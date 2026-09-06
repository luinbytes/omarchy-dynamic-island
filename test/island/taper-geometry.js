const assert = require("node:assert/strict")
const View = require("../../shell/plugins/island/ViewModel.js")

function sample(edge, depth, span = 306) {
  const metrics = { screen: { width: 800, height: 800 }, bar: { position: edge, size: 26 },
    anchor: { x: 250, y: 2, width: 250, height: 22 }, slotWidth: 250 }
  const horizontal = edge === "top" || edge === "bottom"
  const rect = horizontal ? { x: 247, y: edge === "top" ? 2 : 774 - depth, width: span, height: depth + 24, radius: 24 }
    : { x: edge === "left" ? 2 : 774 - depth, y: 247, width: depth + 24, height: span, radius: 24 }
  return View.activityOutline(rect, metrics)
}

for (const edge of ["top", "bottom", "left", "right"]) {
  let lastSpan = Infinity
  let topology = null
  for (const depth of [68, 32, 24, 16, 10, 5, 2]) {
    const outline = sample(edge, depth)
    const span = edge === "top" || edge === "bottom" ? outline.bounds.width : outline.bounds.height
    assert.ok(span <= lastSpan, edge + " narrows its painted contour as it closes")
    lastSpan = span
    assert.equal(outline.contentSafe, depth >= 32)
    assert.ok(Number.isFinite(outline.taper))
    const commands = outline.perimeter.match(/[MLCZ]/g).join("")
    topology ||= commands
    assert.equal(commands, topology, edge + " retains path topology through the taper boundary")
    const values = outline.perimeter.match(/-?\d+(?:\.\d+)?/g).map(Number)
    for (let i = 0; i < values.length; i += 2) {
      assert.ok(values[i] >= -0.001 && values[i] <= outline.bounds.width + 0.001, edge + " keeps curve controls inside paint bounds")
      assert.ok(values[i + 1] >= -0.001 && values[i + 1] <= outline.bounds.height + 0.001, edge + " keeps curve controls inside paint bounds")
    }
  }
  assert.ok(lastSpan < 24, edge + " reaches a rounded tip instead of a full-width strip")
  const before = sample(edge, 32.001)
  const after = sample(edge, 31.999)
  assert.ok(Math.abs(before.bounds.width - after.bounds.width) < 0.01)
  assert.ok(Math.abs(before.bounds.height - after.bounds.height) < 0.01)
  assert.ok(sample(edge, 44, 83).shoulderRadius > 0, edge + " gives narrow peeks a bar connection")
}

console.log("rounded-tip bounds, continuity, and four-edge geometry passed")
