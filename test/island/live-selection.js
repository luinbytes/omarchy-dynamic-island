const assert = require("node:assert/strict")
const Hub = require("../../shell/plugins/island/HubModel.js")
const View = require("../../shell/plugins/island/ViewModel.js")

function mediaActivity(title, playing, revision, updatedAt) {
  return {
    revision,
    updatedAt,
    compact: { icon: "♪", label: title, value: playing ? "Playing" : "Paused" },
    minimal: { icon: "♪", value: "♪" },
    expanded: {},
    actions: [],
    media: { title, artist: "Artist", playing, trackToken: title + "|token" }
  }
}

function reconcile(state, activitiesByKey, nowMs, extra) {
  return Hub.reconcile(state, Object.assign({ activitiesByKey }, extra || {}), { nowMs })
}

function finishExpansion(state, screen, height) {
  return Hub.acceptLayout(state, {
    screen,
    key: state.pendingRoute.entityKey,
    widthToken: 408,
    expectedWidthToken: 408,
    preferredHeight: height || 188,
    heightBudget: 1000
  })
}

let state = Hub.initialState()
let result = reconcile(state, { late: mediaActivity("Track", true, 1, 10) }, 1000)
state = result.state
assert.equal(result.schedule.primary.key, "late")
assert.equal(state.lifecycleByKey.late.changedAt, 1000)
assert.equal(state.lifecycleByKey.late.pausedAt, null)

result = reconcile(state, { late: mediaActivity("Track", false, 2, 123456789) }, 2000)
state = result.state
assert.equal(state.lifecycleByKey.late.pausedAt, 2000, "pausedAt comes from the playing-to-paused transition")
assert.equal(result.nextWakeAt, 17000)
assert.ok([result.schedule.primary, result.schedule.secondary].some(item => item && item.key === "late"))

result = reconcile(state, { late: mediaActivity("Renamed", false, 99, 999999999) }, 12000)
state = result.state
assert.equal(state.lifecycleByKey.late.pausedAt, 2000, "metadata refresh cannot reset a pause lease")
assert.equal(result.nextWakeAt, 17000)

result = reconcile(state, { late: mediaActivity("Renamed", false, 100, 999999999) }, 17000)
state = result.state
assert.notEqual(result.schedule.primary.key, "late", "paused media leaves primary at the exact deadline")
assert.notEqual(result.schedule.secondary && result.schedule.secondary.key, "late", "paused media leaves both compact slots")
assert.equal(result.nextWakeAt, null)
assert.equal(result.schedule.byKey.late.media.title, "Renamed", "expired compact eligibility does not remove expanded controls")

result = reconcile(state, { late: mediaActivity("Renamed", true, 101, 999999999) }, 18000)
state = result.state
assert.equal(result.schedule.primary.key, "late", "resume is compact-eligible immediately")
assert.equal(state.lifecycleByKey.late.changedAt, 18000)

const crowded = {}
for (let index = 0; index < 8; index++) crowded[`plain-${index}`] = { compact: { label: `Plain ${index}` } }
crowded["last-media"] = mediaActivity("Found in full map", true, 1, 1)
result = reconcile(Hub.initialState(), crowded, 20000)
assert.equal(result.schedule.primary.key, "last-media", "media extraction scans all activitiesByKey, not a rendered two-slot frame")

state = Hub.initialState()
result = reconcile(state, { oldest: mediaActivity("Oldest", true, 1, 1) }, 30000)
state = result.state
result = reconcile(state, {
  oldest: mediaActivity("Oldest", true, 2, 999999),
  newer: mediaActivity("Newer", true, 1, 1)
}, 31000)
state = result.state
assert.equal(result.schedule.primary.key, "oldest", "active work is stable by semantic transition, not refresh timestamp")
result = reconcile(state, {
  oldest: mediaActivity("Oldest refreshed", true, 500, 888888888),
  newer: mediaActivity("Newer refreshed", true, 600, 999999999)
}, 32000)
assert.equal(result.schedule.primary.key, "oldest", "routine metadata refresh cannot reorder equal-rank work")
state = result.state
let routed = Hub.navigate(state, "music", "monitor")
assert.equal(routed.pendingRoute.entityKey, "oldest", "deliberate Music navigation preflights the scheduled media body's identity")

let weatherResult = Hub.reconcile(Hub.initialState(), {
  activitiesByKey: { music: mediaActivity("Active", true, 1, 1) },
  weather: { ready: true, status: "ready", mode: "manual", current: { temperature: 12 }, icon: "☀", fetchedAt: 32000 }
}, { nowMs: 32000 })
assert.equal(weatherResult.schedule.secondary, null, "ambient weather does not force active media into a two-bubble layout")
weatherResult = Hub.reconcile(Hub.initialState(), {
  weather: { ready: true, status: "ready", mode: "manual", current: { temperature: 12 }, icon: "☀", fetchedAt: 32000 }
}, { nowMs: 32000 })
assert.equal(weatherResult.schedule.primary.tool, "weather", "current configured weather is the ambient fallback")
weatherResult = Hub.reconcile(Hub.initialState(), {
  weather: { ready: true, status: "stale", mode: "manual", current: { temperature: 12 }, icon: "☀", fetchedAt: 1 }
}, { nowMs: 32000 })
assert.equal(weatherResult.schedule.reason, "neutral", "stale cached weather is available in its tool but not compact-eligible")

