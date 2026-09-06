function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key)
}

function finite(value, fallback) {
  return typeof value === "number" && isFinite(value) ? value : fallback
}

function text(value) {
  return typeof value === "string" ? value : ""
}

function clamp(value, minimum, maximum) {
  if (maximum < minimum) return minimum
  return Math.max(minimum, Math.min(value, maximum))
}

function rectangle(x, y, width, height, radius) {
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
    radius: Math.max(0, Math.round(radius))
  }
}

function outlinePiece(x, y, width, height, topLeftRadius, topRightRadius, bottomRightRadius, bottomLeftRadius) {
  return {
    x: x,
    y: y,
    width: Math.max(0, width),
    height: Math.max(0, height),
    topLeftRadius: Math.max(0, topLeftRadius),
    topRightRadius: Math.max(0, topRightRadius),
    bottomRightRadius: Math.max(0, bottomRightRadius),
    bottomLeftRadius: Math.max(0, bottomLeftRadius)
  }
}

function shoulder(box, cutout, start, first, second, clockwise, radius) {
  return {
    box: box,
    cutout: cutout,
    start: start,
    first: first,
    second: second,
    clockwise: clockwise,
    radius: radius
  }
}

function svgNumber(value) {
  var number = finite(value, 0)
  return String(number === 0 ? 0 : number)
}

function svgPoint(point, bounds) {
  return svgNumber(point.x - bounds.x) + " " + svgNumber(point.y - bounds.y)
}

function svgLine(parts, point, bounds) {
  parts.push("L " + svgPoint(point, bounds))
}

function svgArc(parts, radius, clockwise, point, bounds) {
  if (radius <= 0.01) {
    svgLine(parts, point, bounds)
    return
  }
  parts.push("A " + svgNumber(radius) + " " + svgNumber(radius) + " 0 0 " + (clockwise ? "1" : "0") + " " + svgPoint(point, bounds))
}

function svgCubic(parts, first, second, point, bounds) {
  parts.push("C " + svgPoint(first, bounds) + " " + svgPoint(second, bounds) + " " + svgPoint(point, bounds))
}

function outlinePerimeter(body, shoulders, edge, bounds, connected) {
  var left = body.x
  var top = body.y
  var right = body.x + body.width
  var bottom = body.y + body.height
  var upper = shoulders[0]
  var lower = shoulders[1]
  var parts = ["M " + svgPoint({ x: left + body.topLeftRadius, y: top }, bounds)]

  if (!connected) {
    svgLine(parts, { x: right - body.topRightRadius, y: top }, bounds)
    svgArc(parts, body.topRightRadius, true, { x: right, y: top + body.topRightRadius }, bounds)
    svgLine(parts, { x: right, y: bottom - body.bottomRightRadius }, bounds)
    svgArc(parts, body.bottomRightRadius, true, { x: right - body.bottomRightRadius, y: bottom }, bounds)
    svgLine(parts, { x: left + body.bottomLeftRadius, y: bottom }, bounds)
    svgArc(parts, body.bottomLeftRadius, true, { x: left, y: bottom - body.bottomLeftRadius }, bounds)
    svgLine(parts, { x: left, y: top + body.topLeftRadius }, bounds)
    svgArc(parts, body.topLeftRadius, true, { x: left + body.topLeftRadius, y: top }, bounds)
    parts.push("Z")
    return parts.join(" ")
  }

  if (edge === "top") {
    svgLine(parts, { x: right - body.topRightRadius, y: top }, bounds)
    svgArc(parts, body.topRightRadius, true, { x: right, y: top + body.topRightRadius }, bounds)
    svgLine(parts, lower.first, bounds)
    svgLine(parts, lower.start, bounds)
    svgArc(parts, lower.radius, !lower.clockwise, lower.second, bounds)
    svgLine(parts, { x: right, y: bottom - body.bottomRightRadius }, bounds)
    svgArc(parts, body.bottomRightRadius, true, { x: right - body.bottomRightRadius, y: bottom }, bounds)
    svgLine(parts, { x: left + body.bottomLeftRadius, y: bottom }, bounds)
    svgArc(parts, body.bottomLeftRadius, true, { x: left, y: bottom - body.bottomLeftRadius }, bounds)
    svgLine(parts, upper.second, bounds)
    svgArc(parts, upper.radius, upper.clockwise, upper.start, bounds)
    svgLine(parts, upper.first, bounds)
    svgLine(parts, { x: left, y: top + body.topLeftRadius }, bounds)
    svgArc(parts, body.topLeftRadius, true, { x: left + body.topLeftRadius, y: top }, bounds)
  } else if (edge === "bottom") {
    svgLine(parts, { x: right - body.topRightRadius, y: top }, bounds)
    svgArc(parts, body.topRightRadius, true, { x: right, y: top + body.topRightRadius }, bounds)
    svgLine(parts, lower.second, bounds)
    svgArc(parts, lower.radius, lower.clockwise, lower.start, bounds)
    svgLine(parts, lower.first, bounds)
    svgLine(parts, { x: right, y: bottom - body.bottomRightRadius }, bounds)
    svgArc(parts, body.bottomRightRadius, true, { x: right - body.bottomRightRadius, y: bottom }, bounds)
    svgLine(parts, { x: left + body.bottomLeftRadius, y: bottom }, bounds)
    svgArc(parts, body.bottomLeftRadius, true, { x: left, y: bottom - body.bottomLeftRadius }, bounds)
    svgLine(parts, upper.first, bounds)
    svgLine(parts, upper.start, bounds)
    svgArc(parts, upper.radius, !upper.clockwise, upper.second, bounds)
    svgLine(parts, { x: left, y: top + body.topLeftRadius }, bounds)
    svgArc(parts, body.topLeftRadius, true, { x: left + body.topLeftRadius, y: top }, bounds)
  } else if (edge === "left") {
    svgLine(parts, upper.first, bounds)
    svgLine(parts, upper.start, bounds)
    svgArc(parts, upper.radius, !upper.clockwise, upper.second, bounds)
    svgLine(parts, { x: right - body.topRightRadius, y: top }, bounds)
    svgArc(parts, body.topRightRadius, true, { x: right, y: top + body.topRightRadius }, bounds)
    svgLine(parts, { x: right, y: bottom - body.bottomRightRadius }, bounds)
    svgArc(parts, body.bottomRightRadius, true, { x: right - body.bottomRightRadius, y: bottom }, bounds)
    svgLine(parts, lower.second, bounds)
    svgArc(parts, lower.radius, lower.clockwise, lower.start, bounds)
    svgLine(parts, lower.first, bounds)
    svgLine(parts, { x: left + body.bottomLeftRadius, y: bottom }, bounds)
    svgArc(parts, body.bottomLeftRadius, true, { x: left, y: bottom - body.bottomLeftRadius }, bounds)
    svgLine(parts, { x: left, y: top + body.topLeftRadius }, bounds)
    svgArc(parts, body.topLeftRadius, true, { x: left + body.topLeftRadius, y: top }, bounds)
  } else {
    svgLine(parts, upper.second, bounds)
    svgArc(parts, upper.radius, upper.clockwise, upper.start, bounds)
    svgLine(parts, upper.first, bounds)
    svgLine(parts, { x: right - body.topRightRadius, y: top }, bounds)
    svgArc(parts, body.topRightRadius, true, { x: right, y: top + body.topRightRadius }, bounds)
    svgLine(parts, { x: right, y: bottom - body.bottomRightRadius }, bounds)
    svgArc(parts, body.bottomRightRadius, true, { x: right - body.bottomRightRadius, y: bottom }, bounds)
    svgLine(parts, lower.first, bounds)
    svgLine(parts, lower.start, bounds)
    svgArc(parts, lower.radius, !lower.clockwise, lower.second, bounds)
    svgLine(parts, { x: left + body.bottomLeftRadius, y: bottom }, bounds)
    svgArc(parts, body.bottomLeftRadius, true, { x: left, y: bottom - body.bottomLeftRadius }, bounds)
    svgLine(parts, { x: left, y: top + body.topLeftRadius }, bounds)
    svgArc(parts, body.topLeftRadius, true, { x: left + body.topLeftRadius, y: top }, bounds)
  }
  parts.push("Z")
  return parts.join(" ")
}

