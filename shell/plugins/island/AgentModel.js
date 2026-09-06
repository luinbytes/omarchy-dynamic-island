var STATES = ["working", "approval-requested", "blocked", "idle", "turn-ended", "interrupted", "disconnected", "unknown"]
var EVENTS = { SessionStart: "idle", UserPromptSubmit: "working", PreToolUse: "working", PostToolUse: "working", PermissionRequest: "approval-requested", Stop: "turn-ended", Interrupt: "interrupted", SessionEnd: "disconnected", SubagentStart: "working", SubagentStop: "turn-ended" }

function identifier(value) {
  return typeof value === "string" && /^[A-Za-z0-9_.:/-]{1,160}$/.test(value)
}

function fromHook(raw, now) {
  if (!raw || !Object.prototype.hasOwnProperty.call(EVENTS, raw.hook_event_name) || !identifier(raw.session_id)) return null
  var child = raw.hook_event_name === "SubagentStart" || raw.hook_event_name === "SubagentStop"
  if (child && !identifier(raw.agent_id)) return null
  return { sessionId: child ? raw.agent_id : raw.session_id, parentId: child ? raw.session_id : "",
    event: raw.hook_event_name, observedAt: now }
}

function initialState() { return { revision: 0, sessions: [] } }

function ingest(previous, raw, now) {
  if (!raw || Object.keys(raw).some(function(key) { return ["sessionId", "parentId", "event", "observedAt"].indexOf(key) < 0 })
    || !identifier(raw.sessionId) || (raw.parentId !== "" && !identifier(raw.parentId))
    || !Object.prototype.hasOwnProperty.call(EVENTS, raw.event)
    || typeof raw.observedAt !== "number" || !isFinite(raw.observedAt) || raw.observedAt < now - 60000 || raw.observedAt > now + 5000) return previous
  var sessions = previous.sessions.slice()
  var index = sessions.findIndex(function(item) { return item.sessionId === raw.sessionId })
  if (index >= 0 && sessions[index].observedAt >= raw.observedAt) return previous
  var approvalNoted = raw.event === "PermissionRequest"
  var old = index >= 0 ? sessions[index] : null
  var nextState = EVENTS[raw.event]
  var changedAt = old && old.state === nextState && old.approvalNoted === approvalNoted
    ? old.changedAt || old.observedAt : raw.observedAt
  var session = { sessionId: raw.sessionId, parentId: raw.parentId, state: nextState, observedAt: raw.observedAt,
    changedAt: changedAt, event: raw.event, approvalNoted: approvalNoted, source: "Codex hooks" }
  if (index >= 0) sessions[index] = session
  else sessions.push(session)
  sessions.sort(function(a, b) { return b.observedAt - a.observedAt })
  return { revision: previous.revision + 1, sessions: sessions.slice(0, 64) }
}

function fromHerdr(previous, raw, now) {
  if (!raw || raw.online !== true || !Array.isArray(raw.agents)) return previous
  var statusMap = { working: "working", blocked: "blocked", done: "turn-ended", idle: "idle", unknown: "unknown" }
  var sessions = []
  var seen = Object.create(null)
  raw.agents.slice(0, 64).forEach(function(item) {
    if (!item || typeof item.paneId !== "string" || !/^[A-Za-z0-9_.:/%\-]{1,128}$/.test(item.paneId)) return
    var key = "herdr:" + item.paneId
    if (seen[key]) return
    seen[key] = true
    var nextState = Object.prototype.hasOwnProperty.call(statusMap, item.status) ? statusMap[item.status] : "unknown"
    var old = previous.sessions.find(function(session) { return session.sessionId === key })
    var changedAt = old && old.state === nextState ? old.changedAt
      : (old || nextState === "working" || nextState === "blocked" ? now : 0)
    sessions.push({ sessionId: key, parentId: "", state: nextState,
      observedAt: now, changedAt: changedAt, event: "Reported " + String(item.status || "unknown").slice(0, 32),
      approvalNoted: nextState === "approval-requested", source: "Herdr",
      displayName: typeof item.name === "string" ? item.name.replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 64) : "Herdr agent" })
  })
  return { revision: previous.revision + 1, sessions: sessions }
}

function snapshot(state, now, enabled, staleAfterMs) {
  var staleAfter = typeof staleAfterMs === "number" && staleAfterMs > 0 ? staleAfterMs : 300000
  var sessions = state.sessions.map(function(session) {
    var age = Math.max(0, now - session.observedAt)
    return Object.assign({}, session, { ageSeconds: Math.floor(age / 1000), stale: !enabled || age >= staleAfter })
  })
  var grouped = []
  var emitted = Object.create(null)
  function append(session) {
    if (emitted[session.sessionId]) return
    emitted[session.sessionId] = true
    grouped.push(session)
    sessions.filter(function(child) { return child.parentId === session.sessionId }).forEach(append)
  }
  sessions.filter(function(session) { return !session.parentId }).forEach(append)
  sessions.forEach(append)
  return { revision: state.revision, enabled: enabled, sessions: grouped,
    working: sessions.filter(function(item) { return item.state === "working" && !item.stale }).length,
    blocked: sessions.filter(function(item) { return item.state === "blocked" && !item.stale }).length,
    attention: sessions.filter(function(item) { return (item.approvalNoted || item.state === "blocked") && !item.stale }).length }
}

function hasCurrentSessions(snapshot, nowMs) {
  return snapshot.sessions.some(function(session) {
    if (session.stale || ["disconnected", "unknown"].indexOf(session.state) >= 0) return false
    if (["turn-ended", "interrupted"].indexOf(session.state) >= 0) {
      var changedAt = typeof session.changedAt === "number" ? session.changedAt : session.observedAt
      return typeof nowMs === "number" && changedAt > 0 && nowMs < changedAt + 8000
    }
    return true
  })
}

if (typeof module !== "undefined") module.exports = { initialState: initialState, fromHook: fromHook, fromHerdr: fromHerdr, ingest: ingest, snapshot: snapshot, hasCurrentSessions: hasCurrentSessions }
