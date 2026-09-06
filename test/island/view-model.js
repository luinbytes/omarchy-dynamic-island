const assert = require("node:assert/strict")
const viewModel = require("../../shell/plugins/island/ViewModel.js")
const activityModel = require("../../shell/plugins/island/ActivityModel.js")

function activity(id, target, compact) {
  return {
    source: "test",
    id,
    target: target || { mode: "all" },
    compact: compact === undefined ? { icon: "*", label: id, value: "value", progress: 0.5 } : compact,
    minimal: { icon: "*" },
    expanded: {
      leading: { icon: "*", label: id },
      center: { label: "Now playing", value: "A useful detail" },
      trailing: { value: "42%" },
      bottom: { label: "Ready" }
    },
    actions: [{ id: "open", label: "Open", role: "primary", enabled: true }]
  }
}

function state(phase, ownerScreen, first, second) {
  const firstKey = JSON.stringify(["test", first.id])
  const secondKey = second ? JSON.stringify(["test", second.id]) : null
  const map = { [firstKey]: first }
  if (second) map[secondKey] = second
  return {
    activitiesByKey: map,
    presentation: {
      phase,
      primaryKey: firstKey,
      secondaryKey: secondKey,
      selectedKey: firstKey,
      ownerScreen: ownerScreen || "",
      underlyingKey: null
    }
  }
}

function metrics(position, width, height) {
  const screenWidth = width || 1920
  const screenHeight = height || 1080
  const anchors = {
    top: { x: 835, y: 0, width: 250, height: 26 },
    bottom: { x: 835, y: screenHeight - 26, width: 250, height: 26 },
    left: { x: 0, y: 415, width: 26, height: 250 },
    right: { x: screenWidth - 26, y: 415, width: 26, height: 250 }
  }
  return {
    screen: { width: screenWidth, height: screenHeight },
    anchor: anchors[position],
    bar: { position, size: 26 },
    focusedScreen: "DP-1",
    nowMs: 1000,
    slotWidth: 250,
    compactHeight: 22,
    margin: 8,
    gap: 6
  }
}

function assertFits(rect, rawMetrics) {
  assert.ok(rect.x >= 0 && rect.y >= 0, "rect starts on screen")
  assert.ok(rect.x + rect.width <= rawMetrics.screen.width, "rect fits screen width")
  assert.ok(rect.y + rect.height <= rawMetrics.screen.height, "rect fits screen height")
}

function withPeekMeasurement(raw, active, width) {
  raw.peekMeasurement = { key: active && active.candidate ? active.candidate.id : "", width: width || 210, height: 68 }
  return raw
}

for (const position of ["top", "bottom", "left", "right"]) {
  const raw = metrics(position)
  const frame = viewModel.frameFor(state("expanded", "DP-1", activity("first")), "DP-1", raw, activityModel.selection)
  assert.equal(frame.phase, "expanded", position + " expands on owner")
  assertFits(frame.geometry.card, raw)
  const compact = viewModel.frameFor(state("compact", "", activity("first"), activity("second")), "DP-1", raw, activityModel.selection)
  assertFits(compact.geometry.card, raw)
  if (position === "top") assert.ok(compact.geometry.card.y + compact.geometry.card.height <= 26, "top compact stays in the bar strip")
  if (position === "bottom") assert.ok(compact.geometry.card.y >= raw.screen.height - 26, "bottom compact stays in the bar strip")
  if (position === "left") assert.ok(compact.geometry.card.x + compact.geometry.card.width <= 26, "left compact stays in the bar strip")
  if (position === "right") assert.ok(compact.geometry.card.x >= raw.screen.width - 26, "right compact stays in the bar strip")
}

const narrow = metrics("top", 320, 180)
narrow.anchor = { x: 35, y: 2, width: 250, height: 22 }
const narrowFrame = viewModel.frameFor(state("expanded", "DP-1", activity("first")), "DP-1", narrow, activityModel.selection)
assertFits(narrowFrame.geometry.card, narrow)
assert.ok(narrowFrame.geometry.card.width <= 304, "expanded width fits a 320px display")

