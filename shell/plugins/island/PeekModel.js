var COALESCE_MS = 250
var ACTIVE_MS = 5000
var MAX_BASELINE_ENTITIES = 128
var CODEX_WINDOWS = ["weekly", "session"]
var CODEX_THRESHOLDS = [25, 10, 5]

var RANK = {
  agentAttention: 600,
  systemAttention: 580,
  notificationCritical: 550,
  notificationNormal: 500,
  notificationLow: 450,
  agentInterrupted: 430,
  agentFinished: 420,
  systemTerminal: 410,
  systemOngoing: 400,
  agentWorking: 350,
  codexReset: 440,
  codexDrop: 430,
  codexLow: 470,
  codexWarning: 520,
  codexCritical: 560,
  media: 300
}

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key)
}

function finite(value) {
  return typeof value === "number" && isFinite(value)
}

function cleanText(value, maximum) {
  if (typeof value !== "string") return ""
  return value.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
}

function normalizeTargetScreens(value) {
  if (!Array.isArray(value)) return []
  var result = []
  for (var index = 0; index < value.length; index++) {
    var screen = cleanText(value[index], 160)
    if (screen && result.indexOf(screen) < 0) result.push(screen)
  }
  return result
}

function emptyEntities() {
  return Object.create(null)
}

function copyEntities(value) {
  var result = emptyEntities()
  var keys = value && typeof value === "object" ? Object.keys(value) : []
  for (var index = 0; index < keys.length; index++) {
    var item = value[keys[index]]
    result[keys[index]] = item && typeof item === "object" ? Object.assign({}, item) : item
  }
  return result
}

function trimEntities(value) {
  var keys = Object.keys(value)
  for (var index = 0; index < keys.length - MAX_BASELINE_ENTITIES; index++) delete value[keys[index]]
  return value
}

function sourceState() {
  return { initialized: false, ready: false, backend: "", entities: emptyEntities() }
}

function codexSourceState() {
  return { weekly: null, session: null }
}

function copyCodexSource(raw) {
  var source = raw || codexSourceState()
  return {
    weekly: source.weekly ? Object.assign({}, source.weekly) : null,
    session: source.session ? Object.assign({}, source.session) : null
  }
}

function codexBaseline(remaining, resetAt) {
  var lowest = null
  for (var index = 0; index < CODEX_THRESHOLDS.length; index++) {
    if (remaining < CODEX_THRESHOLDS[index]) lowest = CODEX_THRESHOLDS[index]
  }
  return { remaining: remaining, dropAnchor: remaining, lowestThreshold: lowest, resetAt: resetAt }
}

function codexCandidate(window, kind, remaining, threshold, nowMs) {
  var low = threshold !== null
  var rank = kind === "codex-reset" ? RANK.codexReset : !low ? RANK.codexDrop
    : threshold === 5 ? RANK.codexCritical : threshold === 10 ? RANK.codexWarning : RANK.codexLow
  return {
    source: "codex", subjectKey: "codex:" + window, entityKey: "hub:codex", tool: "codex",
    kind: kind, occurredAt: nowMs, rank: rank,
    summary: {
      icon: "codex", label: window === "weekly" ? "Codex weekly" : "Codex 5-hour",
      value: remaining + "% left" + (kind === "codex-reset" ? " · reset"
        : low ? " · below " + threshold + "%" : "")
    }
  }
}

