var TOOLS = ["music", "weather", "codex", "agents", "notifications", "system"]
var PAUSE_GRACE_MS = 15000
var AGENT_TERMINAL_MS = 8000

var RANK = {
  attention: 600,
  notification: 500,
  active: 400,
  busy: 300,
  terminal: 200,
  ambient: 100
}

function finite(value) {
  return typeof value === "number" && isFinite(value)
}

function text(value) {
  return typeof value === "string" ? value : ""
}

function cloneMap(source) {
  var result = {}
  var keys = source && typeof source === "object" ? Object.keys(source) : []
  for (var index = 0; index < keys.length; index++) result[keys[index]] = Object.assign({}, source[keys[index]])
  return result
}

function card(tool, label, value, icon, revision) {
  return {
    key: "hub:" + tool,
    tool: tool,
    label: text(label),
    value: text(value),
    icon: text(icon),
    minimalValue: text(icon),
    revision: finite(revision) ? revision : 0,
    actions: [],
    media: null,
    expanded: null
  }
}

function neutralCard() {
  return card("music", "Island", "", "◦", 0)
}

function title(tool) {
  return tool.charAt(0).toUpperCase() + tool.slice(1)
}

function iconForTool(tool) {
  return { music: "media", weather: "weather", codex: "codex", agents: "robot", notifications: "bell", system: "CPU" }[tool] || "◦"
}

function emptySchedule() {
  var primary = neutralCard()
  var byTool = {}
  for (var index = 0; index < TOOLS.length; index++) byTool[TOOLS[index]] = card(TOOLS[index], title(TOOLS[index]), "", iconForTool(TOOLS[index]))
  byTool.music = primary
  var byKey = {}
  for (var toolIndex = 0; toolIndex < TOOLS.length; toolIndex++) byKey[byTool[TOOLS[toolIndex]].key] = byTool[TOOLS[toolIndex]]
  return {
    primary: primary,
    secondary: null,
    byKey: byKey,
    byTool: byTool,
    candidateCount: 0,
    availableCount: TOOLS.length,
    revision: 0,
    reason: "neutral"
  }
}

function scheduleFingerprint(schedule) {
  return JSON.stringify({
    primary: schedule.primary,
    secondary: schedule.secondary,
    byKey: schedule.byKey,
    byTool: schedule.byTool,
    candidateCount: schedule.candidateCount,
    availableCount: schedule.availableCount,
    reason: schedule.reason
  })
}

function initialState() {
  var schedule = emptySchedule()
  return {
    tool: "music",
    entityKey: "hub:music",
    ownerScreen: "",
    expanded: false,
    chooserOpen: false,
    pendingRoute: null,
    retainedCard: null,
    layout: null,
    layoutError: "",
    revision: 0,
    lifecycleByKey: {},
    schedule: schedule,
    scheduleFingerprint: scheduleFingerprint(schedule)
  }
}

function routeCard(previous, tool, key) {
  var schedule = previous && previous.schedule ? previous.schedule : emptySchedule()
  var selected = schedule.byKey && schedule.byKey[key] ? schedule.byKey[key] : null
  if (!selected && key === "hub:" + tool && schedule.byTool) selected = schedule.byTool[tool]
  if (!selected) selected = card(tool, title(tool), "No longer live", iconForTool(tool))
  return Object.assign({}, selected, { key: key, tool: tool })
}

function prepareRoute(previous, tool, screen, entityKey, keepChooser) {
  if (TOOLS.indexOf(tool) < 0 || typeof screen !== "string" || !screen) return previous
  var scheduled = previous && previous.schedule && previous.schedule.byTool ? previous.schedule.byTool[tool] : null
  var key = typeof entityKey === "string" && entityKey ? entityKey : scheduled && scheduled.key ? scheduled.key : "hub:" + tool
  if (previous.expanded && previous.tool === tool && previous.ownerScreen === screen && previous.entityKey === key) {
    if (!previous.chooserOpen) return previous
    return Object.assign({}, previous, { chooserOpen: false, pendingRoute: null, revision: previous.revision + 1 })
  }
  var pending = previous.pendingRoute
  if (pending && pending.tool === tool && pending.ownerScreen === screen && pending.entityKey === key) return previous
  return Object.assign({}, previous, {
    pendingRoute: {
      tool: tool,
      entityKey: key,
      ownerScreen: screen,
      retainedCard: routeCard(previous, tool, key)
    },
    chooserOpen: keepChooser === true && previous.chooserOpen === true,
    layoutError: "",
    revision: previous.revision + 1
  })
}

