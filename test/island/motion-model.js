const assert = require("node:assert/strict")
const motion = require("../../shell/plugins/island/MotionModel.js")
const viewModel = require("../../shell/plugins/island/ViewModel.js")

function intent(primary, secondary, options) {
  const settings = options || {}
  return {
    edge: settings.edge || "top",
    bounds: settings.bounds || { width: 800, height: 500 },
    alerting: settings.alerting === true,
    primary,
    secondary: secondary || null
  }
}

function body(key, rect, role, profile, revision) {
  return {
    key,
    revision: revision || 1,
    content: { key, label: key },
    expanded: role === "expanded",
    role,
    profile: profile || "compact",
    rect
  }
}

function mediaBody(key, rect, role, trackToken, title) {
  const compact = { x: 250, y: 0, width: 200, height: 22, radius: 11 }
  const expanded = { x: 146, y: 0, width: 408, height: 184, radius: 36 }
  const content = { key, media: { trackToken, title } }
  return {
    key,
    revision: 1,
    content,
    expanded: role === "expanded",
    role,
    profile: role === "expanded" ? "expansion" : "compact",
    rect,
    sharedTitle: viewModel.mediaTitleIntent(content, role, compact, expanded, "top")
  }
}

function tick(state, seconds, steps) {
  let next = state
  for (let index = 0; index < steps; index++) next = motion.advance(next, seconds / steps)
  return next
}

assert.equal(motion.PROFILES.expansion.omega, Math.PI * 2 / 0.32, "the perimeter uses the Nootch 0.32 second response translation")
assert.equal(motion.PROFILES.expansion.zeta, 0.88, "the perimeter uses the Nootch damping fraction")
assert.equal(motion.PROFILES.collapse.omega, motion.PROFILES.expansion.omega, "closing keeps the same outer response")
assert.equal(motion.PROFILES.collapse.zeta, motion.PROFILES.expansion.zeta, "closing keeps the same outer damping")
const outerSamples = [100, 200].map(ms => motion.sampleSpring(0, 0, 1,
  motion.PROFILES.expansion.omega, motion.PROFILES.expansion.zeta, ms / 1000).value)
assert.ok(outerSamples[0] > 0.60 && outerSamples[0] < 0.67, "the Nootch-derived perimeter reaches its early expansion sample")
assert.ok(outerSamples[1] > 0.93 && outerSamples[1] < 0.98, "the Nootch-derived perimeter reaches its 200 ms sample")

let state = motion.initialState()
state = motion.reconcile(state, intent(body("a", { x: 250, y: 0, width: 200, height: 22, radius: 11 }, "primary")), false)
state = motion.reconcile(state, intent(body("a", { x: 160, y: 0, width: 408, height: 160, radius: 28 }, "expanded", "expansion")), false)
state = tick(state, 0.12, 8)
const before = motion.renderFrame(state).bodies.find(candidate => candidate.key === "a")
assert.notEqual(before.velocity.span, 0, "midflight expansion has sampled velocity")
state = motion.reconcile(state, intent(body("a", { x: 250, y: 0, width: 200, height: 22, radius: 11 }, "primary")), false)
const after = motion.renderFrame(state).bodies.find(candidate => candidate.key === "a")
assert.equal(after.rect.width, before.rect.width, "retarget keeps the sampled position")
assert.equal(after.velocity.span, before.velocity.span, "retarget keeps the sampled velocity")

state = motion.initialState()
state = motion.reconcile(state, intent(
  body("first", { x: 250, y: 0, width: 170, height: 22, radius: 11 }, "primary"),
  body("second", { x: 426, y: 0, width: 22, height: 22, radius: 11 }, "secondary")
), false)
state = tick(state, 0.15, 9)
const secondaryBefore = motion.renderFrame(state).bodies.find(candidate => candidate.key === "second")
const pairedCapsuleBefore = motion.renderFrame(state).capsule
state = motion.reconcile(state, intent(body("second", { x: 196, y: 0, width: 408, height: 160, radius: 28 }, "expanded", "expansion")), false)
const secondaryAfter = motion.renderFrame(state).bodies.find(candidate => candidate.key === "second")
assert.equal(secondaryAfter.slot, secondaryBefore.slot, "selected secondary keeps its visual body")
assert.equal(secondaryAfter.role, "expanded", "selected secondary mutates role in place")
assert.deepEqual(secondaryAfter.rect, pairedCapsuleBefore.rect, "selected secondary starts from the whole joined capsule")
assert.deepEqual(secondaryAfter.regionRect, secondaryBefore.rect, "selected secondary retains its keyed compact region inside the capsule")
assert.equal(secondaryAfter.outgoing.expanded, false, "selected secondary retains its compact semantic renderer on frame one")
assert.equal(secondaryAfter.contentProjection, 0, "source content begins at the same sampled capsule progress")

