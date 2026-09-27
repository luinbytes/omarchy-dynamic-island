import QtQuick
import Quickshell.Services.Mpris
import "MediaProjection.js" as MediaProjection

Item {
  id: root

  property var shell: null
  property var service: null
  property var state: MediaProjection.initialState()
  property bool peekSnapshotReady: false
  property var peekSnapshot: ({ kind: "absent" })
  readonly property var sourcePlayers: Mpris.players ? Mpris.players.values : []
  property string selectedPlayerKey: ""
  readonly property var activePlayer: selectActivePlayer()
  readonly property string publishedKey: state && state.playerKey ? state.playerKey : ""
  readonly property int publishedInstanceEpoch: state && typeof state.instanceEpoch === "number" ? state.instanceEpoch : 0
  readonly property string publishedTrackToken: state && state.trackToken ? state.trackToken : ""
  readonly property bool progressActive: canPollProgress(activePlayer)
  readonly property var peekSourceSnapshot: {
    var snapshot = root.peekSnapshot && root.peekSnapshot.kind === "track" ? root.peekSnapshot : null
    return {
      available: root.enabled === true,
      ready: root.peekSnapshotReady === true,
      entries: snapshot ? [{
        entityKey: JSON.stringify([MediaProjection.SOURCE, MediaProjection.ID]),
        sourceIdentity: snapshot.trackToken,
        title: snapshot.title,
        artist: snapshot.artist || "",
        playing: snapshot.isPlaying === true
      }] : []
    }
  }
  property var observedPlayer: null
  property var publishedPlayer: null
  property int playerInstanceEpoch: 0
  readonly property var players: {
    var list = sourcePlayers || []
    return list.filter(function(player) { return player && (player.trackTitle || player.trackArtist) }).map(function(player) {
      return { key: playerKey(player), label: String(player.identity || player.desktopEntry || "Media player"), playing: player.isPlaying === true }
    })
  }

  function playerKey(player) {
    return player ? String(player.dbusName || player.desktopEntry || player.identity || "") : ""
  }

  function selectActivePlayer() {
    var list = sourcePlayers || []
    var firstWithTrack = null
    var firstPlaying = null
    for (var index = 0; index < list.length; index++) {
      var player = list[index]
      if (!player || !(player.trackTitle || player.trackArtist)) continue
      if (selectedPlayerKey && playerKey(player) === selectedPlayerKey) return player
      if (player.isPlaying === true && !firstPlaying) firstPlaying = player
      if (!firstWithTrack) firstWithTrack = player
    }
    return firstPlaying || firstWithTrack
  }

  function selectPlayer(key) {
    if (!enabled || typeof key !== "string" || key.length > 255) return false
    var player = playerForKey(key)
    if (!player || !(player.trackTitle || player.trackArtist)) return false
    selectedPlayerKey = key
    schedule()
    return true
  }

  function playerForKey(key) {
    if (!key) return null
    var list = sourcePlayers || []
    for (var index = 0; index < list.length; index++) {
      if (list[index] && playerKey(list[index]) === key) return list[index]
    }
    return null
  }

  function control(trackToken, actionId) {
    if (trackToken !== publishedTrackToken || ["previous", "playPause", "next"].indexOf(actionId) < 0) return false
    if (!publishedPlayer || MediaProjection.trackToken(publishedKey, publishedInstanceEpoch, publishedPlayer.uniqueId) !== trackToken) return false
    return runPublishedAction(actionId)
  }

  signal commandRequested(var command)

  function canHandle(player, action) {
    if (!player) return false
    if (action === "previous") return player.canGoPrevious === true
    if (action === "next") return player.canGoNext === true
    if (action === "playPause") return player.canTogglePlaying === true
      || (player.isPlaying === true ? player.canPause === true : player.canPlay === true)
    return false
  }

  function canPollProgress(player) {
    return enabled && state.active === true && !!player
      && player.isPlaying === true && player.positionSupported === true && player.lengthSupported === true
      && typeof player.length === "number" && isFinite(player.length) && player.length > 0
  }

  function observeActivePlayer() {
    if (observedPlayer === activePlayer) return
    observedPlayer = activePlayer
    playerInstanceEpoch += 1
  }

  function snapshotFor(player) {
    if (!enabled || !player || player !== observedPlayer) return { kind: "absent" }
    var key = playerKey(player)
    if (!key) return { kind: "absent" }
    return {
      playerKey: String(key),
      instanceEpoch: playerInstanceEpoch,
      uniqueId: player.uniqueId,
      title: player.trackTitle || "",
      artist: player.trackArtist || "",
      artUrl: player.trackArtUrl || "",
      isPlaying: player.isPlaying === true,
      positionSupported: player.positionSupported === true,
      lengthSupported: player.lengthSupported === true,
      position: player.position,
      length: player.length,
      canSeek: player.canSeek === true,
      canPrevious: canHandle(player, "previous"),
      canPlayPause: canHandle(player, "playPause"),
      canNext: canHandle(player, "next")
    }
  }

  function reconcileNow() {
    if (!enabled) return
    observeActivePlayer()
    var player = activePlayer
    var result = MediaProjection.reconcile(state, snapshotFor(player), Date.now())
    state = result.state
    peekSnapshot = result.snapshot
    peekSnapshotReady = true
    publishedPlayer = state.active === true ? player : null
    if (result.command) commandRequested(result.command)
  }

  function schedule() {
    if (enabled) reconcileTimer.restart()
  }

  function runPublishedAction(actionId) {
    if (!enabled || !publishedKey) return false
    var player = playerForKey(publishedKey)
    if (!player || player !== publishedPlayer || player !== observedPlayer || !canHandle(player, actionId)) return false
    if (actionId === "previous") player.previous()
    else if (actionId === "next") player.next()
    else if (player.isPlaying && player.canPause) player.pause()
    else if (!player.isPlaying && player.canPlay) player.play()
    else player.togglePlaying()
    return true
  }

  function seekPublished(trackToken, positionSeconds) {
    if (!enabled || !publishedKey || !publishedTrackToken || trackToken !== publishedTrackToken
      || typeof positionSeconds !== "number" || !isFinite(positionSeconds)) return false
    var player = playerForKey(publishedKey)
    if (!player || player !== observedPlayer || player !== publishedPlayer
      || MediaProjection.trackToken(publishedKey, publishedInstanceEpoch, player.uniqueId) !== trackToken
      || player.canSeek !== true || player.positionSupported !== true || player.lengthSupported !== true) return false
    var length = Number(player.length)
    if (!isFinite(length) || length <= 0) return false
    player.position = Math.max(0, Math.min(length, positionSeconds))
    return true
  }

  function diagnostic() {
    return {
      enabled: enabled,
      active: state.active === true,
      playerKey: publishedKey,
      trackToken: publishedTrackToken,
      revision: state.revision,
      polling: progressTimer.running,
      sourcePlayerCount: sourcePlayers ? sourcePlayers.length : 0
    }
  }

  onEnabledChanged: {
    if (enabled) schedule()
    else {
      state = MediaProjection.initialState()
      publishedPlayer = null
      peekSnapshot = ({ kind: "absent" })
      peekSnapshotReady = false
    }
  }
  onActivePlayerChanged: {
    observeActivePlayer()
    schedule()
  }
  onSourcePlayersChanged: {
    peekSnapshot = ({ kind: "absent" })
    peekSnapshotReady = false
    schedule()
  }
  onShellChanged: {
    peekSnapshot = ({ kind: "absent" })
    peekSnapshotReady = false
    schedule()
  }
  Component.onCompleted: {
    observeActivePlayer()
    schedule()
  }

  Timer {
    id: reconcileTimer
    interval: 0
    repeat: false
    onTriggered: root.reconcileNow()
  }

  Timer {
    id: progressTimer
    interval: 1000
    repeat: true
    running: root.progressActive
    onTriggered: root.schedule()
  }

  Connections {
    target: root.activePlayer
    ignoreUnknownSignals: true
    function onIsPlayingChanged() { root.schedule() }
    function onPositionSupportedChanged() { root.schedule() }
    function onLengthSupportedChanged() { root.schedule() }
    function onCanGoPreviousChanged() { root.schedule() }
    function onCanGoNextChanged() { root.schedule() }
    function onCanPlayChanged() { root.schedule() }
    function onCanPauseChanged() { root.schedule() }
    function onCanTogglePlayingChanged() { root.schedule() }
    function onCanSeekChanged() { root.schedule() }
    function onUniqueIdChanged() { root.schedule() }
    function onTrackArtUrlChanged() { root.schedule() }
    function onPostTrackChanged() { root.schedule() }
    function onPositionChanged() { root.schedule() }
    function onLengthChanged() { root.schedule() }
  }

  Connections {
    target: root.service
    function onOwnerActionRequested(key, actionId) {
      if (key === JSON.stringify([MediaProjection.SOURCE, MediaProjection.ID])) root.runPublishedAction(actionId)
    }
    function onOwnerSeekRequested(key, trackToken, positionSeconds) {
      if (key === JSON.stringify([MediaProjection.SOURCE, MediaProjection.ID])) root.seekPublished(trackToken, positionSeconds)
    }
  }
}