const second = activity("second")
const twoMetrics = metrics("top")
twoMetrics.anchor = { x: 1000, y: 0, width: 250, height: 26 }
const two = viewModel.frameFor(state("compact", "", activity("first"), second), "DP-1", twoMetrics, activityModel.selection)
assert.equal(two.geometry.slot.width, 250, "active slot stays reserved")
assert.ok(two.secondary, "two activities draw a secondary bubble")
assert.notEqual(two.primary.key, two.secondary.key, "primary and secondary never duplicate")
assert.ok(two.geometry.secondary.x >= two.geometry.card.x + two.geometry.card.width, "secondary bubble stays separate")
assert.equal(two.geometry.card.x, 1000, "two-card group starts at the reserved slot")
assert.equal(two.geometry.secondary.x + two.geometry.secondary.width, 1250, "two-card group ends at the reserved slot")
assert.ok(two.geometry.card.y >= 0 && two.geometry.card.y + two.geometry.card.height <= 26, "compact card fits the 26px bar")
const hubPairGeometry = viewModel.geometryFor("compact", true, viewModel.screenMetrics(twoMetrics), false, true)
assert.equal(hubPairGeometry.card.width, 176, "the primary gets most of the reserved slot")
assert.equal(hubPairGeometry.secondary.width, 68, "the concurrent activity retains room for its icon and status")
assert.equal(hubPairGeometry.secondary.x - (hubPairGeometry.card.x + hubPairGeometry.card.width), 6, "a hub pair keeps the native compact gap")
assert.equal(hubPairGeometry.secondary.x + hubPairGeometry.secondary.width, hubPairGeometry.slot.x + hubPairGeometry.slot.width,
  "a hub pair fills the existing reserved slot")
const measuredPairMetrics = metrics("top")
measuredPairMetrics.compactPairWidths = { primary: 82, secondary: 44 }
const measuredPair = viewModel.geometryFor("compact", true, viewModel.screenMetrics(measuredPairMetrics), false, true)
const measuredGroupWidth = measuredPair.card.width + measuredPair.secondary.width + 6
assert.equal(measuredPair.slot.width, 250, "intrinsic pair sizing preserves the full capsule slot")
assert.equal(measuredPair.card.width, 82, "the primary body uses its measured intrinsic width")
assert.equal(measuredPair.secondary.width, 44, "the secondary body uses its measured intrinsic width")
assert.equal(measuredPair.card.x - measuredPair.slot.x, Math.floor((measuredPair.slot.width - measuredGroupWidth) / 2),
  "the measured pair is centered as one visual group")
assert.equal(measuredPair.secondary.x - (measuredPair.card.x + measuredPair.card.width), 6,
  "the measured pair retains the compact gap")
assert.ok(measuredPair.secondary.x + measuredPair.secondary.width <= measuredPair.slot.x + measuredPair.slot.width,
  "the measured pair stays inside the capsule slot")
const oversizedPairMetrics = metrics("top")
oversizedPairMetrics.compactPairWidths = { primary: 300, secondary: 180 }
const oversizedPair = viewModel.geometryFor("compact", true, viewModel.screenMetrics(oversizedPairMetrics), false, true)
assert.ok(oversizedPair.card.x >= oversizedPair.slot.x, "an oversized primary measurement is bounded to the slot")
assert.ok(oversizedPair.secondary.x + oversizedPair.secondary.width <= oversizedPair.slot.x + oversizedPair.slot.width,
  "an oversized secondary measurement is bounded to the slot")
assert.equal(oversizedPair.secondary.x - (oversizedPair.card.x + oversizedPair.card.width), 6,
  "bounded intrinsic widths never overlap")
const longPrimaryPairMetrics = metrics("top")
longPrimaryPairMetrics.compactPairWidths = { primary: 900, secondary: 68 }
const longPrimaryPair = viewModel.geometryFor("compact", true, viewModel.screenMetrics(longPrimaryPairMetrics), false, true)
assert.equal(longPrimaryPair.secondary.width, 68, "a long primary title preserves the measured secondary icon region")
assert.equal(longPrimaryPair.card.width, 176, "a long primary title receives the remaining bounded width")