function blend(left, right, amount) {
  return left + (right - left) * amount
}

function surfaceContent(activity, key, expanded) {
  if (!activity) return null
  var compact = activity.compact || activity.minimal || {}
  var regions = activity.expanded || {}
  var media = activity.media || null
  return {
    key: key || "",
    revision: typeof activity.revision === "number" ? activity.revision : 0,
    media: media,
    actions: Array.isArray(activity.actions) ? activity.actions.map(action) : [],
    icon: text(compact.icon),
    label: text(compact.label),
    value: text(compact.value),
    progress: typeof compact.progress === "number" ? clamp(compact.progress, 0, 1) : null,
    expanded: expanded ? {
      leading: surface(regions.leading, compact),
      center: surface(regions.center, compact),
      trailing: surface(regions.trailing, {}),
      bottom: surface(regions.bottom, {}),
      actions: Array.isArray(activity.actions) ? activity.actions.map(action) : []
    } : null
  }
}

function surface(value, fallback) {
  var source = value || fallback || {}
  return {
    icon: text(source.icon),
    label: text(source.label),
    value: text(source.value),
    progress: typeof source.progress === "number" ? clamp(source.progress, 0, 1) : null
  }
}

function action(value) {
  return {
    id: text(value && value.id),
    label: text(value && value.label),
    role: value && value.role === "primary" ? "primary" : "secondary",
    enabled: !value || value.enabled !== false
  }
}

function visibleOnScreen(activity, screenName, focusedScreen) {
  if (!activity || !activity.target) return false
  if (activity.target.mode === "all") return true
  if (activity.target.mode === "focused") return screenName !== "" && screenName === focusedScreen
  return activity.target.mode === "screen" && screenName === String(activity.target.screen || "")
}

function availableOnScreen(activity, screenName, focusedScreen, nowMs, selection) {
  return visibleOnScreen(activity, screenName, focusedScreen) && typeof selection === "function"
    && selection({ candidate: activity }, screenName, nowMs).primaryKey === "candidate"
}

function screenMetrics(raw) {
  var source = raw || {}
  var screen = source.screen || {}
  var anchor = source.anchor || {}
  var bar = source.bar || {}
  var pairWidths = source.compactPairWidths || {}
  var peekMeasurement = source.peekMeasurement || {}
  return {
    width: Math.max(0, finite(screen.width, 0)),
    height: Math.max(0, finite(screen.height, 0)),
    anchor: {
      x: finite(anchor.x, 0),
      y: finite(anchor.y, 0),
      width: Math.max(0, finite(anchor.width, 0)),
      height: Math.max(0, finite(anchor.height, 0))
    },
    bar: {
      position: ["top", "bottom", "left", "right"].indexOf(bar.position) !== -1 ? bar.position : "top",
      size: Math.max(0, finite(bar.size, 0))
    },
    margin: Math.max(0, finite(source.margin, 8)),
    gap: Math.max(0, finite(source.gap, 6)),
    slotWidth: Math.max(80, finite(source.slotWidth, 250)),
    compactHeight: Math.max(12, finite(source.compactHeight, 22)),
    compactPairWidths: {
      primary: Math.max(0, finite(pairWidths.primary, 0)),
      secondary: Math.max(0, finite(pairWidths.secondary, 0))
    },
    peekMeasurement: {
      key: text(peekMeasurement.key),
      width: Math.max(0, finite(peekMeasurement.width, 0)),
      height: Math.max(0, finite(peekMeasurement.height, 0))
    }
  }
}

function compactRectangle(metrics, width, minimal) {
  width = Math.min(width, metrics.width, metrics.anchor.width || width)
  var height = Math.min(metrics.height, metrics.compactHeight, Math.max(1, metrics.anchor.height || metrics.compactHeight))
  var x = metrics.anchor.x + (metrics.anchor.width - width) / 2
  var y = metrics.anchor.y + (metrics.anchor.height - height) / 2
  var limitX = Math.max(0, metrics.width - width)
  var limitY = Math.max(0, metrics.height - height)
  return rectangle(clamp(x, 0, limitX), clamp(y, 0, limitY), width, height, minimal ? height / 2 : Math.min(height / 2, 11))
}

