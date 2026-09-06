const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const Agent = require("../../shell/plugins/island/AgentModel.js")
const start = 1000000

function qmlFunction(sourceText, name, context = {}) {
  const startIndex = sourceText.indexOf(`function ${name}(`)
  assert.notEqual(startIndex, -1, `${name} exists in the panel`)
  const open = sourceText.indexOf("{", startIndex)
  let depth = 0
  for (let index = open; index < sourceText.length; index++) {
    if (sourceText[index] === "{") depth++
    else if (sourceText[index] === "}") depth--
    if (depth === 0) return vm.runInNewContext(`(${sourceText.slice(startIndex, index + 1)})`, context)
  }
  assert.fail(`${name} has a complete body`)
}
const source = { online: true, agents: [
  { paneId: "%12", name: "Fixture agent", status: "working", cwd: "/private/project", prompt: "PRIVATE" },
  { paneId: "pane-idle", name: "Old session", status: "done" }
] }
let records = Agent.fromHerdr(Agent.initialState(), source, start)
assert.equal(records.sessions.length, 2)
assert.equal(records.sessions[0].state, "working")
assert.equal(records.sessions[0].source, "Herdr")
assert.equal(records.sessions[1].changedAt, 0, "an already-ended session is not a new ending event")
assert.equal(JSON.stringify(records).includes("PRIVATE"), false)
assert.equal(JSON.stringify(records).includes("/private"), false)
records = Agent.fromHerdr(records, source, start + 3000)
assert.equal(records.sessions[0].changedAt, start, "a source refresh does not reorder ongoing work")
assert.equal(records.sessions[0].observedAt, start + 3000)
let snapshot = Agent.snapshot(records, start + 4000, true, 10000)
assert.equal(snapshot.working, 1)
snapshot = Agent.snapshot(records, start + 13000, true, 10000)
assert.equal(snapshot.working, 0, "missing Herdr refreshes age out of compact selection")
assert.equal(snapshot.sessions[0].state, "working", "staleness is not completion")
source.agents[0].status = "blocked"
records = Agent.fromHerdr(records, source, start + 15000)
assert.equal(records.sessions[0].state, "blocked", "Herdr does not prove an approval request")
assert.equal(records.sessions[0].approvalNoted, false)
assert.equal(Agent.snapshot(records, start + 15001, true, 10000).attention, 1)
assert.equal(Agent.snapshot(records, start + 25000, true, 10000).attention, 0)
assert.equal(Agent.snapshot(records, start + 15001, false, 10000).attention, 0, "offline sources cannot retain active attention")
source.agents[0].status = "done"
records = Agent.fromHerdr(records, source, start + 26000)
assert.equal(records.sessions[0].state, "turn-ended", "reported done is not verified task success")
assert.equal(records.sessions[0].changedAt, start + 26000)

let hooks = Agent.ingest(Agent.initialState(), { sessionId: "fixture", parentId: "", event: "PermissionRequest", observedAt: start }, start)
hooks = Agent.ingest(hooks, { sessionId: "fixture", parentId: "", event: "PermissionRequest", observedAt: start + 1 }, start + 1)
assert.equal(hooks.sessions[0].changedAt, start)
assert.equal(Agent.snapshot(hooks, start + 300001, true).attention, 0)
assert.equal(hooks.sessions[0].approvalNoted, true, "stale attention remains in the detail record")
hooks = Agent.ingest(hooks, { sessionId: "fixture", parentId: "", event: "PreToolUse", observedAt: start + 2 }, start + 2)
assert.equal(hooks.sessions[0].state, "working")
assert.equal(Agent.snapshot(hooks, start + 2, true).attention, 0, "new work supersedes the previous approval observation")
assert.equal(Agent.hasCurrentSessions(Agent.snapshot(hooks, start + 2, true)), true)
assert.equal(Agent.hasCurrentSessions(Agent.snapshot(hooks, start + 300002, true)), false, "stale hooks cannot mask Herdr")
assert.equal(Agent.hasCurrentSessions(Agent.snapshot(hooks, start + 2, false)), false, "disabled hooks cannot mask Herdr")
let ended = Agent.ingest(hooks, { sessionId: "fixture", parentId: "", event: "Stop", observedAt: start + 3 }, start + 3)
assert.equal(Agent.hasCurrentSessions(Agent.snapshot(ended, start + 8002, true), start + 8002), true)
assert.equal(Agent.hasCurrentSessions(Agent.snapshot(ended, start + 8003, true), start + 8003), false, "ended hooks yield when their terminal lease expires")
ended = Agent.ingest(ended, { sessionId: "fixture", parentId: "", event: "Stop", observedAt: start + 5000 }, start + 5000)
assert.equal(Agent.hasCurrentSessions(Agent.snapshot(ended, start + 8003, true), start + 8003), false, "duplicate terminal observations cannot renew source ownership")
hooks = Agent.ingest(hooks, { sessionId: "fixture", parentId: "", event: "SessionEnd", observedAt: start + 3 }, start + 3)
assert.equal(Agent.hasCurrentSessions(Agent.snapshot(hooks, start + 3, true)), false, "disconnected hooks yield to Herdr immediately")

