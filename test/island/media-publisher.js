const assert = require("node:assert/strict")
const fs = require("node:fs")
const vm = require("node:vm")

const source = fs.readFileSync(require.resolve("../../shell/plugins/island/MediaPublisher.qml"), "utf8")
const match = source.match(/^  function runPublishedAction\(actionId\) \{\n([\s\S]*?)^  \}/m)
const seekMatch = source.match(/^  function seekPublished\(trackToken, positionSeconds\) \{\n([\s\S]*?)^  \}/m)
const progressMatch = source.match(/^  function canPollProgress\(player\) \{\n([\s\S]*?)^  \}/m)
const observeMatch = source.match(/^  function observeActivePlayer\(\) \{\n([\s\S]*?)^  \}/m)
assert.ok(match, "publisher exposes a narrow action bridge")
assert.ok(seekMatch, "publisher exposes an exact-track seek bridge")
assert.ok(progressMatch, "publisher owns one bounded progress predicate")
assert.ok(observeMatch, "publisher owns the active QObject instance epoch")
assert.match(source, /property bool peekSnapshotReady: false/, "publisher keeps media unready until its first source reconciliation")
assert.match(source, /ready: root\.peekSnapshotReady === true/, "peek admission receives explicit source readiness")
assert.match(source, /peekSnapshot = result\.snapshot\s+peekSnapshotReady = true/,
  "the reconciled media snapshot becomes ready atomically with its projection")
assert.match(source, /onMediaChanged:[\s\S]*peekSnapshotReady = false/,
  "source replacement resets the media baseline before it can replay")
assert.match(source, /entityKey: JSON\.stringify\(\[MediaProjection\.SOURCE, MediaProjection\.ID\]\)/,
  "media peeks promote through the publisher's live activity identity, not a track token")
assert.ok(match[1].indexOf("media.playerForKey(publishedKey)") < match[1].indexOf("media.runAction(actionId, false, publishedKey)"), "exact player lookup precedes host action")
for (const signal of ["onPostTrackChanged", "onPositionChanged", "onLengthChanged"]) {
  assert.match(source, new RegExp(`function ${signal}\\(\\) \\{ root\\.schedule\\(\\) \\}`), `${signal} refreshes paused metadata and timing`)
}

const observed = { observedPlayer: null, activePlayer: null, playerInstanceEpoch: 0 }
const observe = vm.runInNewContext(`(function() {\n${observeMatch[1]}\n})`, observed)
const firstObserved = {}
const replacementObserved = {}
observed.activePlayer = firstObserved
observe()
assert.equal(observed.playerInstanceEpoch, 1, "the first observed QObject receives an epoch")
observe()
assert.equal(observed.playerInstanceEpoch, 1, "reconciliation keeps a stable QObject epoch")
observed.activePlayer = replacementObserved
observe()
assert.equal(observed.playerInstanceEpoch, 2, "a distinct QObject receives a fresh epoch")

function actionHarness(options) {
  const calls = []
  const player = options.player || { key: "mpv:1" }
  const context = {
    enabled: options.enabled !== false,
    publishedKey: options.key === undefined ? "mpv:1" : options.key,
    publishedPlayer: options.publishedPlayer || player,
    observedPlayer: options.observedPlayer || player,
    media: {
      playerForKey(key) { return key === options.availableKey ? player : null },
      runAction(...args) { calls.push(args); return true }
    },
    canHandle(candidate, action) { return candidate === player && options.allowed !== false && action === "next" }
  }
  const run = vm.runInNewContext(`(function(actionId) {\n${match[1]}\n})`, context)
  return { run, calls }
}

let harness = actionHarness({ availableKey: "mpv:1" })
assert.equal(harness.run("next"), true)
assert.deepEqual(harness.calls, [["next", false, "mpv:1"]], "host action remains targeted and silent")

harness = actionHarness({ availableKey: "mpv:1", publishedPlayer: { key: "mpv:1" } })
assert.equal(harness.run("next"), false, "a replacement player cannot receive a stale rendered action")
assert.deepEqual(harness.calls, [], "same-key replacement receives no transport command")

harness = actionHarness({ availableKey: "mpv:1", observedPlayer: { key: "mpv:1" } })
assert.equal(harness.run("next"), false, "changed active instance is rejected before republish")

