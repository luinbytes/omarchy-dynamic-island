const assert = require("node:assert/strict")
const fs = require("node:fs")
const Gate = require("../../shell/plugins/island/PresentationGateModel.js")

function schedule(title, icon, artUrl) {
  const media = { title, artist: "Artist", artUrl, trackToken: title + "|1" }
  const primary = { key: "hub:music", label: title, icon, media, compactText: title }
  const secondary = { key: "hub:agents", label: "Agents", icon: "robot", value: "Working" }
  return {
    primary,
    secondary,
    byKey: { "hub:music": primary, "hub:agents": secondary },
    byTool: { music: primary, agents: secondary },
    reason: "active+busy",
    revision: 1
  }
}

function pending(screens, until, sequence) {
  return { pending: { coalesceUntil: until, targetScreens: screens, candidate: { id: "peek:" + sequence, sequence } }, active: null }
}

function activeNotification(screens, previewKey, sequence) {
  return {
    pending: null,
    active: {
      targetScreens: screens,
      candidate: { id: "peek:" + sequence, sequence, source: "notifications", subjectKey: previewKey }
    }
  }
}

const oldSchedule = schedule("Old track", "media", "old.png")
const newSchedule = schedule("New track", "media-new", "new.png")
let state = Gate.initialState()
state = Gate.reconcile(state, oldSchedule, pending(["DP-1"], 1250, 1))
const held = Gate.scheduleFor(state, newSchedule, "DP-1")
assert.equal(held.primary.label, "Old track", "the pending target holds the prior compact title")
assert.equal(held.primary.icon, "media", "the hold retains the prior compact icon")
assert.equal(held.primary.media.artUrl, "old.png", "the hold retains media artwork metadata")
assert.equal(Gate.scheduleFor(state, newSchedule, "HDMI-A-1"), newSchedule, "nonrecipients keep the latest compact schedule")

const burstSchedule = schedule("Burst track", "media-burst", "burst.png")
state = Gate.reconcile(state, newSchedule, pending(["DP-1"], 1250, 2))
assert.equal(Gate.scheduleFor(state, burstSchedule, "DP-1").primary.label, "Old track",
  "a retargeted burst keeps the first compact snapshot")

state = Gate.reconcile(state, burstSchedule, { pending: null, active: { candidate: { id: "peek:2" } } })
assert.equal(Gate.scheduleFor(state, burstSchedule, "DP-1"), burstSchedule,
  "activation releases the hold behind the opaque peek")
assert.deepEqual(Gate.diagnostic(state, { pending: null }).heldScreens, [], "an active lease leaves no compact hold")

state = Gate.reconcile(state, burstSchedule, pending(["DP-1"], 2500, 3))
assert.equal(Gate.scheduleFor(state, schedule("Later", "media-later", "later.png"), "DP-1").primary.label, "Burst track",
  "a later pending epoch captures the current compact state instead of reviving an old one")
state = Gate.bypass(state, "DP-1", pending(["DP-1"], 2500, 3))
assert.equal(Gate.scheduleFor(state, newSchedule, "DP-1").primary.label, "Burst track",
  "manual preflight keeps the held compact snapshot until expanded geometry commits")
assert.equal(Gate.isBypassed(state, "DP-1"), true, "manual intent marks its pending epoch without releasing its visible hold")
state = Gate.reconcile(state, newSchedule, pending(["DP-1"], 2500, 4))
assert.equal(Gate.scheduleFor(state, burstSchedule, "DP-1").primary.label, "Burst track",
  "a retarget in the bypassed epoch cannot replace the compact hold")

state = Gate.reconcile(state, burstSchedule, { pending: null, active: null })
assert.equal(Gate.scheduleFor(state, newSchedule, "DP-1"), newSchedule,
  "suppression or expiry clears held and bypassed state")
assert.deepEqual(Gate.diagnostic(state, { pending: null }), {
  pendingEpoch: "", heldScreens: [], bypassedScreens: [], shownNotificationScreens: []
}, "diagnostics expose only timing state")

const unavailable = Gate.reconcile(Gate.initialState(), oldSchedule, pending([], 3000, 5))
assert.equal(Gate.scheduleFor(unavailable, newSchedule, "DP-1"), newSchedule,
  "an absent recipient cannot hold a compact schedule")

