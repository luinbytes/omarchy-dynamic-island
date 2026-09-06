import QtQuick
import Quickshell.Io
import "AgentModel.js" as AgentModel

Item {
  id: root
  property var shell: null
  property bool observing: false
  property var records: AgentModel.initialState()
  property var herdrRecords: AgentModel.initialState()
  property bool herdrEnumerationReady: false
  property double nowMs: Date.now()
  property string setupMessage: ""
  property bool installingHooks: false
  readonly property bool configuring: hookSetup.running
  readonly property var herdrState: {
    if (!enabled || !shell || !shell.bar || typeof shell.bar.moduleWidgets !== "function") return null
    var widgets = shell.bar.moduleWidgets("io.github.fabean.herdr")
    for (var i = 0; i < widgets.length; i++) {
      var nativeState = widgets[i] ? widgets[i].state : null
      if (nativeState && typeof nativeState === "object") return nativeState
    }
    return null
  }
  readonly property bool herdrOnline: enabled && !!herdrState && herdrState.online === true
  readonly property bool hookSubscribed: enabled && observing
  readonly property var hookSnapshot: AgentModel.snapshot(records, nowMs, enabled && observing)
  readonly property string sourceLabel: hookSubscribed ? "Codex hooks" : herdrOnline ? "Herdr · reported status" : "No live agent source"
  readonly property var snapshot: {
    var source = hookSubscribed ? hookSnapshot : AgentModel.snapshot(herdrRecords, nowMs, herdrOnline, 10000)
    return Object.assign({}, source, { ready: hookSubscribed ? true : herdrEnumerationReady })
  }

  function reconcileHerdr() {
    if (!herdrOnline) {
      herdrRecords = AgentModel.initialState()
      herdrEnumerationReady = false
      nowMs = Date.now()
      return
    }
    if (!herdrState || !Array.isArray(herdrState.agents)) return
    herdrRecords = AgentModel.fromHerdr(herdrRecords, herdrState, Date.now())
    herdrEnumerationReady = true
    nowMs = Date.now()
  }

  onHerdrStateChanged: reconcileHerdr()
  onHerdrOnlineChanged: reconcileHerdr()
  onEnabledChanged: if (!enabled) reconcileHerdr()

  function ingest(json) {
    if (!enabled || !observing || typeof json !== "string" || json.length > 2048) return false
    var event
    try { event = JSON.parse(json) } catch (error) { return false }
    var next = AgentModel.ingest(records, event, Date.now())
    if (next === records) return false
    records = next
    nowMs = Date.now()
    return true
  }

  function setObserving(value) {
    observing = value === true
    if (!observing) records = AgentModel.initialState()
    nowMs = Date.now()
  }

  Component.onCompleted: reconcileHerdr()

  function configureHooks(install) {
    if (hookSetup.running) return
    installingHooks = install === true
    var script = decodeURIComponent(Qt.resolvedUrl("../../../scripts/codex-island-hook.cjs").toString().replace(/^file:\/\//, ""))
    hookSetup.command = ["node", script, install ? "--install" : "--remove"]
    setupMessage = "Updating only Island hooks…"
    hookSetup.running = true
  }

  Process {
    id: hookSetup
    onExited: function(exitCode) {
      root.setupMessage = exitCode === 0 ? (root.installingHooks ? "Installed. Review and trust hooks in Codex /hooks." : "Island hooks removed. Other hooks were preserved.") : "Could not update hooks safely. Existing hooks were preserved."
      if (exitCode === 0 && !root.installingHooks) root.setObserving(false)
    }
  }

  Timer {
    interval: 1000
    repeat: true
    running: root.enabled && (root.records.sessions.length > 0 || root.herdrRecords.sessions.length > 0)
    onTriggered: root.nowMs = Date.now()
  }
}