function pairedCompactGeometry(slot, gap, metrics) {
  var available = Math.max(0, slot.width - gap)
  var fallbackSecondary = Math.min(68, slot.width * 0.32)
  var fallbackPrimary = Math.max(0, available - fallbackSecondary)
  var measured = metrics.compactPairWidths || {}
  var primaryWidth = finite(measured.primary, 0) > 0 ? measured.primary : fallbackPrimary
  var secondaryWidth = finite(measured.secondary, 0) > 0 ? measured.secondary : fallbackSecondary
  var preferredTotal = primaryWidth + secondaryWidth
  if (preferredTotal > available && preferredTotal > 0) {
    var half = available / 2
    if (primaryWidth > half && secondaryWidth <= half) primaryWidth = available - secondaryWidth
    else if (secondaryWidth > half && primaryWidth <= half) secondaryWidth = available - primaryWidth
    else {
      primaryWidth = half
      secondaryWidth = available - half
    }
  }
  var groupWidth = primaryWidth + gap + secondaryWidth
  var groupX = slot.x + (slot.width - groupWidth) / 2
  var radius = Math.min(slot.height / 2, 11)
  var card = rectangle(groupX, slot.y, primaryWidth, slot.height, radius)
  var secondary = rectangle(groupX + primaryWidth + gap, slot.y, secondaryWidth, slot.height, radius)
  var slotRight = slot.x + slot.width
  if (card.x < slot.x) card.x = slot.x
  if (secondary.x + secondary.width > slotRight) secondary.width = Math.max(0, slotRight - secondary.x)
  if (secondary.x < card.x + card.width + gap) card.width = Math.max(0, secondary.x - card.x - gap)
  return {
    card: card,
    secondary: secondary
  }
}

function expandedRectangle(metrics, media) {
  var side = metrics.bar.position === "left" || metrics.bar.position === "right"
  var marginX = Math.min(metrics.margin, metrics.width / 2)
  var marginY = Math.min(metrics.margin, metrics.height / 2)
  var maxWidth = Math.max(0, metrics.width - marginX * 2 - (side ? metrics.bar.size + metrics.gap : 0))
  var maxHeight = Math.max(0, metrics.height - marginY * 2 - (!side ? metrics.bar.size + metrics.gap : 0))
  var width = Math.min(306, maxWidth)
  var height = Math.min(media ? 168 : 148, maxHeight)
  var x = metrics.anchor.x + metrics.anchor.width / 2 - width / 2
  var y = metrics.anchor.y + metrics.anchor.height / 2 - height / 2
  var compact = side ? verticalGeometryFor("compact", false, metrics).card : compactRectangle(metrics, metrics.slotWidth, false)
  if (metrics.bar.position === "top") y = compact.y
  if (metrics.bar.position === "bottom") y = metrics.height - (metrics.height - compact.y - compact.height) - height
  if (metrics.bar.position === "left") x = compact.x
  if (metrics.bar.position === "right") x = metrics.width - (metrics.width - compact.x - compact.width) - width
  var xMinimum = side ? 0 : marginX
  var xMaximum = side ? Math.max(0, metrics.width - width) : Math.max(marginX, metrics.width - width - marginX)
  var yMinimum = side ? marginY : 0
  var yMaximum = side ? Math.max(marginY, metrics.height - height - marginY) : Math.max(0, metrics.height - height)
  return rectangle(
    clamp(x, xMinimum, xMaximum),
    clamp(y, yMinimum, yMaximum),
    width,
    height,
    Math.min(28, Math.min(width, height) / 2)
  )
}

function tipPerimeter(body, edge, bounds, boundary, shoulderRadius, amount, attached) {
  var horizontal = edge === "top" || edge === "bottom"
  var span = horizontal ? body.width : body.height
  var depth = edge === "top" ? body.y + body.height - boundary
    : edge === "bottom" ? boundary - body.y
    : edge === "left" ? body.x + body.width - boundary : boundary - body.x
  var near = edge === "top" ? body.y - boundary
    : edge === "bottom" ? boundary - body.y - body.height
    : edge === "left" ? body.x - boundary : boundary - body.x - body.width
  var radius = Math.min(body.bottomLeftRadius, body.bottomRightRadius)
  if (edge === "bottom") radius = Math.min(body.topLeftRadius, body.topRightRadius)
  if (edge === "left") radius = Math.min(body.topRightRadius, body.bottomRightRadius)
  if (edge === "right") radius = Math.min(body.topLeftRadius, body.bottomLeftRadius)
  radius = Math.max(0, Math.min(radius, depth - shoulderRadius, span / 2))
  var nearRadius = attached ? 0 : radius * (1 - amount)
  var corner = 0.5522847498307936
  var distalStart = blend(depth - radius, shoulderRadius, amount)
  var distalControl = blend(depth - radius + corner * radius,
    shoulderRadius + (depth - shoulderRadius) * 0.55, amount)
  var distalEnd = blend(span - radius, span / 2, amount)
  var distalHandle = blend(span - radius + corner * radius, span * 0.59, amount)
  var crossScale = blend(1, Math.min(1, 18 / Math.max(1, span)), amount)
  function point(u, v) {
    u = span / 2 + (u - span / 2) * crossScale
    if (edge === "top") return { x: body.x + u, y: boundary + v }
    if (edge === "bottom") return { x: body.x + u, y: boundary - v }
    if (edge === "left") return { x: boundary + v, y: body.y + u }
    return { x: boundary - v, y: body.y + u }
  }
  var parts = ["M " + svgPoint(point(attached ? 0 : nearRadius, near), bounds)]
  svgLine(parts, point(span - nearRadius, near), bounds)
  if (attached) {
    svgLine(parts, point(span, 0), bounds)
    svgLine(parts, point(span + shoulderRadius, 0), bounds)
    svgCubic(parts, point(span + shoulderRadius * (1 - corner), 0),
      point(span, shoulderRadius * (1 - corner)), point(span, shoulderRadius), bounds)
  } else {
    svgCubic(parts, point(span - nearRadius + corner * nearRadius, near),
      point(span, near + nearRadius * (1 - corner)), point(span, near + nearRadius), bounds)
  }
  svgLine(parts, point(span, distalStart), bounds)
  svgCubic(parts, point(span, distalControl), point(distalHandle, depth), point(distalEnd, depth), bounds)
  svgLine(parts, point(span - distalEnd, depth), bounds)
  svgCubic(parts, point(span - distalHandle, depth), point(0, distalControl), point(0, distalStart), bounds)
  if (attached) {
    svgLine(parts, point(0, shoulderRadius), bounds)
    svgCubic(parts, point(0, shoulderRadius * (1 - corner)),
      point(-shoulderRadius * (1 - corner), 0), point(-shoulderRadius, 0), bounds)
    svgLine(parts, point(0, 0), bounds)
    svgLine(parts, point(0, near), bounds)
  } else {
    svgLine(parts, point(0, near + nearRadius), bounds)
    svgCubic(parts, point(0, near + nearRadius * (1 - corner)),
      point(nearRadius * (1 - corner), near), point(nearRadius, near), bounds)
  }
  parts.push("Z")
  return parts.join(" ")
}

