const assert = require("node:assert/strict")
const fs = require("node:fs")

const source = fs.readFileSync(require.resolve("../../shell/plugins/island/MediaContent.qml"), "utf8")

assert.match(source, /width:\s*48[\s\S]*?height:\s*48/, "expanded media keeps a compact 48 px artwork card")
assert.match(source, /readonly property bool minimal: !expanded && width < 64/, "22px secondary bubbles use an artwork-only representation")
assert.match(source, /property bool titleOwnedByBody: false/, "body-level title ownership reaches retained media content")
assert.match(source, /visible: !root\.minimal && !root\.titleOwnedByBody/, "compact retained media never paints a body-owned title")
assert.match(source, /id: title[\s\S]*?visible: !root\.titleOwnedByBody/, "expanded retained media never paints a body-owned title")
assert.match(source, /readonly property string subtitle: media && media\.artist \? String\(media\.artist\) : sourceLabel/,
  "missing artist metadata falls back to the selected native player label")
assert.match(source, /visible: text !== "" && !root\.titleOwnedByBody/,
  "body-owned media metadata suppresses the duplicate subtitle during a title crossfade")
assert.match(source, /root\.hasTiming \? root\.timeText[\s\S]*?"Playing" : "Paused"/,
  "players without timing show an honest playback state instead of an empty timeline")
assert.match(source, /id: timelineTrack[\s\S]*?visible: root\.hasTiming/,
  "players without timing do not render a meaningless empty progress rail")
assert.match(source, /id: playerSelector[\s\S]*?visible: root\.canCyclePlayer[\s\S]*?root\.cyclePlayerRequested\(\)/,
  "multi-player selection remains an explicit Music-only action")
assert.match(source, /anchors.leftMargin: root.minimal \? \(parent.width - width\) \/ 2 : 6/, "secondary artwork remains centered")
assert.match(source, /id: compactIndicator\s+visible: !root.minimal/, "secondary artwork cannot overlap a playback indicator")
assert.match(source, /visible:\s*compactArtImage\.status !== Image\.Ready/, "compact art falls back after image errors")
assert.match(source, /visible:\s*expandedArtImage\.status !== Image\.Ready/, "expanded art falls back after image errors")
assert.match(source, /maskEnabled:\s*true[\s\S]*?maskSource:\s*compactArtMask/, "compact art is rounded by a retained mask")
assert.match(source, /maskEnabled:\s*true[\s\S]*?maskSource:\s*expandedArtMask/, "expanded art is rounded by a retained mask")
assert.match(source, /width:\s*44[\s\S]*?height:\s*44/, "transport actions have 44 px targets")
assert.match(source, /width:\s*24[\s\S]*?height:\s*24/, "transport glyphs are materially sized inside their targets")
assert.match(source, /running:\s*root\.interactive && !root\.reducedMotion && !root\.expanded && !root\.minimal && root\.media && root\.media\.playing/, "compact playback bars stop for outgoing, minimal and reduced-motion content")
assert.match(source, /running:\s*root\.interactive && !root\.reducedMotion && root\.expanded && root\.media && root\.media\.playing/, "expanded playback bars stop for outgoing and reduced-motion content")
assert.match(source, /activeFocusOnTab:\s*root\.canSeek[\s\S]*?Accessible\.role:\s*Accessible\.Slider/, "timeline has a focusable slider contract")
assert.doesNotMatch(source, /Accessible\.(value|minimumValue|maximumValue|stepSize)\s*:/, "slider range belongs to the Item, not nonexistent Accessible attached properties")
assert.match(source, /readonly property real maximumValue:/, "slider exposes its own accessible range")
assert.match(source, /Accessible\.onIncreaseAction:/, "assistive tools can seek using the same guarded route")
assert.doesNotMatch(source, /Accessible\.ignored:\s*!controlEnabled/, "disabled transport buttons remain discoverable to assistive tools")
assert.match(source, /enabled: control\.controlEnabled\s+Accessible\.role: Accessible\.Button/, "accessible buttons expose real disabled state independently of the pointer absorber")
assert.match(source, /root\.seekRequested\(root\.media\.trackToken/, "seek gestures retain the media track token")
assert.doesNotMatch(source, /album|AirPlay|footer/i, "media presentation omits duplicate metadata and fake player chrome")
console.log("media content renderer contracts passed")
