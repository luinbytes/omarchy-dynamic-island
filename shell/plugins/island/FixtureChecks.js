function check(state, expected) {
  var ids = Object.keys(state.activitiesByKey).sort()
  var expectedIds = expected.ids.map(function(id) { return JSON.stringify(["fixture", id]) }).sort()
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) return "activity-keys"
  var fields = ["phase", "primaryKey", "secondaryKey", "selectedKey", "underlyingKey"]
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i]
    var value = expected[field]
    if (value === undefined) value = field === "selectedKey" ? expected.primaryKey : null
    if (field !== "phase" && value !== null) value = JSON.stringify(["fixture", value])
    if (state.presentation[field] !== value) return field
  }
  for (var j = 0; j < ids.length; j++) {
    if (state.activitiesByKey[ids[j]].revision !== 1) return "activity-revision"
  }
  return ""
}

if (typeof module !== "undefined") module.exports = { check: check }
