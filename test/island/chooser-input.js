const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "../..")
const activityVisualSource = fs.readFileSync(path.join(root, "shell/plugins/island/ActivityVisual.qml"), "utf8")
const hubContentSource = fs.readFileSync(path.join(root, "shell/plugins/island/HubContent.qml"), "utf8")

function objectWithId(source, type, id) {
  const marker = `id: ${id}`
  const markerIndex = source.indexOf(marker)
  assert.notEqual(markerIndex, -1, `${id} exists`)
  const start = source.lastIndexOf(`${type} {`, markerIndex)
  assert.notEqual(start, -1, `${id} has type ${type}`)
  let depth = 0
  for (let index = source.indexOf("{", start); index < source.length; index++) {
    if (source[index] === "{") depth++
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1)
  }
  assert.fail(`${id} object is balanced`)
}

function lineBinding(source, name) {
  const match = source.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, "m"))
  assert.ok(match, `${name} binding exists`)
  return match[1].trim()
}

function propertyBinding(source, name, nextName) {
  const match = source.match(new RegExp(`readonly property bool ${name}:\\s*([\\s\\S]*?)\\n\\s*readonly property bool ${nextName}:`))
  assert.ok(match, `${name} binding exists`)
  return match[1].trim()
}

function linePropertyBinding(source, name) {
  const match = source.match(new RegExp(`^\\s*readonly property bool ${name}:\\s*(.+)$`, "m"))
  assert.ok(match, `${name} binding exists`)
  return match[1].trim()
}

const chooserButton = objectWithId(hubContentSource, "Ui.Button", "chooserButton")
const chooserVisibleExpression = lineBinding(chooserButton, "visible")
const chooserEnabledExpression = lineBinding(chooserButton, "enabled")
const hubRoot = { active: true, interactive: true, controlsEnabled: false, chooserNavigationEnabled: true }
const chooserVisible = vm.runInNewContext(chooserVisibleExpression, { root: hubRoot })
const chooserEnabled = vm.runInNewContext(chooserEnabledExpression, { root: hubRoot, visible: chooserVisible })

assert.equal(chooserVisible, true, "the current Hub chooser toggle is visible while geometry is moving")
assert.equal(chooserEnabled, true, "the visible chooser toggle is enabled independently of settled controls")
hubRoot.chooserNavigationEnabled = false
assert.equal(vm.runInNewContext(chooserEnabledExpression, { root: hubRoot, visible: chooserVisible }), false,
  "a stale Hub instance cannot enable its chooser toggle")
hubRoot.chooserNavigationEnabled = true
hubRoot.interactive = false
const outgoingVisible = vm.runInNewContext(chooserVisibleExpression, { root: hubRoot })
assert.equal(vm.runInNewContext(chooserEnabledExpression, { root: hubRoot, visible: outgoingVisible }), false,
  "outgoing Hub content cannot enable its chooser toggle")

const hubNavigationExpression = propertyBinding(activityVisualSource, "hubNavigationInteractive", "chooserOwnsHeader")
const visualRoot = {
  interactive: true,
  screenName: "DP-1",
  service: {
    hubState: {
      expanded: true,
      ownerScreen: "DP-1",
      entityKey: "hub:music",
      chooserOpen: false
    }
  },
  visual: {
    key: "hub:music",
    incoming: {
      expanded: true,
      content: { hub: true, key: "hub:music" }
    }
  }
}

assert.equal(vm.runInNewContext(hubNavigationExpression, { root: visualRoot }), true,
  "the matching current Hub route enables its ancestor input layer")

visualRoot.service.hubState.ownerScreen = "HDMI-A-1"
assert.equal(vm.runInNewContext(hubNavigationExpression, { root: visualRoot }), false,
  "a Hub route owned by another screen cannot enable this layer")
visualRoot.service.hubState.ownerScreen = "DP-1"
visualRoot.service.hubState.entityKey = "hub:weather"
assert.equal(vm.runInNewContext(hubNavigationExpression, { root: visualRoot }), false,
  "a cross-route Hub state cannot enable navigation")
visualRoot.service.hubState.entityKey = "hub:music"
visualRoot.visual.incoming.content.key = "hub:weather"
assert.equal(vm.runInNewContext(hubNavigationExpression, { root: visualRoot }), false,
  "stale incoming Hub content cannot enable navigation")
visualRoot.visual.incoming.content.key = "hub:music"
visualRoot.interactive = false
assert.equal(vm.runInNewContext(hubNavigationExpression, { root: visualRoot }), false,
  "a fullscreen-suppressed surface cannot enable Hub navigation")

const detailBody = objectWithId(hubContentSource, "Item", "detailBody")
assert.equal(vm.runInNewContext(lineBinding(detailBody, "enabled"), {
  root: { interactive: true, controlsEnabled: false }
}), false, "detail controls remain disabled while geometry is moving")

const incomingInteractiveExpression = linePropertyBinding(activityVisualSource, "incomingInteractive")
assert.equal(vm.runInNewContext(incomingInteractiveExpression, {
  root: { controlsInteractive: false, hubNavigationInteractive: true }
}), true, "the current Hub navigation capability opens the ancestor input layer")

const chooserBody = objectWithId(hubContentSource, "Item", "chooserBody")
const chooserColumn = objectWithId(chooserBody, "Column", "chooserColumn")
const chooserHeader = objectWithId(chooserColumn, "Item", "chooserHeader")
const chooserHeaderText = objectWithId(chooserHeader, "Text", "chooserHeaderText")
const chooserSpacing = vm.runInNewContext(lineBinding(chooserColumn, "spacing"))
const chooserBodyTop = vm.runInNewContext(lineBinding(chooserBody, "anchors.margins"))
const chooserButtonTop = vm.runInNewContext(lineBinding(chooserButton, "anchors.topMargin"))
const chooserButtonHeight = vm.runInNewContext(lineBinding(chooserButton, "height"))
const chooserHeaderHeightExpression = lineBinding(chooserHeader, "implicitHeight")
const chooserHeaderHeight = vm.runInNewContext(chooserHeaderHeightExpression, {
  chooserHeaderText: { implicitHeight: 17 },
  chooserButton: { height: chooserButtonHeight }
})

assert.ok(chooserBodyTop + chooserHeaderHeight + chooserSpacing >= chooserButtonTop + chooserButtonHeight + 4,
  "the first chooser row clears the toggle by at least four pixels")
assert.equal(vm.runInNewContext(chooserHeaderHeightExpression, {
  chooserHeaderText: { implicitHeight: 32 },
  chooserButton: { height: chooserButtonHeight }
}), 32, "a taller chooser font grows the header instead of clipping it")
assert.equal(lineBinding(chooserHeaderText, "font.pixelSize"), "14", "the chooser title keeps its measured font size")
assert.equal(lineBinding(chooserHeaderText, "font.weight"), "Font.DemiBold", "the chooser title keeps its weight")

console.log("chooser input contract passed")
