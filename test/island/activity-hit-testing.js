const assert = require("node:assert/strict")
const Hub = require("../../shell/plugins/island/HubModel.js")
const View = require("../../shell/plugins/island/ViewModel.js")
const Motion = require("../../shell/plugins/island/MotionModel.js")

const hub = Hub.initialState()
const pair = { ...hub.schedule, secondary: hub.schedule.byTool.agents }
for (const edge of ["top", "bottom", "left", "right"]) {
  const vertical = edge === "left" || edge === "right"
  const raw = {
    screen: { width: 1920, height: 1080 }, bar: { position: edge, size: 26 },
    anchor: { x: vertical ? (edge === "left" ? 2 : 1896) : 835,
      y: vertical ? 415 : (edge === "top" ? 2 : 1056), width: vertical ? 22 : 250, height: vertical ? 250 : 22 }
  }
  function intent(schedule) {
    const frame = Hub.frameFor(hub, schedule, "monitor", View.screenMetrics(raw), View)
    return View.motionIntentFor(frame, raw)
  }
  const single = intent(hub.schedule)
  let state = Motion.reconcile(Motion.initialState(), single, true)
  assert.equal(Motion.renderFrame(state).split, null)
  state = Motion.reconcile(state, intent(pair), true)
  const { split, bodies } = Motion.renderFrame(state)
  assert.equal(split.vertical, vertical)
  assert.equal(split.bubble.width, 22)
  assert.equal(split.bubble.height, 22)
  const axis = vertical ? "y" : "x"
  const extent = vertical ? "height" : "width"
  const end = split.primary[axis] + split.primary[extent]
  assert.equal(split.bubble[axis] - end, 6)
  const targets = [
    { key: "old", role: "retiring", visible: true, rect: split.primary },
    { key: "hidden", role: "primary", visible: false, rect: split.bubble },
    ...bodies
  ]
  function hit(along) {
    return View.activityKeyAtPoint(targets, vertical ? split.primary.x + 11 : along,
      vertical ? along : split.primary.y + 11)
  }
  assert.equal(hit(end - 11), pair.primary.key)
  assert.equal(hit(end + 2), pair.primary.key)
  assert.equal(hit(end + 4), pair.secondary.key)
  assert.equal(hit(split.bubble[axis] + 11), pair.secondary.key)
  state = Motion.reconcile(state, single, false)
  assert.ok(Motion.renderFrame(state).split.bubble, edge + " retains the departing bubble at merge start")
  state = Motion.reconcile(state, single, true)
  assert.equal(Motion.renderFrame(state).split, null)
}
assert.equal(View.activityKeyAtPoint([], 900, 12), null)
assert.equal(View.activityKeyAtPoint([], NaN, 12), null)
console.log("native split, merge and activity hit testing passed on four edges")
