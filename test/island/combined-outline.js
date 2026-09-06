const assert = require("node:assert/strict")
const viewModel = require("../../shell/plugins/island/ViewModel.js")

const metrics = {
  screen: { width: 1920, height: 1080 },
  anchor: { x: 835, y: 0, width: 250, height: 26 },
  bar: { position: "top", size: 26 },
  slotWidth: 250,
  compactHeight: 22,
  margin: 8,
  gap: 6
}

const primary = { key: "primary", role: "primary", visible: true, rect: { x: 835, y: 2, width: 176, height: 22, radius: 11 } }
const secondary = { key: "secondary", role: "secondary", visible: true, rect: { x: 1017, y: 2, width: 68, height: 22, radius: 11 } }
const combined = viewModel.combinedActivityOutline([primary, secondary], metrics)
const expected = viewModel.activityOutline({ x: 835, y: 2, width: 250, height: 22, radius: 11 }, metrics)
assert.deepEqual(combined, expected, "the combined outline is the union passed through the existing perimeter builder")
const growing = { ...primary, rect: { x: 756, y: 2, width: 408, height: 184, radius: 28 } }
assert.deepEqual(viewModel.combinedActivityOutline([growing, secondary], metrics), viewModel.activityOutline(growing.rect, metrics),
  "a growing activity owns the shared curvature while the smaller activity stays inside its bounds")

const stable = viewModel.combinedActivityOutline([
  primary,
  { key: "hidden", role: "primary", visible: false, rect: { x: 10, y: 10, width: 700, height: 200, radius: 80 } },
  { key: "empty", role: "primary", visible: true, rect: { x: 10, y: 10, width: 0, height: 22, radius: 11 } }
], metrics)
assert.deepEqual(stable, viewModel.activityOutline(primary.rect, metrics), "invisible and zero-sized bodies do not change the derived outline")
assert.deepEqual(viewModel.combinedActivityOutline([], metrics), viewModel.activityOutline({ x: 0, y: 0, width: 0, height: 0, radius: 0 }, metrics),
  "an empty body set produces the existing empty outline")

const hitBodies = [
  { key: "retiring", role: "retiring", visible: true, rect: { x: 800, y: 0, width: 400, height: 100, radius: 10 } },
  primary,
  secondary,
  { key: "hidden", role: "primary", visible: false, rect: { x: 900, y: 2, width: 100, height: 22, radius: 11 } }
]
assert.equal(viewModel.activityKeyAtPoint(hitBodies, 900, 12), "primary", "an exact primary hit ignores an overlapping retiring body")
assert.equal(viewModel.activityKeyAtPoint(hitBodies, 1050, 12), "secondary", "an exact secondary hit keeps its key")
assert.equal(viewModel.activityKeyAtPoint(hitBodies, 1014, 12), "primary", "a gap hit selects the nearest primary rectangle")
assert.equal(viewModel.activityKeyAtPoint(hitBodies, 1015, 12), "secondary", "a gap hit selects the nearest secondary rectangle")
assert.equal(viewModel.activityKeyAtPoint([], 900, 12), null, "an empty body set has no target key")
assert.equal(viewModel.activityKeyAtPoint(hitBodies, NaN, 12), null, "non-finite points have no target key")

console.log("combined outline projection passed")
