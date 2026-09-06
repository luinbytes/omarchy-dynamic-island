const assert = require("node:assert/strict")
const Hub = require("../../shell/plugins/island/HubModel.js")
const View = require("../../shell/plugins/island/ViewModel.js")
const Agent = require("../../shell/plugins/island/AgentModel.js")
const MediaProjection = require("../../shell/plugins/island/MediaProjection.js")

const metrics = View.screenMetrics({
  screen: { width: 1920, height: 1080 },
  anchor: { x: 835, y: 2, width: 250, height: 22 },
  bar: { position: "top", size: 26 }
})

let state = Hub.initialState()
let result = Hub.reconcile(state, {}, { nowMs: 1000 })
state = result.state
assert.deepEqual(Hub.TOOLS, ["music", "weather", "codex", "agents", "notifications", "system"],
  "Codex replaces Notes in the active Hub route registry")
assert.equal(result.schedule.primary.key, "hub:music", "a neutral Island remains reachable with no live source")
assert.equal(result.schedule.reason, "neutral")
assert.equal(result.schedule.secondary, null)

state = Hub.navigate(state, "weather", "monitor", "hub:weather")
assert.equal(state.expanded, false, "navigation waits for a content-derived target height")
assert.equal(state.pendingRoute.entityKey, "hub:weather")
let frame = Hub.frameFor(state, result.schedule, "monitor", metrics, View)
assert.equal(frame.phase, "compact", "preflight does not start a minimum-height morph")
assert.equal(frame.preflight.content.key, "hub:weather")
assert.equal(frame.preflight.widthToken, 306)
const heightBudget = frame.preflight.heightBudget
assert.equal(Hub.acceptLayout(state, { screen: "other", key: "hub:weather", widthToken: 306, expectedWidthToken: 306, preferredHeight: 184, heightBudget }), state,
  "another monitor cannot commit the pending route")
assert.equal(Hub.acceptLayout(state, { screen: "monitor", key: "hub:weather", widthToken: 305, expectedWidthToken: 306, preferredHeight: 184, heightBudget }), state,
  "a stale-width loader cannot commit the pending route")
const blockedExpansion = Hub.acceptLayout(state, { screen: "monitor", key: "hub:weather", widthToken: 306, expectedWidthToken: 306, preferredHeight: heightBudget + 1, heightBudget })
assert.equal(blockedExpansion.expanded, false, "content that cannot fit does not silently clip into an expanded card")
assert.equal(blockedExpansion.pendingRoute, null)
assert.equal(blockedExpansion.layoutError, "content-too-tall")
state = Hub.acceptLayout(state, { screen: "monitor", key: "hub:weather", widthToken: 306, expectedWidthToken: 306, preferredHeight: 184, heightBudget })
assert.equal(state.expanded, true)
assert.equal(state.pendingRoute, null)
frame = Hub.frameFor(state, result.schedule, "monitor", metrics, View)
assert.equal(frame.selected.tool, "weather")
assert.equal(frame.selected.key, "hub:weather")
assert.equal(frame.isOwner, true)
assert.equal(frame.geometry.card.height, 184, "the accepted bounded content height owns the expanded target")
assert.equal(frame.titleExpandedRect.height, 184, "the shared-title endpoint uses the actual expanded height")
assert.equal(Hub.frameFor(state, result.schedule, "other", metrics, View).phase, "compact", "expansion belongs to one monitor")

const shortMetrics = View.screenMetrics({
  screen: { width: 1920, height: 150 },
  anchor: { x: 835, y: 2, width: 250, height: 22 },
  bar: { position: "top", size: 26 }
})
const shortFrame = Hub.frameFor(state, result.schedule, "monitor", shortMetrics, View)
assert.equal(shortFrame.layoutReady, false, "a layout measured for another screen budget is invalidated")
const safelyCollapsed = Hub.acceptLayout(state, {
  screen: "monitor",
  key: "hub:weather",
  widthToken: shortFrame.geometry.card.width,
  expectedWidthToken: shortFrame.geometry.card.width,
  preferredHeight: 184,
  heightBudget: shortFrame.detailHeightBudget
})
assert.equal(safelyCollapsed.expanded, false, "an open card collapses when its complete semantic content no longer fits")
assert.equal(safelyCollapsed.entityKey, "hub:weather", "safe collapse retains the exact deliberate route")
assert.equal(safelyCollapsed.layoutError, "content-too-tall")