function navigate(previous, tool, screen, entityKey) {
  return prepareRoute(previous, tool, screen, entityKey, false)
}

function toggleChooser(previous, screen) {
  if (!previous || !previous.expanded || previous.ownerScreen !== screen) return previous
  var open = previous.chooserOpen !== true
  return Object.assign({}, previous, {
    chooserOpen: open,
    pendingRoute: null,
    revision: previous.revision + 1
  })
}

function closeChooser(previous, screen) {
  if (!previous || previous.ownerScreen !== screen || previous.chooserOpen !== true) return previous
  return Object.assign({}, previous, { chooserOpen: false, pendingRoute: null, revision: previous.revision + 1 })
}

function chooseTool(previous, tool, screen) {
  if (!previous || previous.chooserOpen !== true || !previous.expanded || previous.ownerScreen !== screen) return previous
  return prepareRoute(previous, tool, screen, "hub:" + tool, true)
}

function normalizeLayout(report) {
  if (!report || typeof report.screen !== "string" || !report.screen
      || typeof report.key !== "string" || !report.key
      || !finite(report.widthToken) || report.widthToken <= 0
      || !finite(report.expectedWidthToken) || report.expectedWidthToken <= 0
      || Math.round(report.widthToken) !== Math.round(report.expectedWidthToken)
      || !finite(report.preferredHeight) || report.preferredHeight <= 0
      || !finite(report.heightBudget) || report.heightBudget <= 0) return null
  return {
    screen: report.screen,
    key: report.key,
    widthToken: Math.max(1, Math.round(report.widthToken)),
    preferredHeight: Math.max(1, Math.round(report.preferredHeight)),
    heightBudget: Math.max(1, Math.round(report.heightBudget))
  }
}

function sameLayout(left, right) {
  return !!left && !!right && left.screen === right.screen && left.key === right.key
    && left.widthToken === right.widthToken && left.preferredHeight === right.preferredHeight
    && left.heightBudget === right.heightBudget
}

function acceptLayout(previous, rawReport) {
  var report = normalizeLayout(rawReport)
  if (!previous || !report) return previous
  var pending = previous.pendingRoute
  if (pending) {
    if (pending.ownerScreen !== report.screen || pending.entityKey !== report.key) return previous
    if (report.preferredHeight > report.heightBudget) {
      return Object.assign({}, previous, {
        chooserOpen: false,
        pendingRoute: null,
        layoutError: "content-too-tall",
        revision: previous.revision + 1
      })
    }
    return Object.assign({}, previous, {
      tool: pending.tool,
      entityKey: pending.entityKey,
      ownerScreen: pending.ownerScreen,
      expanded: true,
      chooserOpen: false,
      pendingRoute: null,
      retainedCard: pending.retainedCard,
      layout: report,
      layoutError: "",
      revision: previous.revision + 1
    })
  }
  if (!previous.expanded || previous.ownerScreen !== report.screen || previous.entityKey !== report.key) return previous
  if (report.preferredHeight > report.heightBudget) {
    return Object.assign({}, previous, {
      ownerScreen: "",
      expanded: false,
      chooserOpen: false,
      pendingRoute: null,
      layout: null,
      layoutError: "content-too-tall",
      revision: previous.revision + 1
    })
  }
  if (sameLayout(previous.layout, report)) return previous
  return Object.assign({}, previous, { layout: report, layoutError: "", revision: previous.revision + 1 })
}

function collapse(previous) {
  if (!previous.expanded && !previous.ownerScreen && !previous.pendingRoute) return previous
  return Object.assign({}, previous, {
    ownerScreen: "",
    expanded: false,
    chooserOpen: false,
    pendingRoute: null,
    layoutError: "",
    revision: previous.revision + 1
  })
}

