import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const pinnedCommit = "f99d33a8ddee7b36509a71a6d20d5d23355ce8b1"
const requiredFiles = [
  "README.md",
  "shell/plugins/island/manifest.json",
  "shell/plugins/island/ActivityModel.js",
  "shell/plugins/island/Service.qml",
  "shell/plugins/island/BarWidget.qml",
  "shell/services/ActivityBroker.qml",
  "test/island/activity-model-cases.js",
  "test/island/run-activity-model.js",
  "test/island/manifest-contract.js",
  ".codex/skills/verify-omarchy-island/SKILL.md",
  ".codex/skills/verify-omarchy-island/features/README.md",
  ".codex/skills/verify-omarchy-island/features/activity-contract.md",
  ".codex/skills/verify-omarchy-island/features/quickbar-anchor.md",
  ".codex/skills/verify-omarchy-island/features/live-activity-publishers.md"
]

function fail(message) {
  console.error("not ok - " + message)
  process.exitCode = 1
}

function requireFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) fail("missing " + relativePath)
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) {
    fail(command + " could not run: " + result.error.message)
    return false
  }
  if (result.status !== 0) {
    fail(command + " exited with " + result.status)
    return false
  }
  return true
}

const args = process.argv.slice(2)
let upstream = ""
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--upstream" && args[i + 1]) {
    upstream = path.resolve(args[++i])
  } else {
    fail("unsupported argument " + args[i])
  }
}

for (const relativePath of requiredFiles) requireFile(relativePath)

if (run(process.execPath, ["test/island/run-activity-model.js"])) console.log("ok - activity model cases")
if (run(process.execPath, ["test/island/manifest-contract.js"])) console.log("ok - manifest contract")

if (upstream) {
  const upstreamGit = spawnSync("git", ["-C", upstream, "rev-parse", "HEAD"], { encoding: "utf8" })
  const actualCommit = (upstreamGit.stdout || "").trim()
  if (upstreamGit.status !== 0 || actualCommit !== pinnedCommit) fail("upstream is not pinned to " + pinnedCommit)
  else console.log("ok - upstream pinned to " + pinnedCommit)

  for (const relativePath of ["shell/shell.qml", "shell/services/PluginRegistry.qml", "shell/Ui/BarWidget.qml", "shell/plugins/services/media/manifest.json", "shell/plugins/services/media/Service.qml", "shell/plugins/services/media/BarWidget.qml", "shell/plugins/osd/OsdModel.js"]) {
    if (!fs.existsSync(path.join(upstream, relativePath))) fail("upstream host file missing " + relativePath)
  }

  const qmlFiles = [
    path.join(root, "shell/plugins/island/Service.qml"),
    path.join(root, "shell/plugins/island/BarWidget.qml"),
    path.join(root, "shell/services/ActivityBroker.qml")
  ]
  if (run("qmllint", ["-I", path.join(upstream, "shell"), ...qmlFiles])) console.log("ok - qmllint")
} else {
  console.log("ok - upstream and qmllint checks skipped")
}

if (process.exitCode) process.exit(process.exitCode)
console.log("scaffold verification passed")
