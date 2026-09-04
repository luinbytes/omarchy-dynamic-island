var fs = require("fs")
var path = require("path")

var root = path.resolve(__dirname, "../..")
var manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"))
var pluginDir = path.dirname(path.join(root, manifest.entryPoints.service))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(!fs.existsSync(path.join(root, "shell/shell.qml")), "package contains no host shell")
var hostServices = path.join(root, "shell/services")
assert(!fs.existsSync(hostServices) || fs.readdirSync(hostServices).length === 0, "package contains no host services")
assert(!manifest.id.startsWith("omarchy."), "user plugin does not use the reserved namespace")

for (var name of fs.readdirSync(pluginDir)) {
  if (!name.endsWith(".qml")) continue
  var source = fs.readFileSync(path.join(pluginDir, name), "utf8")
  for (var match of source.matchAll(/^\s*import\s+"([^"]+)"/gm)) {
    var imported = path.resolve(pluginDir, match[1])
    var relative = path.relative(root, imported)
    assert(!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep), "local import stays inside the package")
    assert(fs.existsSync(imported), "local import is packaged: " + match[1])
  }
}

var service = fs.readFileSync(path.join(root, manifest.entryPoints.service), "utf8")
assert(!/required\s+property\s+\w+\s+activityBroker\b/.test(service), "service must load without host broker injection")
var widget = fs.readFileSync(path.join(root, manifest.entryPoints.barWidget), "utf8")
var moduleName = widget.match(/\bmoduleName\s*:\s*"([^"]+)"/)
assert(moduleName && moduleName[1] === manifest.id, "widget identity matches the installed manifest")

process.stdout.write("plugin package boundaries passed\n")
