const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const system = require("../../shell/plugins/island/SystemModel.js")

const BASE = 1000000

function sample(sampledAt, values = {}) {
  const ram = values.ram === undefined ? 50 : values.ram
  return {
    version: system.VERSION,
    sampledAt,
    cpuTicks: values.cpuTicks === undefined ? null : values.cpuTicks,
    memory: values.memory === null ? null : {
      totalBytes: 1000000,
      availableBytes: Math.round(1000000 * (1 - ram / 100))
    },
    psi: {
      cpu: values.cpuPressure === undefined ? 0 : values.cpuPressure,
      memory: values.memoryPressure === undefined ? 0 : values.memoryPressure,
      io: values.ioPressure === undefined ? 0 : values.ioPressure
    },
    gpu: values.gpu === undefined || values.gpu === null ? null : { busyPercent: values.gpu, source: "fixture" },
    processes: values.processes || [],
    errors: values.errors || []
  }
}

function accept(state, value) {
  const result = system.ingest(state, value, value.sampledAt)
  assert.equal(result.accepted, true, result.error)
  return result.state
}

function event(snapshot, key) {
  return snapshot.events.find(item => item.key === key)
}

function qmlFunction(source, name, context = {}) {
  const start = source.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `${name} exists in the panel`)
  const open = source.indexOf("{", start)
  let depth = 0
  for (let index = open; index < source.length; index++) {
    if (source[index] === "{") depth++
    else if (source[index] === "}") depth--
    if (depth === 0) return vm.runInNewContext(`(${source.slice(start, index + 1)})`, context)
  }
  assert.fail(`${name} has a complete body`)
}

let state = system.initialState()
state = accept(state, sample(BASE, { cpuTicks: { total: 1000, idle: 500 }, gpu: null }))
let view = system.snapshot(state, BASE)
assert.deepEqual(Object.keys(view).sort(), ["available", "error", "events", "readings", "sampledAt"])
assert.deepEqual(Object.keys(view.readings).sort(), ["cpu", "cpuPressure", "gpu", "ioPressure", "memoryPressure", "ram"])
assert.equal(view.available, true)
assert.equal(view.readings.cpu, null, "the first cumulative CPU counter is a baseline")
assert.equal(view.readings.gpu, null, "unsupported GPU utilization stays null")

state = accept(state, sample(BASE + 3000, { cpuTicks: { total: 1100, idle: 510 } }))
assert.equal(system.snapshot(state, BASE + 3000).readings.cpu, 90)
state = accept(state, sample(BASE + 6000, { cpuTicks: { total: 1200, idle: 520 } }))
state = accept(state, sample(BASE + 9000, { cpuTicks: { total: 1300, idle: 530 } }))
state = accept(state, sample(BASE + 12000, { cpuTicks: { total: 1400, idle: 540 } }))
state = accept(state, sample(BASE + 15000, { cpuTicks: { total: 1500, idle: 550 } }))
state = accept(state, sample(BASE + 17999, { cpuTicks: { total: 1600, idle: 560 } }))
assert.equal(event(system.snapshot(state, BASE + 17999), "system:cpu"), undefined, "busy CPU must be continuous for 15 seconds")
state = accept(state, sample(BASE + 18000, { cpuTicks: { total: 1700, idle: 570 } }))
let cpuEvent = event(system.snapshot(state, BASE + 18000), "system:cpu")
assert.equal(cpuEvent.phase, "ongoing")
assert.equal(cpuEvent.startedAt, BASE + 3000)
assert.equal(cpuEvent.occurredAt, BASE + 18000)
assert.equal(cpuEvent.eligibleUntil, null)
assert.deepEqual(Object.keys(cpuEvent).sort(), ["eligibleUntil", "icon", "key", "label", "occurredAt", "phase", "startedAt", "value"])
state = accept(state, sample(BASE + 21000, { cpuTicks: { total: 1800, idle: 580 } }))
assert.equal(event(system.snapshot(state, BASE + 21000), "system:cpu").occurredAt, BASE + 18000,
  "event identity and rank time stay stable across polls")
