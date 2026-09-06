pragma ComponentBehavior: Bound

import QtQuick
import Quickshell.Io
import "SystemModel.js" as SystemModel

Item {
  id: root

  enabled: true
  property var modelState: SystemModel.initialState()
  property double nowMs: Date.now()
  property string samplePhase: "idle"
  property int lastSampleGeneration: 0
  property int activeSampleGeneration: 0
  property var activeSampleProcess: null
  property string sampleOutput: ""
  property bool sampleStreamFinished: false
  property bool sampleExited: false
  property int sampleExitCode: -1
  property string sampleCancelError: ""
  readonly property bool sampling: samplePhase !== "idle"
  readonly property var snapshot: SystemModel.snapshot(modelState, nowMs)

  function samplerPath() {
    return decodeURIComponent(Qt.resolvedUrl("../../../scripts/island-system-sample.cjs").toString().replace(/^file:\/\//, ""))
  }

  function startSample() {
    if (!enabled || samplePhase !== "idle") return false
    sampleOutput = ""
    sampleStreamFinished = false
    sampleExited = false
    sampleExitCode = -1
    sampleCancelError = ""
    lastSampleGeneration++
    activeSampleGeneration = lastSampleGeneration
    var process = sampleProcessComponent.createObject(root, { generation: activeSampleGeneration })
    if (!process) {
      activeSampleGeneration = 0
      modelState = SystemModel.failure(modelState, "System sampler could not start")
      return false
    }
    activeSampleProcess = process
    samplePhase = "collecting"
    process.command = ["node", samplerPath()]
    process.running = true
    sampleWatchdog.restart()
    return true
  }

  function markSampleStreamFinished(generation, text) {
    if (generation !== activeSampleGeneration) return
    sampleOutput = String(text || "")
    sampleStreamFinished = true
    completeSampleIfReady()
  }

  function markSampleExited(generation, exitCode) {
    if (generation !== activeSampleGeneration) return
    sampleExitCode = exitCode
    sampleExited = true
    completeSampleIfReady()
  }

  function finishActiveSample() {
    sampleWatchdog.stop()
    sampleDrainWatchdog.stop()
    var process = activeSampleProcess
    activeSampleProcess = null
    activeSampleGeneration = 0
    samplePhase = "idle"
    sampleCancelError = ""
    sampleOutput = ""
    sampleStreamFinished = false
    sampleExited = false
    sampleExitCode = -1
    if (process) process.destroy()
  }

  function completeSampleIfReady() {
    if (samplePhase === "idle" || !sampleStreamFinished || !sampleExited) return
    var cancelled = samplePhase === "cancelling"
    var cancelError = sampleCancelError
    var output = sampleOutput
    var exitCode = sampleExitCode
    finishActiveSample()
    nowMs = Date.now()
    if (cancelled) {
      if (enabled && cancelError) modelState = SystemModel.failure(modelState, cancelError)
      return
    }
    if (exitCode !== 0) {
      modelState = SystemModel.failure(modelState, "System sampler failed")
      return
    }
    if (!output || output.length > 131072) {
      modelState = SystemModel.failure(modelState, "System sampler output is invalid")
      return
    }
    var parsed
    try {
      parsed = JSON.parse(output)
    } catch (error) {
      modelState = SystemModel.failure(modelState, "System sampler returned invalid JSON")
      return
    }
    var result = SystemModel.ingest(modelState, parsed, nowMs)
    modelState = result.state
  }

  function cancelActiveSample(message) {
    if (samplePhase === "idle") return
    samplePhase = "cancelling"
    sampleCancelError = String(message || "")
    sampleWatchdog.stop()
    if (activeSampleProcess && activeSampleProcess.running) activeSampleProcess.running = false
    sampleDrainWatchdog.restart()
    completeSampleIfReady()
  }

  function discardActiveSample() {
    if (samplePhase === "idle") return
    var cancelError = sampleCancelError
    if (activeSampleProcess && activeSampleProcess.running) activeSampleProcess.running = false
    finishActiveSample()
    nowMs = Date.now()
    if (enabled && cancelError) modelState = SystemModel.failure(modelState, cancelError)
  }

  Component {
    id: sampleProcessComponent

    Process {
      id: request
      required property int generation
      stdout: StdioCollector {
        waitForEnd: true
        onStreamFinished: root.markSampleStreamFinished(request.generation, text)
      }
      onExited: function(exitCode) { root.markSampleExited(request.generation, exitCode) }
    }
  }

  Timer {
    id: sampleTimer
    interval: 3000
    repeat: true
    running: root.enabled
    onTriggered: root.startSample()
  }

  Timer {
    id: freshnessTimer
    interval: 1000
    repeat: true
    running: root.enabled
    onTriggered: root.nowMs = Date.now()
  }

  Timer {
    id: sampleWatchdog
    interval: 2500
    repeat: false
    onTriggered: root.cancelActiveSample("System sampler timed out")
  }

  Timer {
    id: sampleDrainWatchdog
    interval: 1000
    repeat: false
    onTriggered: root.discardActiveSample()
  }

  onEnabledChanged: {
    nowMs = Date.now()
    if (enabled) return
    modelState = SystemModel.initialState()
    root.cancelActiveSample("")
  }

  Component.onCompleted: if (root.enabled) root.startSample()
  Component.onDestruction: {
    sampleWatchdog.stop()
    sampleDrainWatchdog.stop()
    if (activeSampleProcess) {
      activeSampleProcess.running = false
      activeSampleProcess.destroy()
      activeSampleProcess = null
    }
  }
}
