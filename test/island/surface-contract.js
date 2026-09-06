const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")
const ActivityModel = require("../../shell/plugins/island/ActivityModel.js")

const source = fs.readFileSync(require.resolve("../../shell/plugins/island/IslandSurface.qml"), "utf8")
const serviceSource = fs.readFileSync(require.resolve("../../shell/plugins/island/Service.qml"), "utf8")
const hubContentSource = fs.readFileSync(require.resolve("../../shell/plugins/island/HubContent.qml"), "utf8")
const activityVisualSource = fs.readFileSync(require.resolve("../../shell/plugins/island/ActivityVisual.qml"), "utf8")
assert.match(source, /WlrLayershell\.layer:\s*WlrLayer\.Top/, "island shares the native bar layer and yields to fullscreen applications")
assert.doesNotMatch(source, /WlrLayershell\.layer:\s*WlrLayer\.Overlay/, "island is not classified as a modal overlay")
assert.match(source, /id:\s*layoutPreflight[\s\S]*visible:\s*false[\s\S]*reportLayout:\s*active/,
  "a pending route is measured before the first expanded motion")
assert.match(source, /expected\.key !== key \|\| Math\.round\(widthToken\) !== expected\.widthToken/,
  "layout reports are guarded by exact key and target width")
assert.match(source, /closeHubChooser\(root\.screenName\)[\s\S]*root\.close\("escape"\)/,
  "Escape closes the chooser before collapsing its current activity")
assert.equal((activityVisualSource.match(/reportLayout:\s*root\.interactive/g) || []).length, 1,
  "only the incoming interactive activity body reports local layout changes")
assert.doesNotMatch(hubContentSource, /id:\s*toolRow|anchors\.bottomMargin:\s*root\.tool === "music" \? 78 : 48/,
  "expanded content has no permanent bottom navigation")