state = accept(state, sample(BASE + 24000, { cpuTicks: { total: 1900, idle: 610 } }))
state = accept(state, sample(BASE + 30000, { cpuTicks: { total: 2000, idle: 640 } }))
state = accept(state, sample(BASE + 34000, { cpuTicks: { total: 2100, idle: 670 } }))
cpuEvent = event(system.snapshot(state, BASE + 34000), "system:cpu")
assert.equal(cpuEvent.phase, "terminal", "lower utilization must persist for 10 seconds before recovery")
assert.equal(cpuEvent.eligibleUntil, BASE + 34000 + system.TERMINAL_EVENT_MS)
const recoveryDetail = cpuEvent.value
state = accept(state, sample(BASE + 35000, { cpuTicks: { total: 2200, idle: 700 } }))
assert.equal(event(system.snapshot(state, BASE + 35000), "system:cpu").value, recoveryDetail,
  "recovery evidence stays frozen after the transition")
state = accept(state, sample(BASE + 36000, { cpuTicks: { total: 2300, idle: 710 } }))
assert.equal(event(system.snapshot(state, BASE + 36000), "system:cpu"), undefined,
  "a new high reading immediately retires the prior recovery event")

let continuity = system.initialState()
continuity = accept(continuity, sample(BASE, { cpuTicks: { total: 1000, idle: 500 } }))
continuity = accept(continuity, sample(BASE + 3000, { cpuTicks: { total: 1100, idle: 510 } }))
continuity = accept(continuity, sample(BASE + 20000, { cpuTicks: { total: 1200, idle: 520 } }))
assert.equal(system.snapshot(continuity, BASE + 20000).readings.cpu, null, "a stale gap resets the CPU delta baseline")
continuity = accept(continuity, sample(BASE + 23000, { cpuTicks: { total: 1300, idle: 530 } }))
assert.equal(event(system.snapshot(continuity, BASE + 23000), "system:cpu"), undefined,
  "samples separated by a stale gap never prove sustained load")

let memoryState = system.initialState()
memoryState = accept(memoryState, sample(BASE, { ram: 92 }))
memoryState = accept(memoryState, sample(BASE + 5000, { ram: 92 }))
memoryState = accept(memoryState, sample(BASE + 10000, { ram: 92 }))
memoryState = accept(memoryState, sample(BASE + system.RESOURCE_SUSTAIN_MS - 1, { ram: 92 }))
assert.equal(event(system.snapshot(memoryState, BASE + system.RESOURCE_SUSTAIN_MS - 1), "system:ram"), undefined)
memoryState = accept(memoryState, sample(BASE + system.RESOURCE_SUSTAIN_MS, { ram: 92 }))
assert.equal(event(system.snapshot(memoryState, BASE + system.RESOURCE_SUSTAIN_MS), "system:ram").phase, "attention")

let pressureState = system.initialState()
pressureState = accept(pressureState, sample(BASE, { memoryPressure: 12 }))
pressureState = accept(pressureState, sample(BASE + system.PRESSURE_SUSTAIN_MS, { memoryPressure: 12 }))
assert.equal(event(system.snapshot(pressureState, BASE + system.PRESSURE_SUSTAIN_MS), "system:memory-pressure").phase, "attention")

let cpuPressureState = system.initialState()
cpuPressureState = accept(cpuPressureState, sample(BASE, { cpuPressure: 12 }))
cpuPressureState = accept(cpuPressureState, sample(BASE + system.PRESSURE_SUSTAIN_MS, { cpuPressure: 12 }))
assert.equal(event(system.snapshot(cpuPressureState, BASE + system.PRESSURE_SUSTAIN_MS), "system:cpu-pressure").phase, "attention")

