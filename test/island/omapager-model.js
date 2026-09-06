const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const notifications = require("../../shell/plugins/island/NotificationModel.js")

const timestamp = Date.UTC(2026, 8, 6, 12)
const row = {
  key: "nmg5w8k1",
  ts: timestamp / 1000,
  app: "Google Chrome",
  source: "Slack",
  summary: "Build complete\n",
  body: "<a href='https://example.invalid'>raw markup</a>",
  bodyLine: "Plain build summary",
  urgency: 2,
  codes: "123456",
  replyPath: "/private"
}

const live = notifications.normalizeOmapagerEntry(row, true)
assert.deepEqual(live, {
  key: JSON.stringify(["omapager", "nmg5w8k1"]),
  providerKey: "nmg5w8k1",
  live: true,
  restored: false,
  app: "Slack",
  summary: "Build complete",
  body: "Plain build summary",
  urgency: "critical",
  timestamp,
  canInvoke: true,
  canDismiss: true
}, "the provider boundary keeps action identity separate from the Island key and renders its plain source fields")
assert.equal(Object.hasOwn(live, "codes"), false, "provider code metadata cannot cross into Island entries")
assert.equal(Object.hasOwn(live, "replyPath"), false, "provider reply channels cannot cross into Island entries")

const restored = notifications.normalizeOmapagerEntry({ ...row, restored: true }, true)
assert.equal(restored.live, false, "restored Omapager cards are display-only")
assert.equal(restored.canInvoke, false, "restored cards cannot invoke stale provider actions")
assert.equal(restored.canDismiss, false, "restored cards cannot dismiss stale provider actions")
assert.equal(notifications.preview([restored], { [restored.key]: timestamp }, timestamp + 1, false, 6000), null,
  "restored cards cannot become compact previews")
assert.equal(notifications.normalizeOmapagerEntry({ ...row, key: "bad/key" }, true), null,
  "provider action keys are constrained before they become Island identity")

const parsed = notifications.parseOmapagerHistoryOutput(JSON.stringify({
  version: 2,
  backend: "omapager",
  entries: [{ ...row, restored: true }]
}))
assert.equal(parsed.ok, true, "bounded Omapager history uses its explicit format")
assert.equal(parsed.entries[0].live, false, "Omapager history remains non-live")
assert.equal(parsed.entries[0].app, "Slack", "history preserves the provider source label")
assert.equal(notifications.parseOmapagerHistoryOutput(JSON.stringify({ version: 2, backend: "native", entries: [] })).ok, false,
  "the Omapager parser rejects a mismatched provider")

const helper = path.resolve(__dirname, "../../scripts/island-notification-history.cjs")
const root = fs.mkdtempSync(path.join(os.tmpdir(), "island-omapager-"))

function runHelper(directory, limit = 10, maximumBytes = 65536) {
  return spawnSync(process.execPath, [helper, "--dir", directory, "--format", "omapager",
    "--limit", String(limit), "--max-bytes", String(maximumBytes)], { encoding: "utf8" })
}

function writeHistory(directory, closedAt, value) {
  fs.writeFileSync(path.join(directory, `${closedAt}-${value.key}.json`), JSON.stringify(value), { mode: 0o600 })
}

try {
  const directory = path.join(root, "history")
  fs.mkdirSync(directory, { mode: 0o700 })
  writeHistory(directory, timestamp - 5000, { ...row, key: "nolder", ts: (timestamp - 10000) / 1000 })
  writeHistory(directory, timestamp, row)
  fs.writeFileSync(path.join(directory, "ignored.txt"), "ignored", { mode: 0o600 })
  fs.symlinkSync(path.join(directory, `${timestamp}-${row.key}.json`), path.join(directory, `${timestamp + 1}-nlink.json`))

  const result = runHelper(directory, 1)
  assert.equal(result.status, 0, "the bounded helper reads regular Omapager history")
  const output = JSON.parse(result.stdout)
  assert.deepEqual(output, {
    version: 2,
    backend: "omapager",
    entries: [{
      key: row.key,
      app: "Google Chrome",
      source: "Slack",
      summary: "Build complete",
      body: "<a href='https://example.invalid'>raw markup</a>",
      bodyLine: "Plain build summary",
      urgency: 2,
      ts: timestamp / 1000,
      restored: true
    }]
  }, "closed-time filenames order Omapager history and the helper emits only its presentation fields")

  const mismatched = path.join(root, "mismatched")
  fs.mkdirSync(mismatched, { mode: 0o700 })
  fs.writeFileSync(path.join(mismatched, `${timestamp}-${row.key}.json`), JSON.stringify({ ...row, key: "nother" }), { mode: 0o600 })
  assert.notEqual(runHelper(mismatched).status, 0, "the filename and Omapager provider key must agree")

  const oversized = path.join(root, "oversized")
  fs.mkdirSync(oversized, { mode: 0o700 })
  fs.writeFileSync(path.join(oversized, `${timestamp}-${row.key}.json`), "x".repeat(2048), { mode: 0o600 })
  assert.notEqual(runHelper(oversized, 10, 1024).status, 0, "Omapager history honors the byte ceiling")
} finally {
  fs.rmSync(root, { recursive: true, force: true })
}

const store = fs.readFileSync(require.resolve("../../shell/plugins/island/NotificationStore.qml"), "utf8")
assert.match(store, /shell\.serviceFor\("njpatel\.omapager"\)/,
  "Omapager uses the mounted plugin service rather than a second bus server")
assert.match(store, /readonly property string providerId: usesOmapager \? "omapager" : "native"/,
  "the active backend is explicit for diagnostics and lifecycle baselines")
assert.match(store, /omapagerLayout\.decks[\s\S]*deck\.rows/,
  "live Omapager entries flatten the provider layout in display order")
assert.match(store, /NotificationModel\.normalizeOmapagerEntry\(deck\.rows\[rowIndex\], true\)/,
  "the adapter normalizes provider rows at its boundary")
assert.match(store, /omapagerService\.doNotDisturb === true \|\| Number\(omapagerService\.globalSnoozeUntil\)/,
  "provider quiet states conservatively suppress automatic Island previews")
assert.match(store, /function omapagerActionKey\(key\)[\s\S]*omapagerRows\(\)/,
  "an action revalidates the current provider row before forwarding it")
assert.match(store, /omapagerService\.activate\(providerKey\)/,
  "Open forwards the current raw provider key")
assert.match(store, /omapagerService\.closeToast\(providerKey, "dismissed"\)/,
  "Dismiss forwards the current raw provider key")
assert.match(store, /--format", request\.provider/,
  "history uses the bounded helper's provider format")
assert.match(store, /request\.generation === _historyGeneration[\s\S]*request\.provider === providerId/,
  "a provider switch invalidates stale history completions")
assert.match(store, /onOmapagerServiceChanged:[\s\S]*resetProvider\(\)/,
  "a replaced Omapager service instance resets the startup baseline")
assert.match(store, /function resetProvider\(\)\s*\{\s*nextHistoryGeneration\(\)\s*_pendingHistoryRequest = null/,
  "a replaced provider drops queued history reads before the old child exits")
assert.doesNotMatch(store, /refreshHeld|setDoNotDisturb|snoozeSource|IpcHandler/,
  "the Island adapter never mutates Omapager state or opens another notification server")

console.log("Omapager direct-provider notification boundary regressions passed")
