const assert = require("node:assert/strict")
const fs = require("node:fs")
const Handoff = require("../../shell/plugins/island/OmapagerHandoffModel.js")

assert.deepEqual(Handoff.claimsFor(false, [{ screenName: "DP-1", presenterAvailable: true }]), [],
  "an unready Island never suppresses provider popups")
assert.deepEqual(Handoff.claimsFor(true, [
  { screenName: "DP-1", presenterAvailable: true },
  { screenName: "DP-1", presenterAvailable: true },
  { screenName: "HDMI-A-1", presenterAvailable: false },
  { screenName: "\u0000", presenterAvailable: true }
]), [{ screenName: "DP-1", presenterId: "luinbytes.island" }],
"claims keep only unique, live presenter screens")
assert.equal(Handoff.canOwnClaims([]), true, "an empty provider claim list is available to Island")
assert.equal(Handoff.canOwnClaims([{ screenName: "DP-1", presenterId: "luinbytes.island" }]), true,
  "Island can renew its own claim list")
assert.equal(Handoff.canOwnClaims([{ screenName: "DP-1", presenterId: "other.presenter" }]), false,
  "a foreign presenter blocks Island instead of merging claim arrays")
assert.equal(Handoff.canOwnClaims([{ screenName: "DP-1" }]), false,
  "malformed existing claims cannot be adopted")

const service = fs.readFileSync(require.resolve("../../shell/plugins/island/Service.qml"), "utf8")
const store = fs.readFileSync(require.resolve("../../shell/plugins/island/NotificationStore.qml"), "utf8")
const widget = fs.readFileSync(require.resolve("../../shell/plugins/island/BarWidget.qml"), "utf8")

assert.equal(Handoff.canOwnClaims({ length: 0 }), false)

assert.match(service, /Binding \{[\s\S]*automaticDisplayClaims[\s\S]*RestoreBindingOrValue/,
  "Island restores Omapager's default display policy when its handoff binding stops")
assert.match(service, /var notifications = sources \? sources\.notifications : null[\s\S]*notifications\.backend === "omapager"/,
  "claims wait for the same Omapager baseline that PeekModel has accepted")
assert.match(service, /!root\.fixturesEnabled[\s\S]*notificationStore\.dnd !== true/,
  "fixtures and quiet provider state release claims back to Omapager")
assert.match(service, /OmapagerHandoffModel\.claimsFor[\s\S]*root\.islandWidgets\(\)/,
  "claims derive from direct widget properties instead of diagnostics")
assert.match(store, /omapagerAutomaticDisplayClaimsAvailable/,
  "older Omapager providers keep their existing popup behavior")
assert.match(service, /omapagerAutomaticDisplayClaimsOwnable[\s\S]*when: root\.omapagerAutomaticDisplayHandoffReady && root\.omapagerAutomaticDisplayClaimsOwnable/,
  "the restoring Binding takes only an empty or Island-owned claim array")
assert.match(widget, /readonly property bool presenterAvailable: surface\.presenterAvailable/,
  "widgets expose the surface availability needed by the handoff")

console.log("Omapager display handoff contract passed")
