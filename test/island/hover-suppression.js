const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")

const widgetSource = fs.readFileSync(require.resolve("../../shell/plugins/island/BarWidget.qml"), "utf8")
const surfaceSource = fs.readFileSync(require.resolve("../../shell/plugins/island/IslandSurface.qml"), "utf8")

assert.match(widgetSource, /property bool islandBarPointerOver: false/)
assert.match(widgetSource, /property bool islandSurfacePointerOver: false/)
assert.match(widgetSource, /property bool islandPointerOver: islandBarPointerOver \|\| islandSurfacePointerOver/)
assert.match(widgetSource, /property bool islandSuppressionLease: false/)
assert.match(widgetSource, /property bool islandSuppressionBaseline: false/)
assert.match(widgetSource, /HoverHandler \{[\s\S]*root\.islandBarPointerOver = hovered/)
assert.match(surfaceSource, /function islandWidgets\(\)[\s\S]*moduleWidgets\("luinbytes\.island"\)/)
assert.match(surfaceSource, /function islandPointerWidget\(widgets\)[\s\S]*islandPointerOver === true/)
assert.match(surfaceSource, /function islandSuppressionOwner\(widgets\)[\s\S]*islandSuppressionLease === true/)
assert.match(surfaceSource, /function syncCenterHoverSuppression\(forceRelease\)[\s\S]*centerHoverRevealSuppressed = true/)
assert.match(surfaceSource, /islandSuppressionBaseline = bar\.centerHoverRevealSuppressed === true/)
assert.match(surfaceSource, /owner\.islandSuppressionLease = false/)
assert.match(surfaceSource, /bar\.activePopout && widgets\.indexOf\(bar\.activePopout\) < 0/)
assert.match(surfaceSource, /bar\.centerSectionRevealHeld === true/)
assert.doesNotMatch(surfaceSource, /id: centerHoverReleaseTimer|interval: 125/)
assert.match(surfaceSource, /Connections \{[\s\S]*target: root\.bar[\s\S]*onCenterSectionRevealHeldChanged/)
assert.match(surfaceSource, /HoverHandler \{[\s\S]*root\.setSurfacePointerOver\(hovered\)/)
assert.match(surfaceSource, /readonly property var hoverRegion:[\s\S]*secondInputActive[\s\S]*id: hoverTarget/)
assert.match(surfaceSource, /onPresenterAvailableChanged:[\s\S]*setSurfacePointerOver\(false\)/)
assert.match(surfaceSource, /function clearPointerState\(\)[\s\S]*syncCenterHoverSuppression\(true\)/)
assert.match(surfaceSource, /revealHeld: bar && bar\.centerSectionRevealHeld === true/)

function implementation(name) {
  const start = surfaceSource.indexOf("function " + name + "(")
  assert.ok(start >= 0)
  let depth = 0
  for (let end = surfaceSource.indexOf("{", start); end < surfaceSource.length; end++) {
    if (surfaceSource[end] === "{") depth++
    if (surfaceSource[end] === "}" && --depth === 0) return surfaceSource.slice(start, end + 1)
  }
  throw new Error("Unclosed function " + name)
}

const bar = { centerHoverRevealSuppressed: false, activePopout: null }
const first = { islandPointerOver: false }
const second = { islandPointerOver: false }
const context = { bar, anchorItem: first, islandWidgets: () => [first, second],
  centerHoverSettleTimer: { stop() {}, restart() {} } }
context.root = context
vm.createContext(context)
for (const name of ["islandPointerWidget", "islandSuppressionOwner", "settleCenterHoverSuppression", "syncCenterHoverSuppression", "onActivePopoutChanged"])
  vm.runInContext(implementation(name), context)
const sync = () => context.syncCenterHoverSuppression(false)

first.islandPointerOver = true
sync(bar, first, [first, second])
assert.equal(bar.centerHoverRevealSuppressed, true)
assert.equal(first.islandSuppressionLease, true)
second.islandPointerOver = true
first.islandPointerOver = false
sync(bar, first, [first, second])
assert.equal(bar.centerHoverRevealSuppressed, true)
assert.equal(second.islandSuppressionLease, true)
assert.equal(first.islandSuppressionLease, false)
second.islandPointerOver = false
sync(bar, first, [first, second])
bar.centerSectionRevealHeld = true
context.settleCenterHoverSuppression(false)
assert.equal(bar.centerHoverRevealSuppressed, true, "leave cannot uncover a native reveal hold")
bar.centerSectionRevealHeld = false
context.settleCenterHoverSuppression(false)
assert.equal(bar.centerHoverRevealSuppressed, false)

first.islandPointerOver = true
sync()
assert.equal(first.islandSuppressionLease, true)
bar.activePopout = { id: "weather" }
context.onActivePopoutChanged()
assert.equal(first.islandSuppressionLease, false, "the native popout handoff ends the Island lease")
assert.equal(bar.centerHoverRevealSuppressed, false, "handoff restores before the new panel's deferred suppression")
bar.centerHoverRevealSuppressed = true
sync()
first.islandPointerOver = false
context.settleCenterHoverSuppression(false)
assert.equal(bar.centerHoverRevealSuppressed, true, "hover leave must preserve the new panel's suppression")
first.islandPointerOver = true
bar.centerHoverRevealSuppressed = false
bar.activePopout = null
context.onActivePopoutChanged()
assert.equal(first.islandSuppressionLease, true, "closing the foreign popout reacquires stationary Island hover")
assert.equal(bar.centerHoverRevealSuppressed, true)

console.log("hover suppression contract passed")