function updateCodexSource(previous, sources, nowMs) {
  if (!own(sources, "codex")) return { state: previous, candidates: [] }
  var snapshot = sources.codex || {}
  var state = copyCodexSource(previous)
  var candidates = []
  for (var index = 0; index < CODEX_WINDOWS.length; index++) {
    var window = CODEX_WINDOWS[index]
    var remaining = window === "weekly" ? snapshot.remaining
      : finite(snapshot.sessionUsed) ? 100 - snapshot.sessionUsed : null
    if (snapshot.available !== true || !finite(remaining) || remaining < 0 || remaining > 100) {
      state[window] = null
      continue
    }
    var epoch = window === "weekly" ? snapshot.weeklyResetAt : snapshot.sessionResetAt
    epoch = finite(epoch) && epoch > 0 ? epoch : null
    var prior = state[window]
    if (!prior) {
      state[window] = codexBaseline(remaining, epoch)
      continue
    }
    if (epoch !== null && prior.resetAt !== null && epoch < prior.resetAt) continue
    if (epoch !== null && prior.resetAt !== null && epoch > prior.resetAt) {
      state[window] = codexBaseline(remaining, epoch)
      candidates.push(codexCandidate(window, "codex-reset", remaining, null, nowMs))
      continue
    }
    var next = Object.assign({}, prior, { remaining: remaining, resetAt: epoch === null ? prior.resetAt : epoch })
    var threshold = null
    for (var thresholdIndex = 0; thresholdIndex < CODEX_THRESHOLDS.length; thresholdIndex++) {
      var boundary = CODEX_THRESHOLDS[thresholdIndex]
      if (remaining < boundary && (prior.lowestThreshold === null || boundary < prior.lowestThreshold)) threshold = boundary
    }
    var dropped = prior.dropAnchor - remaining >= 10
    if (dropped) next.dropAnchor -= Math.floor((prior.dropAnchor - remaining) / 10) * 10
    if (threshold !== null) next.lowestThreshold = threshold
    if (threshold !== null || dropped) {
      candidates.push(codexCandidate(window, threshold !== null ? "codex-low" : "codex-drop", remaining, threshold, nowMs))
    }
    state[window] = next
  }
  return { state: state, candidates: candidates }
}

function copyCandidate(raw) {
  if (!raw || typeof raw !== "object") return null
  return Object.assign({}, raw, {
    summary: raw.summary && typeof raw.summary === "object" ? Object.assign({}, raw.summary) : {}
  })
}

function copyPending(raw) {
  if (!raw || typeof raw !== "object") return null
  return {
    candidate: copyCandidate(raw.candidate),
    coalesceUntil: raw.coalesceUntil,
    targetScreens: normalizeTargetScreens(raw.targetScreens)
  }
}

function copyActive(raw) {
  if (!raw || typeof raw !== "object") return null
  return {
    candidate: copyCandidate(raw.candidate),
    shownAt: raw.shownAt,
    expiresAt: raw.expiresAt,
    targetScreens: normalizeTargetScreens(raw.targetScreens)
  }
}

function initialState() {
  return {
    revision: 0,
    sequence: 0,
    sources: {
      notifications: sourceState(),
      agents: sourceState(),
      media: sourceState(),
      system: sourceState(),
      codex: codexSourceState()
    },
    pending: null,
    active: null
  }
}

function copySource(raw) {
  if (!raw || typeof raw !== "object") return sourceState()
  return {
    initialized: raw.initialized === true,
    ready: raw.ready === true,
    backend: cleanText(raw.backend, 80),
    entities: copyEntities(raw.entities)
  }
}

function usableState(previous) {
  if (!previous || typeof previous !== "object" || !previous.sources) return initialState()
  return {
    revision: finite(previous.revision) ? previous.revision : 0,
    sequence: finite(previous.sequence) ? previous.sequence : 0,
    sources: {
      notifications: copySource(previous.sources.notifications),
      agents: copySource(previous.sources.agents),
      media: copySource(previous.sources.media),
      system: copySource(previous.sources.system),
      codex: copyCodexSource(previous.sources.codex)
    },
    pending: copyPending(previous.pending),
    active: copyActive(previous.active)
  }
}

function fingerprint(value) {
  return JSON.stringify(value)
}

function sameEntity(left, right) {
  return fingerprint(left) === fingerprint(right)
}

function snapshotResult(provided, ready, backend, entities, changes) {
  return {
    provided: provided,
    ready: ready,
    backend: backend || "",
    entities: entities || emptyEntities(),
    changes: changes || []
  }
}

