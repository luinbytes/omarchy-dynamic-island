const assert = require("node:assert/strict")
const Motion = require("../../shell/plugins/island/MotionModel.js")

const bounds = { width: 1920, height: 1080 }

function compactRect(edge) {
  if (edge === "bottom") return { x: 835, y: 1056, width: 250, height: 22, radius: 11 }
  if (edge === "left") return { x: 2, y: 415, width: 22, height: 250, radius: 11 }
  if (edge === "right") return { x: 1896, y: 415, width: 22, height: 250, radius: 11 }
  return { x: 835, y: 2, width: 250, height: 22, radius: 11 }
}

function closedRect(edge) {
  if (edge === "bottom") return { x: 807, y: 1010, width: 306, height: 68, radius: 24 }
  if (edge === "left") return { x: 2, y: 387, width: 68, height: 306, radius: 24 }
  if (edge === "right") return { x: 1850, y: 387, width: 68, height: 306, radius: 24 }
  return { x: 807, y: 2, width: 306, height: 68, radius: 24 }
}

function content(key) {
  return { key, label: key, value: "value", icon: "bell", peek: true }
}

function body(key, rect) {
  return {
    key,
    revision: 1,
    content: { key, label: key, value: "value", icon: "•" },
    expanded: false,
    role: "primary",
    profile: "compact",
    rect,
    sourceRect: rect,
    sourceCapsuleRect: rect,
    sharedTitle: { owned: false }
  }
}

function compactIntent(edge, key) {
  const rect = compactRect(edge)
  return {
    edge,
    bounds,
    alerting: false,
    capsule: { mode: "primary", profile: "compact", rect },
    primary: body(key, rect),
    secondary: null,
    peek: null
  }
}

function peekIntent(edge, item, reducedMotion = false) {
  const rect = closedRect(edge)
  return {
    edge,
    bounds,
    alerting: false,
    capsule: { mode: "peek", profile: "expansion", rect },
    primary: null,
    secondary: null,
    peek: { content: item, key: item.key, placement: "closed", rect,
      size: { width: rect.width, height: rect.height } },
    reducedMotion
  }
}

function settle(state, seconds = 1 / 120, frames = 600) {
  for (let index = 0; index < frames; index++) state = Motion.advance(state, seconds)
  return state
}

for (const edge of ["top", "bottom", "left", "right"]) {
  let state = Motion.reconcile(Motion.initialState(), compactIntent(edge, "activity"), true)
  state = Motion.reconcile(state, peekIntent(edge, content("peek-a")), false)
  let frame = Motion.renderFrame(state)
  assert.equal(frame.peek.contentKey, "peek-a", edge + " starts with the incoming peek payload")
  assert.equal(frame.peek.contentPhase, "steady", edge + " starts the peek payload centered")
  assert.equal(frame.bodies[0].role, "suspended", edge + " suspends the compact body during closed ownership")
  assert.equal(frame.bodies[0].visible, false, edge + " does not paint a suspended body")
  const retained = frame.bodies[0].rect
  state = settle(state)
  frame = Motion.renderFrame(state)
  assert.equal(frame.bodies[0].role, "suspended", edge + " keeps the compact pose through the full peek")
  assert.ok(frame.bodies[0].rect.width > 0 && frame.bodies[0].rect.height > 0,
    edge + " keeps a nonzero retained pose while the peek owns the capsule")
  assert.deepEqual(frame.bodies[0].rect, retained, edge + " does not shrink the hidden body to zero")
  state = Motion.reconcile(state, compactIntent(edge, "activity"), false)
  frame = Motion.renderFrame(state)
  assert.equal(frame.bodies[0].role, "primary", edge + " restores the retained body role")
  assert.ok(frame.bodies[0].rect.width > 0 && frame.bodies[0].rect.height > 0,
    edge + " restores a nonzero body on the first return sample")
  state = settle(state)
  frame = Motion.renderFrame(state)
  assert.equal(frame.peek.visible, false, edge + " clears the closed peek after return")
  assert.ok(frame.bodies[0].rect.width > 0 && frame.bodies[0].rect.height > 0,
    edge + " keeps a nonzero body after return settles")
}

