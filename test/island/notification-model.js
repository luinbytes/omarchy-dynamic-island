const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const vm = require("node:vm")
const { spawnSync } = require("node:child_process")
const notifications = require("../../shell/plugins/island/NotificationModel.js")

const baseTime = Date.UTC(2026, 8, 5, 12)
const raw = {
  originalId: 7,
  app: "Fixture App",
  summary: "Fixture summary",
  body: "Fixture body",
  urgency: 2,
  timestamp: baseTime,
  execArgv: ["forbidden"],
  image: "https://invalid.example/image",
  appIcon: "https://invalid.example/icon",
  glyph: "forbidden"
}

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

const live = notifications.normalizeEntry(raw, true)
assert.deepEqual(Object.keys(live), [
  "key", "live", "app", "summary", "body", "urgency", "timestamp", "canInvoke", "canDismiss"
], "public entries expose only the bounded presentation and control contract")
assert.equal(live.key, JSON.stringify([baseTime, 7]), "compound identity is stable")
assert.equal(live.urgency, "critical", "native urgency normalizes to a named value")
assert.equal(live.canInvoke, true, "only live rows can invoke")
assert.equal(live.canDismiss, true, "only live rows can dismiss")
assert.equal(Object.hasOwn(live, "execArgv"), false, "launch arguments never enter public values")
assert.equal(Object.hasOwn(live, "image"), false, "network image references never enter public values")

const bounded = notifications.normalizeEntry({
  originalId: 8,
  app: "a".repeat(100),
  summary: "summary\nwith\tcontrols" + "s".repeat(200),
  body: "b".repeat(700),
  timestamp: baseTime + 1
}, false)
assert.equal(bounded.app.length, 80, "application names are bounded")
assert.ok(bounded.summary.length <= 160 && !/[\n\t]/.test(bounded.summary), "summaries are plain and bounded")
assert.equal(bounded.body.length, 512, "bodies are bounded")
assert.equal(bounded.live, false, "history entries remain non-live")
assert.equal(bounded.canInvoke, false, "history can never invoke")
assert.equal(bounded.canDismiss, false, "history can never dismiss")
assert.equal(notifications.normalizeEntry({ originalId: -1, timestamp: baseTime }, true), null,
  "the native history placeholder is not a valid public entry")

let semantic = notifications.updateSemanticEvents({}, {}, [live], baseTime + 10000)
assert.equal(semantic.eventTimes[live.key], baseTime, "a first sighting keeps its native event time")
assert.equal(notifications.preview([live], semantic.eventTimes, baseTime + 5999, false, 6000), live,
  "a new live row previews within its lease")
assert.equal(notifications.preview([live], semantic.eventTimes, baseTime + 6000, false, 6000), null,
  "a preview expires at six seconds")
assert.equal(notifications.preview([live], semantic.eventTimes, baseTime + 1000, true, 6000), null,
  "Do Not Disturb suppresses preview eligibility")
assert.equal(notifications.preview([{ ...live, live: false }], semantic.eventTimes, baseTime + 1000, false, 6000), null,
  "restored and historical rows cannot enter the compact preview")

const replacement = notifications.normalizeEntry({ ...raw, summary: "Replacement" }, true)
semantic = notifications.updateSemanticEvents(semantic.fingerprints, semantic.eventTimes, [replacement], baseTime + 20000)
assert.equal(semantic.eventTimes[replacement.key], baseTime + 20000,
  "changed content at the same compound identity is a fresh semantic event")
assert.equal(notifications.preview([replacement], semantic.eventTimes, baseTime + 20001, false, 6000), replacement,
  "replacement semantics receive a new preview lease")
assert.equal(notifications.previewWakeAt([replacement], semantic.eventTimes, baseTime + 20001, false, 6000), baseTime + 26000,
  "the selection layer can wake at the semantic lease deadline")

const historyPayload = JSON.stringify({ version: 1, entries: [
  { ...raw, timestamp: baseTime - 1000, originalId: 1 },
  { ...raw, timestamp: baseTime - 2000, originalId: 2 }
] })
const parsedHistory = notifications.parseHistoryOutput(historyPayload)
assert.equal(parsedHistory.ok, true, "validated helper history parses")
assert.equal(parsedHistory.entries.every(entry => !entry.live && !entry.canInvoke && !entry.canDismiss), true,
  "history stays display-only")
assert.deepEqual(notifications.mergeEntries([live], [live, ...parsedHistory.entries], 2).map(entry => entry.key),
  [live.key, parsedHistory.entries[0].key], "live rows win deduplication and merged history stays bounded")
assert.equal(notifications.parseHistoryOutput("not json").ok, false, "malformed helper output fails closed")

const helper = path.resolve(__dirname, "../../scripts/island-notification-history.cjs")
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "island-notification-"))

function runHelper(directory, limit = 10, maximumBytes = 65536) {
  return spawnSync(process.execPath, [helper, "--dir", directory, "--limit", String(limit),
    "--max-bytes", String(maximumBytes)], { encoding: "utf8" })
}

