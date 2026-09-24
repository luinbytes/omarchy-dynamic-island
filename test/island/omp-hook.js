const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { setTimeout: delay } = require("node:timers/promises")
const Agent = require("../../shell/plugins/island/AgentModel.js")

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "island-omp-"))
  const originalPath = process.env.PATH
  const originalOutput = process.env.OMP_ISLAND_TEST_EVENTS
  const originalMarker = process.env.OMPCODE
  try {
    const output = path.join(directory, "events")
    const command = path.join(directory, "omarchy-shell")
    fs.writeFileSync(command, "#!/usr/bin/env node\nrequire('node:fs').appendFileSync(process.env.OMP_ISLAND_TEST_EVENTS, process.argv[4] + '\\n')\n", { mode: 0o700 })
    process.env.PATH = directory + path.delimiter + originalPath
    process.env.OMP_ISLAND_TEST_EVENTS = output
    delete process.env.OMPCODE
    const handlers = {}
    const extension = (await import("../../scripts/omp-island.ts")).default
    process.env.OMPCODE = "1"
    const nestedHandlers = {}
    extension({ on(name, callback) { nestedHandlers[name] = callback } })
    assert.deepEqual(nestedHandlers, {}, "nested OMP sessions do not register a second publisher")
    delete process.env.OMPCODE
    extension({ on(name, callback) { handlers[name] = callback } })
    const ctx = id => ({ hasUI: true, sessionManager: { getSessionId: () => id } })
    handlers.session_start({}, { hasUI: false, sessionManager: { getSessionId: () => "headless" } })
    handlers.session_start({}, ctx("invalid id"))
    const first = ctx("session-1")
    handlers.session_start({}, first)
    handlers.agent_start({}, first)
    handlers.tool_execution_start({ toolName: "ask", args: { questions: [{ question: "PRIVATE" }] } }, first)
    handlers.tool_execution_end({ toolName: "ask", result: "PRIVATE" }, first)
    handlers.tool_approval_requested({ reason: "PRIVATE" }, first)
    handlers.tool_approval_resolved({}, first)
    handlers.agent_end({ willContinue: true })
    handlers.agent_end({})
    handlers.session_switch({}, ctx("session-2"))
    handlers.session_shutdown()

    const expected = ["SessionStart", "UserPromptSubmit", "Blocked", "UserPromptSubmit", "PermissionRequest", "UserPromptSubmit", "Stop", "SessionEnd", "SessionStart", "SessionEnd"]
    let lines = []
    for (let attempt = 0; attempt < 100; attempt++) {
      if (fs.existsSync(output)) lines = fs.readFileSync(output, "utf8").trim().split("\n")
      if (lines.length === expected.length) break
      await delay(20)
    }
    assert.equal(lines.length, expected.length, "all lifecycle events reach the shell in order")
    const events = lines.map(line => JSON.parse(line))
    assert.deepEqual(events.map(event => event.event), expected)
    assert.deepEqual(events.map(event => event.sessionId), expected.map((_, index) => index < 8 ? "omp:session-1" : "omp:session-2"))
    assert.equal(JSON.stringify(events).includes("PRIVATE"), false, "no user content leaves the extension")
    let state = Agent.initialState()
    const states = []
    for (const event of events) {
      state = Agent.ingest(state, event, Date.now())
      states.push(state.sessions.find(session => session.sessionId === event.sessionId).state)
    }
    assert.deepEqual(states, ["idle", "working", "blocked", "working", "approval-requested", "working", "turn-ended", "disconnected", "idle", "disconnected"])
    assert.equal(state.sessions[0].source, "OMP hooks")
    assert.equal(Agent.snapshot(state, Date.now(), true).attention, 0)
    console.log("OMP lifecycle, ordering, source, and privacy checks passed")
  } finally {
    process.env.PATH = originalPath
    if (originalOutput === undefined) delete process.env.OMP_ISLAND_TEST_EVENTS
    else process.env.OMP_ISLAND_TEST_EVENTS = originalOutput
    if (originalMarker === undefined) delete process.env.OMPCODE
    else process.env.OMPCODE = originalMarker
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
