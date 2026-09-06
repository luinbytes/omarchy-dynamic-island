var HISTORY_VERSION = 1
var OMAPAGER_HISTORY_VERSION = 2
var MAX_ENTRIES = 10
var PREVIEW_MS = 6000

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key)
}

function plainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false
  if (typeof Object.getPrototypeOf !== "function") return true
  var prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function finiteInteger(value) {
  return typeof value === "number" && isFinite(value) && Math.floor(value) === value
    && Math.abs(value) <= (Number.MAX_SAFE_INTEGER || 9007199254740991)
}

function cleanText(value, maximum) {
  if (typeof value !== "string") return ""
  return value.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
}

function urgency(value) {
  if (value === 0 || value === "low") return "low"
  if (value === 2 || value === "critical") return "critical"
  return "normal"
}

function identityKey(timestamp, originalId) {
  if (!finiteInteger(timestamp) || timestamp <= 0 || !finiteInteger(originalId) || originalId < 0) return ""
  return JSON.stringify([timestamp, originalId])
}

function omapagerProviderKey(value) {
  if (typeof value !== "string") return ""
  var key = value.trim()
  return /^[A-Za-z0-9._-]{1,120}$/.test(key) ? key : ""
}

function omapagerIdentityKey(providerKey) {
  var key = omapagerProviderKey(providerKey)
  return key ? JSON.stringify(["omapager", key]) : ""
}

function omapagerTimestamp(value) {
  var seconds = Number(value)
  var timestamp = Math.round(seconds * 1000)
  return isFinite(seconds) && seconds > 0 && finiteInteger(timestamp) && timestamp > 0 ? timestamp : 0
}

function normalizeEntry(raw, live) {
  if (!raw || typeof raw !== "object") return null
  var timestamp
  var originalId
  try {
    timestamp = Number(raw.timestamp)
    originalId = Number(raw.originalId)
  } catch (error) {
    return null
  }
  var key = identityKey(timestamp, originalId)
  if (!key) return null
  var isLive = live === true
  return {
    key: key,
    live: isLive,
    app: cleanText(raw.app, 80),
    summary: cleanText(raw.summary, 160),
    body: cleanText(raw.body, 512),
    urgency: urgency(raw.urgency),
    timestamp: timestamp,
    canInvoke: isLive,
    canDismiss: isLive
  }
}

function normalizeOmapagerEntry(raw, live) {
  if (!raw || typeof raw !== "object") return null
  var providerKey = omapagerProviderKey(raw.key)
  var timestamp = omapagerTimestamp(raw.ts)
  var key = omapagerIdentityKey(providerKey)
  if (!key || !timestamp) return null
  var restored = raw.restored === true
  var isLive = live === true && !restored
  return {
    key: key,
    providerKey: providerKey,
    live: isLive,
    restored: restored,
    app: cleanText(raw.source, 80) || cleanText(raw.app, 80),
    summary: cleanText(raw.summary, 160),
    body: cleanText(raw.bodyLine, 512) || cleanText(raw.body, 512),
    urgency: urgency(raw.urgency),
    timestamp: timestamp,
    canInvoke: isLive,
    canDismiss: isLive
  }
}

function semanticFingerprint(entry) {
  return JSON.stringify([entry.app, entry.summary, entry.body, entry.urgency])
}

function updateSemanticEvents(previousFingerprints, previousEventTimes, liveEntries, nowMs) {
  var fingerprints = {}
  var eventTimes = {}
  var priorFingerprints = plainObject(previousFingerprints) ? previousFingerprints : {}
  var priorEventTimes = plainObject(previousEventTimes) ? previousEventTimes : {}
  var now = finiteInteger(nowMs) && nowMs >= 0 ? nowMs : 0
  for (var index = 0; index < liveEntries.length; index++) {
    var entry = liveEntries[index]
    var fingerprint = semanticFingerprint(entry)
    fingerprints[entry.key] = fingerprint
    if (!own(priorFingerprints, entry.key)) eventTimes[entry.key] = entry.timestamp
    else if (priorFingerprints[entry.key] !== fingerprint) eventTimes[entry.key] = now
    else eventTimes[entry.key] = finiteInteger(priorEventTimes[entry.key]) ? priorEventTimes[entry.key] : entry.timestamp
  }
  return { fingerprints: fingerprints, eventTimes: eventTimes }
}

