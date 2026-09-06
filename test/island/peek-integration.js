const assert = require("node:assert/strict")
const ViewModel = require("../../shell/plugins/island/ViewModel.js")
const MotionModel = require("../../shell/plugins/island/MotionModel.js")
const HubModel = require("../../shell/plugins/island/HubModel.js")

function metrics(edge) {
  return {
    screen: { width: 1920, height: 1080 },
    anchor: edge === "top" ? { x: 835, y: 0, width: 250, height: 26 }
      : edge === "bottom" ? { x: 835, y: 1054, width: 250, height: 26 }
        : edge === "left" ? { x: 0, y: 415, width: 26, height: 250 }
          : { x: 1894, y: 415, width: 26, height: 250 },
    bar: { position: edge, size: 26 },
    focusedScreen: "DP-1", nowMs: 1000, slotWidth: 250, compactHeight: 22, margin: 8, gap: 6
  }
}

function withPeekMeasurement(raw, active, width) {
  return Object.assign({}, raw, {
    peekMeasurement: {
      key: active && active.candidate ? active.candidate.id : "",
      width: width || 200,
      height: 68
    }
  })
}

const candidate = {
  targetScreens: ["DP-1", "HDMI-A-1"],
  candidate: {
    id: "peek:42", sequence: 42, tool: "notifications", entityKey: "notification:[100,42]",
    summary: { icon: "bell", label: "Mail", value: "Build complete" }
  }
}

for (const edge of ["top", "bottom", "left", "right"]) {
  const raw = withPeekMeasurement(metrics(edge), candidate)
  const compact = ViewModel.geometryFor("compact", false, ViewModel.screenMetrics(raw), false).card
  const closed = ViewModel.projectPeekFrame({ phase: "compact", primary: { key: "main", label: "Main", value: "" }, geometry: { card: compact } },
    candidate, "DP-1", raw)
  let state = MotionModel.reconcile(MotionModel.initialState(), ViewModel.motionIntentFor(closed, raw), false)
  let rendered = MotionModel.renderFrame(state)
  assert.equal(rendered.peek.visible, true, edge + " exposes a closed semantic peek on its first capsule sample")
  assert.equal(rendered.bodies.filter(body => body.role === "peek").length, 0, edge + " keeps peeks outside the keyed body records")

  const main = ViewModel.geometryFor("expanded", false, ViewModel.screenMetrics(raw), false).card
  const expanded = {
    phase: "expanded", isOwner: true,
    selected: { key: "hub:agents", revision: 1, tool: "agents", label: "Agents", value: "Working", icon: "󰚩", actions: [] },
    geometry: { card: main }, titleCompactRect: compact, sourceCapsuleRect: compact, titleExpandedRect: main
  }
  const attached = ViewModel.projectPeekFrame(expanded, candidate, "DP-1", raw)
  assert.deepEqual(attached.geometry, expanded.geometry, edge + " leaves the manual hub geometry unchanged")
  state = MotionModel.reconcile(MotionModel.initialState(), ViewModel.motionIntentFor(attached, raw), true)
  state = MotionModel.reconcile(state, ViewModel.motionIntentFor(attached, raw), false)
  for (let index = 0; index < 12; index++) state = MotionModel.advance(state, 0.01)
  rendered = MotionModel.renderFrame(state)
  assert.equal(rendered.peek.placement, "below", edge + " renders the independent below-main record")
  assert.ok(rendered.peek.visible, edge + " reveals the attached pill without a full-height body roll")
  assert.ok(rendered.peek.rect.x >= 0 && rendered.peek.rect.y >= 0
    && rendered.peek.rect.x + rendered.peek.rect.width <= raw.screen.width
    && rendered.peek.rect.y + rendered.peek.rect.height <= raw.screen.height, edge + " keeps every peek edge on screen")
}

const musicKey = JSON.stringify(["luinbytes.island.media", "now-playing"])
const liveMusic = { key: musicKey, tool: "music", media: { title: "Track", trackToken: "player|1|2" } }
let musicHub = HubModel.initialState()
musicHub.schedule.primary = liveMusic
musicHub.schedule.byKey[musicKey] = liveMusic
musicHub.schedule.byKey["hub:music"] = liveMusic
musicHub.schedule.byTool.music = liveMusic
musicHub = HubModel.navigate(musicHub, "music", "DP-1", "hub:music")
const musicMetrics = ViewModel.screenMetrics(metrics("top"))
const musicPreflight = HubModel.frameFor(musicHub, musicHub.schedule, "DP-1", musicMetrics, ViewModel).preflight
musicHub = HubModel.acceptLayout(musicHub, { screen: "DP-1", key: "hub:music", widthToken: 306,
  expectedWidthToken: 306, preferredHeight: 168, heightBudget: musicPreflight.heightBudget })
const musicBase = HubModel.frameFor(musicHub, musicHub.schedule, "DP-1", musicMetrics, ViewModel)
assert.equal(musicBase.selected.key, "hub:music")
const musicPeek = { ...candidate, candidate: { ...candidate.candidate, source: "media", tool: "music", entityKey: musicKey } }
assert.equal(ViewModel.projectPeekFrame(musicBase, musicPeek, "DP-1", withPeekMeasurement(metrics("top"), musicPeek)), musicBase,
  "chooser music route suppresses only its redundant media peek")
assert.equal(ViewModel.projectPeekFrame({ phase: "compact" }, musicPeek, "HDMI-A-1", withPeekMeasurement(metrics("top"), musicPeek)).peek.placement, "closed",
  "the other monitor still receives the same media event")
assert.equal(ViewModel.projectPeekFrame(musicBase, candidate, "DP-1", withPeekMeasurement(metrics("top"), candidate)).peek.placement, "below",
  "notifications still appear below open music")

console.log("peek projection and separate-motion integration passed")