let ioPressureState = system.initialState()
ioPressureState = accept(ioPressureState, sample(BASE, { ioPressure: 12 }))
ioPressureState = accept(ioPressureState, sample(BASE + system.PRESSURE_SUSTAIN_MS, { ioPressure: 12 }))
assert.equal(event(system.snapshot(ioPressureState, BASE + system.PRESSURE_SUSTAIN_MS), "system:io-pressure").phase, "attention")

let gpuState = system.initialState()
gpuState = accept(gpuState, sample(BASE, { gpu: 95 }))
gpuState = accept(gpuState, sample(BASE + 5000, { gpu: 95 }))
gpuState = accept(gpuState, sample(BASE + 10000, { gpu: 95 }))
gpuState = accept(gpuState, sample(BASE + 15000, { gpu: 95 }))
assert.equal(event(system.snapshot(gpuState, BASE + 15000), "system:gpu").phase, "ongoing")
gpuState = accept(gpuState, sample(BASE + 18000, { gpu: 70 }))
gpuState = accept(gpuState, sample(BASE + 28000, { gpu: 70 }))
assert.equal(event(system.snapshot(gpuState, BASE + 28000), "system:gpu").phase, "terminal")

const blocked = { pid: 42, startTimeTicks: "1234", state: "D", name: "worker" }
const zombie = { pid: 51, startTimeTicks: "9876", state: "Z", name: "child" }
assert.equal(system.Z_STATE_SUSTAIN_MS, undefined, "the model exports no Z-state lifecycle")
let processState = system.initialState()
processState = accept(processState, sample(BASE, { processes: [blocked, zombie] }))
processState = accept(processState, sample(BASE + 6000, { processes: [blocked, zombie] }))
processState = accept(processState, sample(BASE + 12000, { processes: [blocked, zombie] }))
processState = accept(processState, sample(BASE + 18000, { processes: [blocked, zombie] }))
processState = accept(processState, sample(BASE + 24000, { processes: [blocked, zombie] }))
processState = accept(processState, sample(BASE + system.D_STATE_SUSTAIN_MS - 1, { processes: [blocked, zombie] }))
assert.equal(system.snapshot(processState, BASE + system.D_STATE_SUSTAIN_MS - 1).events.length, 0)
processState = accept(processState, sample(BASE + system.D_STATE_SUSTAIN_MS, { processes: [blocked, zombie] }))
let processEvent = system.snapshot(processState, BASE + system.D_STATE_SUSTAIN_MS).events[0]
assert.equal(system.snapshot(processState, BASE + system.D_STATE_SUSTAIN_MS).events.length, 1,
  "mixed D/Z samples report only the blocked process")
assert.equal(processEvent.label, "Uninterruptible wait")
assert.match(processEvent.value, /PID 42 · state D · 30s observed/)
assert.doesNotMatch(processEvent.label + processEvent.value, /dead|crash/i)
processState = accept(processState, sample(BASE + system.D_STATE_SUSTAIN_MS + 3000, { processes: [] }))
assert.equal(system.snapshot(processState, BASE + system.D_STATE_SUSTAIN_MS + 3000).events.length, 0,
  "an absent process clears observation without inventing death")

const legacyZombieState = Object.assign(system.initialState(), {
  sampledAt: BASE,
  processTrackers: {
    "Z:51:9876": { active: true, startedAt: BASE, occurredAt: BASE, value: "child · PID 51 · state Z · 10s observed" }
  }
})
assert.equal(system.snapshot(legacyZombieState, BASE).events.length, 0,
  "legacy Z tracker state never returns an alert")
const purgedZombieState = accept(legacyZombieState, sample(BASE + 3000, { processes: [zombie] }))
assert.deepEqual(purgedZombieState.processTrackers, {}, "ingest purges legacy Z tracker state")
assert.equal(system.snapshot(purgedZombieState, BASE + 3000).events.length, 0,
  "legacy raw Z samples remain schema-valid but create no process alert")