function taperAmount(depth) {
  var progress = clamp(depth / 32, 0, 1)
  return 1 - progress * progress * (3 - 2 * progress)
}

function activityOutline(sampledRect, rawMetrics) {
  var metrics = screenMetrics(rawMetrics)
  var source = sampledRect || {}
  var body = {
    x: finite(source.x, 0),
    y: finite(source.y, 0),
    width: Math.max(0, finite(source.width, 0)),
    height: Math.max(0, finite(source.height, 0)),
    radius: Math.max(0, finite(source.radius, 0))
  }
  var edge = metrics.bar.position
  var horizontal = edge === "top" || edge === "bottom"
  var barBoundary = 0
  var outsideSpace = 0
  var bodySpace = 0
  if (edge === "top") {
    barBoundary = Math.min(metrics.height, metrics.bar.size)
    outsideSpace = Math.min(body.x, metrics.width - body.x - body.width)
    bodySpace = body.y + body.height - barBoundary
  } else if (edge === "bottom") {
    barBoundary = Math.max(0, metrics.height - metrics.bar.size)
    outsideSpace = Math.min(body.x, metrics.width - body.x - body.width)
    bodySpace = barBoundary - body.y
  } else if (edge === "left") {
    barBoundary = Math.min(metrics.width, metrics.bar.size)
    outsideSpace = Math.min(body.y, metrics.height - body.y - body.height)
    bodySpace = body.x + body.width - barBoundary
  } else {
    barBoundary = Math.max(0, metrics.width - metrics.bar.size)
    outsideSpace = Math.min(body.y, metrics.height - body.y - body.height)
    bodySpace = barBoundary - body.x
  }
  var exposedDepth = Math.max(0, bodySpace)
  var span = horizontal ? body.width : body.height
  var radius = Math.max(0, Math.min(18, outsideSpace, exposedDepth / 2, span / 2))
  var connected = radius > 0.01
  var taper = connected ? taperAmount(exposedDepth) : 0
  var bodyRadius = Math.min(body.radius, body.width / 2, body.height / 2,
    connected ? exposedDepth - radius : Math.max(body.width, body.height))
  var bodyPiece = outlinePiece(body.x, body.y, body.width, body.height,
    connected && (edge === "top" || edge === "left") ? 0 : bodyRadius,
    connected && (edge === "top" || edge === "right") ? 0 : bodyRadius,
    connected && (edge === "bottom" || edge === "right") ? 0 : bodyRadius,
    connected && (edge === "bottom" || edge === "left") ? 0 : bodyRadius)
  var shoulders = []
  var right = body.x + body.width
  var bottom = body.y + body.height
  if (connected && edge === "top") {
    shoulders.push(shoulder(
      { x: body.x - radius, y: barBoundary, width: radius, height: radius },
      { x: body.x - radius * 2, y: barBoundary, width: radius * 2, height: radius * 2 },
      { x: body.x - radius, y: barBoundary }, { x: body.x, y: barBoundary }, { x: body.x, y: barBoundary + radius }, false, radius))
    shoulders.push(shoulder(
      { x: right, y: barBoundary, width: radius, height: radius },
      { x: right, y: barBoundary, width: radius * 2, height: radius * 2 },
      { x: right + radius, y: barBoundary }, { x: right, y: barBoundary }, { x: right, y: barBoundary + radius }, true, radius))
  } else if (connected && edge === "bottom") {
    shoulders.push(shoulder(
      { x: body.x - radius, y: barBoundary - radius, width: radius, height: radius },
      { x: body.x - radius * 2, y: barBoundary - radius * 2, width: radius * 2, height: radius * 2 },
      { x: body.x - radius, y: barBoundary }, { x: body.x, y: barBoundary }, { x: body.x, y: barBoundary - radius }, true, radius))
    shoulders.push(shoulder(
      { x: right, y: barBoundary - radius, width: radius, height: radius },
      { x: right, y: barBoundary - radius * 2, width: radius * 2, height: radius * 2 },
      { x: right + radius, y: barBoundary }, { x: right, y: barBoundary }, { x: right, y: barBoundary - radius }, false, radius))
  } else if (connected && edge === "left") {
    shoulders.push(shoulder(
      { x: barBoundary, y: body.y - radius, width: radius, height: radius },
      { x: barBoundary, y: body.y - radius * 2, width: radius * 2, height: radius * 2 },
      { x: barBoundary, y: body.y - radius }, { x: barBoundary, y: body.y }, { x: barBoundary + radius, y: body.y }, true, radius))
    shoulders.push(shoulder(
      { x: barBoundary, y: bottom, width: radius, height: radius },
      { x: barBoundary, y: bottom, width: radius * 2, height: radius * 2 },
      { x: barBoundary, y: bottom + radius }, { x: barBoundary, y: bottom }, { x: barBoundary + radius, y: bottom }, false, radius))
  } else if (connected && edge === "right") {
    shoulders.push(shoulder(
      { x: barBoundary - radius, y: body.y - radius, width: radius, height: radius },
      { x: barBoundary - radius * 2, y: body.y - radius * 2, width: radius * 2, height: radius * 2 },
      { x: barBoundary, y: body.y - radius }, { x: barBoundary, y: body.y }, { x: barBoundary - radius, y: body.y }, false, radius))
    shoulders.push(shoulder(
      { x: barBoundary - radius, y: bottom, width: radius, height: radius },
      { x: barBoundary - radius * 2, y: bottom, width: radius * 2, height: radius * 2 },
      { x: barBoundary, y: bottom + radius }, { x: barBoundary, y: bottom }, { x: barBoundary - radius, y: bottom }, true, radius))
  }
  while (shoulders.length < 2) shoulders.push(shoulder(
    { x: body.x, y: body.y, width: 0, height: 0 },
    { x: body.x, y: body.y, width: 0, height: 0 },
    { x: body.x, y: body.y }, { x: body.x, y: body.y }, { x: body.x, y: body.y }, false, 0))
  var minimumX = body.x
  var minimumY = body.y
  var maximumX = right
  var maximumY = bottom
  for (var index = 0; index < shoulders.length; index++) {
    var box = shoulders[index].box
    minimumX = Math.min(minimumX, box.x)
    minimumY = Math.min(minimumY, box.y)
    maximumX = Math.max(maximumX, box.x + box.width)
    maximumY = Math.max(maximumY, box.y + box.height)
  }
  var bounds = { x: minimumX, y: minimumY, width: maximumX - minimumX, height: maximumY - minimumY }
  if (taper > 0) {
    var crossScale = blend(1, Math.min(1, 18 / Math.max(1, span)), taper)
    if (horizontal) {
      bounds.x = body.x + span / 2 + (bounds.x - body.x - span / 2) * crossScale
      bounds.width *= crossScale
    } else {
      bounds.y = body.y + span / 2 + (bounds.y - body.y - span / 2) * crossScale
      bounds.height *= crossScale
    }
  }
  return {
    bounds: bounds,
    body: bodyPiece,
    shoulders: shoulders,
    shoulderRadius: radius,
    taper: taper,
    contentSafe: taper === 0,
    perimeter: connected ? tipPerimeter(bodyPiece, edge, bounds, barBoundary, radius, taper, true)
      : outlinePerimeter(bodyPiece, shoulders, edge, bounds, false)
  }
}