state = Hub.toggleChooser(state, "monitor")
assert.equal(state.chooserOpen, true)
const selectedBeforeChooser = state.entityKey
state = Hub.chooseTool(state, "notifications", "monitor")
assert.equal(state.entityKey, selectedBeforeChooser, "the current activity stays selected during utility preflight")
assert.equal(state.pendingRoute.entityKey, "hub:notifications", "chooser navigation deliberately selects the canonical tool route")
assert.equal(state.chooserOpen, true, "the chooser covers the retained body until the replacement is sized")
const cancelledChoice = Hub.closeChooser(state, "monitor")
assert.equal(cancelledChoice.pendingRoute, null, "Escape from the chooser also cancels its uncommitted route")
assert.equal(cancelledChoice.entityKey, selectedBeforeChooser)
state = Hub.toggleChooser(cancelledChoice, "monitor")
state = Hub.chooseTool(state, "notifications", "monitor")
state = Hub.acceptLayout(state, { screen: "monitor", key: "hub:notifications", widthToken: 306, expectedWidthToken: 306, preferredHeight: 216, heightBudget })
assert.equal(state.entityKey, "hub:notifications")
assert.equal(state.chooserOpen, false)
state = Hub.collapse(state)
assert.equal(state.tool, "notifications", "collapse does not rewrite the last deliberate expanded route")
assert.equal(state.expanded, false)

let earlyChoice = Hub.navigate(Hub.initialState(), "music", "monitor", "hub:music")
let earlyChoiceFrame = Hub.frameFor(earlyChoice, result.schedule, "monitor", metrics, View)
earlyChoice = Hub.acceptLayout(earlyChoice, {
  screen: "monitor",
  key: "hub:music",
  widthToken: earlyChoiceFrame.preflight.widthToken,
  expectedWidthToken: earlyChoiceFrame.preflight.widthToken,
  preferredHeight: 184,
  heightBudget: earlyChoiceFrame.preflight.heightBudget
})
earlyChoice = Hub.toggleChooser(earlyChoice, "monitor")
const weatherChoice = Hub.chooseTool(earlyChoice, "weather", "monitor")
assert.equal(weatherChoice.entityKey, "hub:music", "an early chooser selection retains the presented Music route during Weather preflight")
assert.equal(weatherChoice.pendingRoute.entityKey, "hub:weather", "an early Weather selection queues its semantic route instead of collapsing the card")
assert.equal(weatherChoice.chooserOpen, true, "the chooser remains visible until the Weather layout commits")
assert.equal(Hub.chooseTool(weatherChoice, "weather", "monitor"), weatherChoice,
  "duplicate early Weather presses are idempotent while the same preflight is pending")

const blocked = Array.from({ length: 3 }, (_, index) => ({
  key: "system:process:D:" + (80 + index) + ":4321",
  label: "Uninterruptible wait",
  value: "worker · PID " + (80 + index),
  icon: "!",
  phase: "attention",
  startedAt: 1000,
  occurredAt: 1000 + index,
  eligibleUntil: null
}))
const compactSources = {
  codex: {
    providerPresent: true,
    available: true,
    sessionUsed: 31,
    weeklyUsed: 56,
    remaining: 44,
    pace: "under pace",
    paceState: "ahead",
    margin: 12,
    reset: "2d 5h  ·  Tue 18:30"
  },
  weather: { ready: true, status: "ready", mode: "manual", location: { name: "London" }, current: { temperature: 14 } },
  agents: { enabled: true, sessions: [{ state: "working", changedAt: 1500, observedAt: 1500 }] },
  notifications: {
    entries: [{ key: "history", app: "Discord" }, { key: "older", app: "Mail" }],
    preview: { key: "live", app: "Discord", summary: "Message", urgency: "normal", timestamp: 2500 }
  },
  notificationPreviewUntil: 5000,
  system: { available: true, sampledAt: 3000, events: blocked }
}
const compactResult = Hub.reconcile(Hub.initialState(), compactSources, { nowMs: 3000 })
const compactFrame = Hub.frameFor(compactResult.state, compactResult.schedule, "monitor", metrics, View)
assert.equal(compactFrame.primary.compactText, "3 blocked procs", "a process pair keeps its count and noun")
assert.equal(compactFrame.secondary.compactText, "Discord", "a notification pair keeps the app name")
assert.equal(compactFrame.primary.key, blocked[0].key, "the system card keeps the exact selected process key")
assert.equal(compactFrame.secondary.key, "notification:live", "the notification card keeps the exact selected key")
assert.equal(compactFrame.geometry.card.width, 176, "hub primary takes the larger share")
assert.equal(compactFrame.geometry.secondary.width, 68, "hub secondary keeps an icon and short semantic cue")
assert.equal(compactFrame.geometry.secondary.x - (compactFrame.geometry.card.x + compactFrame.geometry.card.width), 6,
  "hub compact cards keep the existing gap")