function surfaceCard(activity, key) {
  var compact = activity && (activity.compact || activity.minimal) ? (activity.compact || activity.minimal) : {}
  var minimal = activity && activity.minimal ? activity.minimal : compact
  return {
    key: key,
    tool: "music",
    label: text(compact.label),
    value: text(compact.value),
    icon: text(compact.icon) || "♪",
    minimalValue: text(minimal.value) || text(minimal.icon) || "♪",
    progress: finite(compact.progress) ? compact.progress : null,
    revision: activity && finite(activity.revision) ? activity.revision : 0,
    actions: activity && Array.isArray(activity.actions) ? activity.actions.slice() : [],
    media: activity && activity.media ? activity.media : null,
    expanded: activity && activity.expanded ? activity.expanded : null
  }
}

function rememberSignal(records, key, signal, nowMs) {
  var previous = records[key]
  if (previous && previous.signal === signal) return previous
  var record = { signal: signal, changedAt: nowMs, pausedAt: signal === "paused" ? nowMs : null }
  records[key] = record
  return record
}

function addCandidate(candidates, content, phase, stableAt, occurredAt, detailRank) {
  candidates.push({
    content: content,
    phase: phase,
    rank: RANK[phase],
    stableAt: finite(stableAt) ? stableAt : 0,
    occurredAt: finite(occurredAt) ? occurredAt : 0,
    detailRank: finite(detailRank) ? detailRank : 0
  })
}

function candidateOrder(left, right) {
  if (left.rank !== right.rank) return right.rank - left.rank
  if (left.detailRank !== right.detailRank) return right.detailRank - left.detailRank
  if (left.phase === "notification" || left.phase === "terminal") {
    if (left.occurredAt !== right.occurredAt) return right.occurredAt - left.occurredAt
  } else if (left.stableAt !== right.stableAt) {
    return left.stableAt - right.stableAt
  }
  return left.content.key < right.content.key ? -1 : left.content.key > right.content.key ? 1 : 0
}

function earlierWake(current, candidate, nowMs) {
  if (!finite(candidate) || candidate <= nowMs) return current
  return current === null || candidate < current ? candidate : current
}

function codexCard(snapshot) {
  var source = snapshot && typeof snapshot === "object" ? snapshot : {}
  var remaining = typeof source.remaining === "number" && finite(source.remaining)
    ? Math.max(0, Math.min(100, Math.round(source.remaining))) : null
  var weeklyUsed = typeof source.weeklyUsed === "number" && finite(source.weeklyUsed)
    ? Math.max(0, Math.min(100, Math.round(source.weeklyUsed))) : null
  var value = source.providerPresent !== true ? "Provider unavailable"
    : source.available !== true ? "Usage unavailable"
      : remaining !== null ? remaining + "% weekly left"
        : weeklyUsed !== null ? weeklyUsed + "% weekly used" : "Usage unavailable"
  var result = card("codex", "Codex usage", value, iconForTool("codex"), weeklyUsed === null ? 0 : weeklyUsed)
  result.minimalValue = iconForTool("codex")
  return result
}

function weatherCard(snapshot) {
  var location = snapshot && snapshot.location ? snapshot.location : {}
  var result = card("weather", text(location.name) || text(location.label) || "Weather", "Set location", text(snapshot && snapshot.icon) || "☀", snapshot && snapshot.fetchedAt)
  if (snapshot && snapshot.current && finite(snapshot.current.temperature)) result.value = Math.round(snapshot.current.temperature) + "°"
  result.minimalValue = snapshot && snapshot.current ? result.value : result.icon
  return result
}

