const assert = require("node:assert/strict")
const Peek = require("../../shell/plugins/island/PeekModel.js")

function notification(key, summary, extras) {
  return Object.assign({
    key,
    live: true,
    app: "Mail",
    summary,
    body: "Body",
    urgency: "normal",
    timestamp: 1
  }, extras || {})
}

function notifications(entries, extras) {
  return Object.assign({ available: true, dnd: false, entries }, extras || {})
}

function agents(sessions, backend) {
  return { enabled: true, sourceLabel: backend || "Codex hooks", sessions }
}

function agent(sessionId, state, extras) {
  return Object.assign({
    sessionId,
    state,
    approvalNoted: state === "approval-requested",
    stale: false,
    source: "Codex hooks",
    observedAt: 1,
    changedAt: 1,
    ageSeconds: 0,
    event: "SessionStart"
  }, extras || {})
}

function media(title, playing, extras) {
  return Object.assign({
    title,
    artist: "Artist",
    playing,
    trackToken: "player|1|" + title,
    positionSeconds: 0,
    durationSeconds: 100,
    canSeek: true
  }, extras || {})
}

function system(events, extras) {
  return Object.assign({ available: true, sampledAt: 1, readings: [], events }, extras || {})
}

function systemEvent(key, phase, occurredAt, extras) {
  return Object.assign({ key, phase, occurredAt, label: "CPU pressure", value: "High", icon: "CPU" }, extras || {})
}

function run(state, sources, nowMs, extras) {
  return Peek.reconcile(state, sources, Object.assign({ nowMs, targetScreens: ["DP-1"] }, extras || {}))
}

let state = Peek.initialState()
let result = run(state, {
  notifications: notifications([notification("existing", "Already here")]),
  agents: agents([agent("existing-agent", "working")]),
  activitiesByKey: { player: { media: media("Existing track", true) } },
  system: system([systemEvent("system:cpu", "attention", 10)])
}, 100)
state = result.state
assert.equal(result.active, null)
assert.equal(state.pending, null, "the first ready snapshot baselines every source")
assert.equal(state.sources.notifications.initialized, true)
assert.equal(state.sources.agents.initialized, true)
assert.equal(state.sources.media.initialized, true)
assert.equal(state.sources.system.initialized, true)

state = Peek.initialState()
state = run(state, { agents: { enabled: true, ready: false, sourceLabel: "Herdr · reported status", sessions: [] } }, 0).state
assert.equal(state.sources.agents.initialized, false, "Herdr stays unready until its first actual enumeration")
state = run(state, { agents: { enabled: true, ready: true, sourceLabel: "Herdr · reported status", sessions: [
  agent("herdr-existing", "working", { source: "Herdr" })
] } }, 100).state
assert.equal(state.pending, null, "a delayed first Herdr enumeration is a baseline, not a startup event")
state = run(state, { agents: { enabled: true, ready: true, sourceLabel: "Herdr · reported status", sessions: [
  agent("herdr-existing", "blocked", { source: "Herdr" })
] } }, 200).state
assert.equal(state.pending.candidate.kind, "agent-blocked", "a later reported Herdr change remains eligible")
state = Peek.initialState()
state = run(state, { agents: { enabled: true, ready: true, sourceLabel: "Herdr · reported status", sessions: [
  agent("herdr-reconnect", "working", { source: "Herdr" })
] } }, 0).state
state = run(state, { agents: { enabled: false, ready: false, sourceLabel: "No live agent source", sessions: [] } }, 300).state
assert.equal(state.sources.agents.ready, false, "Herdr going offline resets the enumeration baseline")
state = run(state, { agents: { enabled: true, ready: true, sourceLabel: "Herdr · reported status", sessions: [
  agent("herdr-existing", "blocked", { source: "Herdr" })
] } }, 400).state
assert.equal(state.pending, null, "a reconnected Herdr source rebaselines its existing sessions")

state = Peek.initialState()
state = run(state, { agents: { enabled: true, ready: true, sourceLabel: "Codex hooks", sessions: [] } }, 0).state
state = run(state, { agents: { enabled: true, ready: true, sourceLabel: "Codex hooks", sessions: [
  agent("hook-first", "working", { source: "Codex hooks" })
] } }, 100).state
assert.equal(state.pending.candidate.kind, "agent-working", "the first event after hook subscription remains intentional")