function writeFixture(directory, timestamp, originalId, extra = {}) {
  const value = {
    timestamp,
    originalId,
    app: "Fixture App",
    summary: "Fixture summary",
    body: "Fixture body",
    urgency: 1,
    execArgv: ["forbidden"],
    image: "https://invalid.example/private",
    ...extra
  }
  fs.writeFileSync(path.join(directory, `${timestamp}-${originalId}.json`), JSON.stringify(value), { mode: 0o600 })
}

try {
  const goodDirectory = path.join(fixtureRoot, "good")
  fs.mkdirSync(goodDirectory, { mode: 0o700 })
  writeFixture(goodDirectory, baseTime, 1)
  writeFixture(goodDirectory, baseTime + 1000, 2)
  fs.writeFileSync(path.join(goodDirectory, "ignored.txt"), "ignored", { mode: 0o600 })
  fs.symlinkSync(path.join(goodDirectory, `${baseTime}-1.json`), path.join(goodDirectory, `${baseTime + 2000}-3.json`))

  const goodResult = runHelper(goodDirectory, 1)
  assert.equal(goodResult.status, 0, "bounded regular history fixtures are readable")
  const helperPayload = JSON.parse(goodResult.stdout)
  assert.equal(helperPayload.entries.length, 1, "helper honors the requested file count")
  assert.equal(helperPayload.entries[0].timestamp, baseTime + 1000, "helper reads newest files first")
  assert.deepEqual(Object.keys(helperPayload.entries[0]), ["originalId", "app", "summary", "body", "urgency", "timestamp"],
    "helper emits only known fields")

  const directoryLink = path.join(fixtureRoot, "directory-link")
  fs.symlinkSync(goodDirectory, directoryLink)
  assert.notEqual(runHelper(directoryLink).status, 0, "a symlinked history directory is rejected")

  const mismatchedDirectory = path.join(fixtureRoot, "mismatched")
  fs.mkdirSync(mismatchedDirectory, { mode: 0o700 })
  writeFixture(mismatchedDirectory, baseTime + 3000, 4, { originalId: 5 })
  assert.notEqual(runHelper(mismatchedDirectory).status, 0, "filename and content identity must agree")

  const oversizedDirectory = path.join(fixtureRoot, "oversized")
  fs.mkdirSync(oversizedDirectory, { mode: 0o700 })
  fs.writeFileSync(path.join(oversizedDirectory, `${baseTime + 4000}-6.json`), "x".repeat(2048), { mode: 0o600 })
  assert.notEqual(runHelper(oversizedDirectory, 10, 1024).status, 0, "oversized history files fail closed")
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true })
}

const storeSource = fs.readFileSync(require.resolve("../../shell/plugins/island/NotificationStore.qml"), "utf8")
assert.match(storeSource, /shell\.firstPartyServiceFor\("omarchy\.notifications"\)/,
  "the store binds the native first-party notification service")
assert.match(storeSource, /readonly property double previewUntil:/, "the store exposes the semantic preview deadline")
assert.match(storeSource, /readonly property bool available: enabled &&/,
  "the adapter is inert when the inherited Item enabled gate is false")
assert.match(storeSource, /function popupIndex\(key\)[\s\S]*popupModel\.get\(index\)/,
  "each explicit control re-resolves the current native row")
assert.match(storeSource, /invokePopupDefault\(index\)/, "Open delegates only to the native explicit action")
assert.match(storeSource, /dismissPopup\(index\)/, "Dismiss delegates only to the native explicit action")
assert.match(storeSource, /_historyStreamFinished \|\| !_historyExited/,
  "history acceptance rendezvouses stdout completion and process exit")
assert.match(storeSource, /_historyExitCode !== 0/, "failed helper exits cannot publish history")
assert.match(storeSource, /id: historyWatchdog[\s\S]*onTriggered: root\.timeOutHistoryRequest\(\)/,
  "a bounded watchdog prevents a failed helper launch from latching the request")
assert.match(storeSource, /function requestInitialHistory\(\)[\s\S]*!_componentReady \|\| !enabled \|\| !available \|\| _initialHistoryRequested/,
  "persisted history loads once only after the owner store is ready and available")
assert.match(storeSource, /onAvailableChanged: requestInitialHistory\(\)/,
  "late native-service availability still starts the initial history load")
assert.match(storeSource, /Component\.onCompleted:[\s\S]*schedulePopupSync\(false\)[\s\S]*requestInitialHistory\(\)/,
  "store startup owns initial history loading independently of panel construction")
let initialHistoryStarts = 0
const initialHistoryState = {
  _componentReady: true,
  enabled: true,
  available: false,
  _initialHistoryRequested: false,
  historyRefreshTimer: { restart() { initialHistoryStarts++ } }
}
const requestInitialHistory = qmlFunction(storeSource, "requestInitialHistory", initialHistoryState)
assert.equal(requestInitialHistory(), false, "history does not start before the native service is available")
initialHistoryState.available = true
assert.equal(requestInitialHistory(), true, "late native availability starts the owner load")
assert.equal(requestInitialHistory(), false, "repeated lifecycle notifications do not duplicate the owner load")
assert.equal(initialHistoryStarts, 1)
assert.match(storeSource, /Number\(row\.originalId\) === -1/, "native replay placeholders are ignored")
assert.doesNotMatch(storeSource, /property int[^\n]*(timestamp|fetchedAt|nowMs|preview)/,
  "epoch values cannot overflow a QML int")