function notificationSnapshot(input) {
  if (!own(input, "notifications")) return snapshotResult(false, false)
  var snapshot = input.notifications
  if (!snapshot || typeof snapshot !== "object" || snapshot.available !== true || snapshot.ready === false) {
    return snapshotResult(true, false)
  }
  var entries = Array.isArray(snapshot.entries) ? snapshot.entries.slice() : []
  if (snapshot.preview && entries.indexOf(snapshot.preview) < 0) entries.push(snapshot.preview)
  var entities = emptyEntities()
  var changes = []
  for (var index = 0; index < entries.length; index++) {
    var entry = entries[index]
    if (!entry || entry.live !== true) continue
    var key = cleanText(entry.key, 256)
    if (!key) continue
    var semantic = {
      app: cleanText(entry.app, 80),
      summary: cleanText(entry.summary, 160),
      body: cleanText(entry.body, 512),
      urgency: entry.urgency === "critical" || entry.urgency === 2 ? "critical"
        : entry.urgency === "low" || entry.urgency === 0 ? "low" : "normal"
    }
    if (!own(entities, key)) {
      entities[key] = semantic
      changes.push({ key: key, semantic: semantic, raw: entry })
    }
  }
  return snapshotResult(true, true, cleanText(snapshot.backend, 80) || "native", entities, changes)
}

function agentBackend(snapshot, sessions) {
  var explicit = cleanText(snapshot.backend || snapshot.sourceLabel || snapshot.source, 80)
  if (explicit && explicit !== "No live agent source") return explicit
  var found = emptyEntities()
  for (var index = 0; index < sessions.length; index++) {
    var source = cleanText(sessions[index] && sessions[index].source, 80)
    if (source) found[source] = true
  }
  return Object.keys(found).sort().join("+")
}

function agentSnapshot(input) {
  if (!own(input, "agents")) return snapshotResult(false, false)
  var snapshot = input.agents
  if (!snapshot || typeof snapshot !== "object" || snapshot.enabled !== true || snapshot.ready === false
      || !Array.isArray(snapshot.sessions)) {
    return snapshotResult(true, false)
  }
  var entities = emptyEntities()
  var changes = []
  for (var index = 0; index < snapshot.sessions.length; index++) {
    var session = snapshot.sessions[index]
    if (!session || typeof session !== "object") continue
    var key = cleanText(session.sessionId, 160)
    if (!key || own(entities, key)) continue
    var state = cleanText(session.state, 40)
    var semantic = {
      state: state,
      approval: session.approvalNoted === true,
      source: cleanText(session.source, 80)
    }
    entities[key] = semantic
    changes.push({
      key: key,
      semantic: semantic,
      stale: session.stale === true,
      label: cleanText(session.displayName, 64) || "Agent"
    })
  }
  return snapshotResult(true, true, agentBackend(snapshot, snapshot.sessions), entities, changes)
}

function directMediaEntries(snapshot) {
  if (Array.isArray(snapshot.entries)) return snapshot.entries
  if (snapshot.current && typeof snapshot.current === "object") return [snapshot.current]
  if (own(snapshot, "trackToken") || own(snapshot, "title") || own(snapshot, "playing")) return [snapshot]
  return []
}

function mediaSnapshot(input) {
  var direct = own(input, "media")
  var activities = own(input, "activitiesByKey")
  if (!direct && !activities) return snapshotResult(false, false)
  var entities = emptyEntities()
  var changes = []
  if (direct) {
    var snapshot = input.media
    if (!snapshot || typeof snapshot !== "object" || snapshot.available === false || snapshot.ready === false) {
      return snapshotResult(true, false)
    }
    var entries = directMediaEntries(snapshot)
    for (var entryIndex = 0; entryIndex < entries.length; entryIndex++) {
      var directEntry = entries[entryIndex]
      appendMedia(entities, changes, directEntry && (directEntry.entityKey || directEntry.key) || "media", directEntry)
    }
  } else {
    var map = input.activitiesByKey
    if (!map || typeof map !== "object") return snapshotResult(true, false)
    var keys = Object.keys(map)
    for (var index = 0; index < keys.length; index++) {
      var activity = map[keys[index]]
      if (activity && activity.media) appendMedia(entities, changes, keys[index], activity.media)
    }
  }
  return snapshotResult(true, true, "activity", entities, changes)
}

function appendMedia(entities, changes, rawKey, media) {
  if (!media || typeof media !== "object") return
  var key = cleanText(rawKey, 256)
  if (!key || own(entities, key)) return
  var semantic = {
    sourceIdentity: cleanText(media.sourceIdentity || media.playerKey || media.trackToken, 256),
    title: cleanText(media.title, 160),
    artist: cleanText(media.artist, 160),
    playing: media.playing === true || media.isPlaying === true
  }
  if (!semantic.sourceIdentity && !semantic.title && !semantic.artist) return
  entities[key] = semantic
  changes.push({ key: key, semantic: semantic })
}

