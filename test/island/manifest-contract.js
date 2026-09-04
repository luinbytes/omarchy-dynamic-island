var fs = require("fs")
var path = require("path")

var root = path.resolve(__dirname, "../..")
var manifestPath = path.join(root, "manifest.json")
var pluginRoot = root
var manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function nonEmptyString(value, label) {
  assert(typeof value === "string" && value.length > 0, label + " is a non-empty string")
}

assert(manifest.schemaVersion === 1, "schemaVersion is 1")
assert(!fs.existsSync(path.join(root, "shell/plugins/island/manifest.json")), "nested manifest is absent")
assert(manifest.id === "luinbytes.island", "plugin id is stable")
nonEmptyString(manifest.name, "name")
assert(manifest.name === "Omarchy Island", "display name is stable")
nonEmptyString(manifest.version, "version")
nonEmptyString(manifest.author, "author")
assert(manifest.author === "luinbytes", "plugin author is stable")
nonEmptyString(manifest.description, "description")
assert(Array.isArray(manifest.kinds), "kinds is an array")
var expectedKinds = ["service", "bar-widget"]
assert(manifest.kinds.length === expectedKinds.length, "kinds has the exact plugin set")
for (var kindIndex = 0; kindIndex < manifest.kinds.length; kindIndex++) {
  assert(typeof manifest.kinds[kindIndex] === "string", "kinds contain strings")
  assert(manifest.kinds.indexOf(manifest.kinds[kindIndex]) === kindIndex, "kinds are unique")
}
for (var expectedKindIndex = 0; expectedKindIndex < expectedKinds.length; expectedKindIndex++) {
  assert(manifest.kinds.indexOf(expectedKinds[expectedKindIndex]) !== -1, expectedKinds[expectedKindIndex] + " kind is declared")
}
assert(typeof manifest.keepLoaded === "boolean", "keepLoaded is boolean")
assert(manifest.keepLoaded === true, "service is keep-loaded")
assert(manifest.entryPoints && typeof manifest.entryPoints === "object" && !Array.isArray(manifest.entryPoints), "entryPoints is an object")
var expectedEntryPoints = {
  service: "shell/plugins/island/Service.qml",
  barWidget: "shell/plugins/island/BarWidget.qml"
}
assert(Object.keys(manifest.entryPoints).length === Object.keys(expectedEntryPoints).length, "entryPoints has the expected fields")
var entryPointKinds = Object.keys(expectedEntryPoints)
for (var entryIndex = 0; entryIndex < entryPointKinds.length; entryIndex++) {
  var entryKind = entryPointKinds[entryIndex]
  var entryPoint = manifest.entryPoints[entryKind]
  assert(entryPoint === expectedEntryPoints[entryKind], entryKind + " entry point is stable")
  assert(typeof entryPoint === "string" && entryPoint.length > 0, entryKind + " entry point is non-empty")
  assert(entryPoint.charAt(0) !== "/" && entryPoint.charAt(0) !== "\\", entryKind + " entry point is relative")
  assert(entryPoint.indexOf("..") === -1, entryKind + " entry point cannot escape the plugin")
  assert(!path.posix.isAbsolute(entryPoint) && !path.win32.isAbsolute(entryPoint), entryKind + " entry point is not absolute")
  var resolvedEntryPoint = path.resolve(pluginRoot, entryPoint)
  var relativeEntryPoint = path.relative(pluginRoot, resolvedEntryPoint)
  assert(relativeEntryPoint !== ".." && relativeEntryPoint.indexOf(".." + path.sep) !== 0, entryKind + " entry point stays in the plugin")
  assert(fs.existsSync(resolvedEntryPoint) && fs.statSync(resolvedEntryPoint).isFile(), entryKind + " entry point file exists")
}
assert(manifest.barWidget && typeof manifest.barWidget === "object" && !Array.isArray(manifest.barWidget), "barWidget metadata is present")
nonEmptyString(manifest.barWidget.displayName, "barWidget.displayName")
nonEmptyString(manifest.barWidget.description, "barWidget.description")
nonEmptyString(manifest.barWidget.category, "barWidget.category")
assert(manifest.barWidget.defaultSection === "center", "barWidget.defaultSection is center")
assert(typeof manifest.barWidget.allowMultiple === "boolean", "barWidget.allowMultiple is boolean")
assert(manifest.barWidget.allowMultiple === false, "barWidget does not allow multiple instances")

process.stdout.write("manifest contract passed\n")
