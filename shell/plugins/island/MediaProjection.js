var SOURCE = "luinbytes.island.media"
var ID = "now-playing"
var MAX_TEXT = 256
var MAX_PLAYER_KEY = 255

function finite(value, fallback) {
  return typeof value === "number" && isFinite(value) ? value : fallback
}

function text(value, maximum) {
  if (typeof value !== "string") return ""
  var clean = value.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim()
  return clean.slice(0, maximum || MAX_TEXT)
}

function optional(value, maximum) {
  var clean = text(value, maximum)
  return clean === "" ? undefined : clean
}

function artUrl(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 2048 || /[\x00-\x1f\x7f\s]/.test(value)) return undefined
  if (/^file:\/\/\/[^\s]+$/.test(value)) return value
  var remote = /^(https?):\/\/([^\/?#]+)(?:[\/?#][^\s]*)?$/.exec(value)
  return remote && remote[2].indexOf("@") === -1 ? value : undefined
}

function exactPlayerKey(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > MAX_PLAYER_KEY || /[\x00-\x1f\x7f\s]/.test(value)) return ""
  return value
}

function epoch(value) {
  return typeof value === "number" && isFinite(value) && Math.floor(value) === value && value >= 0 && value <= 2147483647
    ? value : -1
}

function trackToken(playerKey, instanceEpoch, uniqueId) {
  var key = exactPlayerKey(playerKey)
  var instance = epoch(instanceEpoch)
  var player = typeof uniqueId === "number" && isFinite(uniqueId) && Math.floor(uniqueId) === uniqueId
    && uniqueId >= 0 && uniqueId <= 4294967295 ? String(uniqueId) : ""
  return key && instance >= 0 && player !== "" ? key + "|" + instance + "|" + player : ""
}

function timing(position, length) {
  var duration = finite(length, 0)
  var current = finite(position, -1)
  if (duration <= 0 || current < 0) return null
  return { positionSeconds: Math.min(current, duration), durationSeconds: duration }
}

function normalize(raw) {
  var source = raw && typeof raw === "object" ? raw : {}
  var playerKey = exactPlayerKey(source.playerKey)
  var instanceEpoch = epoch(source.instanceEpoch)
  var token = trackToken(playerKey, instanceEpoch, source.uniqueId)
  var title = optional(source.title)
  var artist = optional(source.artist)
  var headline = title || artist
  if (!playerKey || !token || !headline) return { kind: "absent" }
  var time = source.positionSupported === true && source.lengthSupported === true ? timing(source.position, source.length) : null
  return {
    kind: "track",
    playerKey: playerKey,
    instanceEpoch: instanceEpoch,
    trackToken: token,
    title: headline,
    artist: title ? artist : undefined,
    artUrl: artUrl(source.artUrl),
    isPlaying: source.isPlaying === true,
    positionSeconds: time ? time.positionSeconds : undefined,
    durationSeconds: time ? time.durationSeconds : undefined,
    progress: time ? Math.round((time.positionSeconds / time.durationSeconds) * 1000) / 1000 : undefined,
    canSeek: time !== null && source.canSeek === true,
    canPrevious: source.canPrevious === true,
    canPlayPause: source.canPlayPause === true,
    canNext: source.canNext === true
  }
}

function signature(snapshot) {
  return JSON.stringify(snapshot)
}

function surface(icon, label) {
  var result = {}
  if (icon !== undefined) result.icon = icon
  if (label !== undefined) result.label = label
  return result
}

function actions(snapshot) {
  return [
    { id: "previous", label: "Previous", role: "secondary", enabled: snapshot.canPrevious },
    { id: "playPause", label: snapshot.isPlaying ? "Pause" : "Play", role: "primary", enabled: snapshot.canPlayPause },
    { id: "next", label: "Next", role: "secondary", enabled: snapshot.canNext }
  ]
}

function media(snapshot) {
  var result = {
    trackToken: snapshot.trackToken,
    title: snapshot.title,
    playing: snapshot.isPlaying,
    canSeek: snapshot.canSeek
  }
  if (snapshot.artist !== undefined) result.artist = snapshot.artist
  if (snapshot.artUrl !== undefined) result.artUrl = snapshot.artUrl
  if (snapshot.positionSeconds !== undefined) {
    result.positionSeconds = snapshot.positionSeconds
    result.durationSeconds = snapshot.durationSeconds
  }
  return result
}

function activity(snapshot, revision, createdAt, updatedAt) {
  return {
    source: SOURCE,
    id: ID,
    kind: "media",
    revision: revision,
    priority: "normal",
    relevance: 1,
    createdAt: createdAt,
    updatedAt: updatedAt,
    target: { mode: "all" },
    privacy: "public",
    compact: surface(snapshot.isPlaying ? "▶" : "Ⅱ", snapshot.title),
    minimal: surface(snapshot.isPlaying ? "▶" : "Ⅱ", snapshot.title),
    actions: actions(snapshot),
    media: media(snapshot)
  }
}

function initialState() {
  return {
    active: false,
    createdAt: 0,
    revision: 0,
    playerKey: "",
    instanceEpoch: 0,
    trackToken: "",
    fingerprint: ""
  }
}

function inactiveState(revision) {
  return {
    active: false,
    createdAt: 0,
    revision: revision,
    playerKey: "",
    instanceEpoch: 0,
    trackToken: "",
    fingerprint: ""
  }
}

function reconcile(previous, rawSnapshot, nowMs) {
  var prior = previous || initialState()
  var snapshot = normalize(rawSnapshot)
  var now = Math.max(0, Math.floor(finite(nowMs, 0)))
  if (snapshot.kind === "absent") {
    if (!prior.active) return { state: prior, command: null, snapshot: snapshot }
    var endRevision = prior.revision + 1
    return {
      state: inactiveState(endRevision),
      command: { type: "end", source: SOURCE, id: ID, revision: endRevision },
      snapshot: snapshot
    }
  }
  var fingerprint = signature(snapshot)
  if (prior.active && prior.fingerprint === fingerprint) return { state: prior, command: null, snapshot: snapshot }
  var revision = prior.revision + 1
  var createdAt = prior.active ? prior.createdAt : now
  var next = {
    active: true,
    createdAt: createdAt,
    revision: revision,
    playerKey: snapshot.playerKey,
    instanceEpoch: snapshot.instanceEpoch,
    trackToken: snapshot.trackToken,
    fingerprint: fingerprint
  }
  return {
    state: next,
    command: { type: prior.active ? "update" : "publish", activity: activity(snapshot, revision, createdAt, now) },
    snapshot: snapshot
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    SOURCE: SOURCE,
    ID: ID,
    text: text,
    artUrl: artUrl,
    exactPlayerKey: exactPlayerKey,
    epoch: epoch,
    trackToken: trackToken,
    normalize: normalize,
    activity: activity,
    initialState: initialState,
    reconcile: reconcile
  }
}