function plainActivityOutline(sampledRect, taperEdge, taper) {
  var source = sampledRect || {}
  var body = outlinePiece(
    finite(source.x, 0), finite(source.y, 0),
    Math.max(0, finite(source.width, 0)), Math.max(0, finite(source.height, 0)),
    Math.max(0, Math.min(finite(source.radius, 0), finite(source.width, 0) / 2, finite(source.height, 0) / 2)),
    Math.max(0, Math.min(finite(source.radius, 0), finite(source.width, 0) / 2, finite(source.height, 0) / 2)),
    Math.max(0, Math.min(finite(source.radius, 0), finite(source.width, 0) / 2, finite(source.height, 0) / 2)),
    Math.max(0, Math.min(finite(source.radius, 0), finite(source.width, 0) / 2, finite(source.height, 0) / 2)))
  var emptyShoulder = shoulder(
    { x: body.x, y: body.y, width: 0, height: 0 },
    { x: body.x, y: body.y, width: 0, height: 0 },
    { x: body.x, y: body.y }, { x: body.x, y: body.y }, { x: body.x, y: body.y }, false, 0)
  var bounds = { x: body.x, y: body.y, width: body.width, height: body.height }
  var edge = taperEdge || "top"
  var amount = clamp(finite(taper, 0), 0, 1)
  var boundary = edge === "top" ? body.y : edge === "bottom" ? body.y + body.height
    : edge === "left" ? body.x : body.x + body.width
  if (taperEdge && amount > 0) {
    var horizontal = edge === "top" || edge === "bottom"
    var span = horizontal ? body.width : body.height
    var crossScale = blend(1, Math.min(1, 18 / Math.max(1, span)), amount)
    if (horizontal) {
      bounds.width *= crossScale
      bounds.x += (body.width - bounds.width) / 2
    } else {
      bounds.height *= crossScale
      bounds.y += (body.height - bounds.height) / 2
    }
  }
  return {
    bounds: bounds,
    body: body,
    shoulders: [emptyShoulder, emptyShoulder],
    shoulderRadius: 0,
    taper: amount,
    contentSafe: amount === 0,
    perimeter: taperEdge ? tipPerimeter(body, edge, bounds, boundary, 0, amount, false)
      : outlinePerimeter(body, [emptyShoulder, emptyShoulder], "top", bounds, false)
  }
}

function attachedPeekOutline(sampledPeekRect, rawMetrics) {
  var edge = screenMetrics(rawMetrics).bar.position
  var rect = sampledPeekRect || {}
  var depth = edge === "top" || edge === "bottom" ? finite(rect.height, 0) : finite(rect.width, 0)
  return plainActivityOutline(rect, edge, taperAmount(depth))
}

function visibleBodyRects(bodies, ignoreRetiring) {
  var source = Array.isArray(bodies) ? bodies : []
  var result = []
  for (var index = 0; index < source.length; index++) {
    var body = source[index]
    var rect = body && body.rect ? body.rect : null
    if (!body || body.visible !== true || (ignoreRetiring && body.role === "retiring") || !rect) continue
    var width = Math.max(0, finite(rect.width, 0))
    var height = Math.max(0, finite(rect.height, 0))
    if (width <= 0 || height <= 0) continue
    result.push({
      key: typeof body.key === "string" ? body.key : "",
      rect: {
        x: finite(rect.x, 0),
        y: finite(rect.y, 0),
        width: width,
        height: height,
        radius: Math.max(0, finite(rect.radius, 0))
      }
    })
  }
  return result
}

function combinedActivityOutline(bodies, rawMetrics) {
  var rects = visibleBodyRects(bodies, false)
  if (rects.length === 0) return activityOutline({ x: 0, y: 0, width: 0, height: 0, radius: 0 }, rawMetrics)
  var left = rects[0].rect.x
  var top = rects[0].rect.y
  var right = left + rects[0].rect.width
  var bottom = top + rects[0].rect.height
  var radius = rects[0].rect.radius
  for (var index = 1; index < rects.length; index++) {
    var rect = rects[index].rect
    left = Math.min(left, rect.x)
    top = Math.min(top, rect.y)
    right = Math.max(right, rect.x + rect.width)
    bottom = Math.max(bottom, rect.y + rect.height)
    radius = Math.max(radius, rect.radius)
  }
  return activityOutline({ x: left, y: top, width: right - left, height: bottom - top, radius: radius }, rawMetrics)
}

function rectDistanceSquared(rect, x, y) {
  var right = rect.x + rect.width
  var bottom = rect.y + rect.height
  var horizontal = x < rect.x ? rect.x - x : x > right ? x - right : 0
  var vertical = y < rect.y ? rect.y - y : y > bottom ? y - bottom : 0
  return horizontal * horizontal + vertical * vertical
}

function activityKeyAtPoint(bodies, x, y) {
  if (!isFinite(x) || !isFinite(y)) return null
  var rects = visibleBodyRects(bodies, true)
  var nearest = null
  var distance = Infinity
  for (var index = 0; index < rects.length; index++) {
    var body = rects[index]
    if (body.key === "") continue
    var nextDistance = rectDistanceSquared(body.rect, x, y)
    if (nextDistance === 0) return body.key
    if (nextDistance < distance) {
      nearest = body.key
      distance = nextDistance
    }
  }
  return nearest
}