for (const position of ["top", "bottom", "left", "right"]) {
  const raw = metrics(position)
  const pairState = state("expanded", "DP-1", activity("first"), activity("second"))
  pairState.presentation.selectedKey = JSON.stringify(["test", "second"])
  const selectedSecondary = viewModel.frameFor(pairState, "DP-1", raw, activityModel.selection)
  const sourceGeometry = viewModel.geometryFor("compact", true, viewModel.screenMetrics(raw), false)
  const selectedIntent = viewModel.motionIntentFor(selectedSecondary, raw)
  assert.deepEqual(selectedSecondary.titleCompactRect, sourceGeometry.secondary,
    position + " preserves the clicked secondary's compact source region")
  assert.deepEqual(selectedSecondary.sourceCapsuleRect, sourceGeometry.slot,
    position + " expands from the complete reserved compact capsule")
  assert.deepEqual(selectedIntent.primary.sourceRect, sourceGeometry.secondary,
    position + " motion receives the clicked compact source rectangle")
  assert.deepEqual(selectedIntent.primary.sourceCapsuleRect, sourceGeometry.slot,
    position + " motion receives the whole joined source capsule")
}

const expanded = viewModel.frameFor(state("expanded", "DP-1", activity("first"), second), "DP-1", metrics("top"), activityModel.selection)
assert.equal(expanded.geometry.card.height, 148, "generic expansion keeps its compact initial height")
const passive = viewModel.frameFor(state("expanded", "DP-1", activity("first"), second), "HDMI-A-1", metrics("top"), activityModel.selection)
assert.equal(expanded.phase, "expanded", "owner screen expands")
assert.equal(passive.phase, "compact", "other screens remain passive")
assert.equal(passive.secondary, null, "passive screen does not duplicate the secondary bubble")

const targeted = viewModel.frameFor(state("compact", "", activity("first", { mode: "screen", screen: "DP-1" })), "HDMI-A-1", metrics("top"), activityModel.selection)
assert.equal(targeted.phase, "idle", "screen-targeted activities stay off other displays")

const hdmi = activity("hdmi", { mode: "screen", screen: "HDMI-A-1" })
const projection = viewModel.frameFor(state("compact", "", activity("dp", { mode: "screen", screen: "DP-1" }), hdmi), "HDMI-A-1", metrics("top"), activityModel.selection)
assert.equal(projection.primary.key, JSON.stringify(["test", "hdmi"]), "per-screen selection uses the reducer ranking helper")

function publication(id, revision, target, priority) {
  return {
    source: "reducer",
    id,
    revision,
    createdAt: 1000,
    updatedAt: 1000,
    target,
    priority,
    compact: { icon: "*", label: id }
  }
}

let reduced = activityModel.initialState()
reduced = activityModel.reduce(reduced, { type: "publish", activity: publication("fallback", 1, { mode: "all" }, "normal") }, { nowMs: 1000, focusedScreen: "DP-1" }).state
reduced = activityModel.reduce(reduced, { type: "publish", activity: publication("dp-primary", 1, { mode: "screen", screen: "DP-1" }, "critical") }, { nowMs: 1000, focusedScreen: "DP-1" }).state
const reducerProjection = viewModel.frameFor(reduced, "HDMI-A-1", metrics("top"), activityModel.selection)
assert.equal(reducerProjection.primary.key, activityModel.identityKey("reducer", "fallback"), "real reducer state projects an eligible fallback onto another monitor")

let alertState = activityModel.initialState()
alertState = activityModel.reduce(alertState, { type: "publish", activity: publication("media", 1, { mode: "all" }, "critical") }, { nowMs: 1000, focusedScreen: "DP-1" }).state
const pulse = publication("pulse", 1, { mode: "all" }, "normal")
pulse.transientMs = 500
alertState = activityModel.reduce(alertState, { type: "publish", activity: pulse }, { nowMs: 1000, focusedScreen: "DP-1" }).state
const alertFrame = viewModel.frameFor(alertState, "DP-1", metrics("top"), activityModel.selection)
assert.equal(alertFrame.primary.key, activityModel.identityKey("reducer", "pulse"), "alert projection preserves the reducer-selected pulse over higher ranked media")
assert.equal(alertFrame.secondary.key, activityModel.identityKey("reducer", "media"), "alert projection keeps ranked underlying media as the second bubble")
for (const position of ["top", "bottom", "left", "right"]) {
  for (const size of [8, 80, 200]) {
    const small = metrics(position, size, size)
    small.slotWidth = 80
    for (const phase of ["compact", "minimal", "expanded"]) {
      const frame = viewModel.frameFor(state(phase, "DP-1", activity("first"), second), "DP-1", small, activityModel.selection)
      assertFits(frame.geometry.card, small)
      if (frame.geometry.secondary) assertFits(frame.geometry.secondary, small)
    }
  }
}
const shortSlot = metrics("top")
shortSlot.slotWidth = 80
shortSlot.anchor.width = 80
const shortFrame = viewModel.frameFor(state("compact", "", activity("first"), second), "DP-1", shortSlot, activityModel.selection)
assert.equal(shortFrame.geometry.secondary.x + shortFrame.geometry.secondary.width, shortFrame.geometry.slot.x + 80)

