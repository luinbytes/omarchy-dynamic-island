const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const model = require("../../shell/plugins/island/ActivityModel.js")
const FixtureChecks = require("../../shell/plugins/island/FixtureChecks.js")
const source = fs.readFileSync(require.resolve("../../shell/plugins/island/IslandFixture.qml"), "utf8")
const serviceSource = fs.readFileSync(require.resolve("../../shell/plugins/island/Service.qml"), "utf8")
const publisherSource = fs.readFileSync(require.resolve("../../shell/plugins/island/MediaPublisher.qml"), "utf8")

assert.match(serviceSource, /readonly property bool fixturesEnabled: Quickshell\.env\("OMARCHY_ISLAND_FIXTURES"\) === "1"/)
assert.match(serviceSource, /MediaPublisher \{[\s\S]*enabled: !root\.fixturesEnabled/)
assert.match(publisherSource, /if \(!enabled\) return/)

function fixture(drop) {
  let now = 1000
  let delivered = 0
  const root = { failure: "", lastRejection: "", settledState: null, settlesAt: 0,
    expectedState: { phase: "idle", ids: [], primaryKey: null, selectedKey: null } }
  const service = {
    state: model.initialState(),
    get presentation() { return this.state.presentation },
    resetFixtureState() { this.state = model.initialState() }
  }
  root.activityBroker = { deliver(command) {
    if (++delivered === drop) return
    const result = model.reduce(service.state, JSON.parse(JSON.stringify(command)), { nowMs: now, focusedScreen: "" })
    if (!result.accepted) root.lastRejection = result.error
    if (result.changed) service.state = result.state
  } }
  const context = vm.createContext({ root, service, FixtureChecks, Date: { now: () => now } })
  for (const match of source.matchAll(/^  function (\w+)\(([^\n]*)\) \{\n([\s\S]*?)^  \}/gm)) {
    root[match[1]] = vm.runInContext(`(function(${match[2]}) {\n${match[3]}\n})`, context)
    context[match[1]] = root[match[1]]
  }
  const ipc = {}
  for (const match of source.matchAll(/^    function (\w+)\(\): string \{\n([\s\S]*?)^    \}/gm)) {
    ipc[match[1]] = vm.runInContext(`(function() {\n${match[2]}\n})`, context)
  }
  return { ipc, service, advance(ms, tick) {
    now += ms
    if (tick) {
      const result = model.reduce(service.state, { type: "tick" }, { nowMs: now, focusedScreen: "" })
      if (result.changed) service.state = result.state
    }
  } }
}

for (const scenario of ["compact", "minimal", "two", "alerting", "expanded", "expiry"]) {
  assert.match(fixture().ipc[scenario](), /^ISLAND_FIXTURE_PASS/, scenario)
  assert.match(fixture(1).ipc[scenario](), /^ISLAND_FIXTURE_FAIL/, scenario + " dropped publication")
}
for (const scenario of ["two", "alerting", "expanded"]) {
  assert.match(fixture(2).ipc[scenario](), /^ISLAND_FIXTURE_FAIL/, scenario + " dropped second command")
}
assert.match(fixture().ipc.malformed(), /^ISLAND_FIXTURE_REJECT/)
assert.match(fixture(1).ipc.malformed(), /^ISLAND_FIXTURE_FAIL/)
for (const scenario of ["alerting", "expiry"]) {
  const working = fixture()
  working.ipc[scenario]()
  working.advance(1000, true)
  assert.match(working.ipc.status(), /^ISLAND_FIXTURE_PASS/, scenario + " settled")
  const stuck = fixture()
  stuck.ipc[scenario]()
  stuck.advance(1000, false)
  assert.match(stuck.ipc.status(), /^ISLAND_FIXTURE_FAIL/, scenario + " missing timer")
}
const wrongSelection = fixture()
wrongSelection.ipc.two()
wrongSelection.service.state.presentation.primaryKey = model.identityKey("fixture", "first")
assert.match(wrongSelection.ipc.status(), /^ISLAND_FIXTURE_FAIL/)
const wrongSelected = fixture()
wrongSelected.ipc.two()
wrongSelected.service.state.presentation.selectedKey = model.identityKey("fixture", "second")
assert.match(wrongSelected.ipc.status(), /^ISLAND_FIXTURE_FAIL/)
const wrongSecondary = fixture()
wrongSecondary.ipc.alerting()
wrongSecondary.service.state.presentation.secondaryKey = null
assert.match(wrongSecondary.ipc.status(), /^ISLAND_FIXTURE_FAIL/)
const staleSecondary = fixture()
staleSecondary.ipc.compact()
staleSecondary.service.state.presentation.secondaryKey = model.identityKey("fixture", "missing")
assert.match(staleSecondary.ipc.status(), /^ISLAND_FIXTURE_FAIL/)
console.log("fixture assertions passed, including dropped commands and missing timers")