state = motion.reconcile(state, intent(body("third", { x: 250, y: 0, width: 200, height: 22, radius: 11 }, "primary", "compact", 2)), false)
let visual = motion.renderFrame(state).bodies.find(candidate => candidate.key === "third")
assert.ok(visual.outgoing, "keyed replacement retains one outgoing content layer")
assert.ok(visual.incoming, "keyed replacement creates one incoming content layer")
state = tick(state, 1, 60)
visual = motion.renderFrame(state).bodies.find(candidate => candidate.key === "third")
assert.equal(visual.outgoing, null, "outgoing layer retires after its geometric handoff")

state = motion.reconcile(state, intent(body("third", { x: 196, y: 0, width: 408, height: 160, radius: 28 }, "expanded", "expansion", 3)), false)
state = tick(state, 0.04, 4)
visual = motion.renderFrame(state).bodies.find(candidate => candidate.key === "third")
const closingCapsule = visual.rect
state = motion.reconcile(state, intent(body("third", { x: 250, y: 0, width: 200, height: 22, radius: 11 }, "primary", "compact", 3)), false)
visual = motion.renderFrame(state).bodies.find(candidate => candidate.key === "third")
assert.deepEqual(visual.rect, closingCapsule, "closing retains the sampled whole capsule")
assert.equal(visual.outgoing, null, "closing replaces detail content without another full-height roll")
assert.equal(visual.incoming.expanded, false, "closing restores the compact semantic renderer inside the sampled capsule")

const agentsCompact = { x: 835, y: 2, width: 250, height: 22, radius: 11 }
const agentsExpanded = { x: 807, y: 2, width: 306, height: 228, radius: 28 }
const agentsExpandedBody = Object.assign(body("agents", agentsExpanded, "expanded", "expansion"), {
  sourceRect: agentsCompact,
  sourceCapsuleRect: agentsCompact
})
state = motion.reconcile(motion.initialState(), intent(body("agents", agentsCompact, "primary"), null, { bounds: { width: 1920, height: 1080 } }), true)
state = motion.reconcile(state, intent(agentsExpandedBody, null, { bounds: { width: 1920, height: 1080 } }), false)
state = tick(state, 2, 240)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.geometrySettled, true, "the captured Agents expansion reaches its settled capsule pose")
assert.deepEqual({
  x: Math.round(visual.rect.x), y: Math.round(visual.rect.y), width: Math.round(visual.rect.width),
  height: Math.round(visual.rect.height), radius: Math.round(visual.rect.radius)
}, agentsExpanded, "the captured Agents capsule settles at its expanded geometry")
assert.deepEqual(visual.regionRect, agentsCompact, "the retained compact region remains available as projection history")
assert.equal(visual.incoming.offsetX, 0, "a settled expanded layer starts at the capsule-local x origin")
assert.ok(Math.abs(visual.incoming.offsetY) < 0.001, "a settled expanded layer starts at the capsule-local y origin")

function edgeMetrics(edge) {
  const width = 1920
  const height = 1080
  return {
    screen: { width, height },
    anchor: edge === "top" ? { x: 835, y: 0, width: 250, height: 26 }
      : edge === "bottom" ? { x: 835, y: 1054, width: 250, height: 26 }
        : edge === "left" ? { x: 0, y: 415, width: 26, height: 250 }
          : { x: 1894, y: 415, width: 26, height: 250 },
    bar: { position: edge, size: 26 }, slotWidth: 250, compactHeight: 22, margin: 8, gap: 6
  }
}

for (const edge of ["top", "bottom", "left", "right"]) {
  const raw = edgeMetrics(edge)
  const metrics = viewModel.screenMetrics(raw)
  const compact = viewModel.geometryFor("compact", false, metrics, false).card
  const expandedRect = viewModel.geometryFor("expanded", false, metrics, false).card
  const expandedBody = Object.assign(body("settled-" + edge, expandedRect, "expanded", "expansion"), {
    sourceRect: compact,
    sourceCapsuleRect: compact
  })
  state = motion.reconcile(motion.initialState(), intent(body("settled-" + edge, compact, "primary"), null,
    { edge, bounds: raw.screen }), true)
  state = motion.reconcile(state, intent(expandedBody, null, { edge, bounds: raw.screen }), false)
  state = tick(state, 2, 240)
  visual = motion.renderFrame(state).bodies[0]
  assert.equal(visual.geometrySettled, true, edge + " expanded capsule settles")
  assert.ok(Math.abs(visual.incoming.offsetX) < 0.001 && Math.abs(visual.incoming.offsetY) < 0.001,
    edge + " settled expanded content uses its capsule-local origin")
}