function preview(liveEntries, eventTimes, nowMs, dnd, previewMs) {
  if (dnd === true || !Array.isArray(liveEntries)) return null
  var now = finiteInteger(nowMs) && nowMs >= 0 ? nowMs : 0
  var lifetime = finiteInteger(previewMs) && previewMs > 0 ? previewMs : PREVIEW_MS
  var times = plainObject(eventTimes) ? eventTimes : {}
  var selected = null
  var selectedAt = -1
  for (var index = 0; index < liveEntries.length; index++) {
    var entry = liveEntries[index]
    if (!entry || entry.live !== true) continue
    var eventAt = finiteInteger(times[entry.key]) ? times[entry.key] : entry.timestamp
    if (eventAt < 0 || eventAt > now || now - eventAt >= lifetime) continue
    if (eventAt > selectedAt || (eventAt === selectedAt && entry.key < selected.key)) {
      selected = entry
      selectedAt = eventAt
    }
  }
  return selected
}

function previewWakeAt(liveEntries, eventTimes, nowMs, dnd, previewMs) {
  var selected = preview(liveEntries, eventTimes, nowMs, dnd, previewMs)
  if (!selected) return null
  var lifetime = finiteInteger(previewMs) && previewMs > 0 ? previewMs : PREVIEW_MS
  var eventAt = finiteInteger(eventTimes[selected.key]) ? eventTimes[selected.key] : selected.timestamp
  return eventAt + lifetime
}

function mergeEntries(liveEntries, historyEntries, maximum) {
  var limit = finiteInteger(maximum) && maximum > 0 ? Math.min(MAX_ENTRIES, maximum) : MAX_ENTRIES
  var result = []
  var seen = {}
  var sources = [Array.isArray(liveEntries) ? liveEntries : [], Array.isArray(historyEntries) ? historyEntries : []]
  for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    for (var index = 0; index < sources[sourceIndex].length && result.length < limit; index++) {
      var entry = sources[sourceIndex][index]
      if (!entry || !entry.key || own(seen, entry.key)) continue
      seen[entry.key] = true
      result.push(entry)
    }
  }
  return result
}

function parseHistoryOutput(raw) {
  var parsed
  try {
    parsed = JSON.parse(String(raw || ""))
  } catch (error) {
    return { ok: false, entries: [], error: "notification history returned invalid data" }
  }
  if (!plainObject(parsed) || parsed.version !== HISTORY_VERSION || !Array.isArray(parsed.entries)
    || parsed.entries.length > MAX_ENTRIES) {
    return { ok: false, entries: [], error: "notification history returned an unsupported shape" }
  }
  var entries = []
  var seen = {}
  for (var index = 0; index < parsed.entries.length; index++) {
    var entry = normalizeEntry(parsed.entries[index], false)
    if (!entry || own(seen, entry.key)) {
      return { ok: false, entries: [], error: "notification history contains invalid entries" }
    }
    seen[entry.key] = true
    entries.push(entry)
  }
  entries.sort(function(left, right) {
    if (left.timestamp !== right.timestamp) return right.timestamp - left.timestamp
    return left.key < right.key ? -1 : left.key > right.key ? 1 : 0
  })
  return { ok: true, entries: entries, error: "" }
}

function parseOmapagerHistoryOutput(raw) {
  var parsed
  try {
    parsed = JSON.parse(String(raw || ""))
  } catch (error) {
    return { ok: false, entries: [], error: "notification history returned invalid data" }
  }
  if (!plainObject(parsed) || parsed.version !== OMAPAGER_HISTORY_VERSION || parsed.backend !== "omapager"
      || !Array.isArray(parsed.entries) || parsed.entries.length > MAX_ENTRIES) {
    return { ok: false, entries: [], error: "notification history returned an unsupported shape" }
  }
  var entries = []
  var seen = {}
  for (var index = 0; index < parsed.entries.length; index++) {
    var entry = normalizeOmapagerEntry(parsed.entries[index], false)
    if (!entry || own(seen, entry.key)) {
      return { ok: false, entries: [], error: "notification history contains invalid entries" }
    }
    seen[entry.key] = true
    entries.push(entry)
  }
  entries.sort(function(left, right) {
    if (left.timestamp !== right.timestamp) return right.timestamp - left.timestamp
    return left.key < right.key ? -1 : left.key > right.key ? 1 : 0
  })
  return { ok: true, entries: entries, error: "" }
}

if (typeof module !== "undefined") {
  module.exports = {
    HISTORY_VERSION: HISTORY_VERSION,
    MAX_ENTRIES: MAX_ENTRIES,
    PREVIEW_MS: PREVIEW_MS,
    identityKey: identityKey,
    omapagerIdentityKey: omapagerIdentityKey,
    normalizeOmapagerEntry: normalizeOmapagerEntry,
    normalizeEntry: normalizeEntry,
    semanticFingerprint: semanticFingerprint,
    updateSemanticEvents: updateSemanticEvents,
    preview: preview,
    previewWakeAt: previewWakeAt,
    mergeEntries: mergeEntries,
    parseHistoryOutput: parseHistoryOutput,
    parseOmapagerHistoryOutput: parseOmapagerHistoryOutput
  }
}
