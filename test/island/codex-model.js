const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const codex = require("../../shell/plugins/island/CodexModel.js")

let usage = codex.normalize({
  available: true,
  session_used: 31,
  used: 56,
  remaining: 44,
  status: "under pace",
  pace_state: "ahead",
  margin: 12,
  reset: "2d 5h  ·  Tue 18:30",
  weekly_reset_at: 1789201150,
  session_reset_at: 1789183150
}, true)
assert.deepEqual(usage, {
  providerPresent: true,
  available: true,
  sessionUsed: 31,
  weeklyUsed: 56,
  remaining: 44,
  pace: "under pace",
  paceState: "ahead",
  margin: 12,
  reset: "2d 5h  ·  Tue 18:30",
  weeklyResetAt: 1789201150,
  sessionResetAt: 1789183150
}, "the direct provider boundary preserves its usage and pace semantics")

usage = codex.normalize({ available: true, remaining: 25, session_used: 20 }, true)
assert.equal(usage.weeklyUsed, 75, "remaining capacity derives the absent weekly-used display field")
assert.equal(usage.pace, "", "an omitted pace remains unavailable rather than being recomputed")
assert.equal(usage.weeklyResetAt, null, "an omitted weekly reset remains unavailable")
assert.equal(usage.sessionResetAt, null, "an omitted session reset remains unavailable")

usage = codex.normalize({ available: false, remaining: null, session_used: null }, true)
assert.equal(usage.sessionUsed, null, "the provider's unavailable session value does not become zero usage")
assert.equal(usage.remaining, null, "the provider's unavailable remaining value does not become zero capacity")
assert.equal(usage.weeklyUsed, null, "no weekly display value is inferred from unavailable provider fields")
assert.equal(usage.weeklyResetAt, null, "unavailable providers do not retain a weekly reset")
assert.equal(usage.sessionResetAt, null, "unavailable providers do not retain a session reset")

usage = codex.normalize({ available: true, used: 150, remaining: -3, pace_state: "account", reset: { private: true } }, true)
assert.equal(usage.weeklyUsed, 100, "external percentages remain bounded at the provider boundary")
assert.equal(usage.remaining, 0, "external percentages remain bounded at the provider boundary")
assert.equal(usage.paceState, "", "unknown provider pace states do not become UI semantics")
assert.equal(usage.reset, "", "non-display provider values do not enter the panel")
assert.equal(codex.normalize({ available: true, remaining: 50, weekly_reset_at: "1789201150", session_reset_at: -1 }, true).weeklyResetAt, null,
  "reset epochs remain numeric provider data")
assert.equal(codex.normalize({ available: true, remaining: 50, weekly_reset_at: 1789201150, session_reset_at: 1789183150 }, true).sessionResetAt, 1789183150,
  "numeric reset epochs cross the provider boundary")
assert.equal(codex.normalize({ available: true, used: "", remaining: false }, true).weeklyUsed, null,
  "non-numeric external values do not coerce into usage percentages")

usage = codex.normalize(null, false)
assert.deepEqual(usage, {
  providerPresent: false,
  available: false,
  sessionUsed: null,
  weeklyUsed: null,
  remaining: null,
  pace: "",
  paceState: "",
  margin: null,
  reset: "",
  weeklyResetAt: null,
  sessionResetAt: null
}, "a missing provider remains a selectable unavailable route without private fallback data")

const panel = fs.readFileSync(require.resolve("../../shell/plugins/island/CodexPanel.qml"), "utf8")
const service = fs.readFileSync(require.resolve("../../shell/plugins/island/Service.qml"), "utf8")
const hubContent = fs.readFileSync(require.resolve("../../shell/plugins/island/HubContent.qml"), "utf8")
assert.match(panel, /text: "Session"[\s\S]*text: "Weekly"[\s\S]*text: "Pace"[\s\S]*text: root\.snapshot\.reset \? "Resets "/,
  "the panel keeps both provider windows, pace, and reset visible together")
assert.doesNotMatch(panel, /ScrollView|Canvas|refresh\(/, "the panel remains compact and never creates a provider refresh path")
assert.match(panel, /providerPresent \? "Codex Usage has no current limit data\." : "Codex Usage is not available on this bar\."/,
  "missing widgets and unavailable provider data have distinct explanations")
assert.match(service, /moduleWidgets\("lu\.codex-usage"\)[\s\S]*widget\.usage\.available === true/,
  "Service reads the provider's live public usage and prefers an available instance")
assert.match(service, /readonly property var codexUsage: CodexModel\.normalize\([\s\S]*codex: root\.codexUsage/,
  "the normalized provider binding flows through the existing domain snapshot reconciliation")
assert.doesNotMatch(service, /NotesRepository|\.refresh\(/,
  "the direct integration leaves saved Notes dormant and never refreshes the provider")
assert.match(service, /codex: \{[\s\S]*providerPresent:[\s\S]*available:[\s\S]*sessionUsed:[\s\S]*weeklyUsed:[\s\S]*remaining:[\s\S]*paceState:/,
  "diagnostics expose only provider state and percentage fields")
assert.match(hubContent, /id: codexLoader[\s\S]*CodexPanel \{ usage: root\.service\.codexUsage \}/,
  "the Codex route owns a direct normalized usage panel")
assert.doesNotMatch(hubContent, /NotesPanel|id: "notes"/, "Notes has no active loader or chooser route")
assert.match(hubContent, /iconText: ""[\s\S]*ActivityIcon \{[\s\S]*name: chooserToolButton\.modelData\.icon[\s\S]*size: 14[\s\S]*fallbackText: ""/,
  "chooser semantics use the shared icon component without replacing native button input")

const selectorMatch = service.match(/^  function codexUsageWidget\(\) \{\n([\s\S]*?)^  \}/m)
assert.ok(selectorMatch, "Service owns one direct Codex usage widget selector")
const unavailableWidget = { usage: { available: false } }
const availableWidget = { usage: { available: true } }
const selector = vm.runInNewContext(`(function() {\n${selectorMatch[1]}\n})`, {
  shell: { bar: { moduleWidgets(id) {
    assert.equal(id, "lu.codex-usage")
    return [unavailableWidget, availableWidget]
  } } }
})
assert.equal(selector(), availableWidget, "an available live provider wins over another monitor's unavailable instance")

console.log("Codex usage boundary preserves direct provider semantics")
