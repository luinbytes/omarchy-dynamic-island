function plainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function percentage(value) {
  return typeof value === "number" && isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null
}

function resetEpoch(value) {
  return typeof value === "number" && isFinite(value) && value > 0 ? value : null
}

function displayText(value, maximum) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, maximum)
}

function paceState(value) {
  return ["ahead", "behind", "onpace", "spent", "full"].indexOf(value) >= 0 ? value : ""
}

function normalize(raw, providerPresent) {
  var source = plainObject(raw) ? raw : {}
  var available = providerPresent === true && source.available === true
  var weeklyUsed = percentage(source.used)
  var remaining = percentage(source.remaining)
  if (weeklyUsed === null && remaining !== null) weeklyUsed = 100 - remaining
  if (remaining === null && weeklyUsed !== null) remaining = 100 - weeklyUsed
  return {
    providerPresent: providerPresent === true,
    available: available,
    sessionUsed: percentage(source.session_used),
    weeklyUsed: weeklyUsed,
    remaining: remaining,
    pace: displayText(source.status, 48),
    paceState: paceState(source.pace_state),
    margin: percentage(source.margin),
    reset: displayText(source.reset, 96),
    weeklyResetAt: available ? resetEpoch(source.weekly_reset_at) : null,
    sessionResetAt: available ? resetEpoch(source.session_reset_at) : null
  }
}

if (typeof module !== "undefined") module.exports = { normalize: normalize }