harness = actionHarness({ availableKey: "different-player" })
assert.equal(harness.run("next"), false)
assert.deepEqual(harness.calls, [], "a missing published player cannot fall back to another player")

harness = actionHarness({ availableKey: "mpv:1", allowed: false })
assert.equal(harness.run("next"), false)
assert.deepEqual(harness.calls, [], "capability is checked immediately before the action")

function seekHarness(options) {
  const publishedPlayer = options.player || {
    uniqueId: options.uniqueId === undefined ? 1 : options.uniqueId,
    canSeek: options.canSeek !== false,
    positionSupported: options.positionSupported !== false,
    lengthSupported: options.lengthSupported !== false,
    length: options.length === undefined ? 120 : options.length,
    position: 20
  }
  const livePlayer = options.livePlayer || publishedPlayer
  const epoch = options.epoch === undefined ? 1 : options.epoch
  const context = {
    enabled: options.enabled !== false,
    publishedKey: "mpv:1",
    publishedInstanceEpoch: epoch,
    publishedTrackToken: `mpv:1|${epoch}|1`,
    observedPlayer: options.observedPlayer || publishedPlayer,
    publishedPlayer,
    media: { playerForKey(key) { return key === options.availableKey ? livePlayer : null } },
    MediaProjection: { trackToken(key, instanceEpoch, uniqueId) { return `${key}|${instanceEpoch}|${uniqueId}` } },
    isFinite,
    Number,
    Math
  }
  const seek = vm.runInNewContext(`(function(trackToken, positionSeconds) {\n${seekMatch[1]}\n})`, context)
  return { seek, player: livePlayer }
}

let seek = seekHarness({ availableKey: "mpv:1" })
assert.equal(seek.seek("mpv:1|1|1", 150), true)
assert.equal(seek.player.position, 120, "seek clamps only on the exact live player")

seek = seekHarness({ availableKey: "mpv:1", uniqueId: 2 })
assert.equal(seek.seek("mpv:1|1|1", 40), false)
assert.equal(seek.player.position, 20, "stale track tokens cannot write position")

seek = seekHarness({ availableKey: "other-player" })
assert.equal(seek.seek("mpv:1|1|1", 40), false)
assert.equal(seek.player.position, 20, "missing published players cannot fall back for seek")

const firstInstance = { uniqueId: 1, canSeek: true, positionSupported: true, lengthSupported: true, length: 120, position: 20 }
const replacementInstance = { uniqueId: 1, canSeek: true, positionSupported: true, lengthSupported: true, length: 120, position: 20 }
seek = seekHarness({ availableKey: "mpv:1", player: firstInstance, livePlayer: replacementInstance, observedPlayer: replacementInstance, epoch: 1 })
assert.equal(seek.seek("mpv:1|1|1", 40), false, "a replaced QObject with the same key and native id cannot receive the old seek")
assert.equal(replacementInstance.position, 20, "replacement instance remains untouched before republish")
seek = seekHarness({ availableKey: "mpv:1", player: replacementInstance, livePlayer: replacementInstance, observedPlayer: replacementInstance, epoch: 2 })
assert.equal(seek.seek("mpv:1|1|1", 40), false, "old epoch tokens remain invalid after republish")
assert.equal(seek.seek("mpv:1|2|1", 40), true, "the republished instance accepts only its new epoch token")

function pollsProgress(options) {
  const context = {
    enabled: options.enabled !== false,
    state: { active: options.active !== false },
    media: { hasMedia: options.hasMedia !== false },
    isFinite
  }
  const predicate = vm.runInNewContext(`(function(player) {\n${progressMatch[1]}\n})`, context)
  return predicate(options.player)
}

const playable = { isPlaying: true, positionSupported: true, lengthSupported: true, length: 120 }
assert.equal(pollsProgress({ hasMedia: false, player: playable }), false, "absent metadata cannot poll")
assert.equal(pollsProgress({ player: { ...playable, length: 0 } }), false, "zero duration cannot poll")
assert.equal(pollsProgress({ player: { ...playable, length: Infinity } }), false, "non-finite duration cannot poll")
assert.equal(pollsProgress({ player: playable }), true, "valid active playback polls once per second")
console.log("media publisher action safety assertions passed")