function geometryFor(phase, hasSecondary, metrics, expandedMedia, pairedCompact) {
  var side = metrics.bar.position === "left" || metrics.bar.position === "right"
  if (side) return verticalGeometryFor(phase, hasSecondary, metrics, expandedMedia)
  var slot = compactRectangle(metrics, metrics.slotWidth, false)
  var primary = slot
  var secondary = null
  if (phase === "minimal") {
    primary = compactRectangle(metrics, Math.min(metrics.compactHeight, 22), true)
  } else if (phase === "expanded") {
    primary = expandedRectangle(metrics, expandedMedia)
  } else if (hasSecondary) {
    var gap = Math.min(metrics.gap, 8, slot.width / 6)
    if (pairedCompact === true) {
      var pair = pairedCompactGeometry(slot, gap, metrics)
      primary = pair.card
      secondary = pair.secondary
    } else {
      var bubble = Math.min(slot.height, 22, slot.width / 3)
      var primaryWidth = slot.width - bubble - gap
      primary = rectangle(slot.x, slot.y, primaryWidth, slot.height, Math.min(slot.height / 2, 11))
      secondary = rectangle(slot.x + primaryWidth + gap, slot.y, bubble, slot.height, bubble / 2)
    }
  }
  return { slot: slot, card: primary, secondary: secondary }
}

function verticalGeometryFor(phase, hasSecondary, metrics, expandedMedia) {
  var width = Math.min(metrics.width, metrics.compactHeight, Math.max(1, metrics.anchor.width || metrics.compactHeight))
  var slotHeight = Math.min(metrics.slotWidth, metrics.height, metrics.anchor.height || metrics.slotWidth)
  var slot = rectangle(
    clamp(metrics.anchor.x + (metrics.anchor.width - width) / 2, 0, Math.max(0, metrics.width - width)),
    clamp(metrics.anchor.y + (metrics.anchor.height - slotHeight) / 2, 0, Math.max(0, metrics.height - slotHeight)),
    width,
    slotHeight,
    width / 2
  )
  if (phase === "expanded") return { slot: slot, card: expandedRectangle(metrics, expandedMedia), secondary: null }
  var gap = hasSecondary ? Math.min(metrics.gap, 8, slot.height / 3) : 0
  var bubble = Math.min(width, metrics.compactHeight, (slot.height - gap) / (hasSecondary ? 2 : 1))
  var totalHeight = hasSecondary ? bubble * 2 + gap : bubble
  var top = slot.y + (slot.height - totalHeight) / 2
  var card = rectangle(slot.x, top, bubble, bubble, bubble / 2)
  var secondary = hasSecondary ? rectangle(slot.x, top + bubble + gap, bubble, bubble, bubble / 2) : null
  return { slot: slot, card: card, secondary: secondary }
}

function insetRange(total, size, margin) {
  var space = Math.max(0, total - size)
  var inset = Math.min(Math.max(0, margin), space / 2)
  return { minimum: inset, maximum: Math.max(inset, total - size - inset) }
}

function peekDimensions(content, metrics) {
  var measured = metrics.peekMeasurement || {}
  if (!content || measured.key !== content.key || measured.width < 1 || measured.height < 1) return null
  var widthInset = Math.min(Math.max(0, metrics.margin), metrics.width / 2)
  return {
    width: Math.max(0, Math.min(measured.width, metrics.width - widthInset * 2)),
    height: Math.max(0, Math.min(measured.height, metrics.height))
  }
}

function peekRectangle(metrics, size) {
  if (!size) return null
  var side = metrics.bar.position === "left" || metrics.bar.position === "right"
  var compact = side ? verticalGeometryFor("compact", false, metrics, false).card
    : compactRectangle(metrics, metrics.slotWidth, false)
  var width = Math.max(0, size.width)
  var height = Math.max(0, size.height)
  var x = compact.x + compact.width / 2 - width / 2
  var y = compact.y + compact.height / 2 - height / 2
  if (metrics.bar.position === "top") y = compact.y
  if (metrics.bar.position === "bottom") y = compact.y + compact.height - height
  if (metrics.bar.position === "left") x = compact.x
  if (metrics.bar.position === "right") x = compact.x + compact.width - width
  var xRange = insetRange(metrics.width, width, metrics.margin)
  var yRange = insetRange(metrics.height, height, metrics.margin)
  if (metrics.bar.position === "top" || metrics.bar.position === "bottom") x = clamp(x, xRange.minimum, xRange.maximum)
  else y = clamp(y, yRange.minimum, yRange.maximum)
  return rectangle(
    clamp(x, 0, Math.max(0, metrics.width - width)),
    clamp(y, 0, Math.max(0, metrics.height - height)),
    width,
    height,
    Math.min(24, width / 2, height / 2)
  )
}

function attachedPeekRectangle(mainRect, metrics, size) {
  if (!mainRect || !size) return null
  var edge = metrics.bar.position
  var gap = Math.max(4, Math.min(8, metrics.gap))
  var horizontal = edge === "top" || edge === "bottom"
  var width = Math.max(0, size.width)
  var height = Math.max(0, size.height)
  var x = mainRect.x + (mainRect.width - width) / 2
  var y = mainRect.y + (mainRect.height - height) / 2
  if (edge === "top") y = mainRect.y + mainRect.height + gap
  else if (edge === "bottom") y = mainRect.y - gap - height
  else if (edge === "left") x = mainRect.x + mainRect.width + gap
  else x = mainRect.x - gap - width
  var xRange = insetRange(metrics.width, width, metrics.margin)
  var yRange = insetRange(metrics.height, height, metrics.margin)
  if (horizontal) x = clamp(x, xRange.minimum, xRange.maximum)
  else y = clamp(y, yRange.minimum, yRange.maximum)
  if (width < 1 || height < 1 || x < 0 || y < 0 || x + width > metrics.width || y + height > metrics.height) return null
  return rectangle(x, y, width, height, Math.min(24, width / 2, height / 2))
}

function peekContent(active) {
  var candidate = active && active.candidate ? active.candidate : null
  if (!candidate || typeof candidate.id !== "string" || candidate.id === "") return null
  var summary = candidate.summary && typeof candidate.summary === "object" ? candidate.summary : {}
  return {
    key: candidate.id,
    revision: finite(candidate.sequence) ? candidate.sequence : 0,
    tool: text(candidate.tool),
    label: text(summary.label),
    value: text(summary.value),
    icon: text(summary.icon) || "◦",
    minimalValue: text(summary.icon) || "◦",
    compactText: text(summary.label),
    actions: [],
    media: null,
    expanded: null,
    hub: false,
    peek: true,
    peekCandidateId: candidate.id,
    peekEntityKey: text(candidate.entityKey)
  }
}