const routineWorkingAgent = {
  enabled: true,
  sessions: [{ sessionId: "routine", state: "working", approvalNoted: false, stale: false, changedAt: 1000 }],
  working: 1,
  blocked: 0,
  attention: 0
}
const readyWeather = { ready: true, status: "ready", mode: "manual", current: { temperature: 12 }, icon: "☀", fetchedAt: 1000 }
let livePriorityState = Hub.initialState()
let livePrioritySources = { activitiesByKey: {}, agents: routineWorkingAgent, weather: readyWeather }
result = Hub.reconcile(livePriorityState, livePrioritySources, { nowMs: 1000 })
livePriorityState = result.state
assert.equal(result.schedule.primary.tool, "agents", "routine work is eligible before a player starts")
livePrioritySources.activitiesByKey = { player: mediaActivity("New track", true, 1, 2000) }
result = Hub.reconcile(livePriorityState, livePrioritySources, { nowMs: 2000 })
livePriorityState = result.state
assert.equal(result.schedule.primary.key, "player", "new playing media outranks older routine work")
assert.equal(result.schedule.secondary.tool, "agents", "routine work remains the secondary card")
const newNotification = {
  key: "[3,4]",
  live: true,
  app: "App",
  summary: "New preview",
  body: "Body",
  urgency: "normal",
  timestamp: 3000,
  canInvoke: true,
  canDismiss: true
}
livePrioritySources.notifications = { available: true, dnd: false, preview: newNotification, entries: [newNotification], error: "" }
livePrioritySources.notificationPreviewUntil = 8000
result = Hub.reconcile(livePriorityState, livePrioritySources, { nowMs: 3000 })
livePriorityState = result.state
assert.equal(result.schedule.primary.tool, "notifications", "a new notification preempts playing media")
livePrioritySources.agents = Object.assign({}, routineWorkingAgent, {
  sessions: [{ sessionId: "approval", state: "approval-requested", approvalNoted: true, stale: false, changedAt: 4000 }],
  working: 0,
  attention: 1
})
result = Hub.reconcile(livePriorityState, livePrioritySources, { nowMs: 4000 })
assert.equal(result.schedule.primary.tool, "agents", "approval attention preempts the notification preview")

let pausedAgentState = Hub.initialState()
let pausedAgentSources = {
  activitiesByKey: { player: mediaActivity("New track", true, 1, 10000) },
  agents: routineWorkingAgent,
  weather: readyWeather
}
result = Hub.reconcile(pausedAgentState, pausedAgentSources, { nowMs: 10000 })
pausedAgentState = result.state
pausedAgentSources.activitiesByKey = { player: mediaActivity("New track", false, 2, 11000) }
result = Hub.reconcile(pausedAgentState, pausedAgentSources, { nowMs: 11000 })
pausedAgentState = result.state
assert.equal(result.nextWakeAt, 26000, "pausing preserves the existing 15-second compact lease")
result = Hub.reconcile(pausedAgentState, pausedAgentSources, { nowMs: 26000 })
assert.equal(result.schedule.primary.tool, "agents", "paused-media expiry returns routine work")

let pausedWeatherState = Hub.initialState()
let pausedWeatherSources = {
  activitiesByKey: { player: mediaActivity("New track", true, 1, 10000) },
  weather: readyWeather
}
result = Hub.reconcile(pausedWeatherState, pausedWeatherSources, { nowMs: 10000 })
pausedWeatherState = result.state
pausedWeatherSources.activitiesByKey = { player: mediaActivity("New track", false, 2, 11000) }
result = Hub.reconcile(pausedWeatherState, pausedWeatherSources, { nowMs: 11000 })
pausedWeatherState = result.state
result = Hub.reconcile(pausedWeatherState, pausedWeatherSources, { nowMs: 26000 })
assert.equal(result.schedule.primary.tool, "weather", "paused-media expiry returns ambient weather when work is absent")