state = Peek.initialState()
state = run(state, { media: { available: true, ready: false, entries: [media("Startup track", true)] } }, 0).state
assert.equal(state.sources.media.initialized, false, "unreconciled media does not establish an eager empty baseline")
state = run(state, { media: { available: true, ready: true, entries: [media("Startup track", true)] } }, 100).state
assert.equal(state.pending, null, "the first reconciled media snapshot baselines existing playback")
state = run(state, { media: { available: true, ready: true, entries: [media("Later track", true)] } }, 200).state
assert.equal(state.pending.candidate.kind, "media-track", "a later real track is still eligible after the empty baseline")

state = Peek.initialState()
result = run(state, { notifications: notifications([]) }, 0)
state = result.state
result = run(state, { notifications: notifications([notification("n1", "Build done")]) }, 1000,
  { targetScreens: ["DP-1", "HDMI-A-1", "DP-1", ""] })
state = result.state
assert.equal(state.pending.candidate.kind, "notification-new")
assert.equal(state.pending.candidate.entityKey, "notification:n1")
assert.deepEqual(state.pending.targetScreens, ["DP-1", "HDMI-A-1"], "one lease records each eligible quickbar once")
assert.equal(state.pending.coalesceUntil, 1000 + Peek.COALESCE_MS)
const notificationDeadline = state.pending.coalesceUntil
const pendingState = state
result = run(state, {
  notifications: notifications([notification("n1", "Build done", { timestamp: 999999 })])
}, 1100, { targetScreens: ["DP-1", "HDMI-A-1"] })
state = result.state
assert.equal(result.changed, false, "a timestamp-only refresh is not semantic")
assert.equal(state, pendingState, "a semantic no-op preserves the reducer state reference")
assert.equal(state.pending.coalesceUntil, notificationDeadline, "a duplicate does not extend coalescing")
result = run(state, { notifications: notifications([notification("n1", "Build done")]) }, notificationDeadline,
  { targetScreens: ["DP-1", "HDMI-A-1"] })
state = result.state
assert.equal(state.pending, null)
assert.equal(state.active.candidate.kind, "notification-new")
assert.deepEqual(state.active.targetScreens, ["DP-1", "HDMI-A-1"], "activation preserves the broadcast recipients")
assert.equal(state.active.shownAt, notificationDeadline)
assert.equal(state.active.expiresAt, notificationDeadline + Peek.ACTIVE_MS)
const activeDeadline = state.active.expiresAt
result = run(state, { notifications: notifications([notification("n1", "Build done", { timestamp: 1000000 })]) }, 2000)
state = result.state
assert.equal(state.active.expiresAt, activeDeadline, "a duplicate cannot extend an active lease")
result = run(state, { notifications: notifications([notification("n1", "Build done")]) }, activeDeadline)
state = result.state
assert.equal(state.active, null, "the lease expires at its original bounded deadline")
result = run(state, { notifications: notifications([notification("n1", "Different content")]) }, activeDeadline + 1)
assert.equal(result.state.pending.candidate.kind, "notification-updated", "a semantic content change on the same key is new")

state = Peek.initialState()
result = run(state, { notifications: notifications([{ ...notification("history", "Old"), live: false }]) }, 0)
state = result.state
result = run(state, { notifications: notifications([
  { ...notification("history-2", "Also old"), live: false },
  notification("live", "New")
]) }, 100)
assert.equal(result.state.pending.candidate.subjectKey, "live", "history rows never become candidates")

state = Peek.initialState()
state = run(state, { notifications: notifications([]) }, 0).state
result = run(state, {
  notifications: notifications([notification("omapager-existing", "Already visible")], { backend: "omapager" })
}, 100)
state = result.state
assert.equal(state.pending, null, "an Omapager provider switch baselines its current live layout")
result = run(state, {
  notifications: notifications([
    notification("omapager-existing", "Already visible"),
    notification("omapager-new", "Actually new")
  ], { backend: "omapager" })
}, 200)
assert.equal(result.state.pending.candidate.subjectKey, "omapager-new",
  "a later Omapager live row remains eligible after the provider baseline")

