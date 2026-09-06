const clone = value => JSON.parse(JSON.stringify(value))
const playerKey = JSON.stringify(["luinbytes.island.media", "now-playing"])

function sources() {
  return {
    activitiesByKey: {
      [playerKey]: {
        revision: 1,
        compact: { label: "Original track", value: "Playing", icon: "music" },
        media: { title: "Original track", artist: "Artist", playing: true,
          sourceIdentity: "player", trackToken: "player|original", positionSeconds: 10, durationSeconds: 180 }
      }
    },
    notifications: { available: true, backend: "omapager", dnd: false, entries: [] },
    agents: { enabled: true, ready: true, sourceLabel: "Codex hooks", sessions: [] },
    system: { available: true, sampledAt: 1, events: [], readings: [] }
  }
}

const session = state => ({ sessionId: "qa-agent", state, source: "Codex hooks", stale: false,
  approvalNoted: state === "approval-requested", changedAt: 1000, observedAt: 1000, event: "SessionStart" })
const notice = summary => ({ key: "qa-notice", live: true, app: "QA", summary, body: "Event order",
  urgency: "normal", timestamp: 1000 })
const systemEvent = phase => ({ key: "system:cpu", phase, occurredAt: 1000,
  label: "CPU use", value: phase === "terminal" ? "Recovered" : "High", icon: "cpu" })
const cases = []

function scenario(name, kind, prepare, change) {
  const before = sources()
  if (prepare) prepare(before)
  const after = clone(before)
  change(after)
  cases.push({ name, kind, before, after })
}

for (const state of ["working", "idle", "blocked", "approval-requested", "turn-ended", "interrupted", "disconnected"]) {
  const kind = state === "idle" || state === "turn-ended" ? "agent-finished"
    : state === "approval-requested" ? "agent-approval" : "agent-" + state
  scenario("agent " + state, kind,
    value => { value.agents.sessions = [session(state === "working" ? "idle" : "working")] },
    value => { value.agents.sessions = [session(state)] })
}
scenario("agent session starts", "agent-started", null,
  value => { value.agents.sessions = [session("idle")] })
for (const playing of [false, true]) {
  scenario(playing ? "media resumes" : "media pauses", "media-playback",
    value => { value.activitiesByKey[playerKey].media.playing = !playing },
    value => { value.activitiesByKey[playerKey].media.playing = playing })
}
scenario("media track changes", "media-track", null, value => {
  value.activitiesByKey[playerKey].media.title = "New track"
  value.activitiesByKey[playerKey].media.trackToken = "player|new"
  value.activitiesByKey[playerKey].compact.label = "New track"
})
for (const update of [false, true]) {
  scenario(update ? "notification updates" : "notification arrives", update ? "notification-updated" : "notification-new",
    update ? value => { value.notifications.entries = [notice("Old")] } : null,
    value => {
      value.notifications.entries = [notice("New")]
      value.notifications.preview = value.notifications.entries[0]
      value.notificationPreviewUntil = 7000
    })
}
for (const phase of ["attention", "ongoing", "terminal"]) {
  scenario("system " + phase, phase === "terminal" ? "system-recovered" : "system-warning",
    phase === "terminal" ? value => { value.system.events = [systemEvent("attention")] } : null,
    value => { value.system.events = [systemEvent(phase)] })
}

module.exports = { cases, sources, playerKey }