const pairLeft = { x: 250, y: 0, width: 176, height: 22, radius: 11 }
const pairRight = { x: 432, y: 0, width: 68, height: 22, radius: 11 }
function pairIntent(primaryKey, secondaryKey) {
  return intent(body(primaryKey, pairLeft, "primary"), body(secondaryKey, pairRight, "secondary"))
}
function pairOverlap(first, second) {
  return Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x))
    * Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y))
}
function samplePairTrajectory(pairState, steps, label) {
  for (let index = 0; index < steps; index++) {
    const pairFrame = motion.renderFrame(pairState).bodies
    assert.equal(pairOverlap(pairFrame[0].rect, pairFrame[1].rect), 0,
      label + " keeps opaque regions separate at 120 Hz frame " + index)
    pairState = motion.advance(pairState, 1 / 120)
  }
  return pairState
}
let pairState = motion.reconcile(motion.initialState(), pairIntent("pair-a", "pair-b"), true)
pairState = motion.reconcile(pairState, pairIntent("pair-b", "pair-a"), false)
state = pairState
const reversedPair = motion.renderFrame(pairState).bodies
assert.equal(reversedPair[0].role, "primary", "compact pair keeps its primary physical region")
assert.equal(reversedPair[1].role, "secondary", "compact pair keeps its secondary physical region")
assert.equal(reversedPair[0].key, "pair-b", "reversed primary content enters the existing primary region")
assert.equal(reversedPair[1].key, "pair-a", "reversed secondary content enters the existing secondary region")
assert.equal(reversedPair[0].rect.x, pairLeft.x, "reversed primary geometry does not cross the pair")
assert.equal(reversedPair[1].rect.x, pairRight.x, "reversed secondary geometry does not cross the pair")
assert.equal(reversedPair[0].outgoing.content.key, "pair-a", "primary content hands off in place")
assert.equal(reversedPair[1].outgoing.content.key, "pair-b", "secondary content hands off in place")
pairState = samplePairTrajectory(pairState, 12, "rapid primary-secondary reversal")
pairState = motion.reconcile(pairState, pairIntent("pair-a", "pair-b"), false)
const rapidReturn = motion.renderFrame(pairState).bodies
assert.equal(rapidReturn[0].role, "primary", "rapid reversal keeps the primary physical region")
assert.equal(rapidReturn[1].role, "secondary", "rapid reversal keeps the secondary physical region")
assert.equal(rapidReturn[0].key, "pair-a", "rapid reversal restores primary content in place")
assert.equal(rapidReturn[1].key, "pair-b", "rapid reversal restores secondary content in place")
pairState = samplePairTrajectory(pairState, 12, "rapid secondary-primary reversal")
pairState = motion.reconcile(pairState, pairIntent("pair-b", "pair-a"), false)
pairState = samplePairTrajectory(pairState, 120, "full compact pair reversal")

const handoffExpanded = { x: 196, y: 0, width: 408, height: 160, radius: 28 }
state = motion.reconcile(motion.initialState(), intent(
  body("old-tool", handoffExpanded, "expanded", "expansion")
), true)
state = motion.reconcile(state, intent(
  mediaBody("new-tool", handoffExpanded, "expanded", "new-track", "New Track")
), false)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.present, true, "cross-key media keeps its retained header identity")
assert.equal(visual.sharedTitle.owned, false, "cross-key content layers own the header while they roll")
assert.equal(visual.outgoing.content.key, "old-tool", "cross-key handoff retains the old content layer")
assert.equal(visual.incoming.content.key, "new-tool", "cross-key handoff exposes the new content layer")
assert.notEqual(visual.incoming.offsetY, visual.outgoing.offsetY,
  "cross-key replacement keeps incoming and outgoing content in separately clipped roll regions")
state = tick(state, 1, 60)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.owned, true, "shared header resumes after the content handoff")

state = motion.reconcile(motion.initialState(), intent(
  mediaBody("old-media", handoffExpanded, "expanded", "old-track", "Old Track")
), true)
state = motion.reconcile(state, intent(
  body("new-tool", handoffExpanded, "expanded", "expansion")
), false)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.owned, false, "a stale media header cannot own a new non-media body")
state = tick(state, 2, 120)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.present, false, "a stale media header exits before ownership can return")

state = motion.reconcile(motion.initialState(), intent(
  mediaBody("old-media", handoffExpanded, "expanded", "old-track", "Old Track")
), true)
state = motion.reconcile(state, intent(
  body("new-tool", handoffExpanded, "expanded", "expansion")
), false)
state = motion.reconcile(state, intent(
  mediaBody("new-media", handoffExpanded, "expanded", "new-track", "New Track")
), false)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.identity.key, "old-media", "rapid reversal retains the outgoing title identity until its bounded handoff")
assert.equal(visual.sharedTitle.owned, false, "rapid reversal does not attach the outgoing title to the new body")
state = tick(state, 2, 120)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.identity.key, "new-media", "rapid reversal commits the matching incoming title")
assert.equal(visual.sharedTitle.owned, true, "matching incoming media regains shared header ownership")