function systemSnapshot(input) {
  if (!own(input, "system")) return snapshotResult(false, false)
  var snapshot = input.system
  if (!snapshot || typeof snapshot !== "object" || snapshot.available !== true || !Array.isArray(snapshot.events)) {
    return snapshotResult(true, false)
  }
  var entities = emptyEntities()
  var changes = []
  for (var index = 0; index < snapshot.events.length; index++) {
    var event = snapshot.events[index]
    if (!event || typeof event !== "object") continue
    var key = cleanText(event.key, 256)
    var phase = cleanText(event.phase, 24)
    if (!key || own(entities, key) || ["attention", "ongoing", "terminal"].indexOf(phase) < 0
      || !finite(event.occurredAt) || event.occurredAt < 0) continue
    var semantic = { phase: phase, occurredAt: event.occurredAt }
    entities[key] = semantic
    changes.push({
      key: key,
      semantic: semantic,
      label: cleanText(event.label, 120) || "System",
      value: cleanText(event.value, 200),
      icon: cleanText(event.icon, 24) || "!"
    })
  }
  return snapshotResult(true, true, "system", entities, changes)
}

function notificationCandidate(change, previous, nowMs) {
  var urgency = change.semantic.urgency
  return {
    source: "notifications",
    subjectKey: change.key,
    entityKey: "notification:" + change.key,
    tool: "notifications",
    kind: previous ? "notification-updated" : "notification-new",
    occurredAt: nowMs,
    rank: urgency === "critical" ? RANK.notificationCritical : urgency === "low" ? RANK.notificationLow : RANK.notificationNormal,
    summary: {
      icon: "bell",
      label: change.semantic.app || "Notification",
      value: change.semantic.summary || change.semantic.body
    }
  }
}

function agentCandidate(change, previous, nowMs) {
  if (change.stale) return null
  var state = change.semantic.approval ? "approval-requested" : change.semantic.state
  var reported = change.semantic.source === "Herdr"
  var kind = ""
  var value = ""
  var rank = 0
  if (state === "approval-requested") {
    kind = "agent-approval"
    value = "Approval needed"
    rank = RANK.agentAttention
  } else if (state === "blocked") {
    kind = "agent-blocked"
    value = "Blocked"
    rank = RANK.agentAttention
  } else if (state === "working") {
    kind = "agent-working"
    value = reported ? "Working · reported" : previous ? "Working" : "Started working"
    rank = RANK.agentWorking
  } else if (state === "idle" && !previous) {
    kind = "agent-started"
    value = reported ? "Idle · reported" : "Session started"
    rank = RANK.agentWorking
  } else if (state === "idle" || state === "turn-ended") {
    kind = "agent-finished"
    value = reported ? "Idle · reported" : state === "turn-ended" ? "Turn ended" : "Finished"
    rank = RANK.agentFinished
  } else if (state === "interrupted") {
    kind = "agent-interrupted"
    value = "Interrupted"
    rank = RANK.agentInterrupted
  } else if (state === "disconnected") {
    kind = "agent-disconnected"
    value = "Disconnected"
    rank = RANK.agentFinished
  }
  if (!kind) return null
  return {
    source: "agents",
    subjectKey: change.key,
    entityKey: "hub:agents",
    tool: "agents",
    kind: kind,
    occurredAt: nowMs,
    rank: rank,
    summary: { icon: "󰚩", label: change.label, value: value }
  }
}

function mediaCandidate(change, previous, nowMs) {
  var semantic = change.semantic
  var kind = previous && previous.sourceIdentity === semantic.sourceIdentity
    && previous.title === semantic.title && previous.artist === semantic.artist
    ? "media-playback" : "media-track"
  return {
    source: "media",
    subjectKey: change.key,
    entityKey: change.key,
    tool: "music",
    kind: kind,
    occurredAt: nowMs,
    rank: RANK.media,
    summary: {
      icon: semantic.playing ? "▶" : "Ⅱ",
      label: semantic.title || "Media",
      value: semantic.artist || (semantic.playing ? "Playing" : "Paused")
    }
  }
}