assert.match(hubContentSource, /id:\s*chooserRepeater[\s\S]*\{ id: "music"[\s\S]*\{ id: "system"/,
  "the transient chooser keeps all six tools reachable")
assert.match(hubContentSource, /onContentKeyChanged:\s*layoutReportTimer\.restart\(\)/,
  "a same-size replacement identity publishes its own guarded layout")
assert.match(hubContentSource, /onHeightBudgetChanged:\s*layoutReportTimer\.restart\(\)/,
  "screen budget changes revalidate the open semantic layout")
assert.match(activityVisualSource, /heightBudget:\s*root\.detailHeightBudget/,
  "the incoming panel receives the current screen budget without deriving size from its assigned height")
assert.match(activityVisualSource, /id:\s*capsuleBackground[\s\S]*?ShapePath[\s\S]*?PathSvg[\s\S]*?path:\s*root\.outline\.perimeter/,
  "one closed ShapePath consumes the pure outline perimeter")
assert.equal((source.match(/backgroundVisible: !root\.unifiedSurface/g) || []).length, 2,
  "both content bodies relinquish their individual fills to the unified surface")
assert.match(source, /capsuleOutline: ViewModel\.activityOutline\(motion\.visual\.capsule\.rect, root\.metrics\)/,
  "the hub draws one continuous perimeter from the persistent capsule")
assert.match(source, /PathSvg \{ path: root\.capsuleOutline\.perimeter \}/,
  "the capsule outline drives the unified fill")
assert.match(source, /firstInputOutline: root\.closedPeekPresentation \? root\.peekOutline\s+: root\.unifiedSurface \? root\.capsuleOutline : bodyOne\.outline/,
  "closed peeks use their capsule perimeter while the shared hub input stays persistent")
assert.doesNotMatch(source, /combinedActivityOutline\(motion\.visual\.bodies/,
  "retiring content regions cannot resize the unified input or fill outline")
assert.match(source, /ViewModel\.activityKeyAtPoint\(motion\.visual\.bodies, x \+ mouse\.x, y \+ mouse\.y\)/,
  "the internal space routes to a real sampled activity key")
assert.doesNotMatch(activityVisualSource, /id:\s*shoulderShape|root\.outline\.shoulders\[index\]/,
  "the renderer has no separately anti-aliased shoulder fill")
assert.doesNotMatch(activityVisualSource, /blurEnabled|blurMax|Behavior on opacity/,
  "activity and content containers use geometry displacement without fades or blur")
assert.equal((activityVisualSource.match(/layer\.effect:/g) || []).length, 2,
  "both fixed-position artwork layers retain the shared rounded mask during a metadata fade")
assert.equal((activityVisualSource.match(/layer\.effect: MultiEffect \{ maskEnabled: true; maskSource: sharedArtMask \}/g) || []).length, 2,
  "the image effects only mask the outgoing and incoming artwork corners")
assert.match(activityVisualSource, /readonly property bool hubNavigationInteractive: root\.interactive[\s\S]*hubState\.ownerScreen === root\.screenName[\s\S]*hubState\.entityKey === root\.visual\.key[\s\S]*root\.visual\.incoming\.expanded === true[\s\S]*content\.hub === true[\s\S]*content\.key === root\.visual\.key/,
  "only the current expanded Hub route can receive early navigation input")
assert.match(activityVisualSource, /readonly property bool chooserSelectionInteractive: root\.chooserOwnsHeader[\s\S]*readonly property bool incomingInteractive: root\.controlsInteractive \|\| root\.hubNavigationInteractive[\s\S]*id: incomingLayer\s+enabled: root\.incomingInteractive/,
  "Hub navigation is the sole exception to the settled content-input gate")
assert.match(activityVisualSource, /controlsEnabled: root\.controlsInteractive\s+chooserNavigationEnabled: root\.hubNavigationInteractive\s+chooserSelectionEnabled: root\.chooserSelectionInteractive/,
  "Hub navigation capabilities are passed separately from general controls")
assert.match(hubContentSource, /property bool chooserSelectionEnabled: false[\s\S]*focusable: root\.chooserSelectionEnabled\s+enabled: root\.chooserSelectionEnabled/,
  "only chooser rows become actionable during the bounded geometry morph")
assert.match(activityVisualSource, /actionsEnabled: root\.controlsInteractive/,
  "ordinary activity actions retain the settled-geometry input gate")
assert.match(hubContentSource, /id: detailBody[\s\S]*enabled: root\.interactive && root\.controlsEnabled/,
  "the chooser exception cannot enable the current detail body")
assert.match(hubContentSource, /id: chooserButton[\s\S]*visible: root\.active && root\.interactive\s+enabled: visible && root\.chooserNavigationEnabled/,
  "the current Hub can open its chooser before the geometry settles")
assert.match(activityVisualSource, /outgoing\.offsetY[\s\S]*incoming\.offsetY/,
  "content replacement consumes the motion owner's signed vertical displacement")
assert.match(activityVisualSource, /ViewModel\.titleSample\(root\.visual[\s\S]*titleSampleRect/,
  "media title sampling accepts the source-anchored region projection")
assert.match(activityVisualSource, /outgoing\.offsetX[\s\S]*incoming\.offsetX/,
  "both retained content layers consume the region projection coordinates")
assert.match(activityVisualSource, /sharedTitle\.offsetY/,
  "the one shared title consumes its identity handoff displacement")
assert.ok((activityVisualSource.match(/opacity:\s*1/g) || []).length >= 4,
  "the activity body, content layers and shared title stay fully opaque")
assert.ok((source.match(/intersection:\s*Intersection\.Subtract/g) || []).length >= 4,
  "the input mask subtracts the same quarter-circle shoulder cutouts")
assert.match(source, /outlines:\s*\{ primary: outlineFor\(bodyOne\), secondary: outlineFor\(bodyTwo\) \}/,
  "diagnostics expose outline crop bounds without changing physical click rectangles")
assert.equal((source.match(/outlineMetrics:\s*root\.metrics/g) || []).length, 2,
  "both keyed visual bodies derive their outline from the same screen metrics")
assert.match(hubContentSource, /canCyclePlayer:\s*root\.mediaPlayers\.length > 1[\s\S]*onCyclePlayerRequested:\s*root\.cycleMediaPlayer\(\)/,
  "removing permanent navigation does not strand native media player selection")
assert.doesNotMatch(hubContentSource, /PopupCard|PopupWindow/, "the chooser stays inside the keyed activity body")
assert.match(serviceSource, /function reportHubLayout\(screen, key, widthToken, preferredHeight, expectedWidthToken, heightBudget\)/,
  "Service owns one guarded layout acceptance boundary")
assert.match(source, /readonly property var peekVisual: motion\.visual\.peek/,
  "the surface reads a dedicated peek record rather than reusing a content body")
assert.match(source, /PeekContent \{[\s\S]*visual: root\.peekVisual[\s\S]*onClicked: root\.promotePeek\(\)/,
  "the shallow peek has an explicit promotion target without hub furniture")
assert.match(source, /secondInputActive: root\.presenterAvailable && \(root\.peekVisual && root\.peekVisual\.placement === "below" \? root\.peekInputActive/,
  "an attached peek receives its own bounded input region")
assert.match(serviceSource, /function eligiblePeekScreens\(\)[\s\S]*result\.push\(screenName\)/,
  "one event targets every unique visible non-fullscreen Island")
assert.match(source, /screenMonitor:[\s\S]*Hyprland\.monitorFor\(screen\)[\s\S]*screenFullscreen:[\s\S]*hasFullscreen/,
  "each surface reacts directly to its monitor fullscreen workspace")
assert.match(source, /visible:\s*!!screen[\s\S]*id:\s*capsule[\s\S]*visible:\s*root\.presenterAvailable/,
  "the transparent layer stays mapped while hidden content disappears with the bar")
assert.match(source, /onPresenterAvailableChanged:[\s\S]*motionCommitTimer\.stop\(\)[\s\S]*motion\.abandon\(\)[\s\S]*service\.collapse\("anchor-lost"\)/,
  "anchor loss clears pixels and releases an expanded owner without an exit animation")
assert.match(serviceSource, /active\.expiresAt <= Date\.now\(\)/,
  "expired peek clicks reconcile instead of navigating stale semantic routes")
assert.match(serviceSource, /alreadyOpen[\s\S]*root\.consumePeek\(candidate\.id\)/,
  "an idempotently open semantic route still consumes its matching peek")
assert.match(serviceSource, /pendingPeekPromotionId[\s\S]*root\.consumePeek\(root\.pendingPeekPromotionId\)/,
  "new routes retain their peek until guarded layout acceptance commits")
let primes = 0
let expansions = 0
let focused = 0
const callbacks = []
const state = {
  service: null,
  opened: false,
  keyboardActive: false,
  grabReady: false,
  focusPrimed: false,
  frame: { primary: { key: "primary" } },
  focusPrimeTimer: { restart() { primes++ }, stop() {} },
  capsule: { forceActiveFocus() { focused++ } },
  Qt: { callLater(callback) { callbacks.push(callback) } }
}
state.root = state
const context = vm.createContext(state)
for (const match of source.matchAll(/^  function (\w+)\(([^\n]*)\) \{\n([\s\S]*?)^  \}/gm)) {
  state[match[1]] = vm.runInContext(`(function(${match[2]}) {\n${match[3]}\n})`, context)
}
state.expandKey = function(key, reason) {
  assert.equal(key, "primary")
  assert.equal(reason, "summon")
  expansions++
  return true
}

state.beginFocusPrime()
assert.equal(primes, 0, "closed card never grabs focus")
state.opened = true
state.beginFocusPrime()
assert.equal(state.grabReady, false, "wait for compositor acknowledgement before grabbing")
assert.equal(primes, 0, "Exclusive remains requested until focus arrives")
state.keyboardActive = true
state.beginFocusPrime()
assert.equal(state.grabReady, true)
assert.equal(primes, 1)
state.focusPrimed = true
state.keyboardActive = false
state.beginFocusPrime()
assert.equal(state.grabReady, true, "grab stays latched until outside-click dismissal")
state.keyboardActive = true
state.beginFocusPrime()
assert.equal(primes, 1, "focus notifications do not restart a primed grab")

state.focusPrimed = true
assert.equal(state.open(), true)
assert.equal(expansions, 0, "repeated summon preserves the selected activity")
assert.equal(state.grabReady, true, "repeated summon cannot tear down its own grab")
assert.equal(state.focusPrimed, true, "re-summon does not disturb the active focus mode")
callbacks.shift()()
assert.equal(focused, 1)
state.opened = false
assert.equal(state.open(), true)
assert.equal(expansions, 1)

const seekMatch = serviceSource.match(/^  function seek\(source, id, trackToken, positionSeconds\) \{\n([\s\S]*?)^  \}/m)
assert.ok(seekMatch, "service exposes a validated owner seek boundary")
const mediaKey = ActivityModel.identityKey("luinbytes.island.media", "now-playing")
const seekCalls = []
const serviceState = {
  activitiesByKey: { [mediaKey]: { media: { trackToken: "mpv:1|1", canSeek: true } } },
  presentation: { selectedKey: mediaKey },
  ownerSeekRequested(key, trackToken, seconds) { seekCalls.push([key, trackToken, seconds]) }
}
serviceState.root = serviceState
const serviceSeek = vm.runInNewContext(`(function(source, id, trackToken, positionSeconds) {\n${seekMatch[1]}\n})`, {
  root: serviceState,
  ActivityModel,
  isFinite
})
assert.equal(serviceSeek("luinbytes.island.media", "now-playing", "mpv:1|1", 42), true)
assert.deepEqual(seekCalls, [[mediaKey, "mpv:1|1", 42]], "only the selected media snapshot reaches its owner")
assert.equal(serviceSeek("luinbytes.island.media", "now-playing", "mpv:1|2", 42), false, "stale tracks cannot route a seek")
serviceState.presentation.selectedKey = "other"
assert.equal(serviceSeek("luinbytes.island.media", "now-playing", "mpv:1|1", 42), false, "background media cannot seek")

const promoteMatch = serviceSource.match(/^  function promotePeek\(screen\) \{\n([\s\S]*?)^  \}/m)
assert.ok(promoteMatch, "Service exposes one guarded semantic peek promotion boundary")
const promoted = []
const future = Date.now() + 5000
const promotedState = {
  peekActive: { targetScreens: ["DP-1", "HDMI-A-1"], expiresAt: future, candidate: {
    id: "peek:already-open", tool: "agents", entityKey: "hub:agents"
  } },
  hubState: { expanded: true, ownerScreen: "DP-1", tool: "agents", entityKey: "hub:agents" },
  eligiblePeekScreen(screen) { return screen === "DP-1" || screen === "HDMI-A-1" },
  consumePeek(id) { promoted.push(id) },
  openHub() { throw new Error("same route must not navigate") },
  reconcilePeek() { throw new Error("future lease must not reconcile") }
}
promotedState.root = promotedState
const promote = vm.runInNewContext(`(function(screen) {\n${promoteMatch[1]}\n})`, { root: promotedState, Date })
assert.equal(promote("DP-1"), true, "an already-open matching route is an explicit successful selection")
assert.deepEqual(promoted, ["peek:already-open"], "same-route selection consumes only its matching active peek")

let expiryReconciles = 0
const expiredState = {
  peekActive: { targetScreens: ["DP-1", "HDMI-A-1"], expiresAt: Date.now() - 1, candidate: {
    id: "peek:expired", tool: "agents", entityKey: "hub:agents"
  } },
  hubState: {},
  eligiblePeekScreen() { return true },
  consumePeek() { throw new Error("expired peek must not consume as a selection") },
  openHub() { throw new Error("expired peek must not navigate") },
  reconcilePeek(reason) { assert.equal(reason, "expired-click"); expiryReconciles++ }
}
expiredState.root = expiredState
const expiredPromote = vm.runInNewContext(`(function(screen) {\n${promoteMatch[1]}\n})`, { root: expiredState, Date })
assert.equal(expiredPromote("DP-1"), false, "expired input cannot promote a stale semantic route")
assert.equal(expiryReconciles, 1, "expired input consumes the lease through the reducer reconciliation path")
console.log("surface focus acknowledgement and repeated-summon contracts passed")