state = motion.reconcile(state, intent(null), false)
assert.equal(motion.renderFrame(state).mapped, true, "last activity keeps a visual exit mapped")
state = tick(state, 1, 60)
assert.equal(motion.renderFrame(state).mapped, false, "retained exit eventually unmaps")

state = motion.initialState()
state = motion.reconcile(state, intent(body("bounded", { x: 60, y: 0, width: 200, height: 22, radius: 11 }, "primary"), null, { bounds: { width: 320, height: 180 } }), false)
state = motion.reconcile(state, intent(body("bounded", { x: 8, y: 0, width: 304, height: 160, radius: 28 }, "expanded", "expansion"), null, { bounds: { width: 320, height: 180 } }), false)
for (let index = 0; index < 180; index++) {
  state = motion.advance(state, 1 / 120)
  const rect = motion.renderFrame(state).bodies[0].rect
  assert.ok(rect.x >= -0.01 && rect.y >= -0.01 && rect.x + rect.width <= 320.01 && rect.y + rect.height <= 180.01, "preflight fitted path stays in bounds")
}

state = motion.initialState()
state = motion.reconcile(state, intent(body("resize", { x: 300, y: 0, width: 200, height: 22, radius: 11 }, "primary")), false)
state = motion.reconcile(state, intent(body("resize", { x: 196, y: 0, width: 408, height: 160, radius: 28 }, "expanded", "expansion")), false)
state = tick(state, 0.1, 6)
state = motion.reconcile(state, intent(body("resize", { x: 8, y: 0, width: 304, height: 160, radius: 28 }, "expanded", "expansion"), null, { bounds: { width: 320, height: 180 } }), false)
for (let index = 0; index < 180; index++) {
  state = motion.advance(state, 1 / 120)
  const rect = motion.renderFrame(state).bodies[0].rect
  assert.ok(rect.x >= -0.01 && rect.y >= -0.01 && rect.x + rect.width <= 320.01 && rect.y + rect.height <= 180.01, "midflight bounds rebase stays in bounds")
}

state = motion.initialState()
state = motion.reconcile(state, intent(body("edge", { x: 196, y: 0, width: 408, height: 160, radius: 28 }, "expanded", "expansion")), false)
state = tick(state, 0.08, 5)
const edgeBefore = motion.renderFrame(state).bodies[0].rect
state = motion.reconcile(state, intent(body("edge", { x: 196, y: 340, width: 408, height: 160, radius: 28 }, "expanded", "expansion"), null, { edge: "bottom" }), false)
const edgeAfter = motion.renderFrame(state).bodies[0].rect
assert.ok(Math.abs(edgeAfter.x - edgeBefore.x) < 0.000001 && Math.abs(edgeAfter.y - edgeBefore.y) < 0.000001, "edge rebase keeps the sampled rectangle")

const initial = motion.reconcile(motion.initialState(), intent(body("step", { x: 250, y: 0, width: 200, height: 22, radius: 11 }, "primary")), false)
const expanding = motion.reconcile(initial, intent(body("step", { x: 196, y: 0, width: 408, height: 160, radius: 28 }, "expanded", "expansion")), false)
const oneStep = motion.renderFrame(motion.advance(expanding, 0.3)).bodies[0].rect
const manySteps = motion.renderFrame(tick(expanding, 0.3, 30)).bodies[0].rect
assert.ok(Math.abs(oneStep.width - manySteps.width) < 0.000001 && Math.abs(oneStep.height - manySteps.height) < 0.000001, "analytical stepping is timestep independent")

state = motion.initialState()
state = motion.reconcile(state, intent(body("reduced", { x: 100, y: 0, width: 200, height: 22, radius: 11 }, "primary")), true)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.opacity, 1, "reduced motion snaps opacity")
assert.equal(motion.renderFrame(state).unsettled, false, "reduced motion leaves no clock work")