function systemCandidate(change, nowMs) {
  var phase = change.semantic.phase
  return {
    source: "system",
    subjectKey: change.key,
    entityKey: change.key,
    tool: "system",
    kind: phase === "terminal" ? "system-recovered" : "system-warning",
    occurredAt: finite(change.semantic.occurredAt) ? change.semantic.occurredAt : nowMs,
    rank: phase === "attention" ? RANK.systemAttention : phase === "terminal" ? RANK.systemTerminal : RANK.systemOngoing,
    summary: { icon: change.icon, label: change.label, value: change.value }
  }
}

function candidatesFor(name, prior, snapshot, nowMs) {
  var candidates = []
  for (var index = 0; index < snapshot.changes.length; index++) {
    var change = snapshot.changes[index]
    var previous = own(prior.entities, change.key) ? prior.entities[change.key] : null
    if (previous && sameEntity(previous, change.semantic)) continue
    var candidate = name === "notifications" ? notificationCandidate(change, previous, nowMs)
      : name === "agents" ? agentCandidate(change, previous, nowMs)
      : name === "media" ? mediaCandidate(change, previous, nowMs)
      : systemCandidate(change, nowMs)
    if (candidate) candidates.push(candidate)
  }
  return candidates
}

function updateSource(prior, snapshot, name, nowMs) {
  if (!snapshot.provided) return { state: prior, candidates: [] }
  if (!snapshot.ready) {
    if (!prior.ready) return { state: prior, candidates: [] }
    return {
      state: { initialized: prior.initialized, ready: false, backend: "", entities: copyEntities(prior.entities) },
      candidates: []
    }
  }
  var rebaseline = !prior.initialized || !prior.ready
    || ((name === "agents" || name === "notifications") && prior.backend && snapshot.backend
      && prior.backend !== snapshot.backend)
  if (rebaseline) {
    return {
      state: {
        initialized: true,
        ready: true,
        backend: snapshot.backend,
        entities: trimEntities(copyEntities(snapshot.entities))
      },
      candidates: []
    }
  }
  var candidates = candidatesFor(name, prior, snapshot, nowMs)
  var entities = copyEntities(prior.entities)
  var keys = Object.keys(snapshot.entities)
  for (var index = 0; index < keys.length; index++) entities[keys[index]] = Object.assign({}, snapshot.entities[keys[index]])
  trimEntities(entities)
  return {
    state: { initialized: true, ready: true, backend: snapshot.backend || prior.backend, entities: entities },
    candidates: candidates
  }
}

function betterCandidate(left, right) {
  if (!left) return right
  if (!right) return left
  if (left.rank !== right.rank) return right.rank > left.rank ? right : left
  if (left.occurredAt !== right.occurredAt) return right.occurredAt > left.occurredAt ? right : left
  return right.sequence > left.sequence ? right : left
}

function advanceTime(state, nowMs) {
  if (state.active && state.active.expiresAt <= nowMs) state.active = null
  if (!state.pending || state.pending.coalesceUntil > nowMs) return
  var shownAt = state.pending.coalesceUntil
  var expiresAt = shownAt + ACTIVE_MS
  if (expiresAt > nowMs) {
    state.active = {
      candidate: state.pending.candidate,
      shownAt: shownAt,
      expiresAt: expiresAt,
      targetScreens: state.pending.targetScreens.slice()
    }
  }
  state.pending = null
}

function retainRecipients(lease, screens) {
  if (!lease) return null
  lease.targetScreens = lease.targetScreens.filter(function(screen) { return screens.indexOf(screen) >= 0 })
  return lease.targetScreens.length ? lease : null
}

function continuePendingHandoff(state, expired, nowMs) {
  if (state.active || !expired || !state.pending || expired.expiresAt > nowMs
      || nowMs - expired.expiresAt > COALESCE_MS || state.pending.coalesceUntil <= nowMs
      || state.pending.coalesceUntil - nowMs > COALESCE_MS) return
  var retained = retainRecipients(copyActive(expired), state.pending.targetScreens)
  if (!retained) return
  retained.expiresAt = state.pending.coalesceUntil
  state.active = retained
}

