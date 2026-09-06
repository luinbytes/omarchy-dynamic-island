const assert = require("node:assert/strict")
const MotionModel = require("../../shell/plugins/island/MotionModel.js")
const ViewModel = require("../../shell/plugins/island/ViewModel.js")

const bounds = { width: 1920, height: 1080 }

function rect(width, height) {
  return { x: 960 - width / 2, y: 2, width, height, radius: Math.min(24, width / 2, height / 2) }
}

function closedIntent(key, width) {
  const target = rect(width, 68)
  return {
    edge: "top",
    bounds,
    capsule: { mode: "peek", profile: "expansion", rect: target },
    peek: {
      key,
      content: { key, label: key, value: "Status" },
      placement: "closed",
      rect: target,
      size: { width, height: 68 }
    }
  }
}

function belowIntent(key, width) {
  const main = { x: 807, y: 2, width: 306, height: 228, radius: 28 }
  return {
    edge: "top",
    bounds,
    capsule: { mode: "expanded", profile: "expansion", rect: main },
    peek: {
      key,
      content: { key, label: key, value: "Status" },
      placement: "below",
      rect: { x: 960 - width / 2, y: 236, width, height: 68, radius: 24 },
      size: { width, height: 68 }
    }
  }
}

function tick(state, seconds, count) {
  let next = state
  for (let index = 0; index < count; index++) next = MotionModel.advance(next, seconds / count)
  return next
}

let state = MotionModel.reconcile(MotionModel.initialState(), closedIntent("peek:first", 132), true)
let visual = MotionModel.renderFrame(state)
assert.equal(Math.round(visual.peek.rect.width), 132, "closed peek keeps its measured content width")
assert.equal(Math.round(visual.peek.rect.height), 68, "closed peek keeps the fixed shallow height")

state = MotionModel.reconcile(state, closedIntent("peek:second", 244), false)
visual = MotionModel.renderFrame(state)
assert.equal(visual.peek.contentKey, "peek:first", "outgoing text retains the outgoing measured rect")
assert.equal(Math.round(visual.peek.rect.width), 132, "new closed width waits for keyed content handoff")
state = tick(state, 0.4, 48)
visual = MotionModel.renderFrame(state)
assert.equal(visual.peek.contentKey, "peek:second", "incoming text commits with its matching size")
state = tick(state, 1, 120)
visual = MotionModel.renderFrame(state)
assert.equal(Math.round(visual.peek.rect.width), 244, "closed capsule settles at the incoming measured width")

state = MotionModel.reconcile(MotionModel.initialState(), belowIntent("peek:below", 146), true)
visual = MotionModel.renderFrame(state)
assert.equal(Math.round(visual.peek.rect.width), 146, "attached peek keeps its measured width")
assert.equal(Math.round(visual.peek.rect.x + visual.peek.rect.width / 2), 960, "attached peek centers on the main card axis")
assert.equal(Math.round(visual.peek.rect.y), 236, "attached peek retains the independent gap")

state = MotionModel.reconcile(state, belowIntent("peek:below", 226), false)
visual = MotionModel.renderFrame(state)
assert.equal(Math.round(visual.peek.rect.width), 146, "same-key width retarget begins from the sampled attached size")
state = tick(state, 1, 120)
visual = MotionModel.renderFrame(state)
assert.equal(Math.round(visual.peek.rect.width), 226, "attached width settles through the existing frame clock")
assert.equal(Math.round(visual.peek.rect.x + visual.peek.rect.width / 2), 960, "attached width remains centered while it changes")

function metrics(edge, width) {
  const screenWidth = width || 1920
  const screenHeight = 1080
  return {
    screen: { width: screenWidth, height: screenHeight },
    anchor: edge === "top" ? { x: 835, y: 0, width: 250, height: 26 }
      : edge === "bottom" ? { x: 835, y: screenHeight - 26, width: 250, height: 26 }
        : edge === "left" ? { x: 0, y: 415, width: 26, height: 250 }
          : { x: screenWidth - 26, y: 415, width: 26, height: 250 },
    bar: { position: edge, size: 26 },
    slotWidth: 250,
    compactHeight: 22,
    margin: 8,
    gap: 6
  }
}

for (const edge of ["top", "bottom", "left", "right"]) {
  for (const [tool, width] of [["notifications", 132], ["agents", 168], ["music", 214], ["system", 244], ["codex", 286]]) {
    const raw = metrics(edge)
    const active = {
      targetScreens: ["DP-1"],
      candidate: {
        id: "peek:" + tool + ":" + edge,
        tool,
        entityKey: tool + ":entity",
        summary: { icon: tool, label: tool, value: "Status" }
      }
    }
    raw.peekMeasurement = { key: active.candidate.id, width, height: 68 }
    const compact = ViewModel.geometryFor("compact", false, ViewModel.screenMetrics(raw), false).card
    const closed = ViewModel.projectPeekFrame({ phase: "compact", geometry: { card: compact } }, active, "DP-1", raw)
    assert.equal(closed.peek.placement, "closed", tool + " creates a closed peek")
    assert.equal(closed.peek.size.width, width, tool + " keeps its measured width")
    assert.equal(closed.peek.size.height, 68, tool + " retains the shared shallow height")
    const main = ViewModel.geometryFor("expanded", false, ViewModel.screenMetrics(raw), false).card
    const below = ViewModel.projectPeekFrame({ phase: "expanded", isOwner: true, geometry: { card: main } }, active, "DP-1", raw)
    assert.equal(below.peek.placement, "below", tool + " creates an independent below-main peek")
    if (edge === "top" || edge === "bottom") {
      assert.equal(below.peek.rect.x + below.peek.rect.width / 2, main.x + main.width / 2,
        tool + " centers below the main horizontal axis")
    } else {
      assert.equal(below.peek.rect.y + below.peek.rect.height / 2, main.y + main.height / 2,
        tool + " centers beside the main vertical axis")
    }
  }
}