const panelSource = fs.readFileSync(require.resolve("../../shell/plugins/island/AgentsPanel.qml"), "utf8")
const storeSource = fs.readFileSync(require.resolve("../../shell/plugins/island/AgentStore.qml"), "utf8")
assert.match(storeSource, /property bool herdrEnumerationReady: false/,
  "the reported source begins unready until its first enumeration")
assert.match(storeSource, /function reconcileHerdr\(\)[\s\S]*Array\.isArray\(herdrState\.agents\)[\s\S]*herdrEnumerationReady = true/,
  "only an actual Herdr enumeration admits its initial agent baseline")
assert.match(storeSource, /if \(!herdrOnline\) \{[\s\S]*herdrEnumerationReady = false/,
  "reported-source disconnects reset readiness before a later reconnect")
assert.match(storeSource, /hookSubscribed \? true : herdrEnumerationReady/,
  "hook subscription remains ready so its first live event is not swallowed")
assert.match(panelSource, /property real headerRightInset: 32/, "the global ellipsis owns the upper-right inset")
assert.match(panelSource, /readonly property real preferredHeight: Math\.ceil\(contentColumn\.implicitHeight\)/,
  "semantic content and font metrics own preferred height")
assert.doesNotMatch(panelSource, /Flickable|ListView|ScrollView|WheelHandler/, "agent pages never scroll")
assert.doesNotMatch(panelSource, /(?:root|parent)\.height/, "agent content never reads assigned height")
assert.match(panelSource, /visible: root\.setupOpen/, "hook mutation controls stay behind explicit setup")
assert.match(panelSource, /Accessible\.name:/, "contextual controls have accessible names")

const sessionRank = qmlFunction(panelSource, "sessionRank")
const statusLabel = qmlFunction(panelSource, "statusLabel")
const orderedFor = qmlFunction(panelSource, "orderedFor", { root: { sessionRank } })
const pageFor = qmlFunction(panelSource, "pageFor")
const panelSessions = [
  { sessionId: "ended", state: "turn-ended", observedAt: 50, stale: false, approvalNoted: false, source: "Codex hooks" },
  { sessionId: "working", state: "working", observedAt: 40, stale: false, approvalNoted: false, source: "Codex hooks" },
  { sessionId: "blocked", state: "blocked", observedAt: 30, stale: false, approvalNoted: false, source: "Herdr" },
  { sessionId: "approval", state: "approval-requested", observedAt: 20, stale: false, approvalNoted: true, source: "Codex hooks" },
  { sessionId: "stale", state: "blocked", observedAt: 60, stale: true, approvalNoted: false, source: "Herdr" }
]
const ordered = orderedFor(panelSessions)
assert.equal(ordered.map(item => item.sessionId).join(","), "approval,blocked,working,ended,stale",
  "attention and current work rank ahead of terminal and stale sessions")
assert.equal(pageFor(ordered, 0, 3).map(item => item.sessionId).join(","), "approval,blocked,working",
  "the first bounded page contains the three highest-value sessions")
assert.equal(pageFor(ordered, 1, 3).map(item => item.sessionId).join(","), "ended,stale",
  "remaining sessions stay reachable on the next page")
assert.equal(statusLabel(panelSessions[2]), "Blocked · reported", "generic blocked status never implies an approval request")
console.log("agent source identity, semantic timing, privacy and stale attention checks passed")