function projectPeekFrame(frame, active, screenName, rawMetrics) {
  var base = frame || {}
  var targetScreens = active && Array.isArray(active.targetScreens) ? active.targetScreens : []
  if (targetScreens.indexOf(screenName) < 0) return base
  var metrics = screenMetrics(rawMetrics)
  var content = peekContent(active)
  if (!content) return base
  if (base.phase === "expanded" && base.isOwner === true && base.geometry && base.geometry.card) {
    if (active.candidate && active.candidate.source === "media" && base.selected
        && base.selected.tool === "music"
        && (base.selected.key === active.candidate.entityKey || base.selected.key === "hub:music")) return base
  }
  var size = peekDimensions(content, metrics)
  if (!size) return base
  if (base.phase === "expanded" && base.isOwner === true && base.geometry && base.geometry.card) {
    var attached = attachedPeekRectangle(base.geometry.card, metrics, size)
    if (!attached) return base
    return Object.assign({}, base, {
      peek: { content: content, placement: "below", rect: attached, size: size, candidate: active.candidate }
    })
  }
  var closed = peekRectangle(metrics, size)
  if (!closed || closed.width < 1 || closed.height < 1) return base
  return {
    phase: "peek",
    alerting: false,
    primary: content,
    secondary: null,
    selected: null,
    expanded: null,
    isOwner: false,
    visible: true,
    geometry: { slot: closed, card: closed, secondary: null },
    titleCompactRect: null,
    sourceCapsuleRect: null,
    preflight: base.preflight || null,
    detailHeightBudget: finite(base.detailHeightBudget, 0),
    layoutReady: base.layoutReady === true,
    chooserOpen: base.chooserOpen === true,
    peek: { content: content, rect: closed, placement: "closed", size: size, candidate: active.candidate }
  }
}

function projectedSelection(activities, screenName, focusedScreen, nowMs, selection, excludedKey) {
  if (typeof selection !== "function") return { primaryKey: null, secondaryKey: null }
  var projected = {}
  var keys = Object.keys(activities || {})
  for (var i = 0; i < keys.length; i++) {
    var activity = activities[keys[i]]
    if (visibleOnScreen(activity, screenName, focusedScreen)) projected[keys[i]] = activity
  }
  return selection(projected, screenName, nowMs, excludedKey)
}

function frameFor(state, screenName, rawMetrics, selection) {
  var metrics = screenMetrics(rawMetrics)
  var presentation = state && state.presentation ? state.presentation : {}
  var activities = state && state.activitiesByKey ? state.activitiesByKey : {}
  var focusedScreen = text(rawMetrics && rawMetrics.focusedScreen)
  var nowMs = finite(rawMetrics && rawMetrics.nowMs, 0)
  var chosen = projectedSelection(activities, screenName, focusedScreen, nowMs, selection)
  if (presentation.phase === "alerting" && availableOnScreen(activities[presentation.primaryKey], screenName, focusedScreen, nowMs, selection)) {
    var underlying = projectedSelection(activities, screenName, focusedScreen, nowMs, selection, presentation.primaryKey)
    chosen = { primaryKey: presentation.primaryKey, secondaryKey: underlying.primaryKey }
  }
  var primaryActivity = activities[chosen.primaryKey]
  var secondaryActivity = activities[chosen.secondaryKey]
  var selectedActivity = activities[presentation.selectedKey]
  var primary = primaryActivity ? surfaceContent(primaryActivity, chosen.primaryKey, false) : null
  var secondary = secondaryActivity && chosen.secondaryKey !== chosen.primaryKey ? surfaceContent(secondaryActivity, chosen.secondaryKey, false) : null
  var selected = availableOnScreen(selectedActivity, screenName, presentation.ownerScreen || focusedScreen, nowMs, selection) ? surfaceContent(selectedActivity, presentation.selectedKey, true) : null
  var owner = presentation.phase === "expanded" && text(presentation.ownerScreen) === text(screenName)
  var phase = text(presentation.phase) || "idle"
  if (phase === "expanded" && !owner) {
    phase = primary ? "compact" : "idle"
    selected = null
    secondary = null
  }
  if (!primary && phase !== "expanded") phase = "idle"
  if (phase === "expanded" && !selected) phase = primary ? "compact" : "idle"
  if (phase !== "expanded" && phase !== "alerting" && primary) phase = primaryActivity.compact === null ? "minimal" : "compact"
  if (phase === "alerting" && presentation.primaryKey !== chosen.primaryKey) phase = primary ? (primaryActivity.compact === null ? "minimal" : "compact") : "idle"
  if (phase === "minimal" && !primary) phase = "idle"
  if (phase === "alerting" && !primary) phase = "idle"
  var expanded = phase === "expanded" ? selected && selected.expanded : null
  var hasSecondary = !!secondary && phase !== "minimal" && phase !== "expanded"
  var compactSourceGeometry = phase === "expanded"
    ? geometryFor("compact", !!secondary, metrics, false) : null
  var selectedWasSecondary = !!(compactSourceGeometry && compactSourceGeometry.secondary && selected && secondary
    && selected.key === secondary.key)
  var titleCompactRect = compactSourceGeometry
    ? selectedWasSecondary ? compactSourceGeometry.secondary : compactSourceGeometry.card : null
  var sourceCapsuleRect = compactSourceGeometry
    ? compactSourceGeometry.secondary ? compactSourceGeometry.slot : titleCompactRect : null
  return {
    phase: phase,
    alerting: phase === "alerting",
    primary: primary,
    secondary: hasSecondary ? secondary : null,
    selected: selected,
    expanded: expanded,
    isOwner: owner,
    visible: phase !== "idle",
    geometry: geometryFor(phase, hasSecondary, metrics, phase === "expanded" && !!(selectedActivity && selectedActivity.media)),
    titleCompactRect: titleCompactRect,
    sourceCapsuleRect: sourceCapsuleRect
  }
}

function titleEndpoint(rect, leftInset, rightInset) {
  var body = rectangle(rect.x, rect.y, rect.width, rect.height, rect.radius)
  var left = Math.min(leftInset, body.width)
  var right = Math.max(left, body.width - rightInset)
  return { body: body, left: body.x + left, right: body.x + right }
}