assert.doesNotMatch(storeSource, /showRecentHistory|setDoNotDisturb|clearHistory|execArgv/,
  "the adapter has no host takeover or hidden native mutation route")

const panelSource = fs.readFileSync(require.resolve("../../shell/plugins/island/NotificationPanel.qml"), "utf8")
assert.match(panelSource, /required property var store/, "the panel consumes the domain store")
assert.match(panelSource, /property var content: null/, "the selected activity can retain its exact notification")
assert.match(panelSource, /property real headerRightInset: 32/, "the global ellipsis owns the upper-right inset")
assert.match(panelSource, /readonly property real preferredHeight: Math\.ceil\(contentColumn\.implicitHeight\)/,
  "semantic content and font metrics own preferred height")
assert.doesNotMatch(panelSource, /Flickable|ListView|ScrollView|WheelHandler/, "notification pages never scroll")
assert.doesNotMatch(panelSource, /(?:root|parent)\.height/, "notification content never reads assigned height")
assert.doesNotMatch(panelSource, /Component\.onCompleted:[^\n]*refreshHistory/,
  "panel construction never refreshes history as a side effect")
assert.match(panelSource, /Accessible\.name: "Refresh notification history"/,
  "history refresh remains an explicit contextual action")
assert.match(panelSource, /onClicked: root\.store\.refreshHistory\(\)/,
  "the explicit refresh control requests read-only history")
assert.match(panelSource, /textFormat: Text\.PlainText/g, "notification text is rendered as plain text")
assert.match(panelSource, /root\.entry\.live && root\.entry\.canInvoke/,
  "Open is available only for live actionable rows")
assert.match(panelSource, /root\.entry\.live && root\.entry\.canDismiss/,
  "Dismiss is available only for live dismissible rows")
assert.match(panelSource, /Accessible\.name:/, "explicit controls expose accessible names")
assert.doesNotMatch(panelSource, /Native presenter unchanged/, "internal host ownership does not occupy the panel")
assert.match(panelSource, /onContentKeyChanged: page = 0/, "only a new activity identity resets paging")
assert.doesNotMatch(panelSource, /onContentChanged: page = 0/, "same-key content refreshes preserve the page")
assert.match(panelSource, /Style\.font\.family/, "the panel uses the configured system font")

const entriesFor = qmlFunction(panelSource, "entriesFor")
const bodyChunks = qmlFunction(panelSource, "bodyChunks")
const pagesFor = qmlFunction(panelSource, "pagesFor", { root: { bodyChunks } })
const entryForPage = qmlFunction(panelSource, "entryForPage")
const exactCurrent = entriesFor([live, parsedHistory.entries[0]], live)
assert.equal(exactCurrent[0].key, live.key, "the selected live identity opens first")
assert.equal(exactCurrent[0].live, true, "a matching native row retains live controls")
const expired = { ...live, key: "expired-key", summary: "Expired" }
const retained = entriesFor([live], expired)
assert.equal(retained[0].key, "expired-key", "an expired selected identity is never replaced")
assert.equal(retained[0].retained, true)
assert.equal(retained[0].live, false, "retained detail cannot expose stale native actions")
const longBody = "🙂".repeat(250)
const chunks = bodyChunks(longBody, 120, 4)
assert.equal(chunks.length, 3, "long notification bodies use explicit bounded detail pages")
assert.equal(chunks.join(""), longBody, "body paging preserves every Unicode code point")
assert.equal(chunks.every(chunk => Array.from(chunk).length <= 120), true)
const newlineBody = "\n".repeat(120)
const newlineChunks = bodyChunks(newlineBody, 120, 4)
assert.equal(newlineChunks.join(""), newlineBody, "newline paging preserves every line break")
assert.equal(newlineChunks.every(chunk => (chunk.match(/\n/g) || []).length <= 3), true,
  "each detail page renders at most four logical lines")
const mixedBody = "A🙂\nBé\nC界\nD🚀\nE"
const mixedChunks = bodyChunks(mixedBody, 120, 4)
assert.equal(mixedChunks.join(""), mixedBody, "line-bounded paging preserves mixed Unicode exactly")
assert.equal(mixedChunks.every(chunk => Array.from(chunk).length <= 120
  && (chunk.match(/\n/g) || []).length <= 3), true)
const pages = pagesFor([{ ...live, body: longBody }, { ...parsedHistory.entries[0], body: "" }])
assert.equal(pages.length, 4, "every body chunk and following notification remains reachable")
assert.equal(entryForPage(pages, 3).entry.key, parsedHistory.entries[0].key)

console.log("notification model, history boundary and compact panel contract assertions passed")
