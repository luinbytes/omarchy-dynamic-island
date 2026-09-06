import QtQuick
import "MediaProjection.js" as MediaProjection

Item {
  id: root

  property var shell: null
  property var service: null
  property var state: MediaProjection.initialState()
  property bool peekSnapshotReady: false
  property var peekSnapshot: ({ kind: "absent" })
  readonly property var media: shell && typeof shell.firstPartyServiceFor === "function"
    ? shell.firstPartyServiceFor("omarchy.media") : null
  property string selectedPlayerKey: ""
  readonly property var activePlayer: media && selectedPlayerKey && typeof media.playerForKey === "function" && media.players
    ? media.playerForKey(selectedPlayerKey) || media.activePlayer : media && media.activePlayer ? media.activePlayer : null
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
    var list = media && media.sourcePlayers ? media.sourcePlayers : []
    return list.map(function(player) {
      return { key: String(media.playerKey(player)), label: String(player.identity || player.desktopEntry || "Media player"), playing: player.isPlaying === true }
    })
  }

  function selectPlayer(key) {
    if (!enabled || !media || typeof key !== "string" || key.length > 255 || typeof media.selectPlayer !== "function") return false
    if (media.selectPlayer(key) !== true) return false
    selectedPlayerKey = key
    schedule()
    return true
  }

  function control(trackToken, actionId) {
    if (trackToken !== publishedTrackToken || ["previous", "playPause", "next"].indexOf(actionId) < 0) return false
    if (!publishedPlayer || MediaProjection.trackToken(publishedKey, publishedInstanceEpoch, publishedPlayer.uniqueId) !== trackToken) return false
    return runPublishedAction(actionId)
  }

  signal commandRequested(var command)

  function canHandle(player, action) {
    return !!media && !!player && typeof media.canHandleAction === "function" && media.canHandleAction(player, action) === true
  }

  function canPollProgress(player) {
    return enabled && state.active === true && !!media && media.hasMedia === true && !!player
      && player.isPlaying === true && player.positionSupported === true && player.lengthSupported === true
      && typeof player.length === "number" && isFinite(player.length) && player.length > 0
  }

  function observeActivePlayer() {
    if (observedPlayer === activePlayer) return
    observedPlayer = activePlayer
    playerInstanceEpoch += 1
  }

  function snapshotFor(player) {
    if (!enabled || !media || !player || player !== observedPlayer || media.hasMedia !== true || typeof media.playerKey !== "function") return { kind: "absent" }
    var key = media.playerKey(player)
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
    if (!enabled || !media || !publishedKey || typeof media.playerForKey !== "function" || typeof media.runAction !== "function") return false
    var player = media.playerForKey(publishedKey)
    if (!player || player !== publishedPlayer || player !== observedPlayer || !canHandle(player, actionId)) return false
    return media.runAction(actionId, false, publishedKey) === true
  }

  function seekPublished(trackToken, positionSeconds) {
    if (!enabled || !media || !publishedKey || !publishedTrackToken || trackToken !== publishedTrackToken
      || typeof media.playerForKey !== "function" || typeof positionSeconds !== "number" || !isFinite(positionSeconds)) return false
    var player = media.playerForKey(publishedKey)
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
      polling: progressTimer.running
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
  onMediaChanged: {
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
    target: root.media
    ignoreUnknownSignals: true
    function onActivePlayerChanged() { root.schedule() }
    function onHasMediaChanged() { root.schedule() }
    function onTitleChanged() { root.schedule() }
    function onArtistChanged() { root.schedule() }
    function onAlbumChanged() { root.schedule() }
    function onIdentityChanged() { root.schedule() }
    function onArtUrlChanged() { root.schedule() }
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