const constrained = metrics("top", 320)
const constrainedActive = {
  targetScreens: ["DP-1"],
  candidate: { id: "peek:wide", tool: "notifications", entityKey: "notification:wide", summary: { label: "Wide", value: "Status" } }
}
constrained.peekMeasurement = { key: constrainedActive.candidate.id, width: 900, height: 68 }
const constrainedFrame = ViewModel.projectPeekFrame({ phase: "compact" }, constrainedActive, "DP-1", constrained)
assert.equal(constrainedFrame.peek.size.width, 304, "peek width caps only at the available screen inset")
assert.equal(ViewModel.projectPeekFrame({ phase: "compact" }, constrainedActive, "DP-1", Object.assign({}, constrained, {
  peekMeasurement: { key: "other", width: 900, height: 68 }
})).peek, undefined, "a mismatched measurement key does not use a stale width")

const taperMetrics = metrics("top")
assert.equal(ViewModel.activityOutline({ x: 894, y: 0, width: 132, height: 68, radius: 24 }, taperMetrics).contentSafe, true,
  "a fully exposed closed peek keeps its payload")
assert.equal(ViewModel.activityOutline({ x: 894, y: 2, width: 132, height: 30, radius: 5 }, taperMetrics).contentSafe, false,
  "a closing closed peek suppresses its payload at the rounded tip")
assert.equal(ViewModel.attachedPeekOutline({ x: 894, y: 236, width: 132, height: 68, radius: 24 }, taperMetrics).contentSafe, true,
  "a fully exposed attached peek keeps its payload")
assert.equal(ViewModel.attachedPeekOutline({ x: 894, y: 236, width: 132, height: 10, radius: 5 }, taperMetrics).contentSafe, false,
  "a closing attached peek suppresses its payload at the rounded tip")

function boundaryIntent(edge, capsule, size) {
  return {
    edge,
    bounds: { width: 360, height: 380 },
    capsule: { mode: "expanded", profile: "expansion", rect: capsule },
    peek: {
      key: "peek:boundary:" + edge,
      content: { key: "peek:boundary:" + edge, label: "Boundary", value: "Status" },
      placement: "below",
      rect: { x: 0, y: 0, width: size.width, height: size.height, radius: 24 },
      size
    }
  }
}

const boundaryCases = [
  { edge: "top", capsule: { x: 0, y: 2, width: 306, height: 160, radius: 28 }, size: { width: 340, height: 68 } },
  { edge: "bottom", capsule: { x: 0, y: 218, width: 306, height: 160, radius: 28 }, size: { width: 340, height: 68 } },
  { edge: "left", capsule: { x: 2, y: 0, width: 130, height: 80, radius: 28 }, size: { width: 160, height: 340 } },
  { edge: "right", capsule: { x: 228, y: 0, width: 130, height: 80, radius: 28 }, size: { width: 160, height: 340 } }
]
for (const item of boundaryCases) {
  const boundaryState = MotionModel.reconcile(MotionModel.initialState(), boundaryIntent(item.edge, item.capsule, item.size), true)
  const boundaryPeek = MotionModel.renderFrame(boundaryState).peek
  assert.equal(boundaryPeek.visible, true, item.edge + " retains a legal wide attached peek at an off-center edge")
  assert.ok(boundaryPeek.rect.x >= 0 && boundaryPeek.rect.y >= 0
    && boundaryPeek.rect.x + boundaryPeek.rect.width <= 360 && boundaryPeek.rect.y + boundaryPeek.rect.height <= 380,
  item.edge + " clamps only the cross-axis to the screen")
}

const facingOverflow = [
  { edge: "top", capsule: { x: 0, y: 250, width: 306, height: 80, radius: 28 }, size: { width: 340, height: 68 } },
  { edge: "bottom", capsule: { x: 0, y: 40, width: 306, height: 80, radius: 28 }, size: { width: 340, height: 68 } },
  { edge: "left", capsule: { x: 140, y: 0, width: 130, height: 80, radius: 28 }, size: { width: 160, height: 340 } },
  { edge: "right", capsule: { x: 80, y: 0, width: 130, height: 80, radius: 28 }, size: { width: 160, height: 340 } }
]
for (const item of facingOverflow) {
  const overflowState = MotionModel.reconcile(MotionModel.initialState(), boundaryIntent(item.edge, item.capsule, item.size), true)
  assert.equal(MotionModel.renderFrame(overflowState).peek.visible, false,
    item.edge + " keeps an impossible main-facing attachment suppressed")
}

console.log("peek width motion contract passed")