function agentCard(snapshot) {
  var numericWorking = Number(snapshot && snapshot.working)
  var numericAttention = Number(snapshot && snapshot.attention)
  var numericBlocked = Number(snapshot && snapshot.blocked)
  var working = finite(numericWorking) ? Math.max(0, Math.floor(numericWorking)) : 0
  var attention = finite(numericAttention) ? Math.max(0, Math.floor(numericAttention)) : 0
  var blocked = finite(numericBlocked) ? Math.max(0, Math.floor(numericBlocked)) : 0
  var value = blocked ? blocked + (blocked === 1 ? " blocked agent" : " blocked agents")
    : attention ? attention + (attention === 1 ? " approval" : " approvals")
    : working ? working + (working === 1 ? " agent working" : " agents working") : snapshot && snapshot.enabled ? "Agents idle" : "Not connected"
  var semanticRevision = 0
  var sessions = snapshot && Array.isArray(snapshot.sessions) ? snapshot.sessions : []
  for (var index = 0; index < sessions.length; index++) {
    if (finite(sessions[index] && sessions[index].changedAt)) semanticRevision = Math.max(semanticRevision, sessions[index].changedAt)
  }
  var result = card("agents", "Agents", value, iconForTool("agents"), semanticRevision)
  result.secondaryText = blocked ? "Blocked" : attention ? "Approve" : working ? "Working" : snapshot && snapshot.enabled ? "Idle" : "Offline"
  result.minimalValue = attention ? "!" : working ? String(working) : iconForTool("agents")
  return result
}

function agentSignalTime(snapshot, predicate) {
  var sessions = snapshot && Array.isArray(snapshot.sessions) ? snapshot.sessions : []
  var selected = null
  for (var index = 0; index < sessions.length; index++) {
    var session = sessions[index]
    if (!session || session.stale === true || !predicate(session)) continue
    var changedAt = finite(session.changedAt) ? session.changedAt : session.observedAt
    if (!finite(changedAt)) continue
    if (selected === null || changedAt < selected) selected = changedAt
  }
  return selected
}

function agentTerminal(snapshot, nowMs) {
  var sessions = snapshot && Array.isArray(snapshot.sessions) ? snapshot.sessions : []
  var selected = null
  var labels = { "turn-ended": "Turn ended", interrupted: "Interrupted", disconnected: "Disconnected" }
  for (var index = 0; index < sessions.length; index++) {
    var session = sessions[index]
    if (!session || session.stale === true || !Object.prototype.hasOwnProperty.call(labels, session.state)) continue
    var occurredAt = finite(session.changedAt) ? session.changedAt : session.observedAt
    if (!finite(occurredAt) || occurredAt > nowMs || occurredAt + AGENT_TERMINAL_MS <= nowMs) continue
    if (!selected || occurredAt > selected.occurredAt) {
      selected = { label: labels[session.state], icon: iconForTool("agents"), occurredAt: occurredAt, eligibleUntil: occurredAt + AGENT_TERMINAL_MS }
    }
  }
  return selected
}

function agentEligibility(snapshot) {
  var sessions = snapshot && Array.isArray(snapshot.sessions) ? snapshot.sessions : []
  if (!sessions.length) {
    var aggregateAttention = Math.max(0, Number(snapshot && snapshot.attention) || 0)
    var aggregateBlocked = Math.min(aggregateAttention, Math.max(0, Number(snapshot && snapshot.blocked) || 0))
    return { attention: aggregateAttention, blocked: aggregateBlocked,
      working: Math.max(0, Number(snapshot && snapshot.working) || 0) }
  }
  var attention = 0
  var blocked = 0
  var working = 0
  for (var index = 0; index < sessions.length; index++) {
    var session = sessions[index]
    if (!session || session.stale === true) continue
    if (session.state === "blocked" || session.status === "blocked") {
      attention += 1
      blocked += 1
    } else if (session.approvalNoted === true || session.state === "approval-requested") {
      attention += 1
    } else if (session.state === "working" || session.status === "working") working += 1
  }
  return { attention: attention, blocked: blocked, working: working }
}

function notificationCard(entry) {
  var result = card("notifications", text(entry && entry.app) || "Notification",
    text(entry && entry.summary) || text(entry && entry.body), entry && entry.urgency === "critical" ? "!" : "bell",
    entry && entry.timestamp)
  result.key = "notification:" + text(entry && entry.key)
  result.minimalValue = entry && entry.urgency === "critical" ? "!" : "•"
  result.notification = entry || null
  return result
}

function notificationsToolCard(snapshot) {
  var count = snapshot && Array.isArray(snapshot.entries) ? snapshot.entries.length : 0
  var result = card("notifications", "Notifications", count ? count + (count === 1 ? " recent alert" : " recent alerts") : "No recent alerts", "bell", count)
  result.minimalValue = "•"
  return result
}

