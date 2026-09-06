const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Motion = require("../../shell/plugins/island/MotionModel.js")
const View = require("../../shell/plugins/island/ViewModel.js")
const Hub = require("../../shell/plugins/island/HubModel.js")

const base = path.resolve(__dirname, "../../shell/plugins/island")
const visual = fs.readFileSync(path.join(base, "ActivityVisual.qml"), "utf8")
const content = fs.readFileSync(path.join(base, "IslandContent.qml"), "utf8")

assert.equal((visual.match(/id:\s*sharedMediaTitle/g) || []).length, 1, "a body has one actual shared media title item")
assert.match(visual, /hubNavigationInteractive:[\s\S]*?hubState\.ownerScreen === root\.screenName[\s\S]*?hubState\.entityKey === root\.visual\.key[\s\S]*?chooserOwnsHeader: root\.hubNavigationInteractive && root\.service\.hubState\.chooserOpen/, "chooser title ownership is scoped to the selected body and screen")
assert.match(visual, /sharedTitleVisible:[\s\S]*?sharedTitle\.present[\s\S]*?sharedTitle\.owned === true/, "content layers own the header during cross-key handoffs")
assert.match(visual, /secondaryUsesCompactText/, "a labelled secondary keeps the normal compact content renderer")
assert.match(visual, /root\.visual\.role === "secondary" && !root\.secondaryUsesCompactText/, "fixture secondary bubbles keep the minimal renderer")
assert.match(content, /property string compactText:[\s\S]*?root\.compact\.compactText/, "compact text stays a projected content field")
assert.match(content, /font\.pixelSize: root\.usesCompactText \? 10 : 11/, "labelled pairs use the measured 10px native font")
assert.match(content, /ActivityIcon\s*\{[\s\S]*?name: root\.compact\.icon/, "notifications use the shared semantic icon renderer")
assert.match(visual, /ViewModel\.titleSample\(root\.visual && root\.visual\.titleSampleRect \? root\.visual\.titleSampleRect : root\.rect, root\.sharedTitle\)/, "title pose derives from the source-anchored sampled projection")
assert.match(visual, /sharedTitleBackingSize[\s\S]*?root\.visual\.geometrySettled[\s\S]*?font\.pixelSize:\s*root\.sharedTitleBackingSize[\s\S]*?renderType:\s*Text\.QtRendering[\s\S]*?scale:\s*root\.sharedTitleScale/, "metadata fades do not change settled compact font size")
assert.match(visual, /sharedTitleTransition[\s\S]*?incomingSharedMediaTitle[\s\S]*?opacity: root\.sharedTitleTransition \? root\.sharedTitleMix : 0/,
  "same-player title replacements use two fixed-position text layers with metadata opacity only")
assert.match(visual, /incomingSharedArtImage[\s\S]*?opacity: root\.sharedTitleTransition \? root\.sharedTitleMix : 0/,
  "same-player artwork replacements use the matching body-clock crossfade")
assert.match(visual, /sharedArtImage\.status !== Image\.Ready[\s\S]*?incomingSharedArtImage\.status !== Image\.Ready/,
  "a slow incoming cover fades into the native music fallback instead of reviving stale artwork")
assert.match(visual, /function sharedSubtitle\(title\)[\s\S]*?root\.mediaSourceLabel\(\)/,
  "a missing artist retains the selected player source label in the body-owned header")
assert.match(visual, /y: sharedMediaTitle\.y \+ sharedMediaTitle\.implicitHeight \* root\.sharedTitleScale \+ 4/,
  "the body-owned artist matches MediaContent's title-bottom plus four-pixel spacing")
assert.match(visual, /compactTitleMetrics[\s\S]*?font\.pixelSize:\s*11/, "compact baseline uses measured native 11 px metrics")
assert.match(visual, /expandedTitleMetrics[\s\S]*?font\.pixelSize:\s*14/, "expanded baseline uses measured native 14 px metrics")
assert.match(visual, /backingSize:\s*sharedMediaTitle\.font\.pixelSize/, "diagnostic reports title backing size")
assert.match(visual, /identity:\s*root\.sharedTitle \? root\.sharedTitle\.identity : null/, "diagnostic reports title identity")
assert.match(content, /property bool mediaTitleOwnedByBody: false[\s\S]*?titleOwnedByBody: root\.mediaTitleOwnedByBody/, "island content forwards body title ownership")
assert.equal((visual.match(/mediaTitleOwnedByBody:/g) || []).length, 2, "both retained content layers receive continuous title suppression")
assert.doesNotMatch(visual, /FrameAnimation|NumberAnimation|Behavior on (?:x|y|width|scale)/, "title introduces no independent animation clock or axis")
const compact = { x: 200, y: 2, width: 250, height: 22, radius: 11 }
const expanded = { x: 172, y: 2, width: 306, height: 262, radius: 36 }
function desired(token) {
  const content = { key: "music", media: { trackToken: token, title: token, artUrl: token + ".png" } }
  return { edge: "top", bounds: { width: 800, height: 600 }, primary: {
    key: "music", content, role: "primary", rect: compact, sharedTitle: View.mediaTitleIntent(content, "primary", compact, expanded, "top")
  } }
}
let state = Motion.reconcile(Motion.initialState(), desired("first"), true)
state = Motion.reconcile(state, desired("second"), false)
const body = Motion.renderFrame(state).bodies.find(item => item.key === "music")
assert.equal(body.geometrySettled, true, "a track replacement leaves compact geometry settled")
assert.equal(body.settled, false, "the separate title fade can still be running")
assert.equal(body.sharedTitle.artUrl, "first.png", "artwork retains the title's outgoing track during handoff")
for (let index = 0; index < 240; index++) state = Motion.advance(state, 1 / 120)
const settledHeader = Motion.renderFrame(state).bodies.find(item => item.key === "music").sharedTitle
assert.equal(settledHeader.identity.trackToken, "second")
assert.equal(settledHeader.artUrl, "second.png", "artwork commits with the new title identity")
const minimalHeaderIntent = desired("second")
minimalHeaderIntent.primary.role = "minimal"
minimalHeaderIntent.primary.rect = { ...compact, width: 22 }
minimalHeaderIntent.primary.sharedTitle = View.mediaTitleIntent(minimalHeaderIntent.primary.content, "minimal", minimalHeaderIntent.primary.rect, expanded, "top")
state = Motion.reconcile(state, minimalHeaderIntent, false)
const retainedHeader = Motion.renderFrame(state).bodies.find(item => item.key === "music").sharedTitle
assert.equal(retainedHeader.present, true, "minimal collapse retains the outgoing header until its clipped exit finishes")
assert.equal(retainedHeader.artUrl, "second.png", "the retiring header retains its own artwork")
for (let index = 0; index < 240; index++) state = Motion.advance(state, 1 / 120)
assert.equal(Motion.renderFrame(state).bodies.find(item => item.key === "music").sharedTitle.present, false,
  "the minimal renderer regains artwork ownership after the retained header exits")
assert.equal((visual.match(/id:\s*sharedArtwork\b/g) || []).length, 1, "one body-owned artwork follows the shared title")
assert.match(visual, /source: root\.sharedTitle \? root\.sharedTitle\.artUrl/, "artwork uses retained header identity instead of incoming content")
assert.match(visual, /id: minimalContent[\s\S]*?!\(root\.sharedArtworkOwned && root\.visual\.incoming && root\.visual\.incoming\.content\.media\)/,
  "minimal media cannot duplicate artwork during the retained header exit")
assert.match(content, /compactCentered[\s\S]*compactLabelMetrics\.advanceWidth[\s\S]*TextMetrics/,
  "single-activity centering measures the icon and text group using the current font")

const metrics = View.screenMetrics({
  screen: { width: 1920, height: 1080 },
  anchor: { x: 835, y: 2, width: 250, height: 22 },
  bar: { position: "top", size: 26 }
})
let hub = Hub.initialState()
hub.schedule.byKey.track = { key: "track", tool: "music", label: "Track", value: "Playing", icon: "♪", actions: [], media: { title: "Track", trackToken: "one" } }
hub = Hub.navigate(hub, "music", "monitor", "track")
const preflight = Hub.frameFor(hub, hub.schedule, "monitor", metrics, View).preflight
hub = Hub.acceptLayout(hub, { screen: "monitor", key: "track", widthToken: 306, expectedWidthToken: 306, preferredHeight: 193, heightBudget: preflight.heightBudget })
const frame = Hub.frameFor(hub, hub.schedule, "monitor", metrics, View)
const intent = View.motionIntentFor(frame, metrics)
assert.equal(intent.primary.sharedTitle.expanded.body.height, 193, "media title morph targets the measured expanded body")
console.log("shared title ownership and projection contracts passed")
