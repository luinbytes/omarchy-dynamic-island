const assert = require("node:assert/strict")
const Hub = require("../../shell/plugins/island/HubModel.js")
const Peek = require("../../shell/plugins/island/PeekModel.js")
const Gate = require("../../shell/plugins/island/PresentationGateModel.js")
const View = require("../../shell/plugins/island/ViewModel.js")
const Motion = require("../../shell/plugins/island/MotionModel.js")
const { cases } = require("./event-order-cases.js")

const metrics = { screen: { width: 1920, height: 1080 },
  anchor: { x: 835, y: 2, width: 250, height: 22 }, bar: { position: "top", size: 26 } }

for (const testCase of cases) {
  for (const reduced of [false, true]) {
    let hub = Hub.initialState()
    let peek = Peek.initialState()
    let gate = Gate.initialState()
    let motion = Motion.initialState()
    const step = (sources, nowMs, extra = {}) => {
      const priorSchedule = hub.schedule
      peek = Peek.reconcile(peek, sources, { nowMs, targetScreens: ["DP-1", "HDMI-A-1"], ...extra }).state
      gate = Gate.reconcile(gate, priorSchedule, peek)
      hub = Hub.reconcile(hub, sources, { nowMs }).state
      const schedule = Gate.scheduleFor(gate, hub.schedule, "DP-1")
      const base = Hub.frameFor(hub, schedule, "DP-1", View.screenMetrics(metrics), View)
      const projectedMetrics = peek.active && peek.active.candidate ? Object.assign({}, metrics, {
        peekMeasurement: { key: peek.active.candidate.id, width: 200, height: 68 }
      }) : metrics
      const frame = View.projectPeekFrame(base, peek.active, "DP-1", projectedMetrics)
      motion = Motion.reconcile(motion, View.motionIntentFor(frame, projectedMetrics), reduced)
      return { frame, schedule }
    }
    step(testCase.before, 0)
    for (let i = 0; i < 120; i++) motion = Motion.advance(motion, 1 / 60)
    const original = JSON.parse(JSON.stringify(hub.schedule))
    const prepared = step(testCase.after, 1000)
    assert.equal(peek.pending.candidate.kind, testCase.kind, testCase.name)
    assert.equal(prepared.frame.phase, "compact", testCase.name + " prepares before morphing")
    assert.deepEqual(prepared.schedule, original, testCase.name + " retains complete original compact content")
    for (const deadline of [1050, 1150, 1249]) {
      assert.deepEqual(step(testCase.after, deadline).schedule, original,
        testCase.name + " does not leak an intermediate icon, label or media object")
      motion = Motion.advance(motion, 1 / 60)
    }
    const activated = step(testCase.after, 1250)
    assert.equal(activated.frame.phase, "peek", testCase.name + " reveals the event in the peek first")
    assert.equal(peek.active.candidate.kind, testCase.kind)
    assert.deepEqual(Gate.diagnostic(gate, peek).heldScreens, [])
    for (let i = 0; i < 120; i++) motion = Motion.advance(motion, 1 / 60)
    const returned = step(testCase.after, 1250 + Peek.ACTIVE_MS)
    assert.equal(returned.frame.phase, "compact")
    assert.equal(returned.schedule, hub.schedule, testCase.name + " returns to current domain truth")
    for (let i = 0; i < 120; i++) motion = Motion.advance(motion, 1 / 60)
    const visual = Motion.renderFrame(motion)
    assert.equal(visual.peek.visible, false)
    assert.equal(motion.unsettled, false, testCase.name + " completes its interrupted content and geometry clocks")
  }
}
console.log("event order passed for " + cases.length + " source transitions with animated and reduced motion")