const movedFocus = metrics("top")
movedFocus.focusedScreen = "HDMI-A-1"
const pinned = viewModel.frameFor(state("expanded", "DP-1", activity("first", { mode: "focused" })), "DP-1", movedFocus, activityModel.selection)
assert.equal(pinned.phase, "expanded", "focused expansion remains on its recorded owner")

const afterPulse = metrics("top")
afterPulse.nowMs = 1500
const expiredPulse = viewModel.frameFor(alertState, "DP-1", afterPulse, activityModel.selection)
assert.equal(expiredPulse.phase, "compact", "stale alert presentation cannot resurrect an expired pulse")
assert.equal(expiredPulse.primary.key, activityModel.identityKey("reducer", "media"))
const expiredSelected = activity("first")
expiredSelected.expiresAt = 1000
assert.equal(viewModel.frameFor(state("expanded", "DP-1", expiredSelected), "DP-1", metrics("top"), activityModel.selection).phase, "idle", "projection hides an expired selection before the next tick")

const mediaActivity = activity("media")
mediaActivity.media = {
  trackToken: "mpv:1|track-one",
  title: "Night Drive",
  artist: "Example Artist",
  playing: true,
  positionSeconds: 30,
  durationSeconds: 120,
  canSeek: true
}
const mediaFrame = viewModel.frameFor(state("expanded", "DP-1", mediaActivity), "DP-1", metrics("top"), activityModel.selection)
assert.equal(mediaFrame.geometry.card.width, 306, "media expansion uses the compact detail width")
assert.equal(mediaFrame.geometry.card.height, 168, "media expansion receives its compact dedicated height")
assert.equal(mediaFrame.geometry.card.radius, 28, "every expanded tool uses the same distal corner radius")
assert.equal(mediaFrame.selected.media.trackToken, "mpv:1|track-one", "media payload crosses view projection unchanged")
const mediaIntent = viewModel.motionIntentFor(mediaFrame, metrics("top"))
const titleIntent = mediaIntent.primary.sharedTitle
const compactTitle = viewModel.titleSample(titleIntent.compact.body, titleIntent)
const expandedTitle = viewModel.titleSample(titleIntent.expanded.body, titleIntent)
assert.equal(compactTitle.progress, 0, "compact title endpoint uses its actual body rectangle")
assert.equal(compactTitle.x, titleIntent.compact.left, "compact title has its measured left endpoint")
assert.equal(compactTitle.visualWidth, titleIntent.compact.right - titleIntent.compact.left, "compact title honors the indicator inset")
assert.equal(expandedTitle.progress, 1, "expanded title endpoint uses its actual body rectangle")
assert.equal(expandedTitle.x, titleIntent.expanded.left, "expanded title has its measured left endpoint")
assert.equal(expandedTitle.visualWidth, titleIntent.expanded.right - titleIntent.expanded.left, "expanded title honors the indicator inset")
const constrainedMedia = viewModel.frameFor(state("expanded", "DP-1", mediaActivity), "DP-1", narrow, activityModel.selection)
const constrainedTitle = viewModel.motionIntentFor(constrainedMedia, narrow).primary.sharedTitle
assert.equal(viewModel.titleSample(constrainedTitle.expanded.body, constrainedTitle).visualWidth, Math.max(0, constrainedMedia.geometry.card.width - 154), "constrained title reserves the artwork and right-hand controls")
const pairedMediaIntent = viewModel.motionIntentFor({
  phase: "compact",
  primary: Object.assign({}, mediaFrame.primary, { compactText: "Night Drive" }),
  secondary: Object.assign({}, mediaFrame.primary, { key: "second-media", compactText: "Night Drive" }),
  geometry: hubPairGeometry
}, twoMetrics)
assert.equal(pairedMediaIntent.primary.sharedTitle.compact.body.width, 176, "primary media title uses its dominant compact body")
assert.equal(pairedMediaIntent.secondary.sharedTitle.compact.body.width, 68, "secondary media title uses its smaller compact body")
assert.equal(pairedMediaIntent.secondary.sharedTitle.identity.key, "second-media", "secondary media keeps a meaningful compact title identity")
const expandedSecondaryIntent = viewModel.motionIntentFor({
  phase: "expanded",
  selected: Object.assign({}, mediaFrame.primary, { key: "second-media", compactText: "Night Drive" }),
  titleCompactRect: hubPairGeometry.secondary,
  titleExpandedRect: mediaFrame.geometry.card,
  geometry: { card: mediaFrame.geometry.card }
}, twoMetrics)
assert.equal(expandedSecondaryIntent.primary.sharedTitle.compact.body.width, 68,
  "an expanded secondary media card retains its actual compact title endpoint")
