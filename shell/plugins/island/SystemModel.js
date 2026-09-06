var VERSION = 1
var STALE_AFTER_MS = 10000
var TERMINAL_EVENT_MS = 8000
var RESOURCE_SUSTAIN_MS = 15000
var PRESSURE_SUSTAIN_MS = 5000
var RECOVERY_MS = 10000
var D_STATE_SUSTAIN_MS = 30000
var MAX_PROCESSES = 512
var MAX_EVENTS = 32

var RESOURCE_RULES = [
  { key: "system:cpu", reading: "cpu", high: 90, low: 80, sustainMs: RESOURCE_SUSTAIN_MS, phase: "ongoing", label: "High CPU use", terminalLabel: "CPU use recovered", icon: "CPU" },
  { key: "system:ram", reading: "ram", high: 90, low: 85, sustainMs: RESOURCE_SUSTAIN_MS, phase: "attention", label: "High memory use", terminalLabel: "Memory use recovered", icon: "RAM" },
  { key: "system:gpu", reading: "gpu", high: 90, low: 80, sustainMs: RESOURCE_SUSTAIN_MS, phase: "ongoing", label: "High GPU use", terminalLabel: "GPU use recovered", icon: "GPU" },
  { key: "system:cpu-pressure", reading: "cpuPressure", high: 10, low: 5, sustainMs: PRESSURE_SUSTAIN_MS, phase: "attention", label: "CPU pressure", terminalLabel: "CPU pressure recovered", icon: "PSI" },
  { key: "system:memory-pressure", reading: "memoryPressure", high: 10, low: 5, sustainMs: PRESSURE_SUSTAIN_MS, phase: "attention", label: "Memory pressure", terminalLabel: "Memory pressure recovered", icon: "PSI" },
  { key: "system:io-pressure", reading: "ioPressure", high: 10, low: 5, sustainMs: PRESSURE_SUSTAIN_MS, phase: "attention", label: "I/O pressure", terminalLabel: "I/O pressure recovered", icon: "PSI" }
]

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function finite(value) {
  return typeof value === "number" && isFinite(value)
}

function integer(value) {
  return finite(value) && Math.floor(value) === value
}

function emptyReadings() {
  return { cpu: null, ram: null, gpu: null, cpuPressure: null, memoryPressure: null, ioPressure: null }
}

function initialState() {
  return {
    sampledAt: 0,
    error: "",
    readings: emptyReadings(),
    cpuTicks: null,
    trackers: {},
    processTrackers: {}
  }
}

function copyTracker(value) {
  return {
    sinceAt: value && finite(value.sinceAt) ? value.sinceAt : 0,
    active: !!(value && value.active),
    belowSinceAt: value && finite(value.belowSinceAt) ? value.belowSinceAt : 0,
    startedAt: value && finite(value.startedAt) ? value.startedAt : 0,
    occurredAt: value && finite(value.occurredAt) ? value.occurredAt : 0,
    terminalAt: value && finite(value.terminalAt) ? value.terminalAt : 0,
    terminalUntil: value && finite(value.terminalUntil) ? value.terminalUntil : 0,
    value: value && typeof value.value === "string" ? value.value : ""
  }
}

function copyMap(source) {
  var result = {}
  var keys = source && isObject(source) ? Object.keys(source) : []
  for (var i = 0; i < keys.length; i++) result[keys[i]] = copyTracker(source[keys[i]])
  return result
}

function copyProcessTrackers(source) {
  var result = {}
  var keys = source && isObject(source) ? Object.keys(source) : []
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    if (key.indexOf("D:") === 0) result[key] = copyTracker(source[key])
  }
  return result
}

function copyState(previous) {
  var source = previous && isObject(previous) ? previous : initialState()
  return {
    sampledAt: finite(source.sampledAt) ? source.sampledAt : 0,
    error: typeof source.error === "string" ? source.error : "",
    readings: Object.assign(emptyReadings(), source.readings || {}),
    cpuTicks: source.cpuTicks ? { total: source.cpuTicks.total, idle: source.cpuTicks.idle } : null,
    trackers: copyMap(source.trackers),
    processTrackers: copyProcessTrackers(source.processTrackers)
  }
}

function unknownFields(value, allowed) {
  var keys = Object.keys(value)
  for (var i = 0; i < keys.length; i++) {
    if (!own(allowed, keys[i])) return keys[i]
  }
  return ""
}

function percentOrNull(value) {
  if (value === null) return { ok: true, value: null }
  if (!finite(value) || value < 0 || value > 100) return { ok: false }
  return { ok: true, value: value }
}