let invalid = system.ingest(system.initialState(), Object.assign(sample(BASE), { arbitrary: true }), BASE)
assert.equal(invalid.accepted, false)
invalid = system.ingest(system.initialState(), sample(BASE, { processes: [{ pid: 1, startTimeTicks: "bad", state: "R", name: "bad" }] }), BASE)
assert.equal(invalid.accepted, false)
const tooMany = Array.from({ length: system.MAX_PROCESSES + 1 }, (_, index) => ({
  pid: index + 1,
  startTimeTicks: String(index + 1),
  state: "S",
  name: "process"
}))
invalid = system.ingest(system.initialState(), sample(BASE, { processes: tooMany }), BASE)
assert.equal(invalid.accepted, false)
invalid = system.ingest(system.initialState(), sample(BASE, { gpu: Number.NaN }), BASE)
assert.equal(invalid.accepted, false, "nonfinite readings are rejected")

let ordering = system.initialState()
ordering = accept(ordering, sample(BASE))
let duplicate = system.ingest(ordering, sample(BASE), BASE)
assert.equal(duplicate.accepted, false, "duplicate samples cannot extend a sustained window")
let older = system.ingest(ordering, sample(BASE - 1), BASE)
assert.equal(older.accepted, false, "older samples cannot rewind policy time")