const shownCompact = schedule("Shown media", "media-shown", "shown.png")
let receipt = Gate.reconcile(Gate.initialState(), oldSchedule, activeNotification(["DP-1"], "notification:n1", 6), {
  notificationPreviewKey: "notification:n1"
})
assert.equal(Gate.hasShownNotification(receipt, "DP-1", "notification:n1"), true,
  "an active notification receipt belongs only to its recipient")
assert.equal(Gate.hasShownNotification(receipt, "HDMI-A-1", "notification:n1"), false,
  "unreceipted screens retain their own preview projection")
receipt = Gate.reconcile(receipt, oldSchedule, pending(["DP-1"], 3500, 7), {
  priorPresentedByScreen: { "DP-1": shownCompact },
  notificationPreviewKey: "notification:n1"
})
assert.equal(Gate.scheduleFor(receipt, newSchedule, "DP-1").primary.label, "Shown media",
  "a later pending event snapshots the recipient's presented compact schedule")
receipt = Gate.bypass(receipt, "DP-1", pending(["DP-1"], 3500, 7))
assert.equal(Gate.hasShownNotification(receipt, "DP-1", "notification:n1"), true,
  "manual pending bypass preserves an earlier notification receipt")
receipt = Gate.reconcile(receipt, newSchedule, { pending: null, active: null }, { notificationPreviewKey: "notification:n2" })
assert.equal(Gate.hasShownNotification(receipt, "DP-1", "notification:n1"), false,
  "a changed or expired preview clears its receipt")
const absentPreview = Gate.reconcile(Gate.initialState(), oldSchedule, activeNotification(["DP-1"], "notification:n3", 8), {
  notificationPreviewKey: ""
})
assert.equal(Gate.hasShownNotification(absentPreview, "DP-1", "notification:n3"), false,
  "an already-absent preview cannot create a stale compact receipt")

const surface = fs.readFileSync(require.resolve("../../shell/plugins/island/IslandSurface.qml"), "utf8")
const service = fs.readFileSync(require.resolve("../../shell/plugins/island/Service.qml"), "utf8")
assert.match(surface, /compactScheduleFor\(root\.screenName\)/,
  "the surface asks Service for one per-screen compact presentation schedule")
assert.match(surface, /compactPairSource:[\s\S]*compactSchedule/,
  "compact text measurement uses the gated schedule")
assert.match(surface, /HubModel\.frameFor\(service\.hubState, root\.compactSchedule,/,
  "the compact frame uses the same gated schedule")
assert.match(service, /PeekModel\.reconcile[\s\S]*HubModel\.reconcile/,
  "one reconciliation derives the peek lease before the latest Hub schedule")
assert.match(service, /if \(holdsCompact\) \{[\s\S]*presentationGate = nextGate[\s\S]*hubState = nextHubState/,
  "a pending hold publishes before the raw Hub schedule")
assert.match(service, /if \(activatesPeek\) \{[\s\S]*peekState = nextPeekState[\s\S]*presentationGate = nextGate/,
  "an active peek masks its released compact schedule")
assert.match(service, /ownsPreflight[\s\S]*PresentationGateModel\.scheduleFor/,
  "manual preflight retains the compact hold until expanded geometry owns the screen")
assert.match(service, /compactGate:[\s\S]*pendingSequence[\s\S]*heldScreens/,
  "status exposes only the compact gate sequence and recipient state")
assert.match(service, /hasShownNotification[\s\S]*scheduleWithoutShownPreview/,
  "only a recipient with a matching shown notification receives the preview-free compact projection")
assert.match(service, /priorPresentedByScreen: root\.presentedSchedulesFor\(peekResult\.state\)/,
  "a pending hold snapshots each screen's current compact projection")
assert.match(service, /property var hubSources: \(\{\}\)[\s\S]*function notificationPreviewKey\(\) \{[\s\S]*notificationPreviewKeyFor\(root\.hubSources\)/,
  "receipt filtering reads committed Hub sources instead of live domain snapshots")
assert.match(service, /var sources = root\.domainSnapshots[\s\S]*notificationPreviewKey: root\.notificationPreviewKeyFor\(sources\)[\s\S]*publishPresentation\(hubResult\.state, peekResult\.state, nextGate, sources\)/,
  "the gate captures current presentation before the matching source snapshot publishes")

console.log("presentation gate model passed")
