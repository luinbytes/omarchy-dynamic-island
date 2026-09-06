import QtQuick
import Quickshell.Io
import "NotificationModel.js" as NotificationModel

Item {
  id: root

  property var shell: null
  readonly property var omapagerService: shell && typeof shell.serviceFor === "function"
    ? shell.serviceFor("njpatel.omapager") : null
  readonly property bool usesOmapager: !!omapagerService
  readonly property string providerId: usesOmapager ? "omapager" : "native"
  readonly property bool omapagerAutomaticDisplayClaimsAvailable: usesOmapager
    && typeof omapagerService.automaticDisplayClaims !== "undefined"
  readonly property var omapagerAutomaticDisplayClaims: omapagerAutomaticDisplayClaimsAvailable
    ? omapagerService.automaticDisplayClaims : []
  readonly property var nativeService: shell && typeof shell.firstPartyServiceFor === "function"
    ? shell.firstPartyServiceFor("omarchy.notifications") : null
  readonly property var popupModel: nativeService && nativeService.popupModel ? nativeService.popupModel : null
  readonly property var omapagerLayout: usesOmapager && omapagerService && omapagerService.layout
    ? omapagerService.layout : null
  readonly property string historyDir: nativeService && typeof nativeService.historyDir === "string"
    ? nativeService.historyDir : ""
  readonly property string omapagerHistoryDir: usesOmapager && omapagerService && typeof omapagerService.home === "string"
    && omapagerService.home.charAt(0) === "/" ? omapagerService.home + "/.local/state/omarchy/omapager/history" : ""
  readonly property bool available: enabled && (usesOmapager
    ? !!omapagerLayout && Array.isArray(omapagerLayout.decks)
    : !!nativeService && !!popupModel && historyDir.charAt(0) === "/")
  readonly property bool dnd: available && (usesOmapager
    ? omapagerService.doNotDisturb === true || Number(omapagerService.globalSnoozeUntil) > Date.now() / 1000
    : nativeService.doNotDisturb === true)

  property var _liveEntries: []
  property var _historyEntries: []
  property var _actionRows: ({})
  property var _semanticFingerprints: ({})
  property var _semanticEventTimes: ({})
  property double _nowMs: Date.now()
  property string _liveError: ""
  property bool _liveReady: false
  property string _historyError: ""
  property bool _refreshHistoryAfterPopupSync: false
  property bool _componentReady: false
  property bool _initialHistoryRequested: false

  property int _historyGeneration: 0
  property var _activeHistoryRequest: null
  property var _pendingHistoryRequest: null
  property string _historyOutput: ""
  property bool _historyStreamFinished: false
  property bool _historyExited: false
  property int _historyExitCode: -1
  property bool _historyProcessQuarantined: false

  readonly property int liveCount: _liveEntries.length
  readonly property int historyCount: _historyEntries.length
  readonly property var _preview: available
    ? NotificationModel.preview(_liveEntries, _semanticEventTimes, _nowMs, dnd, NotificationModel.PREVIEW_MS)
    : null
  readonly property double _previewWakeAt: {
    var value = available
      ? NotificationModel.previewWakeAt(_liveEntries, _semanticEventTimes, _nowMs, dnd, NotificationModel.PREVIEW_MS)
      : null
    return value === null ? 0 : value
  }
  readonly property double previewUntil: _previewWakeAt
  readonly property var snapshot: ({
    backend: providerId,
    available: available,
    ready: _liveReady,
    dnd: dnd,
    preview: _preview,
    entries: NotificationModel.mergeEntries(_liveEntries, _historyEntries, NotificationModel.MAX_ENTRIES),
    error: _liveError || _historyError || (!enabled ? "" : (!available ? "Notification service unavailable" : ""))
  })

  function nextHistoryGeneration() {
    _historyGeneration = _historyGeneration >= 2147483646 ? 1 : _historyGeneration + 1
    return _historyGeneration
  }

  function historyLimit() {
    if (providerId === "omapager") return NotificationModel.MAX_ENTRIES
    var value = nativeService ? Number(nativeService.historyLimit) : NotificationModel.MAX_ENTRIES
    if (!isFinite(value) || Math.floor(value) !== value) return NotificationModel.MAX_ENTRIES
    return Math.max(1, Math.min(NotificationModel.MAX_ENTRIES, value))
  }

  function historySource() {
    return providerId === "omapager"
      ? { provider: "omapager", directory: omapagerHistoryDir }
      : { provider: "native", directory: historyDir }
  }

  function historySourceMatches(request) {
    var source = historySource()
    return !!request && request.provider === source.provider
      && request.directory === source.directory
  }

  function schedulePopupSync(refreshHistory) {
    if (!_componentReady || !enabled) {
      _refreshHistoryAfterPopupSync = false
      return
    }
    if (refreshHistory === true && providerId === "native") _refreshHistoryAfterPopupSync = true
    popupSyncTimer.restart()
  }

  function clearLive(errorText) {
    _liveEntries = []
    _actionRows = ({})
    _semanticFingerprints = ({})
    _semanticEventTimes = ({})
    _liveReady = false
    _nowMs = Date.now()
    _liveError = errorText
  }

  function resetProvider() {
    nextHistoryGeneration()
    _pendingHistoryRequest = null
    _historyEntries = []
    _historyError = ""
    _historyProcessQuarantined = false
    _initialHistoryRequested = false
    _refreshHistoryAfterPopupSync = false
    clearLive("")
    if (historyProcess.running) historyProcess.running = false
  }

  function applyLiveEntries(entries, actionRows) {
    var removed = _liveEntries.some(function(previous) {
      return !entries.some(function(current) { return current.key === previous.key })
    })
    var events = NotificationModel.updateSemanticEvents(
      _semanticFingerprints, _semanticEventTimes, entries, Date.now())
    _liveEntries = entries
    _actionRows = actionRows
    _semanticFingerprints = events.fingerprints
    _semanticEventTimes = events.eventTimes
    _nowMs = Date.now()
    _liveReady = true
    _liveError = ""
    requestInitialHistory()
    if (usesOmapager && removed) historyRefreshTimer.restart()
  }

  function syncNativePopups() {
    var entries = []
    try {
      var count = Math.min(NotificationModel.MAX_ENTRIES, Number(popupModel.count) || 0)
      for (var index = 0; index < count; index++) {
        var row = popupModel.get(index)
        if (Number(row.originalId) === -1) continue
        var entry = NotificationModel.normalizeEntry(row, true)
        if (!entry) throw new Error("invalid popup row")
        entries.push(entry)
      }
    } catch (error) {
      clearLive("Native notification rows could not be read")
      return false
    }
    applyLiveEntries(entries, ({}))
    return true
  }

  function omapagerRows() {
    var result = { entries: [], actions: ({}) }
    var seen = ({})
    var decks = omapagerLayout && Array.isArray(omapagerLayout.decks) ? omapagerLayout.decks : null
    if (!decks) throw new Error("invalid Omapager layout")
    for (var deckIndex = 0; deckIndex < decks.length && result.entries.length < NotificationModel.MAX_ENTRIES; deckIndex++) {
      var deck = decks[deckIndex]
      if (!deck || !Array.isArray(deck.rows)) throw new Error("invalid Omapager deck")
      for (var rowIndex = 0; rowIndex < deck.rows.length && result.entries.length < NotificationModel.MAX_ENTRIES; rowIndex++) {
        var entry = NotificationModel.normalizeOmapagerEntry(deck.rows[rowIndex], true)
        if (!entry) throw new Error("invalid Omapager row")
        if (seen[entry.key]) continue
        seen[entry.key] = true
        result.entries.push(entry)
        if (entry.live && entry.providerKey) result.actions[entry.key] = entry.providerKey
      }
    }
    return result
  }

  function syncOmapagerRows() {
    var rows
    try {
      rows = omapagerRows()
    } catch (error) {
      clearLive("Omapager notification rows could not be read")
      return false
    }
    applyLiveEntries(rows.entries, rows.actions)
    return true
  }

  function syncPopups() {
    if (!enabled) {
      clearLive("")
      return false
    }
    if (!available) {
      clearLive("Notification service unavailable")
      return false
    }
    return providerId === "omapager" ? syncOmapagerRows() : syncNativePopups()
  }

  function refreshHistory() {
    if (!enabled) return false
    if (_historyProcessQuarantined) {
      _historyError = "Notification history helper is unavailable"
      return false
    }
    if (!available) {
      _historyError = "Notification history is unavailable"
      return false
    }
    var source = historySource()
    if (source.directory.charAt(0) !== "/") {
      _historyError = "Notification history is unavailable"
      return false
    }
    var request = {
      generation: nextHistoryGeneration(),
      provider: source.provider,
      directory: source.directory,
      limit: historyLimit()
    }
    if (historyProcess.running || _activeHistoryRequest) {
      _pendingHistoryRequest = request
      return true
    }
    startHistoryRequest(request)
    return true
  }

  function requestInitialHistory() {
    if (!_componentReady || !enabled || !available || _initialHistoryRequested) return false
    _initialHistoryRequested = true
    historyRefreshTimer.restart()
    return true
  }

  function startHistoryRequest(request) {
    _activeHistoryRequest = request
    _historyOutput = ""
    _historyStreamFinished = false
    _historyExited = false
    _historyExitCode = -1
    var script = decodeURIComponent(Qt.resolvedUrl("../../../scripts/island-notification-history.cjs")
      .toString().replace(/^file:\/\//, ""))
    historyProcess.command = ["node", script, "--dir", request.directory,
      "--format", request.provider, "--limit", String(request.limit), "--max-bytes", "65536"]
    historyProcess.running = true
    historyWatchdog.restart()
  }

  function startPendingHistoryIfIdle() {
    if (historyProcess.running || _activeHistoryRequest || !_pendingHistoryRequest) return
    var pending = _pendingHistoryRequest
    _pendingHistoryRequest = null
    startHistoryRequest(pending)
  }

  function completeHistoryIfReady() {
    if (!_historyStreamFinished || !_historyExited || !_activeHistoryRequest) return
    historyWatchdog.stop()
    var request = _activeHistoryRequest
    if (request.generation === _historyGeneration && request.provider === providerId && historySourceMatches(request)) {
      if (_historyExitCode !== 0) {
        _historyError = "Notification history could not be read"
      } else {
        var parsed = request.provider === "omapager"
          ? NotificationModel.parseOmapagerHistoryOutput(_historyOutput)
          : NotificationModel.parseHistoryOutput(_historyOutput)
        if (parsed.ok) {
          _historyEntries = parsed.entries
          _historyError = ""
        } else {
          _historyError = parsed.error
        }
      }
    }
    _activeHistoryRequest = null
    Qt.callLater(root.startPendingHistoryIfIdle)
  }

  function markHistoryStreamFinished() {
    _historyStreamFinished = true
    completeHistoryIfReady()
  }

  function markHistoryExited(exitCode) {
    _historyExitCode = exitCode
    _historyExited = true
    completeHistoryIfReady()
    Qt.callLater(root.startPendingHistoryIfIdle)
  }

  function timeOutHistoryRequest() {
    if (!_activeHistoryRequest) return
    nextHistoryGeneration()
    _pendingHistoryRequest = null
    _activeHistoryRequest = null
    _historyProcessQuarantined = true
    _historyError = "Notification history helper timed out"
    if (historyProcess.running) historyProcess.running = false
  }

  function popupIndex(key) {
    if (!available || providerId !== "native" || typeof key !== "string") return -1
    try {
      for (var index = 0; index < popupModel.count; index++) {
        var row = popupModel.get(index)
        var rowKey = NotificationModel.identityKey(Number(row.timestamp), Number(row.originalId))
        if (rowKey === key) return index
      }
    } catch (error) {
      return -1
    }
    return -1
  }

  function omapagerActionKey(key) {
    if (!available || providerId !== "omapager" || typeof key !== "string") return ""
    var expected = _actionRows[key]
    if (typeof expected !== "string" || !expected) return ""
    try {
      var rows = omapagerRows()
      _actionRows = rows.actions
      return rows.actions[key] === expected ? expected : ""
    } catch (error) {
      return ""
    }
  }

  function invoke(key) {
    if (providerId === "omapager") {
      if (!omapagerService || typeof omapagerService.activate !== "function") return false
      var providerKey = omapagerActionKey(key)
      if (!providerKey) return false
      omapagerService.activate(providerKey)
      schedulePopupSync(false)
      return true
    }
    if (!available || typeof nativeService.invokePopupDefault !== "function") return false
    var index = popupIndex(key)
    if (index < 0) return false
    nativeService.invokePopupDefault(index)
    schedulePopupSync(true)
    return true
  }

  function dismiss(key) {
    if (providerId === "omapager") {
      if (!omapagerService || typeof omapagerService.closeToast !== "function") return false
      var providerKey = omapagerActionKey(key)
      if (!providerKey) return false
      omapagerService.closeToast(providerKey, "dismissed")
      schedulePopupSync(false)
      return true
    }
    if (!available || typeof nativeService.dismissPopup !== "function") return false
    var index = popupIndex(key)
    if (index < 0) return false
    nativeService.dismissPopup(index)
    schedulePopupSync(true)
    return true
  }

  onProviderIdChanged: {
    resetProvider()
    schedulePopupSync(false)
  }
  onNativeServiceChanged: if (providerId === "native") {
    resetProvider()
    schedulePopupSync(false)
  }
  onPopupModelChanged: if (providerId === "native") schedulePopupSync(false)
  onOmapagerServiceChanged: if (providerId === "omapager") {
    resetProvider()
    schedulePopupSync(false)
  }
  onOmapagerLayoutChanged: if (providerId === "omapager") schedulePopupSync(false)
  onAvailableChanged: requestInitialHistory()
  onDndChanged: {
    _nowMs = Date.now()
    if (_previewWakeAt > _nowMs) previewTimer.restart()
  }
  onEnabledChanged: {
    if (!_componentReady) {
      if (!enabled) clearLive("")
      return
    }
    if (enabled) {
      resetProvider()
      schedulePopupSync(false)
      requestInitialHistory()
      return
    }
    popupSyncTimer.stop()
    historyRefreshTimer.stop()
    historyWatchdog.stop()
    _refreshHistoryAfterPopupSync = false
    _initialHistoryRequested = false
    _pendingHistoryRequest = null
    nextHistoryGeneration()
    _activeHistoryRequest = null
    if (historyProcess.running) historyProcess.running = false
    _historyEntries = []
    _historyError = ""
    clearLive("")
  }

  Connections {
    target: root.popupModel
    enabled: root.enabled && root.providerId === "native"
    ignoreUnknownSignals: true
    function onCountChanged() { root.schedulePopupSync(true) }
    function onDataChanged() { root.schedulePopupSync(true) }
    function onRowsInserted() { root.schedulePopupSync(true) }
    function onRowsRemoved() { root.schedulePopupSync(true) }
    function onModelReset() { root.schedulePopupSync(true) }
  }

  Connections {
    target: root.omapagerService
    enabled: root.enabled && root.providerId === "omapager"
    ignoreUnknownSignals: true
    function onLayoutRevisionChanged() { root.schedulePopupSync(false) }
  }

  Timer {
    id: popupSyncTimer
    interval: 0
    repeat: false
    onTriggered: {
      var refresh = root._refreshHistoryAfterPopupSync
      root._refreshHistoryAfterPopupSync = false
      root.syncPopups()
      if (refresh && root.available && root.providerId === "native") historyRefreshTimer.restart()
    }
  }

  Timer {
    id: historyRefreshTimer
    interval: 600
    repeat: false
    onTriggered: root.refreshHistory()
  }

  Timer {
    id: historyWatchdog
    interval: 5000
    repeat: false
    onTriggered: root.timeOutHistoryRequest()
  }

  Timer {
    id: previewTimer
    interval: root._previewWakeAt > 0 ? root.wakeInterval(root._previewWakeAt) : 1
    repeat: false
    running: root.enabled && root._previewWakeAt > 0
    onTriggered: {
      root._nowMs = Date.now()
      if (root._previewWakeAt > root._nowMs) restart()
    }
  }

  Process {
    id: historyProcess
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        root._historyOutput = String(text || "")
        root.markHistoryStreamFinished()
      }
    }
    stderr: StdioCollector { waitForEnd: true }
    onExited: function(exitCode) { root.markHistoryExited(exitCode) }
  }

  function wakeInterval(wakeAt) {
    var delta = Number(wakeAt) - Date.now()
    if (!isFinite(delta) || delta <= 0) return 1
    return Math.min(2147483647, Math.max(1, Math.floor(delta)))
  }

  Component.onCompleted: {
    _componentReady = true
    resetProvider()
    schedulePopupSync(false)
    requestInitialHistory()
  }
}