function systemToolCard(snapshot) {
  var events = snapshot && Array.isArray(snapshot.events) ? snapshot.events : []
  var result = card("system", "System", events.length ? events.length + " live" : snapshot && snapshot.available ? "No sustained alerts" : "Unavailable", "CPU", events.length)
  result.minimalValue = "CPU"
  return result
}

function systemEventCard(event, revision, events) {
  var result = card("system", text(event && event.label) || "System", text(event && event.value), text(event && event.icon) || "CPU", revision)
  result.key = text(event && event.key) || "hub:system"
  if (result.key.indexOf("system:process:") === 0) {
    var processCount = 0
    var sourceEvents = Array.isArray(events) ? events : []
    for (var index = 0; index < sourceEvents.length; index++) {
      if (text(sourceEvents[index] && sourceEvents[index].key).indexOf("system:process:D:") === 0) processCount += 1
    }
    result.value = processCount + (processCount === 1 ? " blocked proc" : " blocked procs")
  }
  result.minimalValue = result.icon
  result.systemEvent = event || null
  return result
}

function compactTextFor(card, paired) {
  if (!card) return ""
  var label = text(card.label)
  var value = text(card.value)
  if (card.tool === "music") return label || "Music"
  if (card.tool === "weather") {
    if (paired) return value || "Weather"
    if (label && value) return label + " " + value
    return label || value || "Weather"
  }
  if (card.tool === "agents" && paired) return text(card.secondaryText) || "Agents"
  if (card.tool === "codex" || card.tool === "agents") return value || label
  if (card.tool === "notifications") {
    var app = text(card.notification && card.notification.app)
    var summary = text(card.notification && card.notification.summary)
    if (paired || !summary) return app || value || label || "Notifications"
    return app ? app + " · " + summary : value || label || "Notifications"
  }
  if (card.tool === "system") {
    var processEvent = text(card.key).indexOf("system:process:") === 0
    if (processEvent) return value || label || "System"
    var resourceLabel = {
      "system:cpu": "CPU",
      "system:ram": "RAM",
      "system:gpu": "GPU",
      "system:cpu-pressure": "CPU wait",
      "system:memory-pressure": "RAM wait",
      "system:io-pressure": "I/O wait"
    }[text(card.key)]
    if (resourceLabel && card.systemEvent && card.systemEvent.phase === "terminal") return resourceLabel + " normal"
    return resourceLabel && value ? resourceLabel + " " + value.split(" ")[0] : label && value ? label + " " + value : label || value || "System"
  }
  return label || value
}

function compactCard(card, paired) {
  if (!card) return null
  return Object.assign({}, card, { compactText: compactTextFor(card, paired) })
}

