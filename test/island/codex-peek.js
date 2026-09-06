const assert = require('node:assert/strict')
const Peek = require('../../shell/plugins/island/PeekModel.js')
const Codex = require('../../shell/plugins/island/CodexModel.js')

function sample(remaining, epoch = 1000, extras = {}) {
  return Codex.normalize({ available: true, remaining, weekly_reset_at: epoch, ...extras }, true)
}
function run(state, codex, now, context = {}) {
  return Peek.reconcile(state, { codex }, { nowMs: now, targetScreens: ['DP-1'], ...context }).state
}
function baseline(remaining, epoch = 1000, extras = {}) {
  const state = run(Peek.initialState(), sample(remaining, epoch, extras), 0)
  assert.equal(state.pending, null)
  return state
}
function candidate(remaining, next, epoch = 1000) {
  return run(baseline(remaining, epoch), sample(next, epoch), 100).pending?.candidate
}

assert.equal(candidate(80, 71), undefined)
assert.equal(candidate(80, 70).kind, 'codex-drop')
let state = baseline(80)
for (let remaining = 79; remaining > 70; remaining--) {
  state = run(state, sample(remaining), 80 - remaining)
  assert.equal(state.pending, null)
}
state = run(state, sample(70), 100)
assert.equal(state.pending.candidate.kind, 'codex-drop')
assert.equal(state.pending.candidate.tool, 'codex')
assert.equal(state.pending.candidate.entityKey, 'hub:codex')
assert.equal(state.sources.codex.weekly.dropAnchor, 70)
const sequence = state.sequence
state = run(state, sample(70), 350)
assert.equal(state.active.candidate.source, 'codex')
assert.equal(state.active.expiresAt, 5350)
assert.equal(state.sequence, sequence)
state = run(state, sample(70), 5350)
assert.equal(state.active, null)
assert.equal(state.pending, null)

for (const threshold of [25, 10, 5]) {
  assert.equal(candidate(threshold + 1, threshold), undefined)
  const event = candidate(threshold + 1, threshold - 1)
  assert.equal(event.kind, 'codex-low')
  assert.match(event.summary.value, new RegExp(`below ${threshold}%`))
  state = run(baseline(threshold + 1), sample(threshold - 1), 100)
  const count = state.sequence
  state = run(state, sample(threshold + 1), 6000)
  state = run(state, sample(threshold - 1), 6100)
  assert.equal(state.sequence, count, 'corrections do not rearm a low threshold')
}
state = run(baseline(80), sample(4), 100)
assert.match(state.pending.candidate.summary.value, /below 5%/)
assert.equal(state.sources.codex.weekly.dropAnchor, 10)
assert.equal(state.sources.codex.weekly.lowestThreshold, 5)
assert.equal(state.sequence, 1)
state = run(state, sample(4), 6000)
assert.equal(state.pending, null, 'big drops do not queue crossed checkpoints')

state = run(baseline(26), sample(24), 100)
assert.equal(state.sources.codex.weekly.dropAnchor, 26, 'a low warning does not discard the ten-point checkpoint')
state = run(state, sample(16), 6000)
assert.equal(state.pending.candidate.kind, 'codex-drop')

state = run(baseline(4), sample(100, 2000), 100)
assert.equal(state.pending.candidate.kind, 'codex-reset')
assert.equal(state.sources.codex.weekly.lowestThreshold, null)
assert.equal(state.sources.codex.weekly.dropAnchor, 100)
state = run(state, sample(24, 2000), 6000)
assert.match(state.pending.candidate.summary.value, /below 25%/)
const stable = state.sources.codex.weekly
state = run(state, sample(90, 1000), 12000)
assert.deepEqual(state.sources.codex.weekly, stable, 'an older epoch cannot rewind the window')
assert.equal(state.pending, null)
assert.equal(run(baseline(40), sample(45), 100).pending, null, 'an upward correction is not a reset')
assert.equal(run(baseline(40, null), sample(100, null), 100).pending, null, 'a refill without an epoch does not prove a reset')

for (const bad of [null, NaN, '10', undefined]) {
  state = run(baseline(50), { available: true, remaining: bad }, 100)
  assert.equal(state.sources.codex.weekly, null)
  state = run(state, sample(4), 200)
  assert.equal(state.pending, null, 'returning data rebaselines silently')
}
state = run(baseline(50), { available: false, remaining: 4 }, 100)
state = run(state, sample(4, 2000), 200)
assert.equal(state.pending, null)
assert.equal(run(Peek.initialState(), sample(4), 100).pending, null)

state = baseline(80, 1000, { session_used: 20, session_reset_at: 500 })
state = run(state, sample(80, 1000, { session_used: 96, session_reset_at: 500 }), 100)
assert.equal(state.pending.candidate.subjectKey, 'codex:session')
assert.equal(state.pending.candidate.summary.label, 'Codex 5-hour')
state = run(state, sample(80, 1000, { session_used: 0, session_reset_at: 600 }), 6000)
assert.equal(state.pending.candidate.kind, 'codex-reset')
assert.equal(state.sources.codex.weekly.remaining, 80)
state = run(baseline(80, 1000, { session_used: 20, session_reset_at: 500 }),
  sample(70, 1000, { session_used: 96, session_reset_at: 500 }), 100)
assert.equal(state.pending.candidate.subjectKey, 'codex:session', 'the most urgent simultaneous window wins')
assert.equal(state.sources.codex.weekly.dropAnchor, 70)

for (const context of [{ dnd: true }, { fullscreen: true }, { targetScreens: [] }]) {
  state = run(baseline(80), sample(4), 100, context)
  assert.equal(state.pending, null)
  assert.equal(state.active, null)
  state = run(state, sample(4), 6000)
  assert.equal(state.pending, null, 'suppressed usage changes are not replayed')
}
const normalized = sample(50, 1234, { session_reset_at: 5678 })
assert.equal(normalized.weeklyResetAt, 1234)
assert.equal(normalized.sessionResetAt, 5678)
for (const bad of [0, -1, Infinity, NaN, '1234', null]) assert.equal(sample(50, bad).weeklyResetAt, null)
console.log('Codex peek thresholds, reset epochs, independent windows and suppression passed')