const oldNotification = {
  key: "[1,2]",
  live: true,
  app: "App",
  summary: "Preview",
  body: "Body",
  urgency: "critical",
  timestamp: 1,
  canInvoke: true,
  canDismiss: true
}
let previewResult = Hub.reconcile(Hub.initialState(), {
  notifications: { available: true, dnd: false, preview: oldNotification, entries: [oldNotification], error: "" }
}, { nowMs: 40000 })
assert.notEqual(previewResult.schedule.primary.tool, "notifications", "a preview without the store-owned lease is not aged from its message timestamp")
let blockedResult = Hub.reconcile(Hub.initialState(), {
  agents: {
    enabled: true,
    sessions: [{ sessionId: "blocked", state: "blocked", approvalNoted: false, stale: false, changedAt: 39000 }],
    working: 0,
    blocked: 1,
    attention: 1
  }
}, { nowMs: 40000 })
assert.equal(blockedResult.schedule.primary.tool, "agents", "reported blocked work remains generic attention")
assert.equal(blockedResult.schedule.primary.value, "1 blocked agent", "reported blocked work is never mislabeled as approval")
const sources = {
  activitiesByKey: { media: mediaActivity("Active", true, 1, 1) },
  notifications: { available: true, dnd: false, preview: oldNotification, entries: [oldNotification], error: "" },
  notificationPreviewUntil: 46000,
  agents: {
    enabled: true,
    sessions: [{ sessionId: "approval", state: "approval-requested", approvalNoted: true, stale: false, changedAt: 39000 }],
    working: 0,
    attention: 1
  },
  system: {
    available: true,
    events: [
      { key: "system:ram", label: "Memory pressure", value: "12%", icon: "RAM", phase: "attention", startedAt: 38000, occurredAt: 38000, eligibleUntil: null },
      { key: "system:cpu", label: "High CPU use", value: "95%", icon: "CPU", phase: "ongoing", startedAt: 37000, occurredAt: 37000, eligibleUntil: null },
      { key: "system:recovered", label: "CPU use recovered", value: "40%", icon: "CPU", phase: "terminal", startedAt: 35000, occurredAt: 39500, eligibleUntil: 47000 }
    ],
    sampledAt: 40000
  },
  weather: { ready: true, current: { temperature: 12 }, icon: "☀", fetchedAt: 39000 }
}
result = Hub.reconcile(Hub.initialState(), sources, { nowMs: 40000 })
assert.equal(result.schedule.candidateCount, 4, "each domain contributes at most one eligible candidate and ambient is fallback-only")
assert.equal(result.schedule.primary.tool, "agents", "attention outranks a notification preview")
assert.equal(result.schedule.secondary.tool, "system", "a second attention item fills the second and final slot")
assert.equal([result.schedule.primary, result.schedule.secondary].length, 2, "the committed compact schedule has at most two slots")

sources.agents.sessions[0].stale = true
sources.agents.attention = 1
sources.system.events = sources.system.events.slice(1)
result = Hub.reconcile(result.state, sources, { nowMs: 41000 })
assert.equal(result.schedule.primary.tool, "notifications", "stale approval history cannot compete and preview ranks above active work")
assert.equal(result.nextWakeAt, 46000, "the selector uses the store-owned preview deadline despite an old notification timestamp")

result = Hub.reconcile(result.state, sources, { nowMs: 46000 })
assert.notEqual(result.schedule.primary.tool, "notifications", "the store deadline bounds preview eligibility")

const metrics = View.screenMetrics({
  screen: { width: 1920, height: 1080 },
  anchor: { x: 835, y: 2, width: 250, height: 22 },
  bar: { position: "top", size: 26 }
})
let expandedState = Hub.navigate(state, "music", "monitor", "oldest")
expandedState = finishExpansion(expandedState, "monitor")
let expandedFrame = Hub.frameFor(expandedState, state.schedule, "monitor", metrics, View)
assert.equal(expandedFrame.selected.key, "oldest")
const churned = reconcile(expandedState, {}, 50000, {
  notifications: { available: false, dnd: false, preview: null, entries: [], error: "" }
})
expandedState = churned.state
expandedFrame = Hub.frameFor(expandedState, churned.schedule, "monitor", metrics, View)
assert.equal(expandedFrame.selected.key, "oldest", "schedule churn retains the exact clicked entity key")
assert.equal(expandedFrame.selected.tool, "music", "schedule churn does not change the expanded tool")
assert.equal(expandedFrame.selected.label, "Oldest refreshed", "an expired exact route retains its own last live card")
assert.equal(expandedFrame.selected.expired, true, "a removed entity is explicit instead of borrowing another event")
assert.deepEqual(expandedFrame.selected.actions, [], "an expired retained activity is inert")
assert.equal(expandedFrame.isOwner, true)

const processEvent = {
  key: "system:process:D:42:100",
  label: "Uninterruptible wait",
  value: "private-worker-name-that-must-not-become-compact-copy · PID 42 · state D · 30s observed",
  icon: "D",
  phase: "attention",
  startedAt: 1000,
  occurredAt: 40000,
  eligibleUntil: null
}
const processResult = Hub.reconcile(Hub.initialState(), {
  system: { available: true, events: [processEvent], sampledAt: 40000 }
}, { nowMs: 40000 })
assert.equal(processResult.schedule.primary.label, "Uninterruptible wait")
assert.equal(processResult.schedule.primary.value, "1 blocked proc", "compact process evidence names its observed state")
assert.equal(processResult.schedule.primary.systemEvent.value, processEvent.value, "the full evidence remains available to the detail panel")

console.log("service-owned live selection lifecycle regressions passed; native rendering remains a separate gate")