function reconcile(previous, sources, options) {
  var state = previous && typeof previous === "object" ? previous : initialState()
  var input = sources && typeof sources === "object" ? sources : {}
  var nowMs = options && finite(options.nowMs) ? options.nowMs : 0
  var records = cloneMap(state.lifecycleByKey)
  var retainedRecords = {}
  var candidates = []
  var byKey = {}
  var byTool = {}
  var nextWakeAt = null

  var codex = input.codex || {}
  var weather = input.weather || {}
  var agents = input.agents || {}
  var notifications = input.notifications || {}
  var system = input.system || {}
  byTool.music = card("music", "Music", "No player", iconForTool("music"))
  byTool.weather = weatherCard(weather)
  byTool.codex = codexCard(codex)
  var agentCounts = agentEligibility(agents)
  byTool.agents = agentCard(Object.assign({}, agents, agentCounts))
  byTool.notifications = notificationsToolCard(notifications)
  byTool.system = systemToolCard(system)

  var activities = input.activitiesByKey && typeof input.activitiesByKey === "object" ? input.activitiesByKey : {}
  var activityKeys = Object.keys(activities)
  var musicCards = []
  var musicCandidates = []
  for (var activityIndex = 0; activityIndex < activityKeys.length; activityIndex++) {
    var activityKey = activityKeys[activityIndex]
    var activity = activities[activityKey]
    if (!activity || !activity.media) continue
    var music = surfaceCard(activity, activityKey)
    var signal = activity.media.playing === true ? "playing" : "paused"
    var lifecycle = rememberSignal(records, activityKey, signal, nowMs)
    retainedRecords[activityKey] = lifecycle
    byKey[activityKey] = music
    musicCards.push({ card: music, lifecycle: lifecycle, playing: signal === "playing" })
    if (signal === "playing") {
      addCandidate(musicCandidates, music, "active", lifecycle.changedAt, lifecycle.changedAt, 1)
    } else {
      var pauseUntil = lifecycle.pausedAt + PAUSE_GRACE_MS
      if (nowMs < pauseUntil) {
        addCandidate(musicCandidates, music, "terminal", lifecycle.pausedAt, lifecycle.pausedAt, 0)
        nextWakeAt = earlierWake(nextWakeAt, pauseUntil, nowMs)
      }
    }
  }
  musicCards.sort(function(left, right) {
    if (left.playing !== right.playing) return left.playing ? -1 : 1
    if (left.lifecycle.changedAt !== right.lifecycle.changedAt) return left.lifecycle.changedAt - right.lifecycle.changedAt
    return left.card.key < right.card.key ? -1 : left.card.key > right.card.key ? 1 : 0
  })
  if (musicCards.length) byTool.music = musicCards[0].card
  musicCandidates.sort(candidateOrder)
  if (musicCandidates.length) {
    candidates.push(musicCandidates[0])
    byTool.music = musicCandidates[0].content
  }

  var previewUntil = finite(input.notificationPreviewUntil) ? input.notificationPreviewUntil : null
  var preview = notifications && notifications.preview ? notifications.preview : null
  if (preview && finite(previewUntil) && previewUntil > nowMs) {
    var previewCard = notificationCard(preview)
    byKey[previewCard.key] = previewCard
    var urgencyRank = preview.urgency === "critical" ? 3 : preview.urgency === "normal" ? 2 : 1
    addCandidate(candidates, previewCard, "notification", previewUntil || nowMs, previewUntil || nowMs, urgencyRank)
    nextWakeAt = earlierWake(nextWakeAt, previewUntil, nowMs)
  }

  var agentsCard = byTool.agents
  var agentTerminalState = agentTerminal(agents, nowMs)
  if (agents.enabled === true) {
    if (agentCounts.attention > 0) {
      var attentionAt = agentSignalTime(agents, function(session) {
        return session.approvalNoted === true || session.state === "approval-requested"
          || session.state === "blocked" || session.status === "blocked"
      })
      addCandidate(candidates, agentsCard, "attention", attentionAt, attentionAt, 2)
    } else if (agentCounts.working > 0) {
      var workingAt = agentSignalTime(agents, function(session) { return session.state === "working" })
      addCandidate(candidates, agentsCard, "active", workingAt, workingAt, 0)
    } else if (agentTerminalState) {
      agentsCard = Object.assign({}, agentsCard, {
        value: agentTerminalState.label,
        secondaryText: agentTerminalState.label === "Turn ended" ? "Ended" : agentTerminalState.label === "Interrupted" ? "Stopped" : "Offline",
        minimalValue: agentTerminalState.icon
      })
      byTool.agents = agentsCard
      addCandidate(candidates, agentsCard, "terminal", agentTerminalState.occurredAt, agentTerminalState.occurredAt, 0)
      nextWakeAt = earlierWake(nextWakeAt, agentTerminalState.eligibleUntil, nowMs)
    }
  }

  var events = system && system.available === true && Array.isArray(system.events) ? system.events : []
  var systemCandidates = []
  for (var eventIndex = 0; eventIndex < events.length; eventIndex++) {
    var event = events[eventIndex]
    if (!event || ["attention", "ongoing", "terminal"].indexOf(event.phase) < 0) continue
    if (finite(event.eligibleUntil) && event.eligibleUntil <= nowMs) continue
    var systemCard = systemEventCard(event, system.sampledAt, events)
    byKey[systemCard.key] = systemCard
    var phase = event.phase === "ongoing" ? "busy" : event.phase
    addCandidate(systemCandidates, systemCard, phase, event.startedAt, event.occurredAt, 0)
    nextWakeAt = earlierWake(nextWakeAt, event.eligibleUntil, nowMs)
  }
  systemCandidates.sort(candidateOrder)
  if (systemCandidates.length) {
    candidates.push(systemCandidates[0])
    byTool.system = systemCandidates[0].content
  }

  if (candidates.length === 0 && weather.ready === true && weather.status === "ready"
      && weather.mode !== "unset" && weather.current) {
    addCandidate(candidates, byTool.weather, "ambient", weather.fetchedAt, weather.fetchedAt, 0)
  }

  for (var toolIndex = 0; toolIndex < TOOLS.length; toolIndex++) byKey["hub:" + TOOLS[toolIndex]] = byTool[TOOLS[toolIndex]]
  candidates.sort(candidateOrder)
  var primary = candidates.length ? candidates[0].content : neutralCard()
  var secondary = candidates.length > 1 ? candidates[1].content : null
  var reason = candidates.length ? candidates.slice(0, 2).map(function(candidate) { return candidate.phase }).join("+") : "neutral"
  var schedule = {
    primary: primary,
    secondary: secondary,
    byKey: byKey,
    byTool: byTool,
    candidateCount: candidates.length,
    availableCount: Object.keys(byKey).length,
    revision: state.schedule && finite(state.schedule.revision) ? state.schedule.revision : 0,
    reason: reason
  }
  var fingerprint = scheduleFingerprint(schedule)
  var lifecycleChanged = JSON.stringify(retainedRecords) !== JSON.stringify(state.lifecycleByKey || {})
  var scheduleChanged = fingerprint !== state.scheduleFingerprint
  if (scheduleChanged) schedule.revision += 1
  else schedule = state.schedule
  if (!lifecycleChanged && !scheduleChanged) {
    return { state: state, schedule: schedule, nextWakeAt: nextWakeAt, reason: schedule.reason, changed: false }
  }
  var nextState = Object.assign({}, state, {
    lifecycleByKey: retainedRecords,
    schedule: schedule,
    scheduleFingerprint: scheduleChanged ? fingerprint : state.scheduleFingerprint,
    revision: state.revision + 1
  })
  return { state: nextState, schedule: schedule, nextWakeAt: nextWakeAt, reason: schedule.reason, changed: true }
}