assert.equal(compactFrame.splitMinimal, false, "a labelled hub pair never takes the minimal renderer")
assert.equal(compactFrame.primary.compactCentered, false, "paired activities retain their independent aligned lanes")
const agentPair = Hub.frameFor(compactResult.state, Object.assign({}, compactResult.schedule, {
  primary: compactResult.schedule.byTool.weather,
  secondary: compactResult.schedule.byTool.agents
}), "monitor", metrics, View)
assert.equal(agentPair.secondary.icon, "robot", "the short agent presentation retains its semantic robot identity")
assert.equal(agentPair.secondary.compactText, "Working", "the small secondary explains its live status rather than showing a bare count")
assert.equal(agentPair.secondary.value, "1 agent working", "the full activity record retains the working count")
assert.ok(agentPair.geometry.secondary.width > 64, "secondary media stays above its artwork-only breakpoint")
const blockedSchedule = Object.assign({}, compactResult.schedule, {
  primary: compactResult.schedule.byKey[blocked[0].key],
  secondary: null
})
const blockedFrame = Hub.frameFor(compactResult.state, blockedSchedule, "monitor", metrics, View)
assert.equal(blockedFrame.primary.compactText, "3 blocked procs", "the single process view retains the blocked count")
const codexFrame = Hub.frameFor(compactResult.state, Object.assign({}, compactResult.schedule, {
  primary: compactResult.schedule.byTool.codex,
  secondary: null
}), "monitor", metrics, View)
assert.equal(codexFrame.primary.compactText, "44% weekly left", "Codex retains its remaining weekly usage at compact width")
assert.equal(codexFrame.primary.compactCentered, true, "a single Codex route centers its icon and text as one group")
assert.ok(![compactResult.schedule.primary.key, compactResult.schedule.secondary.key].includes("hub:codex"),
  "Codex usage remains selectable without becoming an ambient activity candidate")
const codexRoute = Hub.navigate(compactResult.state, "codex", "monitor", "hub:codex")
const codexPreflight = Hub.frameFor(codexRoute, compactResult.schedule, "monitor", metrics, View)
assert.equal(codexPreflight.preflight.content.key, "hub:codex", "Codex has the same guarded content-size preflight as other routes")
assert.equal(codexPreflight.preflight.content.tool, "codex", "the Codex preflight keeps its semantic route identity")
const unavailableCodex = Hub.reconcile(Hub.initialState(), Object.assign({}, compactSources, {
  codex: { providerPresent: true, available: false, sessionUsed: null, weeklyUsed: null, remaining: null }
}), { nowMs: 3000 })
assert.equal(unavailableCodex.schedule.byTool.codex.value, "Usage unavailable",
  "missing provider percentages never render as false zero usage")
