const assert = require("node:assert/strict")
const Peek = require("../../shell/plugins/island/PeekModel.js")

const screens = ["DP-1", "HDMI-A-1"]
const sources = label => ({ notifications: { available: true, backend: "qa", entries: label
  ? [{ key: "qa", live: true, app: "QA", summary: label, urgency: "normal" }] : [] } })
const step = (state, label, nowMs, targets = screens, extra = {}) => Peek.reconcile(state, sources(label),
  { nowMs, targetScreens: targets, ...extra }).state

let state = step(Peek.initialState(), "", 0)
state = step(state, "A", 100)
const pendingBoth = state
state = step(state, "A", 200, ["HDMI-A-1"])
assert.deepEqual(state.pending.targetScreens, ["HDMI-A-1"], "a lost monitor abandons its pending peek")
state = step(state, "A", 350)
assert.deepEqual(state.active.targetScreens, ["HDMI-A-1"], "restoring the monitor does not replay an abandoned pending peek")
state = step(pendingBoth, "A", 350)
const activeBoth = state
state = step(state, "A", 400, ["HDMI-A-1"])
assert.deepEqual(state.active.targetScreens, ["HDMI-A-1"], "fullscreen abandons only that monitor's active peek")
state = step(state, "A", 500)
assert.deepEqual(state.active.targetScreens, ["HDMI-A-1"], "fullscreen exit does not resurrect a prior active recipient")

state = step(activeBoth, "B", 5300)
assert.equal(state.pending.coalesceUntil, 5550)
state = step(state, "B", 5350)
assert.equal(state.active.candidate.summary.value, "A", "a queued replacement prevents close-then-reopen geometry")
assert.equal(state.active.expiresAt, 5550, "the display handoff extends only through pending coalescing")
const bridged = state
state = step(state, "B", 5550)
assert.equal(state.active.candidate.summary.value, "B", "the queued event directly takes the retained peek")
assert.equal(state.pending, null)
assert.equal(step(bridged, "B", 5400, screens, { dnd: true }).active, null,
  "DND cancels the retained display immediately")
assert.equal(step(bridged, "B", 5400, []).active, null,
  "losing every presenter cancels the retained display immediately")
state = step(activeBoth, "B", 5350)
assert.equal(state.active.candidate.summary.value, "A", "an event on the expiry sample also preserves visual ownership")
assert.equal(state.active.expiresAt, 5600)
assert.equal(step(activeBoth, "A", 5350).active, null, "ordinary expiry without pending work is unchanged")
assert.equal(step(activeBoth, "B", 8000).active, null, "a delayed snapshot never resurrects an old expired peek")

console.log("peek lifecycle ordering passed")