state = motion.initialState()
state = motion.reconcile(state, intent(body("snap", { x: 60, y: 0, width: 200, height: 22, radius: 11 }, "primary"), null, { bounds: { width: 320, height: 180 } }), false)
state = motion.reconcile(state, intent(body("snap", { x: 8, y: 0, width: 304, height: 160, radius: 28 }, "expanded", "expansion"), null, { bounds: { width: 320, height: 180 } }), false)
state = tick(state, 0.08, 5)
state = motion.reconcile(state, intent(body("snap", { x: 8, y: 0, width: 304, height: 160, radius: 28 }, "expanded", "expansion"), null, { bounds: { width: 320, height: 180 } }), true)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.rect.width, 304, "reduced motion keeps the bounded endpoint")
assert.equal(visual.rect.height, 160, "reduced motion bypasses spring fitting")
const compactIntent = intent(body("continuous", { x: 250, y: 0, width: 200, height: 22, radius: 11 }, "primary"))
const expandedIntent = intent(body("continuous", { x: 146, y: 0, width: 408, height: 160, radius: 28 }, "expanded", "expansion"))
state = motion.reconcile(motion.initialState(), compactIntent, true)
state = motion.reconcile(state, expandedIntent, false)
state = motion.advance(state, 0.12)
const beforeRepeat = state.capsule.pose
assert.ok(beforeRepeat.radius.velocity > 1)
state = motion.reconcile(state, expandedIntent, false)
assert.deepEqual(state.capsule.pose, beforeRepeat, "identical intent cannot rebase the capsule or erase radius velocity")
state = motion.reconcile(state, compactIntent, false)
state = motion.advance(state, 0.05)
const beforeRevision = state.capsule.pose
const outgoingBeforeRevision = motion.renderFrame(state).bodies[0].outgoing
state = motion.reconcile(state, { ...compactIntent, primary: { ...compactIntent.primary, revision: 2 } }, false)
assert.deepEqual(state.capsule.pose, beforeRevision, "content revision cannot replace the active capsule profile")
visual = motion.renderFrame(state).bodies[0]
assert.deepEqual(visual.outgoing, outgoingBeforeRevision, "same-key compact updates keep any existing mode transition blend")
state = motion.reconcile(motion.initialState(), compactIntent, false)
state = motion.reconcile(state, { ...compactIntent, primary: { ...compactIntent.primary, revision: 2 } }, false)
assert.equal(motion.renderFrame(state).bodies[0].outgoing, null, "same-key compact updates replace payload without a blur crossfade")

