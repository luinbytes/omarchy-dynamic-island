const assert = require("node:assert/strict")
const fs = require("node:fs")

const source = fs.readFileSync(require.resolve("../../shell/plugins/island/ActivityIcon.qml"), "utf8")
const islandContent = fs.readFileSync(require.resolve("../../shell/plugins/island/IslandContent.qml"), "utf8")
const peekContent = fs.readFileSync(require.resolve("../../shell/plugins/island/PeekContent.qml"), "utf8")
const activityVisual = fs.readFileSync(require.resolve("../../shell/plugins/island/ActivityVisual.qml"), "utf8")

assert.match(source, /property string name:/, "the shared icon accepts a semantic name")
assert.match(source, /property real size:/, "the shared icon accepts a requested size")
assert.match(source, /property color color:/, "the shared icon accepts the bar color")
assert.match(source, /property string fallbackText:/, "the shared icon accepts a text fallback")
for (const name of ["bell", "cpu", "ram", "gpu", "psi", "alert", "play", "pause"]) {
  assert.match(source, new RegExp(name + ":"), name + " has a semantic rendering")
}
assert.match(source, /canonicalName === "robot"/, "robot has a semantic rendering")
assert.match(source, /"codex":\s*"codex"/, "Codex has a distinct terminal rendering")
for (const name of ["agents", "media", "notifications", "notes", "music", "system", "weather"]) {
  assert.match(source, new RegExp('"' + name + '":'), name + " resolves as a semantic alias")
}
assert.match(source, /"󰚩":\s*"robot"/, "the existing agent glyph maps to the robot semantic")
assert.match(islandContent, /ActivityIcon\s*\{[\s\S]*name:\s*root\.compact\.icon/, "compact content uses the shared icon")
assert.match(peekContent, /ActivityIcon\s*\{[\s\S]*name:\s*root\.card\.icon/, "peek content uses the shared icon")
assert.match(activityVisual, /ActivityIcon\s*\{[\s\S]*name:\s*root\.visual[\s\S]*content\.icon/, "minimal content uses the shared icon")
assert.doesNotMatch(peekContent, /readonly property var iconPaths/, "peek content no longer owns a vector registry")
assert.doesNotMatch(islandContent, /id:\s*compactPlayShape|id:\s*compactPauseBars|id:\s*compactBell/, "compact content no longer duplicates icon branches")
console.log("shared activity icon contract passed")