const weatherFrame = Hub.frameFor(compactResult.state, Object.assign({}, compactResult.schedule, {
  primary: compactResult.schedule.byTool.weather,
  secondary: null
}), "monitor", metrics, View)
assert.equal(weatherFrame.primary.compactText, "London 14°", "single weather compact text includes its location and temperature")
const weatherPairFrame = Hub.frameFor(compactResult.state, Object.assign({}, compactResult.schedule, {
  primary: compactResult.schedule.byTool.weather,
  secondary: compactResult.schedule.byTool.codex
}), "monitor", metrics, View)
assert.equal(weatherPairFrame.primary.compactText, "London 14°", "primary weather retains its full identity in the wider card")
assert.equal(compactResult.schedule.byTool.notifications.icon, "bell", "notifications use a bell semantic icon")
const historyFrame = Hub.frameFor(compactResult.state, Object.assign({}, compactResult.schedule, {
  primary: compactResult.schedule.byTool.notifications,
  secondary: compactResult.schedule.byTool.codex
}), "monitor", metrics, View)
assert.equal(historyFrame.primary.compactText, "2 recent alerts", "notification history counts keep a noun and recency")
const sideMetrics = View.screenMetrics({
  screen: { width: 1920, height: 1080 },
  anchor: { x: 2, y: 400, width: 22, height: 250 },
  bar: { position: "left", size: 26 }
})
const sideFrame = Hub.frameFor(compactResult.state, compactResult.schedule, "monitor", sideMetrics, View)
assert.equal(sideFrame.splitMinimal, true, "vertical bars retain their existing minimal renderer")
assert.equal(sideFrame.secondary.compactText, undefined, "vertical secondary cards do not opt into horizontal text")
const criticalResult = Hub.reconcile(Hub.initialState(), Object.assign({}, compactSources, {
  notifications: Object.assign({}, compactSources.notifications, {
    preview: Object.assign({}, compactSources.notifications.preview, { urgency: "critical" })
  })
}), { nowMs: 3000 })
assert.equal(criticalResult.schedule.byKey["notification:live"].minimalValue, "!", "critical minimal notifications retain urgency")
const idleResult = Hub.reconcile(Hub.initialState(), { agents: { enabled: true, sessions: [] } }, { nowMs: 3000 })
const idleFrame = Hub.frameFor(idleResult.state, Object.assign({}, idleResult.schedule, {
  primary: idleResult.schedule.byTool.agents,
  secondary: null
}), "monitor", metrics, View)
assert.equal(idleFrame.primary.compactText, "Agents idle", "idle compact copy still identifies the activity")
for (const phase of ["attention", "terminal"]) {
  const resourceEvent = { key: "system:cpu-pressure", label: "CPU pressure", value: "11% for 15s", phase, startedAt: 1000, occurredAt: 3000, eligibleUntil: 9000 }
  const resources = Hub.reconcile(Hub.initialState(), { system: { available: true, events: [resourceEvent], sampledAt: 3000 } }, { nowMs: 3000 })
  const resourceFrame = Hub.frameFor(resources.state, resources.schedule, "monitor", metrics, View)
  assert.equal(resourceFrame.primary.compactText, phase === "terminal" ? "CPU wait normal" : "CPU wait 11%", "resource glance retains the metric and state without detail duration")
  assert.equal(resourceFrame.primary.systemEvent.value, "11% for 15s", "expanded resource evidence remains intact")
}

const now = 1000000
const raw = {
  hook_event_name: "SubagentStart",
  session_id: "parent",
  agent_id: "child",
  prompt: "PRIVATE",
  cwd: "/private",
  transcript_path: "/private/log"
}
const event = Agent.fromHook(raw, now)
assert.deepEqual(Object.keys(event).sort(), ["event", "observedAt", "parentId", "sessionId"])
let records = Agent.ingest(Agent.initialState(), event, now)
assert.equal(records.sessions[0].parentId, "parent")
assert.equal(Agent.ingest(records, Object.assign({}, event, { prompt: "PRIVATE" }), now), records)
records = Agent.ingest(records, Object.assign({}, event, { event: "SubagentStop", observedAt: now + 1 }), now + 1)
assert.equal(records.sessions[0].state, "turn-ended", "Stop does not claim task completion")
assert.equal(Agent.ingest(records, event, now + 2), records, "older deliveries cannot overwrite newer status")
assert.equal(Agent.snapshot(records, now + 400000, true).sessions[0].stale, true, "silence is labelled last known, not success")
records = Agent.ingest(records, { sessionId: "parent", parentId: "", event: "PermissionRequest", observedAt: now + 3 }, now + 3)
records = Agent.ingest(records, { sessionId: "parent", parentId: "", event: "PostToolUse", observedAt: now + 4 }, now + 4)
assert.equal(Agent.snapshot(records, now + 4, true).attention, 0, "a newer hook event ends the prior approval observation")
assert.equal(Agent.snapshot(records, now + 400005, true).attention, 0, "stale approval history is not compact-eligible")

const liveMediaKey = JSON.stringify([MediaProjection.SOURCE, MediaProjection.ID])
const liveMediaSnapshot = MediaProjection.normalize({
  playerKey: "mpv:1", instanceEpoch: 1, uniqueId: 1, title: "Native track", artist: "Artist", isPlaying: true
})
const liveMediaActivity = MediaProjection.activity(liveMediaSnapshot, 1, 1000, 1000)
const liveMediaResult = Hub.reconcile(Hub.initialState(), {
  activitiesByKey: { [liveMediaKey]: liveMediaActivity }
}, { nowMs: 1000 })
state = Hub.navigate(liveMediaResult.state, "music", "monitor", liveMediaKey)
frame = Hub.frameFor(state, liveMediaResult.schedule, "monitor", metrics, View)
assert.equal(frame.preflight.content.key, liveMediaKey, "a media peek route resolves the publisher's live activity identity")
assert.equal(frame.preflight.content.expired, undefined, "a media peek route does not degrade to an inert fallback card")
assert.equal(frame.preflight.content.media.trackToken, liveMediaSnapshot.trackToken,
  "the selected hub route retains the live player payload")

console.log("hub routes and private agent status boundary regressions passed; rendered acceptance remains separate")
