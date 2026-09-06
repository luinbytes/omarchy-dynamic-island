var PRESENTER_ID = "luinbytes.island"

function cleanScreen(value) {
  if (typeof value !== "string") return ""
  return value.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 160)
}

function claimsFor(ready, widgets) {
  if (ready !== true || !widgets || typeof widgets.length !== "number") return []
  var claims = []
  for (var index = 0; index < widgets.length; index++) {
    var widget = widgets[index]
    var screenName = cleanScreen(widget && widget.screenName)
    if (!screenName || !widget || widget.presenterAvailable !== true) continue
    if (claims.some(function(claim) { return claim.screenName === screenName })) continue
    claims.push({ screenName: screenName, presenterId: PRESENTER_ID })
  }
  return claims
}

function canOwnClaims(claims) {
  if (!Array.isArray(claims)) return false
  for (var index = 0; index < claims.length; index++) {
    var claim = claims[index]
    if (!claim || claim.presenterId !== PRESENTER_ID) return false
  }
  return true
}

if (typeof module !== "undefined") module.exports = {
  PRESENTER_ID: PRESENTER_ID,
  claimsFor: claimsFor,
  canOwnClaims: canOwnClaims
}