state = Peek.initialState()
state = run(state, { notifications: notifications([]) }, 0).state
state = run(state, { notifications: notifications([notification("shown", "Visible")]) }, 100).state
state = run(state, { notifications: notifications([notification("shown", "Visible")]) }, 350).state
assert.ok(state.active)
result = run(state, {
  notifications: notifications([
    notification("shown", "Visible"),
    notification("hidden", "Suppressed")
  ], { dnd: true })
}, 400)
state = result.state
assert.equal(state.active, null, "DND dismisses an existing automatic lease")
assert.equal(state.pending, null)
result = run(state, {
  notifications: notifications([
    notification("shown", "Visible"),
    notification("hidden", "Suppressed")
  ])
}, 500)
assert.equal(result.state.pending, null, "DND consumes new identities instead of replaying them")

state = Peek.initialState()
state = run(state, { activitiesByKey: {}, system: system([]) }, 0).state
result = run(state, {
  activitiesByKey: { player: { media: media("Hidden track", true) } },
  system: system([systemEvent("system:memory", "attention", 10)])
}, 100, { fullscreen: true })
state = result.state
assert.equal(state.pending, null)
result = run(state, {
  activitiesByKey: { player: { media: media("Hidden track", true) } },
  system: system([systemEvent("system:memory", "attention", 10)])
}, 200)
assert.equal(result.state.pending, null, "fullscreen suppression consumes media and system changes")

state = Peek.initialState()
state = run(state, { activitiesByKey: {} }, 0).state
result = run(state, { activitiesByKey: { player: { media: media("No target", true) } } }, 100, { targetScreens: [] })
state = result.state
assert.equal(state.pending, null)
result = run(state, { activitiesByKey: { player: { media: media("No target", true) } } }, 200)
assert.equal(result.state.pending, null, "an empty target consumes rather than defers the event")

state = Peek.initialState()
state = run(state, {
  notifications: notifications([]),
  agents: agents([])
}, 0).state
state = run(state, {
  notifications: notifications([notification("burst", "Normal")]),
  agents: agents([])
}, 100).state
const burstDeadline = state.pending.coalesceUntil
const pendingBeforeRetarget = JSON.stringify(state)
assert.equal(state.pending.candidate.source, "notifications")
const retargetInput = state
state = run(retargetInput, {
  notifications: notifications([notification("burst", "Normal")]),
  agents: agents([agent("approval", "approval-requested", { event: "PermissionRequest" })])
}, 200).state
assert.equal(JSON.stringify(retargetInput), pendingBeforeRetarget, "retargeting does not mutate prior reducer state")
assert.equal(state.pending.candidate.kind, "agent-approval", "the highest-ranked burst member wins")
assert.equal(state.pending.coalesceUntil, burstDeadline, "retargeting a burst keeps its first deadline")
assert.deepEqual(state.pending.targetScreens, ["DP-1"])
state = run(state, {
  notifications: notifications([notification("burst", "Normal")]),
  agents: agents([agent("approval", "approval-requested")])
}, burstDeadline).state
assert.equal(state.active.candidate.kind, "agent-approval")

state = Peek.initialState()
state = run(state, { agents: agents([]) }, 0).state
state = run(state, { agents: agents([agent("a1", "idle")]) }, 100).state
assert.equal(state.pending.candidate.kind, "agent-started")
state = run(state, { agents: agents([agent("a1", "idle")]) }, 350).state
state = run(state, { agents: agents([agent("a1", "working", { event: "UserPromptSubmit", observedAt: 400, changedAt: 400 })]) }, 400).state
assert.equal(state.pending.candidate.kind, "agent-working")
const workingDeadline = state.pending.coalesceUntil
result = run(state, { agents: agents([agent("a1", "working", {
  event: "PostToolUse",
  observedAt: 9999,
  changedAt: 400,
  ageSeconds: 9,
  stale: false
})]) }, 401)
state = result.state
assert.equal(result.changed, false, "hook churn, observation time, and age do not create progress peeks")
assert.equal(state.pending.coalesceUntil, workingDeadline)
state = run(state, { agents: agents([agent("a1", "working")]) }, workingDeadline).state
state = run(state, { agents: agents([agent("a1", "approval-requested")]) }, 700).state
assert.equal(state.pending.candidate.kind, "agent-approval")
state = run(state, { agents: agents([agent("a1", "approval-requested")]) }, 950).state
state = run(state, { agents: agents([agent("a1", "turn-ended", { event: "Stop" })]) }, 1000).state
assert.equal(state.pending.candidate.kind, "agent-finished")
state = run(state, { agents: agents([agent("a1", "blocked")]) }, 1100).state
assert.equal(state.pending.candidate.kind, "agent-blocked")