const mediaCompact = { x: 250, y: 0, width: 200, height: 22, radius: 11 }
const mediaExpanded = { x: 146, y: 0, width: 408, height: 184, radius: 36 }
state = motion.reconcile(motion.initialState(), intent(mediaBody("media", mediaCompact, "primary", "track-a", "Night Drive")), true)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.present, true, "primary media owns one title immediately")
assert.equal(visual.sharedTitle.identity.trackToken, "track-a", "title identity ignores progress and revisions")
state = motion.reconcile(state, intent(mediaBody("media", mediaExpanded, "expanded", "track-a", "Night Drive")), false)
state = motion.advance(state, 0.12)
visual = motion.renderFrame(state).bodies[0]
const titlePositionBeforeReverse = viewModel.titleSample(visual.rect, visual.sharedTitle)
const titleVelocityBeforeReverse = viewModel.titleVelocity(visual.rectVelocity, visual.sharedTitle)
assert.notEqual(titleVelocityBeforeReverse, 0, "midflight shared title has body-derived velocity")
state = motion.reconcile(state, intent(mediaBody("media", mediaCompact, "primary", "track-a", "Night Drive")), false)
visual = motion.renderFrame(state).bodies[0]
const titlePositionAfterReverse = viewModel.titleSample(visual.rect, visual.sharedTitle)
const titleVelocityAfterReverse = viewModel.titleVelocity(visual.rectVelocity, visual.sharedTitle)
assert.equal(titlePositionAfterReverse.x, titlePositionBeforeReverse.x, "shared title position samples the unchanged reversal pose")
assert.equal(titleVelocityAfterReverse, titleVelocityBeforeReverse, "shared title velocity follows the retained body velocity")
const detailBeforeTitleUpdate = visual.outgoing
state = motion.reconcile(state, intent(mediaBody("media", mediaCompact, "primary", "track-a", "Corrected Title")), false)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.text, "Corrected Title", "same-track metadata updates the shared title in place")
assert.deepEqual(visual.outgoing, detailBeforeTitleUpdate, "same-track metadata does not reenter content crossfade")
state = motion.reconcile(state, intent(mediaBody("media", mediaCompact, "primary", "track-b", "Second Track")), false)
visual = motion.renderFrame(state).bodies[0]
assert.ok(visual.outgoing, "a new media track retains the existing detail layer")
assert.equal(visual.sharedTitle.identity.trackToken, "track-a", "old title remains until its bounded handoff completes")
assert.equal(visual.sharedTitle.owned, true, "retained layers stay title-suppressed during the invisible handoff")
state = tick(state, 2, 120)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.identity.trackToken, "track-b", "new tracks replace identity only after the old title exits")
state = motion.reconcile(state, intent(mediaBody("media", mediaCompact, "minimal", "track-b", "Second Track")), false)
state = tick(state, 1, 60)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.present, false, "minimal media has no shared title")
assert.equal(visual.sharedTitle.owned, true, "minimal media keeps retained titles suppressed")
state = motion.reconcile(state, intent(mediaBody("media", mediaExpanded, "expanded", "track-c", "Reduced Track")), true)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.identity.trackToken, "track-c", "reduced motion takes the latest title identity")
assert.equal(visual.sharedTitle.present, true, "reduced motion exposes the final shared title without a handoff frame")
assert.equal(motion.renderFrame(state).unsettled, false, "reduced motion leaves no shared-title clock work")
state = motion.reconcile(motion.initialState(), intent(body("opaque", { x: 250, y: 0, width: 200, height: 22, radius: 11 }, "primary")), false)
assert.equal(motion.renderFrame(state).bodies[0].rect.width, 0, "a new body starts at zero geometry rather than transparent full size")
assert.equal(motion.renderFrame(state).bodies[0].rect.height, 0)
assert.equal(motion.renderFrame(state).bodies[0].rect.radius, 0)
for (let index = 0; index < 120; index++) {
  state = motion.advance(state, 1 / 120)
  const sample = motion.renderFrame(state).bodies[0]
  assert.equal(sample.opacity, 1, "body stays opaque while growing")
  assert.equal(sample.incoming.opacity, 1, "content stays opaque")
  assert.equal(sample.incoming.blur, 0, "geometry handoff introduces no blur")
}
assert.ok(motion.renderFrame(state).bodies[0].rect.width > 199.9)
assert.ok(motion.renderFrame(state).bodies[0].rect.height > 21.9)
assert.ok(motion.renderFrame(state).bodies[0].rect.radius > 10.9)
state = motion.reconcile(state, intent(body("opaque", { x: 146, y: 0, width: 408, height: 184, radius: 28 }, "expanded", "expansion")), false)
state = tick(state, 2, 120)
const previousBody = motion.renderFrame(state).bodies.find(item => item.key === "opaque")
state = motion.reconcile(state, intent(body("another-tool", { x: 146, y: 0, width: 408, height: 114, radius: 28 }, "expanded", "expansion")), false)
const replacementBody = motion.renderFrame(state).bodies.find(item => item.key === "another-tool")
assert.equal(replacementBody.slot, previousBody.slot, "tool replacement reuses the expanded physical body")
assert.deepEqual(replacementBody.rect, previousBody.rect, "tool replacement retains the sampled geometry")
assert.equal(replacementBody.opacity, 1, "tool replacement cannot fade the body")
assert.equal(replacementBody.incoming.opacity, 1)
assert.equal(replacementBody.outgoing.opacity, 1)
state = tick(state, 2, 120)
state = motion.reconcile(state, intent(null), false)
const retiringWidth = motion.renderFrame(state).bodies.find(item => item.role === "retiring").rect.width
const retiringHeight = motion.renderFrame(state).bodies.find(item => item.role === "retiring").rect.height
state = tick(state, 0.1, 12)
const retiring = motion.renderFrame(state).bodies.find(item => item.role === "retiring")
assert.ok(retiring.rect.width < retiringWidth, "retirement shrinks the physical body")
assert.ok(retiring.rect.height < retiringHeight, "retirement shrinks depth as well as width")
assert.equal(motion.renderFrame(state).mapped, true, "shrinking body stays mapped before reaching zero")
assert.equal(retiring.opacity, 1, "retirement never fades the background")
state = tick(state, 2, 120)
assert.equal(motion.renderFrame(state).mapped, false, "zero-sized retired bodies unmap")
state = motion.reconcile(motion.initialState(), intent(mediaBody("media", mediaCompact, "primary", "a", "A")), true)
state = motion.reconcile(state, intent(mediaBody("media", mediaCompact, "primary", "b", "B")), false)
state = tick(state, 0.1, 12)
const titleBeforeReturn = motion.renderFrame(state).bodies[0].sharedTitle
state = motion.reconcile(state, intent(mediaBody("media", mediaCompact, "primary", "a", "A")), false)
const titleAfterReturn = motion.renderFrame(state).bodies[0].sharedTitle
assert.equal(titleAfterReturn.offsetY, titleBeforeReturn.offsetY, "track handoff reversal preserves title position")
assert.equal(titleAfterReturn.offsetVelocity, titleBeforeReturn.offsetVelocity, "track handoff reversal preserves title velocity")
state = tick(state, 2, 120)
assert.equal(motion.renderFrame(state).bodies[0].sharedTitle.identity.trackToken, "a")

