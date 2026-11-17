import QtQuick
import Quickshell.Io

Item {
  id: root
  required property string mode
  required property string directory
  property var snapshot: ({available: false, active: [], recent: [], live: [], history: []})
  function start() {
    if (enabled && directory && !worker.running) worker.running = true
  }
  Component.onCompleted: start()
  onEnabledChanged: if (enabled) start(); else worker.running = false
  Process {
    id: worker
    command: ["node", decodeURIComponent(Qt.resolvedUrl("../../../scripts/island-desktop-state.cjs").toString().replace(/^file:\/\//, "")), root.mode, root.directory]
    stdout: SplitParser {
      onRead: data => { try { root.snapshot = JSON.parse(data) } catch (_) {} }
    }
    onExited: if (root.enabled) retry.restart()
  }
  Timer { id: retry; interval: 5000; onTriggered: root.start() }
}