function validateCpuTicks(value) {
  if (value === null) return { ok: true, value: null }
  if (!isObject(value) || unknownFields(value, { total: true, idle: true })) return { ok: false }
  if (!integer(value.total) || !integer(value.idle) || value.total <= 0 || value.idle < 0 || value.idle > value.total) return { ok: false }
  return { ok: true, value: { total: value.total, idle: value.idle } }
}

function validateMemory(value) {
  if (value === null) return { ok: true, value: null }
  if (!isObject(value) || unknownFields(value, { totalBytes: true, availableBytes: true })) return { ok: false }
  if (!integer(value.totalBytes) || !integer(value.availableBytes) || value.totalBytes <= 0
    || value.availableBytes < 0 || value.availableBytes > value.totalBytes) return { ok: false }
  return { ok: true, value: { totalBytes: value.totalBytes, availableBytes: value.availableBytes } }
}

function validatePsi(value) {
  if (!isObject(value) || unknownFields(value, { cpu: true, memory: true, io: true })) return { ok: false }
  var cpu = percentOrNull(value.cpu)
  var memory = percentOrNull(value.memory)
  var io = percentOrNull(value.io)
  if (!cpu.ok || !memory.ok || !io.ok) return { ok: false }
  return { ok: true, value: { cpu: cpu.value, memory: memory.value, io: io.value } }
}

function validateGpu(value) {
  if (value === null) return { ok: true, value: null }
  if (!isObject(value) || unknownFields(value, { busyPercent: true, source: true })) return { ok: false }
  var busy = percentOrNull(value.busyPercent)
  if (!busy.ok || busy.value === null || typeof value.source !== "string" || value.source.length < 1 || value.source.length > 64) return { ok: false }
  return { ok: true, value: { busyPercent: busy.value, source: value.source } }
}

function validateProcesses(value) {
  if (!Array.isArray(value) || value.length > MAX_PROCESSES) return { ok: false }
  var seen = {}
  var result = []
  for (var i = 0; i < value.length; i++) {
    var item = value[i]
    if (!isObject(item) || unknownFields(item, { pid: true, startTimeTicks: true, state: true, name: true })) return { ok: false }
    if (!integer(item.pid) || item.pid <= 0 || item.pid > 4194304) return { ok: false }
    if (typeof item.startTimeTicks !== "string" || !/^[0-9]{1,32}$/.test(item.startTimeTicks)) return { ok: false }
    if (typeof item.state !== "string" || !/^[A-Za-z]$/.test(item.state)) return { ok: false }
    if (typeof item.name !== "string" || item.name.length < 1 || item.name.length > 64 || /[\x00-\x1f\x7f]/.test(item.name)) return { ok: false }
    var identity = item.pid + ":" + item.startTimeTicks
    if (own(seen, identity)) return { ok: false }
    seen[identity] = true
    result.push({ pid: item.pid, startTimeTicks: item.startTimeTicks, state: item.state, name: item.name })
  }
  return { ok: true, value: result }
}

function validateErrors(value) {
  if (!Array.isArray(value) || value.length > 8) return { ok: false }
  var result = []
  for (var i = 0; i < value.length; i++) {
    if (typeof value[i] !== "string" || value[i].length < 1 || value[i].length > 160 || /[\x00-\x1f\x7f]/.test(value[i])) return { ok: false }
    result.push(value[i])
  }
  return { ok: true, value: result }
}

function validateSample(raw, receivedAtMs) {
  if (!isObject(raw) || unknownFields(raw, { version: true, sampledAt: true, cpuTicks: true, memory: true, psi: true, gpu: true, processes: true, errors: true })) {
    return { ok: false, error: "system sample has an invalid shape" }
  }
  if (raw.version !== VERSION) return { ok: false, error: "system sample version is unsupported" }
  if (!integer(raw.sampledAt) || raw.sampledAt < 0 || raw.sampledAt > receivedAtMs + 5000 || raw.sampledAt < receivedAtMs - 30000) {
    return { ok: false, error: "system sample time is invalid" }
  }
  var cpuTicks = validateCpuTicks(raw.cpuTicks)
  var memory = validateMemory(raw.memory)
  var psi = validatePsi(raw.psi)
  var gpu = validateGpu(raw.gpu)
  var processes = validateProcesses(raw.processes)
  var errors = validateErrors(raw.errors)
  if (!cpuTicks.ok || !memory.ok || !psi.ok || !gpu.ok || !processes.ok || !errors.ok) {
    return { ok: false, error: "system sample contains invalid readings" }
  }
  return { ok: true, value: {
    sampledAt: raw.sampledAt,
    cpuTicks: cpuTicks.value,
    memory: memory.value,
    psi: psi.value,
    gpu: gpu.value,
    processes: processes.value,
    errors: errors.value
  } }
}