state = Peek.initialState()
state = run(state, { agents: agents([agent("switch", "working")], "Codex hooks") }, 0).state
result = run(state, {
  agents: agents([agent("switch", "blocked", { source: "Herdr" })], "Herdr · reported status")
}, 100)
state = result.state
assert.equal(state.pending, null, "a live agent backend change rebaselines its current sessions")
result = run(state, {
  agents: agents([agent("switch", "turn-ended", { source: "Herdr" })], "Herdr · reported status")
}, 200)
assert.equal(result.state.pending.candidate.kind, "agent-finished", "later semantics from the new backend remain eligible")
assert.equal(result.state.pending.candidate.summary.value, "Idle · reported",
  "reported Herdr completion never asserts verified task success")

state = Peek.initialState()
state = run(state, { agents: agents([], "Herdr · reported status") }, 0).state
state = run(state, { agents: agents([agent("reported-working", "working", { source: "Herdr" })], "Herdr · reported status") }, 100).state
assert.equal(state.pending.candidate.summary.value, "Working · reported",
  "reported working status retains its provenance in the shallow peek")

state = Peek.initialState()
state = run(state, { activitiesByKey: {} }, 0).state
state = run(state, { activitiesByKey: { player: { media: media("Track one", true) } } }, 100).state
assert.equal(state.pending.candidate.kind, "media-track")
const mediaDeadline = state.pending.coalesceUntil
result = run(state, { activitiesByKey: { player: {
  revision: 500,
  updatedAt: 999999,
  media: media("Track one", true, {
    positionSeconds: 70,
    durationSeconds: 140,
    artUrl: "https://example.test/new.jpg",
    canSeek: false,
    canNext: true
  })
} } }, 150)
state = result.state
assert.equal(result.changed, false, "media progress, artwork, capability, and activity revisions are ignored")
assert.equal(state.pending.coalesceUntil, mediaDeadline)
state = run(state, { activitiesByKey: { player: { media: media("Track one", false) } } }, 200).state
assert.equal(state.pending.candidate.kind, "media-playback")
assert.equal(state.pending.coalesceUntil, mediaDeadline)
state = run(state, { activitiesByKey: { player: { media: media("Track two", false) } } }, 210).state
assert.equal(state.pending.candidate.kind, "media-track", "track identity retargets the burst")
state = run(state, {
  activitiesByKey: { otherPlayer: { media: media("Track two", false, { trackToken: "other|1|track" }) } }
}, 220).state
assert.equal(state.pending.candidate.subjectKey, "otherPlayer", "a source identity change is meaningful")

state = Peek.initialState()
state = run(state, { system: system([systemEvent("system:cpu", "attention", 100)]) }, 100).state
result = run(state, { system: system([
  systemEvent("system:cpu", "attention", 100, { value: "Higher", startedAt: 1 })
], { sampledAt: 999999, readings: [{ value: 100 }] }) }, 200)
state = result.state
assert.equal(result.changed, false, "system samples and warning value refreshes are not event identities")
result = run(state, { system: system([
  systemEvent("system:cpu", "terminal", 300, { value: "Recovered" })
]) }, 300)
assert.equal(result.state.pending.candidate.kind, "system-recovered")
assert.equal(result.state.pending.candidate.entityKey, "system:cpu")