function samePlayerMediaBody(token, title, artist, artUrl, rect) {
  const card = mediaBody("same-player", rect || { x: 250, y: 0, width: 200, height: 22, radius: 11 }, "primary", token, title)
  card.content.media.artist = artist
  card.content.media.artUrl = artUrl
  card.sharedTitle.artUrl = artUrl
  return card
}
state = motion.reconcile(motion.initialState(), intent(
  samePlayerMediaBody("mpv:1|4|track-one", "Track one", "Artist one", "one.png")
), true)
const samePlayerRect = motion.renderFrame(state).bodies[0].rect
state = motion.reconcile(state, intent(
  samePlayerMediaBody("mpv:1|4|track-two", "Track two", "Artist two", "two.png")
), false)
visual = motion.renderFrame(state).bodies[0]
assert.deepEqual(visual.rect, samePlayerRect, "same-player track replacement keeps the main capsule geometry fixed")
assert.equal(visual.outgoing, null, "same-player track replacement does not create a full content roll layer")
assert.equal(visual.incoming.content.media.trackToken, "mpv:1|4|track-two", "transport and timeline receive the current track in place")
assert.equal(visual.sharedTitle.offsetY, 0, "same-player title replacement has no vertical header translation")
assert.ok(visual.sharedTitle.transition, "same-player title replacement exposes a metadata-only crossfade")
assert.equal(visual.sharedTitle.transition.outgoing.text, "Track one")
assert.equal(visual.sharedTitle.transition.incoming.text, "Track two")
assert.equal(visual.sharedTitle.transition.outgoing.subtitle, "Artist one")
assert.equal(visual.sharedTitle.transition.incoming.subtitle, "Artist two")
assert.equal(visual.sharedTitle.transition.outgoing.artUrl, "one.png")
assert.equal(visual.sharedTitle.transition.incoming.artUrl, "two.png")
state = tick(state, 0.1, 12)
visual = motion.renderFrame(state).bodies[0]
assert.ok(visual.sharedTitle.transition.progress > 0 && visual.sharedTitle.transition.progress < 1,
  "same-player metadata crossfade advances on the motion clock")
assert.deepEqual(visual.rect, samePlayerRect, "metadata crossfade never moves the compact view")
const metadataProgressBeforeRepeat = visual.sharedTitle.transition.progress
state = motion.reconcile(state, intent(
  samePlayerMediaBody("mpv:1|4|track-two", "Track two", "Artist two", "two.png")
), false)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.transition.progress, metadataProgressBeforeRepeat,
  "repeated polling for the pending track cannot restart the metadata spring")
assert.equal(visual.sharedTitle.offsetY, 0, "repeated polling cannot turn a metadata fade into a vertical handoff")
assert.equal(visual.outgoing, null, "repeated polling keeps the single media content layer")
state = tick(state, 2, 120)
visual = motion.renderFrame(state).bodies[0]
assert.equal(visual.sharedTitle.transition, null, "metadata crossfade retires after the bounded handoff")
assert.equal(visual.sharedTitle.text, "Track two")
let widthState = motion.reconcile(motion.initialState(), intent(
  samePlayerMediaBody("mpv:1|4|track-one", "Track one", "Artist one", "one.png")
), true)
widthState = motion.reconcile(widthState, intent(
  samePlayerMediaBody("mpv:1|4|track-two", "Track two", "Artist two", "two.png",
    { x: 280, y: 0, width: 140, height: 22, radius: 11 })
), false)
let widthVisual = motion.renderFrame(widthState).bodies[0]
assert.equal(widthVisual.outgoing, null, "same-player track replacement remains a single layer when its compact width changes")
assert.ok(widthVisual.sharedTitle.transition, "compact width changes retain the metadata-only title transition")
assert.equal(widthVisual.sharedTitle.offsetY, 0, "compact width changes do not introduce a vertical title roll")
widthState = tick(widthState, 2, 120)
widthVisual = motion.renderFrame(widthState).bodies[0]
assert.equal(Math.round(widthVisual.rect.width), 140, "the same-player compact region settles to its measured width")

let rapidTrackState = motion.reconcile(motion.initialState(), intent(
  samePlayerMediaBody("mpv:1|4|track-one", "Track one", "Artist one", "one.png")
), true)
rapidTrackState = motion.reconcile(rapidTrackState, intent(
  samePlayerMediaBody("mpv:1|4|track-two", "Track two", "Artist two", "two.png")
), false)
rapidTrackState = tick(rapidTrackState, 0.08, 8)
const rapidTrackMix = motion.renderFrame(rapidTrackState).bodies[0].sharedTitle.transition.progress
rapidTrackState = motion.reconcile(rapidTrackState, intent(
  samePlayerMediaBody("mpv:1|4|track-three", "Track three", "Artist three", "three.png")
), false)
visual = motion.renderFrame(rapidTrackState).bodies[0]
assert.equal(visual.outgoing, null, "rapid same-player skips never create a body roll layer")
assert.equal(visual.sharedTitle.transition.outgoing.text, "Track one", "rapid skip retains only the currently visible metadata")
assert.equal(visual.sharedTitle.transition.incoming.text, "Track three", "rapid skip replaces stale pending metadata")
assert.equal(visual.sharedTitle.transition.incoming.artUrl, "three.png", "an asynchronous old artwork request cannot regain the incoming slot")
assert.equal(visual.sharedTitle.transition.progress, rapidTrackMix,
  "rapid same-player skips preserve the sampled fade progress instead of reviving stale metadata")