const minimalActivity = { ...mediaActivity, compact: null }
const minimalMedia = viewModel.frameFor(state("minimal", "", minimalActivity), "DP-1", metrics("top"), activityModel.selection)
assert.equal(viewModel.motionIntentFor(minimalMedia, metrics("top")).primary.sharedTitle.identity, null, "minimal media explicitly has no shared title")
assert.equal(viewModel.motionIntentFor(mediaFrame, metrics("left")).primary.sharedTitle.identity, null, "side-bar media does not infer a horizontal title endpoint")
const degenerateTitle = {
  target: "expanded",
  compact: { body: { x: 5, y: 6, width: 7, height: 8 }, left: 9, right: 10 },
  expanded: { body: { x: 5, y: 6, width: 7, height: 8 }, left: 9, right: 10 }
}
assert.deepEqual(viewModel.titleSample(degenerateTitle.compact.body, degenerateTitle), { progress: 1, x: 9, visualWidth: 1 }, "zero-length title projections take the requested endpoint without NaN")
assert.equal(viewModel.titleVelocity({ x: 1, y: 1, width: 1, height: 1 }, degenerateTitle), 0, "zero-length title projections have no synthetic velocity")

const topOutline = viewModel.activityOutline(mediaFrame.geometry.card, metrics("top"))
assert.equal(topOutline.shoulderRadius, 18, "the settled 306px body receives an 18px shoulder")
assert.equal(topOutline.bounds.x, mediaFrame.geometry.card.x - 18)
assert.equal(topOutline.bounds.width, mediaFrame.geometry.card.width + 36)
assert.equal(topOutline.body.topLeftRadius, 0, "the bar-side body corner is square under the connected shoulder")
assert.equal(topOutline.body.topRightRadius, 0)
assert.equal(topOutline.body.bottomLeftRadius, 28, "distal body corners retain the common activity radius")
assert.equal(topOutline.shoulders[0].start.x, mediaFrame.geometry.card.x - 18)
assert.equal(topOutline.shoulders[0].start.y, 26)
assert.equal(topOutline.shoulders[0].second.x, mediaFrame.geometry.card.x)
assert.equal(topOutline.shoulders[0].second.y, 44)
assert.equal(topOutline.shoulders[0].clockwise, false, "the left top PathArc cuts the reverse corner outward")
assert.match(topOutline.perimeter, /^M [^\n]+ Z$/, "the outline supplies one closed local SVG perimeter")
assert.ok((topOutline.perimeter.match(/\b[AC]\b/g) || []).length >= 4,
  "the top outline retains a finite connected perimeter through its shoulders and distal profile")
assert.doesNotMatch(topOutline.perimeter, /NaN|undefined/, "the outline perimeter remains finite")
const compactOutline = viewModel.activityOutline(viewModel.geometryFor("compact", false, viewModel.screenMetrics(metrics("top")), false).card, metrics("top"))
assert.equal(compactOutline.shoulderRadius, 0, "compact pills do not grow bar shoulders")
assert.equal(compactOutline.bounds.width, compactOutline.body.width)
for (const position of ["top", "bottom", "left", "right"]) {
  const raw = metrics(position)
  const toolFrame = viewModel.frameFor(state("expanded", "DP-1", activity("shape")), "DP-1", raw, activityModel.selection)
  const outline = viewModel.activityOutline(toolFrame.geometry.card, raw)
  assertFits(outline.bounds, raw)
  assert.equal(outline.shoulders.filter(item => item.radius > 0).length, 2, position + " outline has two reverse-corner shoulders")
  assert.match(outline.perimeter, /^M [^\n]+ Z$/, position + " outline is one closed perimeter")
  assert.ok((outline.perimeter.match(/\b[AC]\b/g) || []).length >= 4,
    position + " outline retains a finite connected shoulder and distal profile")
}