function mediaTitleIntent(content, role, compactRect, expandedRect, barPosition) {
  var media = content && content.media ? content.media : null
  var title = media && typeof media.title === "string" ? media.title : ""
  var horizontal = barPosition === "top" || barPosition === "bottom"
  var labelledSecondary = role !== "secondary" || !!(content && typeof content.compactText === "string" && content.compactText !== "")
  var present = !!media && title !== "" && horizontal && role !== "minimal" && labelledSecondary
  return {
    owned: !!media,
    identity: present ? { key: content.key, trackToken: String(media.trackToken || "") } : null,
    text: present ? title : "",
    artUrl: media && typeof media.artUrl === "string" ? media.artUrl : "",
    target: role === "expanded" ? "expanded" : "compact",
    compact: titleEndpoint(compactRect, 28, 26),
    expanded: titleEndpoint(expandedRect, 80, 74)
  }
}

function titleSample(sampledRect, title) {
  var compact = title && title.compact ? title.compact : null
  var expanded = title && title.expanded ? title.expanded : null
  if (!compact || !expanded || !compact.body || !expanded.body) return { progress: 0, x: 0, visualWidth: 0 }
  var current = sampledRect || {}
  var fields = ["x", "y", "width", "height"]
  var numerator = 0
  var denominator = 0
  for (var index = 0; index < fields.length; index++) {
    var name = fields[index]
    var start = finite(compact.body[name], 0)
    var delta = finite(expanded.body[name], start) - start
    numerator += (finite(current[name], start) - start) * delta
    denominator += delta * delta
  }
  var progress = denominator > 0.000001 ? Math.max(0, numerator / denominator) : title.target === "expanded" ? 1 : 0
  var left = blend(compact.left, expanded.left, progress)
  var right = blend(compact.right, expanded.right, progress)
  return { progress: progress, x: left, visualWidth: Math.max(0, right - left) }
}

function titleVelocity(rectVelocity, title) {
  var compact = title && title.compact ? title.compact : null
  var expanded = title && title.expanded ? title.expanded : null
  if (!compact || !expanded || !compact.body || !expanded.body) return 0
  var velocity = rectVelocity || {}
  var fields = ["x", "y", "width", "height"]
  var numerator = 0
  var denominator = 0
  for (var index = 0; index < fields.length; index++) {
    var name = fields[index]
    var start = finite(compact.body[name], 0)
    var delta = finite(expanded.body[name], start) - start
    numerator += finite(velocity[name], 0) * delta
    denominator += delta * delta
  }
  return denominator > 0.000001 ? numerator / denominator : 0
}

function motionBody(content, rect, role, sharedTitle, sourceRect, sourceCapsuleRect) {
  if (!content || !rect) return null
  return {
    key: content.key,
    revision: content.revision,
    content: content,
    expanded: role === "expanded",
    role: role,
    profile: role === "expanded" || role === "peek" ? "expansion" : "compact",
    rect: rect,
    sourceRect: sourceRect || rect,
    sourceCapsuleRect: sourceCapsuleRect || rect,
    sharedTitle: sharedTitle
  }
}

function motionIntentFor(frame, rawMetrics) {
  var metrics = screenMetrics(rawMetrics)
  var source = frame || {}
  var closedPeek = source.phase === "peek" && !!source.peek
  if (closedPeek) {
    var closedContent = source.peek.content
    var closedRect = source.peek.rect
    return {
      edge: metrics.bar.position,
      bounds: { width: metrics.width, height: metrics.height },
      alerting: false,
      capsule: closedRect ? { mode: "peek", profile: "expansion", rect: closedRect } : null,
      primary: null,
      secondary: null,
      peek: { content: closedContent, placement: "closed", rect: closedRect,
        size: source.peek.size || null, key: closedContent && closedContent.key }
    }
  }
  var expanded = source.phase === "expanded"
  var primary = expanded ? source.selected : source.primary
  var primaryRole = expanded ? "expanded" : source.phase === "minimal" || source.splitMinimal ? "minimal" : "primary"
  var compactGeometry = geometryFor("compact", false, metrics, false)
  var expandedGeometry = geometryFor("expanded", false, metrics, true)
  if (source.titleExpandedRect) expandedGeometry.card = source.titleExpandedRect
  var primaryCompactRect = expanded && source.titleCompactRect ? source.titleCompactRect
    : !expanded && source.geometry && source.geometry.card ? source.geometry.card : compactGeometry.card
  var secondaryCompactRect = !expanded && source.geometry && source.geometry.secondary ? source.geometry.secondary : primaryCompactRect
  var primaryRect = source.geometry && source.geometry.card
  var secondaryRect = source.geometry && source.geometry.secondary
  var compactPair = !expanded && !!source.secondary && !!secondaryRect
  var capsuleRect = expanded ? primaryRect : compactPair && source.geometry && source.geometry.slot
    ? source.geometry.slot : primaryRect
  return {
    edge: metrics.bar.position,
    bounds: { width: metrics.width, height: metrics.height },
    alerting: source.alerting === true,
    capsule: capsuleRect ? {
      mode: expanded ? "expanded" : compactPair ? "compactPair" : primaryRole,
      profile: expanded ? "expansion" : "compact",
      rect: capsuleRect
    } : null,
    primary: motionBody(primary, primaryRect, primaryRole,
      mediaTitleIntent(primary, primaryRole, primaryCompactRect, expandedGeometry.card, metrics.bar.position),
      primaryCompactRect, expanded && source.sourceCapsuleRect ? source.sourceCapsuleRect
        : source.geometry && source.geometry.slot ? source.geometry.slot : primaryCompactRect),
    secondary: expanded ? null : motionBody(source.secondary, secondaryRect, "secondary",
      mediaTitleIntent(source.secondary, "secondary", secondaryCompactRect, expandedGeometry.card, metrics.bar.position),
      secondaryCompactRect, source.geometry && source.geometry.slot ? source.geometry.slot : secondaryCompactRect),
    peek: source.peek && source.peek.content ? {
      content: source.peek.content,
      placement: source.peek.placement === "below" ? "below" : "closed",
      rect: source.peek.rect || null,
      size: source.peek.size || null,
      key: source.peek.content.key
    } : null
  }
}

if (typeof module !== "undefined") module.exports = { frameFor: frameFor, screenMetrics: screenMetrics, geometryFor: geometryFor, activityOutline: activityOutline, plainActivityOutline: plainActivityOutline, attachedPeekOutline: attachedPeekOutline, combinedActivityOutline: combinedActivityOutline, activityKeyAtPoint: activityKeyAtPoint, visibleOnScreen: visibleOnScreen, peekContent: peekContent, projectPeekFrame: projectPeekFrame, motionIntentFor: motionIntentFor, mediaTitleIntent: mediaTitleIntent, titleSample: titleSample, titleVelocity: titleVelocity }