function roundedPercent(value) {
  if (!finite(value)) return null
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10
}

function cpuPercent(previous, current) {
  if (!previous || !current) return null
  var total = current.total - previous.total
  var idle = current.idle - previous.idle
  if (!finite(total) || !finite(idle) || total <= 0 || idle < 0 || idle > total) return null
  return roundedPercent((1 - idle / total) * 100)
}

function readingsFor(previous, sample) {
  var ram = sample.memory
    ? roundedPercent((1 - sample.memory.availableBytes / sample.memory.totalBytes) * 100) : null
  return {
    cpu: cpuPercent(previous.cpuTicks, sample.cpuTicks),
    ram: ram,
    gpu: sample.gpu ? roundedPercent(sample.gpu.busyPercent) : null,
    cpuPressure: sample.psi.cpu,
    memoryPressure: sample.psi.memory,
    ioPressure: sample.psi.io
  }
}

function percentText(value, sinceAt, nowMs) {
  var seconds = Math.max(0, Math.floor((nowMs - sinceAt) / 1000))
  return Math.round(value) + "% for " + seconds + "s"
}

function updateTracker(previous, nowMs, high, recovered, sustainMs, valueText) {
  var tracker = copyTracker(previous)
  if (tracker.active) {
    tracker.value = valueText
    if (recovered) {
      if (tracker.belowSinceAt === 0) tracker.belowSinceAt = nowMs
      if (nowMs - tracker.belowSinceAt >= RECOVERY_MS) {
        tracker.active = false
        tracker.terminalAt = nowMs
        tracker.terminalUntil = nowMs + TERMINAL_EVENT_MS
        tracker.belowSinceAt = 0
        tracker.sinceAt = 0
      }
    } else {
      tracker.belowSinceAt = 0
    }
    return tracker
  }
  if (high) {
    tracker.startedAt = 0
    tracker.occurredAt = 0
    tracker.terminalAt = 0
    tracker.terminalUntil = 0
  }
  if (!high) {
    tracker.sinceAt = 0
    return tracker
  }
  if (tracker.sinceAt === 0) tracker.sinceAt = nowMs
  tracker.value = valueText
  if (nowMs - tracker.sinceAt >= sustainMs) {
    tracker.active = true
    tracker.startedAt = tracker.sinceAt
    tracker.occurredAt = nowMs
    tracker.terminalAt = 0
    tracker.terminalUntil = 0
  }
  return tracker
}

function updateResourceTrackers(state, nowMs) {
  for (var i = 0; i < RESOURCE_RULES.length; i++) {
    var rule = RESOURCE_RULES[i]
    var value = state.readings[rule.reading]
    if (!finite(value)) {
      delete state.trackers[rule.key]
      continue
    }
    var old = state.trackers[rule.key]
    var sinceAt = old && old.sinceAt ? old.sinceAt : nowMs
    state.trackers[rule.key] = updateTracker(old, nowMs, value >= rule.high, value <= rule.low,
      rule.sustainMs, percentText(value, sinceAt, nowMs))
  }
}

function processIdentity(process) {
  return process.pid + ":" + process.startTimeTicks
}

function updateProcessTrackers(state, processes, nowMs) {
  var visible = {}
  for (var i = 0; i < processes.length; i++) {
    var candidate = processes[i]
    if (candidate.state === "D") visible[processIdentity(candidate)] = candidate
  }
  var oldKeys = Object.keys(state.processTrackers)
  for (var oldIndex = 0; oldIndex < oldKeys.length; oldIndex++) {
    var oldKey = oldKeys[oldIndex]
    var identity = oldKey.slice(2)
    if (!own(visible, identity)) delete state.processTrackers[oldKey]
  }
  for (var processIndex = 0; processIndex < processes.length; processIndex++) {
    var process = processes[processIndex]
    if (process.state !== "D") continue
    var key = "D:" + processIdentity(process)
    var old = state.processTrackers[key]
    var sinceAt = old && old.sinceAt ? old.sinceAt : nowMs
    var seconds = Math.max(0, Math.floor((nowMs - sinceAt) / 1000))
    var value = process.name + " · PID " + process.pid + " · state " + process.state + " · " + seconds + "s observed"
    state.processTrackers[key] = updateTracker(old, nowMs, true, false, D_STATE_SUSTAIN_MS, value)
  }
}