const peekActive = {
  targetScreens: ["DP-1", "HDMI-A-1"],
  candidate: {
    id: "peek:notification-1",
    sequence: 1,
    tool: "notifications",
    entityKey: "notification:[1,42]",
    summary: { icon: "bell", label: "Mail", value: "Build complete" }
  }
}
for (const position of ["top", "bottom", "left", "right"]) {
  const raw = withPeekMeasurement(metrics(position), peekActive)
  const closedBase = viewModel.frameFor(state("compact", "", activity("first")), "DP-1", raw, activityModel.selection)
  closedBase.preflight = { key: "notification:[100,42]", widthToken: 306, heightBudget: 500 }
  closedBase.detailHeightBudget = 500
  const closedPeek = viewModel.projectPeekFrame(closedBase, peekActive, "DP-1", raw)
  const closedIntent = viewModel.motionIntentFor(closedPeek, raw)
  assert.equal(closedPeek.phase, "peek", position + " closed event replaces only the presentation frame")
  assert.equal(closedPeek.peek.placement, "closed")
  assert.equal(closedIntent.primary, null, position + " closed peek does not create a hub body")
  assert.equal(closedIntent.secondary, null, position + " closed peek does not occupy a second compact body")
  assert.ok(closedIntent.peek && closedIntent.peek.content.peek, position + " preserves semantic peek content")
  assert.equal(closedPeek.preflight, closedBase.preflight, position + " retains hidden promotion layout preflight")
  assert.equal(closedPeek.detailHeightBudget, 500, position + " preserves the pending route height contract")
  assertFits(closedPeek.geometry.card, raw)

  const openBase = viewModel.frameFor(state("expanded", "DP-1", activity("first")), "DP-1", raw, activityModel.selection)
  const openPeek = viewModel.projectPeekFrame(openBase, peekActive, "DP-1", raw)
  const openIntent = viewModel.motionIntentFor(openPeek, raw)
  assert.equal(openPeek.phase, "expanded", position + " keeps an already-open hub unchanged")
  assert.deepEqual(openPeek.geometry, openBase.geometry, position + " attached peek never moves the main geometry")
  assert.equal(openPeek.peek.placement, "below")
  assert.equal(openIntent.secondary, null, position + " attached peek is not a generic secondary region")
  assert.ok(openIntent.peek && openIntent.peek.size.width > 0 && openIntent.peek.size.height === 68,
    position + " carries independent measured peek dimensions")
}

const broadcastRaw = withPeekMeasurement(metrics("top"), peekActive)
const broadcastOwner = viewModel.frameFor(state("expanded", "DP-1", activity("first")), "DP-1", broadcastRaw, activityModel.selection)
const musicOwner = Object.assign({}, broadcastOwner, {
  selected: Object.assign({}, broadcastOwner.selected, { tool: "music" })
})
const broadcastOther = viewModel.frameFor(state("compact", "", activity("first")), "HDMI-A-1", broadcastRaw, activityModel.selection)
assert.equal(viewModel.projectPeekFrame(broadcastOwner, peekActive, "DP-1", broadcastRaw).peek.placement, "below",
  "the expanded recipient gets the attached projection")
assert.equal(viewModel.projectPeekFrame(broadcastOther, peekActive, "HDMI-A-1", broadcastRaw).peek.placement, "closed",
  "another recipient gets the shallow closed projection from the same lease")
const matchingMediaPeek = {
  targetScreens: ["DP-1", "HDMI-A-1"],
  candidate: {
    id: "peek:media-1",
    sequence: 2,
    source: "media",
    tool: "music",
    entityKey: musicOwner.selected.key,
    summary: { icon: "▶", label: "Track", value: "Artist" }
  }
}
assert.equal(viewModel.projectPeekFrame(musicOwner, matchingMediaPeek, "DP-1", broadcastRaw), musicOwner,
  "the expanded matching music owner suppresses its redundant media peek")
assert.equal(viewModel.projectPeekFrame(broadcastOther, matchingMediaPeek, "HDMI-A-1",
  withPeekMeasurement(metrics("top"), matchingMediaPeek)).peek.placement, "closed",
  "matching media changes still reach every other eligible quickbar")
console.log("view model geometry and per-screen projection passed")
