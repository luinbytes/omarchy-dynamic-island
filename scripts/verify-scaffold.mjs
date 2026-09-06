import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const requiredFiles = [
  "README.md",
  "manifest.json",
  "shell/plugins/island/ActivityModel.js",
  "shell/plugins/island/ViewModel.js",
  "shell/plugins/island/MotionModel.js",
  "shell/plugins/island/IslandMotion.qml",
  "shell/plugins/island/ActivityVisual.qml",
  "shell/plugins/island/MediaProjection.js",
  "shell/plugins/island/MediaPublisher.qml",
  "shell/plugins/island/HubModel.js",
  "shell/plugins/island/HubContent.qml",
  "shell/plugins/island/CodexModel.js",
  "shell/plugins/island/CodexPanel.qml",
  "shell/plugins/island/ActivityIcon.qml",
  "shell/plugins/island/PeekModel.js",
  "shell/plugins/island/PresentationGateModel.js",
  "shell/plugins/island/PeekContent.qml",
  "shell/plugins/island/NotesModel.js",
  "shell/plugins/island/NotesRepository.qml",
  "shell/plugins/island/NotesPanel.qml",
  "shell/plugins/island/NotePages.js",
  "shell/plugins/island/WeatherModel.js",
  "shell/plugins/island/WeatherStore.qml",
  "shell/plugins/island/WeatherPanel.qml",
  "shell/plugins/island/AgentModel.js",
  "shell/plugins/island/AgentStore.qml",
  "shell/plugins/island/AgentsPanel.qml",
  "shell/plugins/island/NotificationModel.js",
  "shell/plugins/island/NotificationStore.qml",
  "shell/plugins/island/OmapagerHandoffModel.js",
  "shell/plugins/island/NotificationPanel.qml",
  "shell/plugins/island/SystemModel.js",
  "shell/plugins/island/SystemStore.qml",
  "shell/plugins/island/SystemPanel.qml",
  "scripts/island-notification-history.cjs",
  "scripts/island-system-sample.cjs",
  "scripts/codex-island-hook.cjs",
  "shell/plugins/island/Service.qml",
  "shell/plugins/island/BarWidget.qml",
  "shell/plugins/island/IslandSurface.qml",
  "shell/plugins/island/IslandContent.qml",
  "shell/plugins/island/MediaContent.qml",
  "shell/plugins/island/ActivityBroker.qml",
  "shell/plugins/island/IslandFixture.qml",
  "shell/plugins/island/FixtureChecks.js",
  "test/island/activity-model-cases.js",
  "test/island/view-model.js",
  "test/island/motion-model.js",
  "test/island/peek-model.js",
  "test/island/peek-integration.js",
  "test/island/event-order.js",
  "test/island/event-order-cases.js",
  "test/island/presentation-gate.js",
  "test/island/peek-motion-order.js",
  "test/island/peek-lifecycle-order.js",
  "test/island/presentation-paint.js",
  "test/island/chooser-input.js",
  "test/island/apple-motion-reference.json",
  "test/island/media-projection.js",
  "test/island/media-publisher.js",
  "test/island/media-content.js",
  "test/island/shared-title.js",
  "test/island/codex-model.js",
  "test/island/codex-peek.js",
  "test/island/activity-icon.js",
  "test/island/hover-suppression.js",
  "test/island/omapager-model.js",
  "test/island/omapager-handoff.js",
  "test/island/taper-geometry.js",
  "test/island/peek-width.js",
  "test/island/combined-outline.js",
  "test/island/theme-contract.js",
  "test/island/surface-contract.js",
  "test/island/run-activity-model.js",
  "test/island/manifest-contract.js",
  "test/island/plugin-contract.js",
  "test/island/fixture-contract.js",
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
if (run(process.execPath, ["test/island/view-model.js"])) console.log("ok - view model cases")
if (run(process.execPath, ["test/island/motion-model.js"])) console.log("ok - motion model cases")
if (run(process.execPath, ["test/island/media-projection.js"])) console.log("ok - media projection cases")
if (run(process.execPath, ["test/island/media-publisher.js"])) console.log("ok - media publisher contract")
if (run(process.execPath, ["test/island/media-content.js"])) console.log("ok - media content contract")
if (run(process.execPath, ["test/island/shared-title.js"])) console.log("ok - shared title motion")
if (run(process.execPath, ["test/island/combined-outline.js"])) console.log("ok - unified activity outline")
if (run(process.execPath, ["test/island/hub-model.js"])) console.log("ok - hub workflow regressions")
if (run(process.execPath, ["test/island/codex-model.js"])) console.log("ok - direct Codex usage integration")
if (run(process.execPath, ["test/island/codex-peek.js"])) console.log("ok - Codex usage peek thresholds")
if (run(process.execPath, ["test/island/activity-icon.js"])) console.log("ok - semantic activity icons")
if (run(process.execPath, ["test/island/hover-suppression.js"])) console.log("ok - native hover reveal suppression")
if (run(process.execPath, ["test/island/omapager-model.js"])) console.log("ok - Omapager notification integration")
if (run(process.execPath, ["test/island/omapager-handoff.js"])) console.log("ok - Omapager popup handoff")
if (run(process.execPath, ["test/island/taper-geometry.js"])) console.log("ok - rounded-tip geometry")
if (run(process.execPath, ["test/island/peek-width.js"])) console.log("ok - content-sized peeks")
if (run(process.execPath, ["test/island/peek-model.js"])) console.log("ok - semantic peek flow")
if (run(process.execPath, ["test/island/peek-integration.js"])) console.log("ok - peek projection integration")
if (run(process.execPath, ["test/island/event-order.js"])) console.log("ok - live event presentation order")
if (run(process.execPath, ["test/island/presentation-gate.js"])) console.log("ok - per-screen compact presentation gate")
if (run(process.execPath, ["test/island/peek-motion-order.js"])) console.log("ok - interrupted peek motion")
if (run(process.execPath, ["test/island/peek-lifecycle-order.js"])) console.log("ok - peek lifecycle interruption order")
if (run(process.execPath, ["test/island/presentation-paint.js"])) console.log("ok - presentation paint ownership")
if (run(process.execPath, ["test/island/chooser-input.js"])) console.log("ok - chooser navigation during motion")
if (run(process.execPath, ["test/island/live-selection.js"])) console.log("ok - automatic activity lifecycle")
if (run(process.execPath, ["test/island/agent-sources.js"])) console.log("ok - live agent sources")
if (run(process.execPath, ["test/island/notification-model.js"])) console.log("ok - native notification boundary")
if (run(process.execPath, ["test/island/system-model.js"])) console.log("ok - sustained resource observations")
if (run(process.execPath, ["test/island/hook-install.js"])) console.log("ok - isolated hook installer round-trip")
if (run(process.execPath, ["test/island/notes-model.js"])) console.log("ok - notes persistence model")
if (run(process.execPath, ["test/island/note-pages.js"])) console.log("ok - lossless bounded note pages")
if (run(process.execPath, ["test/island/weather-model.js"])) console.log("ok - weather boundary model")
if (run(process.execPath, ["test/island/theme-contract.js"])) console.log("ok - native theme contract")
if (run(process.execPath, ["scripts/compare-island-motion.mjs"])) console.log("ok - Nootch outer motion source contract")
if (run(process.execPath, ["test/island/surface-contract.js"])) console.log("ok - surface contract")
if (run(process.execPath, ["test/island/manifest-contract.js"])) console.log("ok - manifest contract")
if (run(process.execPath, ["test/island/plugin-contract.js"])) console.log("ok - plugin contract")
if (run(process.execPath, ["test/island/fixture-contract.js"])) console.log("ok - fixture contract")

if (upstream) {
  const upstreamGit = spawnSync("git", ["-C", upstream, "rev-parse", "HEAD"], { encoding: "utf8" })
  if (upstreamGit.status !== 0) {
    fail("upstream is not a git checkout")
  } else {
    const validator = path.join(upstream, "bin/omarchy-plugin-validate")
    if (fs.existsSync(validator)) {
      if (run("bash", [validator, root])) console.log("ok - upstream plugin validator")
    } else {
      fail("upstream plugin validator is missing")
    }

    const qmlLint = ["/usr/lib/qt6/bin/qmllint", "qmllint6", "qmllint"].find(command => {
      const probe = spawnSync(command, ["--version"], { encoding: "utf8" })
      return !probe.error && probe.status === 0 && /qmllint 6\./.test(probe.stdout + probe.stderr)
    })
    if (!qmlLint) {
      console.log("skip - Qt 6 qmllint is unavailable; older qmllint versions do not verify this runtime")
    } else {
      const pluginDirectory = path.join(root, "shell/plugins/island")
      const qmlFiles = fs.readdirSync(pluginDirectory)
        .filter(name => name.endsWith(".qml"))
        .sort()
        .map(name => path.join(pluginDirectory, name))
      const importRoot = fs.mkdtempSync(path.join(os.tmpdir(), "island-qml-imports-"))
      const shellAlias = path.join(importRoot, "qs")
      let linked = false
      try {
        fs.symlinkSync(path.join(upstream, "shell"), shellAlias, "dir")
        linked = true
        if (run(qmlLint, ["-I", importRoot, ...qmlFiles])) console.log("ok - Qt 6 qmllint")
      } finally {
        if (linked) fs.unlinkSync(shellAlias)
        fs.rmdirSync(importRoot)
      }
    }
  }
} else {
  console.log("skip - optional upstream validator and qmllint checks were not requested")
}

if (process.exitCode) process.exit(process.exitCode)
console.log("scaffold verification passed")