function inertRouteCard(route, fallback) {
  var retained = route && route.retainedCard ? route.retainedCard : fallback
  var result = Object.assign({}, retained || card(route.tool, title(route.tool), "No longer live", iconForTool(route.tool)), {
    key: route.entityKey,
    tool: route.tool,
    actions: [],
    expired: true
  })
  if (result.media) result.media = Object.assign({}, result.media, { canSeek: false, playing: false })
  if (result.notification) result.notification = Object.assign({}, result.notification, {
    live: false,
    canInvoke: false,
    canDismiss: false
  })
  return result
}

function contentForRoute(route, committed) {
  if (!route) return null
  var selected = committed.byKey && committed.byKey[route.entityKey] ? committed.byKey[route.entityKey] : null
  if (!selected && route.entityKey === "hub:" + route.tool && committed.byTool) selected = committed.byTool[route.tool]
  if (!selected) selected = inertRouteCard(route)
  return Object.assign({}, selected, {
    key: route.entityKey,
    tool: route.tool,
    hub: true,
    expanded: selected.expanded || {}
  })
}

function expandedHeightBudget(metrics) {
  var side = metrics.bar.position === "left" || metrics.bar.position === "right"
  var barExtent = side ? 0 : metrics.bar.size + metrics.gap
  return Math.max(0, metrics.height - metrics.margin * 2 - barExtent)
}

function placeExpandedHeight(geometry, metrics, height) {
  var cardRect = geometry.card
  cardRect.height = Math.max(0, height)
  cardRect.radius = Math.min(cardRect.radius, cardRect.width / 2, cardRect.height / 2)
  if (metrics.bar.position === "bottom") {
    cardRect.y = geometry.slot.y + geometry.slot.height - cardRect.height
  } else if (metrics.bar.position === "left" || metrics.bar.position === "right") {
    cardRect.y = geometry.slot.y + geometry.slot.height / 2 - cardRect.height / 2
  }
  cardRect.y = Math.max(0, Math.min(cardRect.y, metrics.height - cardRect.height))
}