state = Peek.initialState()
state = run(state, { notifications: { available: true, ready: false, dnd: false, entries: [] } }, 0).state
state = run(state, { notifications: notifications([notification("late", "Loaded while offline")]) }, 100).state
assert.equal(state.pending, null, "a source becoming ready after asynchronous startup rebaselines current live rows")
state = run(state, { notifications: { available: false, dnd: false, entries: [] } }, 200).state
state = run(state, { notifications: notifications([notification("during-outage", "Already present")]) }, 300).state
assert.equal(state.pending, null, "readiness recovery consumes its current snapshot")
state = run(state, { notifications: notifications([
  notification("during-outage", "Already present"),
  notification("after-recovery", "Actually new")
]) }, 400).state
assert.equal(state.pending.candidate.subjectKey, "after-recovery")

state = Peek.initialState()
state = run(state, {
  notifications: notifications([]),
  agents: agents([]),
  activitiesByKey: {},
  system: system([])
}, 0).state
result = run(state, {
  notifications: notifications([
    { live: true, summary: "Missing key" },
    { key: "history", live: false, summary: "History" }
  ]),
  agents: agents([agent("stale", "blocked", { stale: true }), { sessionId: "", state: "working" }]),
  activitiesByKey: { noise: { media: { positionSeconds: 42, durationSeconds: 100 } } },
  system: system([systemEvent("bad-time", "attention", "not-a-number")])
}, 100)
assert.equal(result.state.pending, null, "malformed, historical, stale, and progress-only inputs fail closed")

state = Peek.initialState()
state = run(state, { notifications: notifications([]) }, 0).state
state = run(state, { notifications: notifications([notification("first", "First")]) }, 100).state
state = run(state, { notifications: notifications([notification("first", "First")]) }, 350).state
const leaseDeadline = state.active.expiresAt
result = run(state, { notifications: notifications([
  notification("first", "First"),
  notification("second", "Second")
]) }, 400)
state = result.state
assert.equal(result.nextWakeAt, 650)
result = run(state, { notifications: notifications([
  notification("first", "First"),
  notification("second", "Second")
]) }, 401)
assert.equal(result.nextWakeAt, 650, "the coalescing deadline wins over a later active expiry")
assert.equal(state.active.expiresAt, leaseDeadline)

state = Peek.initialState()
state = run(state, {}, 10000).state
state = run(state, { notifications: notifications([]) }, 10001).state
state = run(state, { notifications: notifications([notification("late-tick", "Late")]) }, 10002).state
result = run(state, { notifications: notifications([notification("late-tick", "Late")]) }, 20000)
assert.equal(result.active, null, "a delayed wake cannot create a fresh five-second lease")
assert.equal(result.nextWakeAt, null)

state = Peek.initialState()
state = run(state, { notifications: notifications([]), agents: agents([]) }, 0).state
state = run(state, { notifications: notifications([notification("promote", "Open me")]), agents: agents([]) }, 100).state
state = run(state, { notifications: notifications([notification("promote", "Open me")]), agents: agents([]) }, 350).state
const promotedId = state.active.candidate.id
state = run(state, {
  notifications: notifications([notification("promote", "Open me")]),
  agents: agents([agent("pending", "approval-requested", { event: "PermissionRequest" })])
}, 400).state
const pendingAfterPromotion = state.pending
const sourceBeforeConsume = JSON.stringify(state.sources)
result = Peek.consume(state, promotedId)
state = result.state
assert.equal(state.active, null, "explicit promotion clears only the matching active peek")
assert.equal(state.pending.candidate.id, pendingAfterPromotion.candidate.id, "promotion preserves an unrelated pending candidate")
assert.equal(JSON.stringify(state.sources), sourceBeforeConsume, "promotion preserves source baselines and consumed identities")
assert.equal(result.nextWakeAt, pendingAfterPromotion.coalesceUntil, "promotion recomputes the pending wake deadline")
result = Peek.consume(state, promotedId)
assert.equal(result.changed, false, "a repeated promotion cannot clear another peek")
state = run(state, {
  notifications: notifications([notification("promote", "Open me")]),
  agents: agents([agent("pending", "approval-requested", { event: "PermissionRequest" })])
}, 401).state
assert.equal(state.active, null, "the promoted event cannot replay from unchanged source state")

console.log("peek model semantic policy passed")
