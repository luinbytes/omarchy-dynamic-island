const assert = require("node:assert/strict")
const model = require("../../shell/plugins/island/ActivityModel.js")
const media = require("../../shell/plugins/island/MediaProjection.js")

function snapshot(overrides) {
  return {
    playerKey: "mpv:1",
    instanceEpoch: 1,
    uniqueId: 1,
    title: "Night Drive",
    artist: "Example Artist",
    album: "After Dark",
    identity: "mpv",
    isPlaying: true,
    positionSupported: true,
    lengthSupported: true,
    position: 30,
    length: 120,
    canPrevious: true,
    canPlayPause: true,
    canNext: false,
    canSeek: true,
    artUrl: "https://cdn.example.test/cover.jpg",
    ...overrides
  }
}

let state = media.initialState()
let result = media.reconcile(state, snapshot(), 1000)
assert.equal(result.command.type, "publish")
assert.equal(result.command.activity.source, "luinbytes.island.media")
assert.equal(result.command.activity.id, "now-playing")
assert.equal(result.command.activity.createdAt, 1000)
assert.equal(result.command.activity.media.positionSeconds / result.command.activity.media.durationSeconds, 0.25)
assert.deepEqual(result.command.activity.actions.map(action => action.enabled), [true, true, false])
assert.deepEqual(result.command.activity.media, {
  trackToken: "mpv:1|1|1",
  title: "Night Drive",
  artist: "Example Artist",
  artUrl: "https://cdn.example.test/cover.jpg",
  playing: true,
  canSeek: true,
  positionSeconds: 30,
  durationSeconds: 120
})
assert.equal(model.validateActivity(result.command.activity, 1000).ok, true, "projection fits ActivityModel schema")
state = result.state

result = media.reconcile(state, snapshot(), 1100)
assert.equal(result.command, null, "unchanged metadata is a no-op")

result = media.reconcile(state, snapshot({ position: 31 }), 2000)
assert.equal(result.command.type, "update", "playing progress refreshes at low rate")
assert.equal(result.command.activity.createdAt, 1000, "createdAt remains stable while a player is retained")
assert.equal(result.command.activity.revision, 2, "revisions increase monotonically")
state = result.state

result = media.reconcile(state, snapshot({ isPlaying: false, positionSupported: false, lengthSupported: false }), 2200)
assert.equal(result.command.type, "update", "paused media remains published for resume")
assert.equal(Object.hasOwn(result.command.activity.media, "positionSeconds"), false, "unsupported progress is omitted")
assert.equal(result.command.activity.media.canSeek, false, "unsupported timing disables seek")
state = result.state

result = media.reconcile(state, { playerKey: "mpv:1", instanceEpoch: 1, uniqueId: 1, title: "\n\u0000", artist: "", album: "" }, 2300)
assert.equal(result.command.type, "end", "empty sanitized metadata ends the activity")
assert.equal(result.state.revision, result.command.revision, "inactive state retains the emitted end watermark")
state = result.state

result = media.reconcile(state, { kind: "absent" }, 2350)
assert.equal(result.command, null, "repeated absence is a no-op")
assert.equal(result.state.revision, state.revision, "repeated absence keeps the watermark")

const huge = "a".repeat(320) + "\n\u0000"
result = media.reconcile(state, snapshot({ title: huge, artist: "\n", album: "", identity: "\u0007player" }), 2400)
assert.ok(result.command.activity.revision > state.revision, "republish advances beyond the end watermark")
assert.equal(model.validateCommand(result.command, 2400).ok, true, "republish after an end remains command-schema valid")
assert.equal(result.command.activity.compact.label.length, 256, "metadata is bounded")
assert.doesNotMatch(result.command.activity.compact.label, /[\x00-\x1f\x7f]/, "metadata has no controls")
assert.equal(Object.hasOwn(result.command.activity.compact, "value"), false, "empty optional metadata is omitted")
assert.equal(Object.hasOwn(result.command.activity.media, "artist"), false, "empty optional artist is omitted")
assert.equal(model.validateActivity(result.command.activity, 2400).ok, true, "bounded metadata remains schema-safe")
assert.equal(media.artUrl("https://user:password@example.test/cover.jpg"), undefined, "artwork credentials are rejected")
assert.equal(media.artUrl("data:image/png;base64,abc"), undefined, "custom artwork schemes are rejected")
assert.equal(media.artUrl("file:///tmp/cover.jpg"), "file:///tmp/cover.jpg", "absolute file artwork is retained")
assert.equal(media.trackToken("mpv:1", 1, 0), "mpv:1|1|0", "numeric zero is a valid native unique id")
assert.equal(media.trackToken("mpv:1", 1, 1), "mpv:1|1|1", "numeric track changes alter the token")
assert.equal(media.trackToken("mpv:1", 1, -1), "", "negative native unique ids are rejected")
assert.equal(media.trackToken("mpv:1", 1, 1.5), "", "fractional native unique ids are rejected")
assert.equal(media.trackToken("mpv:1", -1, 1), "", "negative instance epochs are rejected")
assert.equal(media.trackToken("mpv:1", 1.5, 1), "", "fractional instance epochs are rejected")
assert.equal(media.normalize(snapshot({ instanceEpoch: -1 })).kind, "absent", "projection rejects invalid instance epochs at its pure boundary")
const longPlayerKey = "m".repeat(180)
assert.equal(media.exactPlayerKey(longPlayerKey), longPlayerKey, "valid native player keys retain every character")
assert.equal(media.trackToken(longPlayerKey, 1, 1), longPlayerKey + "|1|1", "long player keys round trip into the identity token")
assert.equal(media.exactPlayerKey("m".repeat(256)), "", "oversized native player keys are rejected rather than truncated")
assert.notEqual(media.trackToken(longPlayerKey, 1, 1), media.trackToken(longPlayerKey + "x", 1, 1), "distinct long-key prefixes cannot collide")
assert.equal(media.exactPlayerKey("mpv: one"), "", "whitespace in a player key is rejected rather than normalized")
let instanceState = media.initialState()
let instanceResult = media.reconcile(instanceState, snapshot({ instanceEpoch: 7 }), 3000)
instanceState = instanceResult.state
instanceResult = media.reconcile(instanceState, snapshot({ instanceEpoch: 8 }), 3100)
assert.equal(instanceResult.command.type, "update", "a replacement player with the same key and native id republishes")
assert.equal(instanceResult.command.activity.media.trackToken, "mpv:1|8|1", "instance epoch breaks a restarted player's token collision")
console.log("media projection lifecycle and schema assertions passed")