let state = Motion.reconcile(Motion.initialState(), compactIntent("top", "activity"), true)
state = Motion.reconcile(state, peekIntent("top", content("peek-a")), false)
state = Motion.advance(state, 0.08)
state = Motion.reconcile(state, peekIntent("top", content("peek-b")), false)
const capsuleTransition = JSON.stringify(state.capsule.transition)
let sawExit = false
let sawEnter = false
let sawSettled = false
let exitFrames = 0
let enterFrames = 0
for (let index = 0; index < 600; index++) {
  const frame = Motion.renderFrame(state)
  assert.ok(frame.peek.contentOffset >= -1 && frame.peek.contentOffset <= 1,
    "peek content displacement remains normalized")
  if (frame.peek.contentPhase === "exiting") {
    sawExit = true
    exitFrames++
    assert.equal(frame.peek.contentKey, "peek-a", "A remains the only visible payload during exit")
    assert.equal(frame.peek.content.key, "peek-a", "exit does not expose the pending payload")
  }
  if (frame.peek.contentPhase === "entering") {
    sawEnter = true
    enterFrames++
    assert.equal(frame.peek.contentKey, "peek-b", "B becomes visible only after A exits")
    assert.equal(frame.peek.content.key, "peek-b", "enter renders the swapped payload")
  }
  if (frame.peek.contentPhase === "steady" && frame.peek.contentKey === "peek-b") sawSettled = true
  state = Motion.advance(state, 1 / 120)
}
assert.equal(sawExit, true, "a replaced peek has a serial exit phase")
assert.equal(sawEnter, true, "a replaced peek has a serial enter phase")
assert.equal(sawSettled, true, "a replaced peek settles with the newest payload")
assert.ok(exitFrames > 0 && exitFrames <= 36, "the outgoing payload clears within 300ms")
assert.ok(enterFrames > 0 && enterFrames <= 36, "the incoming payload settles within 300ms")
assert.equal(JSON.stringify(state.capsule.transition), capsuleTransition,
  "content replacement does not restart or resize the capsule geometry")

state = Motion.reconcile(state, peekIntent("top", content("peek-c")), false)
state = Motion.reconcile(state, peekIntent("top", content("peek-d")), false)
state = settle(state)
let frame = Motion.renderFrame(state)
assert.equal(frame.peek.contentKey, "peek-d", "latest replacement wins while an earlier payload is exiting")
assert.equal(frame.peek.content.key, "peek-d", "the renderer never receives the stale replacement")

state = Motion.reconcile(Motion.initialState(), compactIntent("top", "activity"), true)
state = Motion.reconcile(state, peekIntent("top", content("peek-reduced")), true)
frame = Motion.renderFrame(state)
assert.equal(frame.peek.contentPhase, "steady", "reduced motion does not leave a content roll active")
assert.equal(frame.peek.contentOffset, 0, "reduced motion centers the peek payload")
state = Motion.reconcile(state, compactIntent("top", "activity"), true)
frame = Motion.renderFrame(state)
assert.equal(frame.peek.visible, false, "reduced motion clears the expired peek immediately")
assert.equal(frame.bodies[0].role, "primary", "reduced motion restores the compact body directly")

function narrowClosedIntent(item) {
  const rect = { x: 894, y: 2, width: 132, height: 68, radius: 24 }
  return {
    edge: "top",
    bounds,
    alerting: false,
    capsule: { mode: "peek", profile: "expansion", rect },
    primary: null,
    secondary: null,
    peek: { content: item, key: item.key, placement: "closed", rect, size: { width: 132, height: 68 } }
  }
}

function attachedIntent(item) {
  const main = { x: 807, y: 2, width: 306, height: 228, radius: 28 }
  return {
    edge: "top",
    bounds,
    alerting: false,
    capsule: { mode: "expanded", profile: "expansion", rect: main },
    primary: null,
    secondary: null,
    peek: {
      content: item,
      key: item.key,
      placement: "below",
      rect: { x: 894, y: 236, width: 132, height: 68, radius: 24 },
      size: { width: 132, height: 68 }
    }
  }
}

function assertRectContinuous(left, right, message) {
  for (const field of ["x", "y", "width", "height", "radius"]) {
    assert.ok(Math.abs(left[field] - right[field]) < 0.0001, message + " " + field)
  }
}

const retained = content("peek-retained")
let placementState = Motion.reconcile(Motion.initialState(), narrowClosedIntent(retained), true)
let placementFrame = Motion.renderFrame(placementState)
const closedSample = placementFrame.peek.rect
placementState = Motion.reconcile(placementState, attachedIntent(retained), false)
placementFrame = Motion.renderFrame(placementState)
assertRectContinuous(placementFrame.peek.rect, closedSample, "closed-to-attached preserves the first sampled rect")
assert.equal(placementFrame.peek.placement, "below", "placement handoff exposes the sampled independent outline")
assert.equal(placementFrame.peek.contentPhase, "steady", "same-key placement handoff does not create a content roll")
placementState = settle(placementState)
placementFrame = Motion.renderFrame(placementState)
assert.equal(placementFrame.peek.placement, "below", "closed-to-attached completes at the independent below pose")
assert.equal(Math.round(placementFrame.peek.rect.y), 236, "attached completion reaches the derived main-facing gap")
const attachedSample = placementFrame.peek.rect
placementState = Motion.reconcile(placementState, narrowClosedIntent(retained), false)
placementFrame = Motion.renderFrame(placementState)
assertRectContinuous(placementFrame.peek.rect, attachedSample, "attached-to-closed preserves the first sampled rect")
assert.equal(placementFrame.peek.placement, "below", "attached-to-closed retains its sampled independent outline")
placementState = settle(placementState)
placementFrame = Motion.renderFrame(placementState)
assert.equal(placementFrame.peek.placement, "closed", "attached-to-closed completes at the closed pose")
assert.equal(Math.round(placementFrame.peek.rect.y), 2, "closed completion returns to the bar-adjacent capsule")