function frameFor(hub, schedule, screenName, metrics, viewModel) {
  var committed = schedule && schedule.primary ? schedule : emptySchedule()
  var owner = !!(hub && hub.expanded && hub.ownerScreen === screenName)
  var tool = owner ? hub.tool : (committed.primary.tool || "music")
  var primary = committed.primary
  var secondary = committed.secondary
  var compactPrimary = committed.primary
  var compactSecondary = committed.secondary
  if (owner) {
    var entityKey = text(hub.entityKey) || "hub:" + tool
    primary = contentForRoute({
      tool: tool,
      entityKey: entityKey,
      retainedCard: hub.retainedCard
    }, committed)
    secondary = null
  }
  var phase = owner ? "expanded" : "compact"
  var horizontal = metrics.bar.position === "top" || metrics.bar.position === "bottom"
  var pairedCompact = !!compactSecondary && horizontal
  if (!owner && horizontal) {
    primary = compactCard(primary, false)
    primary.compactCentered = !pairedCompact
    secondary = compactCard(secondary, pairedCompact)
  }
  var geometry = viewModel.geometryFor(phase, !!secondary && !owner, metrics, !!(primary && primary.media), pairedCompact && !owner)
  var titleCompactRect = null
  if (owner) {
    var compactGeometry = viewModel.geometryFor("compact", !!compactSecondary, metrics,
      !!(compactPrimary && compactPrimary.media), pairedCompact)
    titleCompactRect = compactSecondary && hub.entityKey === compactSecondary.key ? compactGeometry.secondary : compactGeometry.card
  }
  var heightBudget = expandedHeightBudget(metrics)
  var layoutReady = false
  if (owner) {
    var layout = hub.layout
    var widthToken = Math.max(1, Math.round(geometry.card.width))
    layoutReady = !!layout && layout.screen === screenName && layout.key === primary.key
      && layout.widthToken === widthToken && layout.heightBudget === heightBudget
      && finite(layout.preferredHeight) && layout.preferredHeight <= heightBudget
    var preferredHeight = layoutReady ? layout.preferredHeight : geometry.card.height
    placeExpandedHeight(geometry, metrics, Math.min(heightBudget, Math.max(metrics.compactHeight, preferredHeight)))
  }
  var titleExpandedRect = Object.assign({}, owner ? geometry.card : viewModel.geometryFor("expanded", false, metrics, true).card)
  var pending = hub && hub.pendingRoute && hub.pendingRoute.ownerScreen === screenName ? hub.pendingRoute : null
  var pendingContent = pending ? contentForRoute(pending, committed) : null
  var pendingGeometry = pendingContent ? viewModel.geometryFor("expanded", false, metrics, !!pendingContent.media) : null
  var preflight = pendingContent && pendingGeometry ? {
    content: pendingContent,
    key: pending.entityKey,
    widthToken: Math.max(1, Math.round(pendingGeometry.card.width)),
    heightBudget: heightBudget
  } : null
  return {
    phase: phase,
    alerting: false,
    primary: primary,
    secondary: owner ? null : secondary,
    selected: owner ? primary : null,
    expanded: owner ? primary.expanded : null,
    isOwner: owner,
    visible: true,
    geometry: geometry,
    titleCompactRect: titleCompactRect,
    titleExpandedRect: titleExpandedRect,
    preflight: preflight,
    detailHeightBudget: heightBudget,
    layoutReady: layoutReady,
    chooserOpen: !!(owner && hub.chooserOpen),
    splitMinimal: !!secondary && !owner && !pairedCompact
  }
}

if (typeof module !== "undefined") module.exports = {
  TOOLS: TOOLS,
  PAUSE_GRACE_MS: PAUSE_GRACE_MS,
  AGENT_TERMINAL_MS: AGENT_TERMINAL_MS,
  initialState: initialState,
  emptySchedule: emptySchedule,
  navigate: navigate,
  toggleChooser: toggleChooser,
  closeChooser: closeChooser,
  chooseTool: chooseTool,
  acceptLayout: acceptLayout,
  collapse: collapse,
  reconcile: reconcile,
  frameFor: frameFor
}