const helperSource = fs.readFileSync(require.resolve("../../scripts/island-system-sample.cjs"), "utf8")
const modelSource = fs.readFileSync(require.resolve("../../shell/plugins/island/SystemModel.js"), "utf8")
assert.doesNotMatch(modelSource, /Z_STATE_SUSTAIN_MS|Zombie process/, "the model has no Z-state rule or display")
assert.match(helperSource, /fields\.slice\(0, 8\)\.reduce/, "guest counters are not double-counted in aggregate CPU")
assert.doesNotMatch(helperSource, /execSync|spawnSync/, "GPU discovery never blocks through a synchronous child process")
assert.match(helperSource, /spawn\("nvidia-smi"/, "NVIDIA utilization uses a fixed executable and argv")
assert.match(helperSource, /GPU_TIMEOUT_MS = 500/, "NVIDIA sampling has a hard timeout")
assert.match(helperSource, /stopOwnedGpuChild/, "sampler shutdown kills only its owned GPU child")
assert.match(helperSource, /process\.getuid\(\)/, "process collection is restricted to the sampler UID")
assert.doesNotMatch(helperSource, /\/cmdline|\/environ/, "the sampler never reads process command lines or environments")
assert.match(helperSource, /function ownBlockedProcesses\(\)/, "the sampler collects only blocked processes")
assert.match(helperSource, /if \(value && value\.state === "D"\) result\.push\(value\)/,
  "the sampler excludes Z-state processes before serialization")
assert.match(helperSource, /MAX_PROCESSES = 512/, "process sampling is bounded")
assert.match(helperSource, /MAX_OUTPUT_BYTES = 128 \* 1024/, "helper output is bounded")
assert.match(helperSource, /process\.argv\.length !== 2/, "the helper accepts no arbitrary command")

const storeSource = fs.readFileSync(require.resolve("../../shell/plugins/island/SystemStore.qml"), "utf8")
assert.match(storeSource, /property var modelState:/, "SystemStore avoids the Item.state property")
assert.doesNotMatch(storeSource, /property (?:var|alias) state\b/, "SystemStore does not shadow Item.state")
assert.match(storeSource, /enabled: true/, "the store exposes the standard enabled lifecycle")
assert.match(storeSource, /running: root\.enabled/g, "disabled fixture stores stop sampling and freshness clocks")
assert.match(storeSource, /property string samplePhase: "idle"/, "sample ownership has an explicit lifecycle")
assert.match(storeSource, /property int activeSampleGeneration: 0/, "each helper request has a stable generation")
assert.match(storeSource, /if \(!enabled \|\| samplePhase !== "idle"\) return false/,
  "a cancelling request quarantines retries until its callbacks drain")
assert.match(storeSource, /if \(generation !== activeSampleGeneration\) return/,
  "callbacks from discarded helper generations cannot mutate a new request")
assert.match(storeSource, /sampleStreamFinished \|\| !sampleExited/, "stdout and exit completion rendezvous")
assert.match(storeSource, /waitForEnd: true/, "stdout is complete before parsing")
assert.match(storeSource, /interval: 3000/, "sampling cadence is lightweight")
assert.match(storeSource, /id: sampleWatchdog[\s\S]*interval: 2500/, "failed starts and hung helpers release the sampling latch")
assert.match(storeSource, /id: sampleDrainWatchdog/, "cancelled helpers get a bounded callback-drain window")
assert.match(storeSource, /activeSampleProcess\.destroy\(\)/, "discard destroys only the owned helper generation")
assert.match(storeSource, /onEnabledChanged:[\s\S]*if \(enabled\) return[\s\S]*cancelActiveSample\(""\)/,
  "disable resets observations while the active generation remains quarantined")
assert.match(storeSource, /nowMs = Date\.now\(\)/, "deadlines use the actual completion time")

const panelSource = fs.readFileSync(require.resolve("../../shell/plugins/island/SystemPanel.qml"), "utf8")
assert.match(panelSource, /required property var store/, "SystemPanel consumes only its store")
assert.match(panelSource, /property var content: null/, "the selected activity can retain its exact system event")
assert.match(panelSource, /property real headerRightInset: 32/, "the global ellipsis owns the upper-right inset")
assert.match(panelSource, /readonly property real preferredHeight: Math\.ceil\(contentColumn\.implicitHeight\)/,
  "semantic content and font metrics own preferred height")
assert.doesNotMatch(panelSource, /Flickable|ListView|ScrollView|WheelHandler/, "system pages never scroll")
assert.doesNotMatch(panelSource, /(?:root|parent)\.height/, "preferred content never reads assigned height")
assert.match(panelSource, /Style\.font\.family/, "the panel uses the native font")
assert.match(panelSource, /Color\.bar\.text/, "the panel follows the native bar theme")
assert.match(panelSource, /snapshot\.readings\.(?:cpu|ram|gpu)/, "the panel renders actual readings")
assert.match(panelSource, /Last known/, "stale values cannot appear to be current readings")
assert.match(panelSource, /no process outcome inferred/, "process evidence never claims a crash or death")
assert.match(panelSource, /onContentKeyChanged: page = 0/, "only a new activity identity resets paging")
assert.doesNotMatch(panelSource, /onContentChanged: page = 0/, "same-key reading refreshes preserve the page")
assert.match(panelSource, /root\.selectedIsProcess \? root\.selectedEvent\.label/,
  "process observations keep raw PID evidence out of the large-value headline")
assert.doesNotMatch(panelSource, /text:\s*"(?:Kill|Restart|Open app)"/, "the panel exposes no process controls")

const remainingEvents = qmlFunction(panelSource, "remainingEvents")
const eventForPage = qmlFunction(panelSource, "eventForPage")
const selectedFor = qmlFunction(panelSource, "selectedFor")
const systemEvents = [{ key: "selected" }, { key: "second" }, { key: "third" }]
assert.equal(selectedFor(systemEvents, { key: "selected", value: "old" }).event.key, systemEvents[0].key,
  "the panel refreshes the selected identity from the current snapshot")
const retainedSystem = selectedFor(systemEvents, { key: "expired", value: "observed" })
assert.equal(retainedSystem.event.key, "expired")
assert.equal(retainedSystem.current, false, "an expired trigger remains an honest retained observation")
const remaining = remainingEvents(systemEvents, systemEvents[0])
assert.equal(remaining.map(item => item.key).join(","), "second,third", "the exact trigger is not duplicated")
assert.equal(eventForPage(remaining, 2).key, "second", "the first alternate event is reachable")
assert.equal(eventForPage(remaining, 3).key, "third", "every remaining event gets a page")
assert.equal(eventForPage(remaining, 4), null, "paging stops after the final event")

console.log("system sampling, sustained policy, recovery, stale-state and panel contracts passed")
