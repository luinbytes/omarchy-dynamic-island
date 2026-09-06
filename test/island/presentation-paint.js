const assert = require("node:assert/strict")
const fs = require("node:fs")
const Motion = require("../../shell/plugins/island/MotionModel.js")

const activityVisual = fs.readFileSync(require.resolve("../../shell/plugins/island/ActivityVisual.qml"), "utf8")
const peekContent = fs.readFileSync(require.resolve("../../shell/plugins/island/PeekContent.qml"), "utf8")
const islandSurface = fs.readFileSync(require.resolve("../../shell/plugins/island/IslandSurface.qml"), "utf8")

assert.match(activityVisual, /id:\s*sharedArtFallback[\s\S]*?opacity:\s*root\.sharedTitleTransition \? 1 - root\.sharedTitleMix : 1[\s\S]*?visible:\s*sharedArtImage\.status !== Image\.Ready/,
  "the retained artwork fallback follows the outgoing metadata weight")
assert.match(activityVisual, /id:\s*incomingSharedArtFallback[\s\S]*?opacity:\s*root\.sharedTitleTransition \? root\.sharedTitleMix : 0[\s\S]*?visible:\s*!!root\.sharedTitleTransition && incomingSharedArtImage\.status !== Image\.Ready/,
  "the replacement artwork fallback follows the incoming metadata weight")
assert.doesNotMatch(activityVisual, /sharedArtImage\.status !== Image\.Ready\s*\|\|/,
  "artwork replacement has no third full-opacity fallback")
assert.match(peekContent, /contentDisplacement:[\s\S]*?Math\.max\(-1, Math\.min\(1, root\.visual\.contentOffset\)\)[\s\S]*?id:\s*contentClip[\s\S]*?clip:\s*true[\s\S]*?id:\s*payload[\s\S]*?x:\s*root\.contentDisplacement \* contentClip\.width/,
  "peek payload displacement maps the retained motion sample fully outside one clip")
assert.equal((peekContent.match(/text:\s*root\.card\.label/g) || []).length, 1,
  "serial peek replacement paints exactly one semantic payload")
assert.match(peekContent, /contentCurrent:[\s\S]*?root\.visual\.key === root\.visual\.contentKey[\s\S]*?contentInteractive:[\s\S]*?root\.visual\.contentPhase === "steady"[\s\S]*?contentSafe:[\s\S]*?root\.outline\.contentSafe !== false[\s\S]*?enabled:\s*root\.interactive && root\.contentInteractive && root\.contentSafe/,
  "a transitioning peek cannot promote a different or unsettled semantic key")
assert.match(peekContent, /id:\s*contentClip[\s\S]*?visible:\s*root\.contentSafe/,
  "a tapered peek suppresses its payload before the clipped point can expose text")
assert.match(activityVisual, /contentSafe:[\s\S]*?root\.outline\.contentSafe !== false[\s\S]*?id:\s*bodyClip[\s\S]*?visible:\s*root\.contentSafe/,
  "a tapered main capsule suppresses its payload with the same outline contract")
assert.match(islandSurface, /peekInputActive:[\s\S]*?root\.peekOutline\.contentSafe !== false[\s\S]*?firstInputContentSafe:[\s\S]*?firstInputOutline\.contentSafe !== false[\s\S]*?secondInputContentSafe:[\s\S]*?secondInputOutline\.contentSafe !== false/,
  "tapered content cannot retain a native input mask")
assert.doesNotMatch(peekContent, /Behavior|NumberAnimation|opacity:/,
  "peek content uses only the shared motion sample without an independent fade or clock")

function peekIntent(key) {
  const rect = { x: 807, y: 2, width: 306, height: 68, radius: 24 }
  return {
    edge: "top",
    bounds: { width: 1920, height: 1080 },
    capsule: { mode: "peek", profile: "expansion", rect },
    primary: null,
    secondary: null,
    peek: {
      key,
      content: { key, icon: "notification", label: key, value: "value" },
      placement: "closed",
      rect,
      size: { width: rect.width, height: rect.height }
    }
  }
}

let state = Motion.reconcile(Motion.initialState(), peekIntent("old"), true)
state = Motion.reconcile(state, peekIntent("new"), false)
let visual = Motion.renderFrame(state).peek
assert.equal(visual.key, "new", "the semantic target advances before retained paint")
assert.equal(visual.contentKey, "old", "the old payload remains the sole painted content during exit")
assert.equal(visual.contentPhase, "exiting")
assert.equal(typeof visual.contentOffset, "number", "the renderer exposes the displacement consumed by PeekContent")
state = Motion.advance(state, 0.1)
visual = Motion.renderFrame(state).peek
assert.ok(visual.contentOffset < 0, "the retained payload moves toward the clipped edge")
assert.ok(visual.contentOffset >= -1 && visual.contentOffset <= 1,
  "the renderer and presenter share a normalized displacement contract")

console.log("presentation paint ownership passed")