rapidTrackState = motion.reconcile(rapidTrackState, intent(
  samePlayerMediaBody("mpv:1|4|track-three", "Track three", "Artist three", "three.png")
), false)
visual = motion.renderFrame(rapidTrackState).bodies[0]
assert.equal(visual.sharedTitle.transition.progress, rapidTrackMix,
  "repeated polling after a rapid skip leaves the newest fade uninterrupted")

const peekContent = { key: "peek:notification", label: "Mail", value: "Build complete", icon: "bell", peek: true }
const closedPeekRect = { x: 807, y: 2, width: 306, height: 68, radius: 24 }
state = motion.reconcile(motion.initialState(), {
  edge: "top", bounds: { width: 1920, height: 1080 }, alerting: false,
  capsule: { mode: "peek", profile: "expansion", rect: closedPeekRect },
  primary: null, secondary: null,
  peek: { content: peekContent, key: peekContent.key, placement: "closed", rect: closedPeekRect,
    size: { width: closedPeekRect.width, height: closedPeekRect.height } }
}, false)
let peekVisual = motion.renderFrame(state).peek
assert.equal(peekVisual.visible, true, "closed peek exposes its useful header from the first capsule sample")
assert.equal(peekVisual.placement, "closed")
assert.equal(peekVisual.content.key, peekContent.key)
assert.equal(motion.renderFrame(state).bodies.filter(item => item.role === "peek").length, 0,
  "closed peek never allocates a generic keyed content body")
state = motion.reconcile(state, {
  edge: "top", bounds: { width: 1920, height: 1080 }, alerting: false,
  capsule: { mode: "idle", profile: "compact", rect: { x: 835, y: 2, width: 250, height: 22, radius: 11 } },
  primary: null, secondary: null, peek: null
}, true)
assert.equal(motion.renderFrame(state).peek.visible, false, "reduced motion clears an expired peek without leaving a hidden clock record")

for (const edge of ["top", "bottom", "left", "right"]) {
  const raw = edgeMetrics(edge)
  const expandedRect = viewModel.geometryFor("expanded", false, viewModel.screenMetrics(raw), false).card
  const expanded = body("main-" + edge, expandedRect, "expanded", "expansion")
  state = motion.reconcile(motion.initialState(), intent(expanded, null, { edge, bounds: raw.screen }), true)
  state = motion.reconcile(state, {
    edge, bounds: raw.screen, alerting: false,
    capsule: { mode: "expanded", profile: "expansion", rect: expandedRect },
    primary: expanded, secondary: null,
    peek: { content: peekContent, key: peekContent.key, placement: "below",
      rect: edge === "top" ? { x: expandedRect.x + 61, y: expandedRect.y + expandedRect.height + 6, width: 184, height: 68, radius: 24 }
        : edge === "bottom" ? { x: expandedRect.x + 61, y: expandedRect.y - 74, width: 184, height: 68, radius: 24 }
          : edge === "left" ? { x: expandedRect.x + expandedRect.width + 6, y: expandedRect.y + (expandedRect.height - 68) / 2, width: 184, height: 68, radius: 24 }
            : { x: expandedRect.x - 190, y: expandedRect.y + (expandedRect.height - 68) / 2, width: 184, height: 68, radius: 24 },
      size: { width: 184, height: 68 } }
  }, false)
  state = tick(state, 0.12, 12)
  let frame = motion.renderFrame(state)
  peekVisual = frame.peek
  assert.equal(peekVisual.placement, "below", edge + " keeps an independent attached peek")
  assert.ok(peekVisual.visible, edge + " reveals the attached peek without a body roll")
  assert.ok(peekVisual.rect.x >= 0 && peekVisual.rect.y >= 0
    && peekVisual.rect.x + peekVisual.rect.width <= raw.screen.width
    && peekVisual.rect.y + peekVisual.rect.height <= raw.screen.height, edge + " peek stays bounded")
  if (edge === "top" || edge === "bottom") assert.ok(peekVisual.rect.width > 0 && peekVisual.rect.width <= 184,
    edge + " samples the independent measured width")
  else assert.ok(peekVisual.rect.height > 0 && peekVisual.rect.height <= 68,
    edge + " samples the independent measured height")
  const mainBeforeExpiry = frame.capsule.rect
  state = motion.reconcile(state, {
    edge, bounds: raw.screen, alerting: false,
    capsule: { mode: "expanded", profile: "expansion", rect: expandedRect },
    primary: expanded, secondary: null, peek: null
  }, false)
  frame = motion.renderFrame(state)
  assert.deepEqual(frame.capsule.rect, mainBeforeExpiry, edge + " peek expiry leaves main geometry untouched")
}
console.log("analytical motion model passed")