function trackerEvent(key, tracker, rule) {
  if (tracker.active) return {
    key: key,
    label: rule.label,
    value: tracker.value,
    icon: rule.icon,
    phase: rule.phase,
    startedAt: tracker.startedAt,
    occurredAt: tracker.occurredAt,
    eligibleUntil: null
  }
  if (tracker.terminalUntil > 0) return {
    key: key,
    label: rule.terminalLabel,
    value: tracker.value,
    icon: rule.icon,
    phase: "terminal",
    startedAt: tracker.startedAt,
    occurredAt: tracker.terminalAt,
    eligibleUntil: tracker.terminalUntil
  }
  return null
}

function eventsFor(state, nowMs) {
  var events = []
  for (var i = 0; i < RESOURCE_RULES.length; i++) {
    var rule = RESOURCE_RULES[i]
    var event = trackerEvent(rule.key, state.trackers[rule.key] || {}, rule)
    if (event && (event.eligibleUntil === null || event.eligibleUntil > nowMs)) events.push(event)
  }
  var processKeys = Object.keys(state.processTrackers)
  for (var processIndex = 0; processIndex < processKeys.length; processIndex++) {
    var processKey = processKeys[processIndex]
    var processTracker = state.processTrackers[processKey]
    if (processKey.indexOf("D:") !== 0 || !processTracker.active) continue
    events.push({
      key: "system:process:" + processKey,
      label: "Uninterruptible wait",
      value: processTracker.value,
      icon: "!",
      phase: "attention",
      startedAt: processTracker.startedAt,
      occurredAt: processTracker.occurredAt,
      eligibleUntil: null
    })
  }
  var phaseRank = { attention: 3, ongoing: 2, terminal: 1 }
  events.sort(function(left, right) {
    var phase = phaseRank[right.phase] - phaseRank[left.phase]
    if (phase !== 0) return phase
    if (left.occurredAt !== right.occurredAt) return right.occurredAt - left.occurredAt
    return left.key < right.key ? -1 : left.key > right.key ? 1 : 0
  })
  return events.slice(0, MAX_EVENTS)
}

function ingest(previous, raw, receivedAtMs) {
  if (!integer(receivedAtMs) || receivedAtMs < 0) return { accepted: false, error: "received time is invalid", state: previous }
  var parsed = validateSample(raw, receivedAtMs)
  if (!parsed.ok) return { accepted: false, error: parsed.error, state: failure(previous, parsed.error) }
  var sample = parsed.value
  var state = copyState(previous)
  if (state.sampledAt > 0 && sample.sampledAt <= state.sampledAt) {
    return { accepted: false, error: "system sample is not newer", state: failure(previous, "system sample is not newer") }
  }
  if (state.sampledAt > 0 && sample.sampledAt - state.sampledAt > STALE_AFTER_MS) {
    state.cpuTicks = null
    state.trackers = {}
    state.processTrackers = {}
  }
  state.readings = readingsFor(state, sample)
  state.cpuTicks = sample.cpuTicks
  state.sampledAt = sample.sampledAt
  state.error = sample.errors.join("; ")
  updateResourceTrackers(state, sample.sampledAt)
  updateProcessTrackers(state, sample.processes, sample.sampledAt)
  return { accepted: true, error: state.error, state: state }
}

function failure(previous, message) {
  var state = copyState(previous)
  state.error = typeof message === "string" && message ? message.slice(0, 256) : "system sample failed"
  return state
}

function snapshot(state, nowMs) {
  var source = state && isObject(state) ? state : initialState()
  var now = integer(nowMs) && nowMs >= 0 ? nowMs : 0
  var fresh = source.sampledAt > 0 && now <= source.sampledAt + STALE_AFTER_MS
  var error = typeof source.error === "string" ? source.error : ""
  if (!fresh && source.sampledAt > 0) error = error || "System sample is stale"
  return {
    available: fresh,
    error: error,
    readings: Object.assign(emptyReadings(), source.readings || {}),
    events: fresh ? eventsFor(source, now) : [],
    sampledAt: finite(source.sampledAt) ? source.sampledAt : 0
  }
}

if (typeof module !== "undefined") module.exports = {
  VERSION: VERSION,
  STALE_AFTER_MS: STALE_AFTER_MS,
  TERMINAL_EVENT_MS: TERMINAL_EVENT_MS,
  RESOURCE_SUSTAIN_MS: RESOURCE_SUSTAIN_MS,
  PRESSURE_SUSTAIN_MS: PRESSURE_SUSTAIN_MS,
  RECOVERY_MS: RECOVERY_MS,
  D_STATE_SUSTAIN_MS: D_STATE_SUSTAIN_MS,
  MAX_PROCESSES: MAX_PROCESSES,
  initialState: initialState,
  validateSample: validateSample,
  cpuPercent: cpuPercent,
  ingest: ingest,
  failure: failure,
  snapshot: snapshot
}