function stateFingerprint(state) {
  return JSON.stringify({
    sequence: state.sequence,
    sources: state.sources,
    pending: state.pending,
    active: state.active
  })
}

function nextWakeAt(state) {
  var wake = null
  if (state.pending) wake = state.pending.coalesceUntil
  if (state.active && (wake === null || state.active.expiresAt < wake)) wake = state.active.expiresAt
  return wake
}

function consume(previous, id) {
  var prior = previous && previous.sources ? previous : initialState()
  var active = prior.active && prior.active.candidate ? prior.active : null
  if (!active || typeof id !== "string" || id === "" || active.candidate.id !== id) {
    return { state: prior, active: prior.active || null, nextWakeAt: nextWakeAt(prior), changed: false }
  }
  var state = usableState(prior)
  state.active = null
  state.revision = (finite(prior.revision) ? prior.revision : 0) + 1
  return { state: state, active: null, nextWakeAt: nextWakeAt(state), changed: true }
}

function reconcile(previous, rawSources, rawContext) {
  var prior = previous && previous.sources ? previous : initialState()
  var state = usableState(prior)
  var before = stateFingerprint(state)
  var sources = rawSources && typeof rawSources === "object" ? rawSources : {}
  var context = rawContext && typeof rawContext === "object" ? rawContext : {}
  var nowMs = finite(context.nowMs) && context.nowMs >= 0 ? context.nowMs : 0
  var targetScreens = normalizeTargetScreens(context.targetScreens)
  state.pending = retainRecipients(state.pending, targetScreens)
  state.active = retainRecipients(state.active, targetScreens)
  var priorActive = state.active
  advanceTime(state, nowMs)

  var snapshots = {
    notifications: notificationSnapshot(sources),
    agents: agentSnapshot(sources),
    media: mediaSnapshot(sources),
    system: systemSnapshot(sources)
  }
  var candidates = []
  var names = ["notifications", "agents", "media", "system", "codex"]
  for (var index = 0; index < names.length; index++) {
    var name = names[index]
    var update = name === "codex" ? updateCodexSource(state.sources.codex, sources, nowMs)
      : updateSource(state.sources[name], snapshots[name], name, nowMs)
    state.sources[name] = update.state
    for (var candidateIndex = 0; candidateIndex < update.candidates.length; candidateIndex++) {
      state.sequence += 1
      candidates.push(Object.assign({}, update.candidates[candidateIndex], {
        id: "peek:" + state.sequence,
        sequence: state.sequence
      }))
    }
  }

  var notificationDnd = snapshots.notifications.provided && sources.notifications
    && sources.notifications.dnd === true
  var suppressed = context.dnd === true || notificationDnd || context.fullscreen === true
    || targetScreens.length === 0
  if (suppressed) {
    state.pending = null
    state.active = null
  } else {
    var selected = null
    for (var selectIndex = 0; selectIndex < candidates.length; selectIndex++) {
      selected = betterCandidate(selected, candidates[selectIndex])
    }
    if (selected) {
      if (state.pending) {
        var winner = betterCandidate(state.pending.candidate, selected)
        if (winner === selected) state.pending.targetScreens = targetScreens.slice()
        state.pending.candidate = winner
      } else {
        state.pending = {
          candidate: selected,
          coalesceUntil: nowMs + COALESCE_MS,
          targetScreens: targetScreens.slice()
        }
      }
    }
    continuePendingHandoff(state, priorActive, nowMs)
  }

  var after = stateFingerprint(state)
  if (before === after && previous && previous.sources) {
    return { state: previous, active: previous.active || null, nextWakeAt: nextWakeAt(previous), changed: false }
  }
  state.revision = (finite(prior.revision) ? prior.revision : 0) + 1
  return { state: state, active: state.active, nextWakeAt: nextWakeAt(state), changed: true }
}

if (typeof module !== "undefined") module.exports = {
  COALESCE_MS: COALESCE_MS,
  ACTIVE_MS: ACTIVE_MS,
  RANK: RANK,
  initialState: initialState,
  consume: consume,
  reconcile: reconcile
}