placementState = Motion.reconcile(placementState, attachedIntent(retained), false)
placementState = Motion.advance(placementState, 0.08)
const interruptedSample = Motion.renderFrame(placementState).peek.rect
placementState = Motion.reconcile(placementState, narrowClosedIntent(retained), false)
placementFrame = Motion.renderFrame(placementState)
assertRectContinuous(placementFrame.peek.rect, interruptedSample, "mid-flight reversal recaptures the rendered placement sample")
placementState = settle(placementState)
assert.equal(Math.round(Motion.renderFrame(placementState).peek.rect.y), 2,
  "mid-flight reversal settles only at the latest closed target")

function placementGeometry(edge) {
  if (edge === "bottom") return {
    closed: { x: 894, y: 1010, width: 132, height: 68, radius: 24 },
    main: { x: 807, y: 850, width: 306, height: 228, radius: 28 },
    attached: { x: 894, y: 776, width: 132, height: 68, radius: 24 }
  }
  if (edge === "left") return {
    closed: { x: 2, y: 474, width: 132, height: 68, radius: 24 },
    main: { x: 2, y: 387, width: 306, height: 306, radius: 28 },
    attached: { x: 314, y: 506, width: 132, height: 68, radius: 24 }
  }
  if (edge === "right") return {
    closed: { x: 1786, y: 474, width: 132, height: 68, radius: 24 },
    main: { x: 1612, y: 387, width: 306, height: 306, radius: 28 },
    attached: { x: 1474, y: 506, width: 132, height: 68, radius: 24 }
  }
  return {
    closed: { x: 894, y: 2, width: 132, height: 68, radius: 24 },
    main: { x: 807, y: 2, width: 306, height: 228, radius: 28 },
    attached: { x: 894, y: 236, width: 132, height: 68, radius: 24 }
  }
}

function placementIntent(edge, item, placement) {
  const geometry = placementGeometry(edge)
  const rect = placement === "below" ? geometry.attached : geometry.closed
  return {
    edge,
    bounds,
    alerting: false,
    capsule: placement === "below"
      ? { mode: "expanded", profile: "expansion", rect: geometry.main }
      : { mode: "peek", profile: "expansion", rect: geometry.closed },
    primary: null,
    secondary: null,
    peek: { content: item, key: item.key, placement, rect, size: { width: 132, height: 68 } }
  }
}

for (const edge of ["top", "bottom", "left", "right"]) {
  const item = content("peek-reveal-" + edge)
  let revealState = Motion.reconcile(Motion.initialState(), placementIntent(edge, item, "closed"), false)
  const closedStart = Motion.renderFrame(revealState).peek.rect
  revealState = Motion.reconcile(revealState, placementIntent(edge, item, "below"), false)
  let revealFrame = Motion.renderFrame(revealState)
  assertRectContinuous(revealFrame.peek.rect, closedStart, edge + " closed-to-below begins from the visible closed rect")
  revealState = Motion.advance(revealState, 0.03)
  const partial = Motion.renderFrame(revealState).peek.rect
  revealState = Motion.reconcile(revealState, placementIntent(edge, item, "closed"), false)
  revealFrame = Motion.renderFrame(revealState)
  assertRectContinuous(revealFrame.peek.rect, partial, edge + " partial below-to-closed preserves the visible clipped rect")
  revealState = settle(revealState)
  assertRectContinuous(Motion.renderFrame(revealState).peek.rect, placementGeometry(edge).closed,
    edge + " partial reversal settles at the closed target")

  revealState = Motion.reconcile(Motion.initialState(), placementIntent(edge, item, "below"), false)
  const hidden = Motion.renderFrame(revealState).peek.rect
  if (edge === "top" || edge === "bottom") assert.equal(hidden.height, 0, edge + " begins with zero attached reveal height")
  else assert.equal(hidden.width, 0, edge + " begins with zero attached reveal width")
  revealState = Motion.reconcile(revealState, placementIntent(edge, item, "closed"), false)
  revealFrame = Motion.renderFrame(revealState)
  assertRectContinuous(revealFrame.peek.rect, hidden, edge + " zero-reveal below-to-closed preserves the hidden rect")
  revealState = settle(revealState)
  assertRectContinuous(Motion.renderFrame(revealState).peek.rect, placementGeometry(edge).closed,
    edge + " zero-reveal reversal settles at the closed target")
}

console.log("peek motion ordering passed")
