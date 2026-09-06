var PROFILES = {
  expansion: { omega: Math.PI * 2 / 0.32, zeta: 0.88 },
  collapse: { omega: Math.PI * 2 / 0.32, zeta: 0.88 },
  compact: { omega: 18, zeta: 1 },
  content: { omega: 10, zeta: 1 }
}

var PEEK_CONTENT_PROFILE = { omega: 50, zeta: 1 }
var PEEK_CONTENT_TRAVEL = 1

function finite(value, fallback) {
  return typeof value === "number" && isFinite(value) ? value : fallback
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value))
}

function blend(left, right, amount) {
  return left + (right - left) * amount
}

function copy(value) {
  if (Array.isArray(value)) return value.map(copy)
  if (value && typeof value === "object") {
    var result = {}
    var keys = Object.keys(value)
    for (var i = 0; i < keys.length; i++) result[keys[i]] = copy(value[keys[i]])
    return result
  }
  return value
}

function profile(name) {
  return PROFILES[name] || PROFILES.compact
}

function axis(value, target, selectedProfile) {
  var chosen = selectedProfile || PROFILES.compact
  return {
    value: finite(value, 0),
    velocity: 0,
    target: finite(target, 0),
    omega: chosen.omega,
    zeta: chosen.zeta
  }
}

function retargetAxis(source, target, selectedProfile) {
  var result = copy(source)
  var chosen = selectedProfile || PROFILES.compact
  result.target = finite(target, result.value)
  result.omega = chosen.omega
  result.zeta = chosen.zeta
  return result
}

function sampleSpring(value, velocity, target, omega, zeta, seconds) {
  var t = Math.max(0, finite(seconds, 0))
  var w = Math.max(0.001, finite(omega, PROFILES.compact.omega))
  var damping = Math.max(0, finite(zeta, PROFILES.compact.zeta))
  var x = finite(value, target)
  var v = finite(velocity, 0)
  var g = finite(target, x)
  if (t === 0) return { value: x, velocity: v }
  if (Math.abs(damping - 1) < 0.000001 || damping > 1) {
    var d = x - g
    var b = v + w * d
    var e = Math.exp(-w * t)
    return {
      value: g + (d + b * t) * e,
      velocity: (b - w * (d + b * t)) * e
    }
  }
  var wd = w * Math.sqrt(Math.max(0.000001, 1 - damping * damping))
  var displacement = x - g
  var blend = (v + damping * w * displacement) / wd
  var decay = Math.exp(-damping * w * t)
  var cosine = Math.cos(wd * t)
  var sine = Math.sin(wd * t)
  var inner = displacement * cosine + blend * sine
  return {
    value: g + decay * inner,
    velocity: decay * (-damping * w * inner + wd * (-displacement * sine + blend * cosine))
  }
}

function advanceAxis(source, seconds) {
  var sampled = sampleSpring(source.value, source.velocity, source.target, source.omega, source.zeta, seconds)
  return {
    value: sampled.value,
    velocity: sampled.velocity,
    target: source.target,
    omega: source.omega,
    zeta: source.zeta
  }
}

function settledAxis(source) {
  return Math.abs(source.value - source.target) < 0.02 && Math.abs(source.velocity) < 0.02
}

function makePose(rect, edge, bounds, selectedProfile) {
  var width = Math.max(0, finite(rect && rect.width, 0))
  var height = Math.max(0, finite(rect && rect.height, 0))
  var x = finite(rect && rect.x, 0)
  var y = finite(rect && rect.y, 0)
  var radius = Math.max(0, finite(rect && rect.radius, 0))
  var horizontal = edge === "top" || edge === "bottom"
  var cross = horizontal ? x + width / 2 : y + height / 2
  var near = 0
  if (edge === "top") near = y
  else if (edge === "bottom") near = bounds.height - y - height
  else if (edge === "left") near = x
  else near = bounds.width - x - width
  return {
    cross: axis(cross, cross, selectedProfile),
    near: axis(near, near, selectedProfile),
    span: axis(horizontal ? width : height, horizontal ? width : height, selectedProfile),
    depth: axis(horizontal ? height : width, horizontal ? height : width, selectedProfile),
    radius: axis(radius, radius, selectedProfile)
  }
}

function poseValues(pose) {
  return {
    cross: pose.cross.value,
    near: pose.near.value,
    span: pose.span.value,
    depth: pose.depth.value,
    radius: pose.radius.value
  }
}

function targetValues(pose) {
  return {
    cross: pose.cross.target,
    near: pose.near.target,
    span: pose.span.target,
    depth: pose.depth.target,
    radius: pose.radius.target
  }
}

function rectForPose(pose, edge, bounds) {
  var value = poseValues(pose)
  var span = Math.max(0, value.span)
  var depth = Math.max(0, value.depth)
  var radius = Math.max(0, Math.min(value.radius, span / 2, depth / 2))
  if (edge === "top") return { x: value.cross - span / 2, y: value.near, width: span, height: depth, radius: radius }
  if (edge === "bottom") return { x: value.cross - span / 2, y: bounds.height - value.near - depth, width: span, height: depth, radius: radius }
  if (edge === "left") return { x: value.near, y: value.cross - span / 2, width: depth, height: span, radius: radius }
  return { x: bounds.width - value.near - depth, y: value.cross - span / 2, width: depth, height: span, radius: radius }
}

function rectFits(rect, bounds) {
  return rect.x >= -0.01 && rect.y >= -0.01 && rect.x + rect.width <= bounds.width + 0.01 && rect.y + rect.height <= bounds.height + 0.01
}

function clampRect(rect, bounds) {
  var width = Math.min(Math.max(0, rect.width), bounds.width)
  var height = Math.min(Math.max(0, rect.height), bounds.height)
  return {
    x: clamp(rect.x, 0, Math.max(0, bounds.width - width)),
    y: clamp(rect.y, 0, Math.max(0, bounds.height - height)),
    width: width,
    height: height,
    radius: Math.min(rect.radius, width / 2, height / 2)
  }
}

function copyRect(rect) {
  return {
    x: finite(rect && rect.x, 0),
    y: finite(rect && rect.y, 0),
    width: Math.max(0, finite(rect && rect.width, 0)),
    height: Math.max(0, finite(rect && rect.height, 0)),
    radius: Math.max(0, finite(rect && rect.radius, 0))
  }
}

function rectProgress(current, start, target) {
  var fields = ["x", "y", "width", "height", "radius"]
  var numerator = 0
  var denominator = 0
  for (var index = 0; index < fields.length; index++) {
    var name = fields[index]
    var initial = finite(start && start[name], 0)
    var delta = finite(target && target[name], initial) - initial
    numerator += (finite(current && current[name], initial) - initial) * delta
    denominator += delta * delta
  }
  return denominator > 0.000001 ? clamp(numerator / denominator, 0, 1) : 1
}

function blendRect(start, target, amount) {
  return {
    x: blend(finite(start && start.x, 0), finite(target && target.x, 0), amount),
    y: blend(finite(start && start.y, 0), finite(target && target.y, 0), amount),
    width: blend(finite(start && start.width, 0), finite(target && target.width, 0), amount),
    height: blend(finite(start && start.height, 0), finite(target && target.height, 0), amount),
    radius: blend(finite(start && start.radius, 0), finite(target && target.radius, 0), amount)
  }
}

function interpolatePose(start, end, amount) {
  return {
    cross: start.cross + (end.cross - start.cross) * amount,
    near: start.near + (end.near - start.near) * amount,
    span: start.span + (end.span - start.span) * amount,
    depth: start.depth + (end.depth - start.depth) * amount,
    radius: start.radius + (end.radius - start.radius) * amount
  }
}

function poseAt(body, target, edge, bounds, selectedProfile, seconds) {
  var positionProfile = PROFILES.collapse
  var current = body.pose
  return {
    cross: sampleSpring(current.cross.value, current.cross.velocity, target.cross, positionProfile.omega, positionProfile.zeta, seconds),
    near: sampleSpring(current.near.value, current.near.velocity, target.near, positionProfile.omega, positionProfile.zeta, seconds),
    span: sampleSpring(current.span.value, current.span.velocity, target.span, selectedProfile.omega, selectedProfile.zeta, seconds),
    depth: sampleSpring(current.depth.value, current.depth.velocity, target.depth, selectedProfile.omega, selectedProfile.zeta, seconds),
    radius: sampleSpring(current.radius.value, current.radius.velocity, target.radius, selectedProfile.omega, selectedProfile.zeta, seconds)
  }
}

function rectForSample(sample, edge, bounds) {
  return rectForPose({
    cross: { value: sample.cross.value },
    near: { value: sample.near.value },
    span: { value: sample.span.value },
    depth: { value: sample.depth.value },
    radius: { value: sample.radius.value }
  }, edge, bounds)
}

function pathFits(body, target, edge, bounds, selectedProfile) {
  for (var index = 0; index <= 480; index++) {
    var seconds = index / 240
    if (!rectFits(rectForSample(poseAt(body, target, edge, bounds, selectedProfile, seconds), edge, bounds), bounds)) return false
  }
  return true
}

function fitTarget(body, desired, edge, bounds, selectedProfile) {
  var start = poseValues(body.pose)
  if (pathFits(body, desired, edge, bounds, selectedProfile)) return desired
  if (!pathFits(body, start, edge, bounds, selectedProfile)) return start
  var low = 0
  var high = 1
  for (var index = 0; index < 18; index++) {
    var middle = (low + high) / 2
    var candidate = interpolatePose(start, desired, middle)
    if (pathFits(body, candidate, edge, bounds, selectedProfile)) low = middle
    else high = middle
  }
  return interpolatePose(start, desired, low)
}

function sameAxisTarget(source, target, selectedProfile) {
  return Math.abs(source.target - target) < 0.001 && source.omega === selectedProfile.omega && source.zeta === selectedProfile.zeta
}

function samePoseTarget(pose, target, selectedProfile) {
  return sameAxisTarget(pose.cross, target.cross, PROFILES.collapse)
    && sameAxisTarget(pose.near, target.near, PROFILES.collapse)
    && sameAxisTarget(pose.span, target.span, selectedProfile)
    && sameAxisTarget(pose.depth, target.depth, selectedProfile)
    && sameAxisTarget(pose.radius, target.radius, selectedProfile)
}

function rectVelocityForPose(pose, edge) {
  var cross = pose.cross.velocity
  var near = pose.near.velocity
  var span = pose.span.velocity
  var depth = pose.depth.velocity
  if (edge === "top") return { x: cross - span / 2, y: near, width: span, height: depth }
  if (edge === "bottom") return { x: cross - span / 2, y: -near - depth, width: span, height: depth }
  if (edge === "left") return { x: near, y: cross - span / 2, width: depth, height: span }
  return { x: -near - depth, y: cross - span / 2, width: depth, height: span }
}

function poseWithVelocity(rect, velocity, edge, bounds) {
  var result = makePose(rect, edge, bounds, PROFILES.compact)
  if (edge === "top") {
    result.cross.velocity = velocity.x + velocity.width / 2
    result.near.velocity = velocity.y
    result.span.velocity = velocity.width
    result.depth.velocity = velocity.height
  } else if (edge === "bottom") {
    result.cross.velocity = velocity.x + velocity.width / 2
    result.near.velocity = -velocity.y - velocity.height
    result.span.velocity = velocity.width
    result.depth.velocity = velocity.height
  } else if (edge === "left") {
    result.cross.velocity = velocity.y + velocity.height / 2
    result.near.velocity = velocity.x
    result.span.velocity = velocity.height
    result.depth.velocity = velocity.width
  } else {
    result.cross.velocity = velocity.y + velocity.height / 2
    result.near.velocity = -velocity.x - velocity.width
    result.span.velocity = velocity.height
    result.depth.velocity = velocity.width
  }
  return result
}

function rebaseBody(body, oldEdge, oldBounds, nextEdge, nextBounds) {
  if (!body.key || !body.pose) return
  if (oldEdge === nextEdge && oldBounds.width === nextBounds.width && oldBounds.height === nextBounds.height) return
  var currentRect = rectForPose(body.pose, oldEdge, oldBounds)
  var currentVelocity = rectVelocityForPose(body.pose, oldEdge)
  var converted = poseWithVelocity(currentRect, currentVelocity, nextEdge, nextBounds)
  var boundedRect = clampRect(currentRect, nextBounds)
  var bounded = poseWithVelocity(boundedRect, currentVelocity, nextEdge, nextBounds)
  bounded.radius.velocity = body.pose.radius.velocity
  var axes = ["cross", "near", "span", "depth", "radius"]
  for (var index = 0; index < axes.length; index++) {
    var name = axes[index]
    bounded[name].omega = body.pose[name].omega
    bounded[name].zeta = body.pose[name].zeta
    if (Math.abs(converted[name].value - bounded[name].value) > 0.01) bounded[name].velocity = 0
  }
  body.pose = bounded
  body.lastCompact = null
  var target = poseValues(bounded)
  var velocityOrder = ["span", "depth", "cross", "near"]
  for (var velocityIndex = 0; velocityIndex < velocityOrder.length; velocityIndex++) {
    if (pathFits(body, target, nextEdge, nextBounds, PROFILES.expansion)) break
    body.pose[velocityOrder[velocityIndex]].velocity = 0
  }
}

function rebaseCapsule(capsule, oldEdge, oldBounds, nextEdge, nextBounds) {
  if (!capsule || !capsule.pose) return
  if (oldEdge === nextEdge && oldBounds.width === nextBounds.width && oldBounds.height === nextBounds.height) return
  var currentRect = rectForPose(capsule.pose, oldEdge, oldBounds)
  var currentVelocity = rectVelocityForPose(capsule.pose, oldEdge)
  var converted = poseWithVelocity(currentRect, currentVelocity, nextEdge, nextBounds)
  var boundedRect = clampRect(currentRect, nextBounds)
  var bounded = poseWithVelocity(boundedRect, currentVelocity, nextEdge, nextBounds)
  bounded.radius.velocity = capsule.pose.radius.velocity
  var axes = ["cross", "near", "span", "depth", "radius"]
  for (var index = 0; index < axes.length; index++) {
    var name = axes[index]
    bounded[name].omega = capsule.pose[name].omega
    bounded[name].zeta = capsule.pose[name].zeta
    if (Math.abs(converted[name].value - bounded[name].value) > 0.01) bounded[name].velocity = 0
  }
  capsule.pose = bounded
}

function createCapsule() {
  return {
    pose: null,
    mode: "idle",
    transition: null
  }
}

function createPeek() {
  return {
    content: null,
    contentKey: "",
    contentRect: null,
    contentSize: null,
    pendingContent: null,
    pendingKey: "",
    pendingRect: null,
    pendingSize: null,
    contentPhase: "steady",
    contentOffset: axis(0, 0, PEEK_CONTENT_PROFILE),
    key: "",
    placement: "closed",
    placementTransition: null,
    width: axis(0, 0, PROFILES.expansion),
    height: axis(0, 0, PROFILES.expansion),
    present: false,
    reveal: axis(0, 0, PROFILES.expansion)
  }
}

function peekSize(raw, fallbackRect) {
  var source = raw && raw.size ? raw.size : {}
  var rect = fallbackRect || (raw && raw.rect) || {}
  return {
    width: Math.max(0, finite(source.width, finite(rect.width, 0))),
    height: Math.max(0, finite(source.height, finite(rect.height, 0)))
  }
}

function setPeekSize(peek, size, reducedMotion, initial) {
  var target = size || { width: 0, height: 0 }
  if (initial || !peek.width || !peek.height) {
    peek.width = axis(target.width, target.width, PROFILES.expansion)
    peek.height = axis(target.height, target.height, PROFILES.expansion)
    return
  }
  peek.width = retargetAxis(peek.width, target.width, PROFILES.expansion)
  peek.height = retargetAxis(peek.height, target.height, PROFILES.expansion)
  if (reducedMotion) {
    peek.width.value = peek.width.target
    peek.width.velocity = 0
    peek.height.value = peek.height.target
    peek.height.velocity = 0
  }
}

function clearPeekContent(peek) {
  peek.content = null
  peek.contentKey = ""
  peek.contentRect = null
  peek.contentSize = null
  peek.pendingContent = null
  peek.pendingKey = ""
  peek.pendingRect = null
  peek.pendingSize = null
  peek.contentPhase = "steady"
  peek.contentOffset = axis(0, 0, PEEK_CONTENT_PROFILE)
  peek.placementTransition = null
  peek.width = axis(0, 0, PROFILES.expansion)
  peek.height = axis(0, 0, PROFILES.expansion)
}

function setPeekContent(peek, content, key, rect, size, reducedMotion) {
  if (!peek.content) {
    peek.content = content
    peek.contentKey = key
    peek.contentRect = rect ? copyRect(rect) : null
    peek.contentSize = copy(size)
    peek.pendingContent = null
    peek.pendingKey = ""
    peek.pendingRect = null
    peek.pendingSize = null
    peek.contentPhase = "steady"
    peek.contentOffset = axis(0, 0, PEEK_CONTENT_PROFILE)
    setPeekSize(peek, size, reducedMotion, true)
    return
  }
  if (reducedMotion) {
    peek.content = content
    peek.contentKey = key
    peek.contentRect = rect ? copyRect(rect) : null
    peek.contentSize = copy(size)
    peek.pendingContent = null
    peek.pendingKey = ""
    peek.pendingRect = null
    peek.pendingSize = null
    peek.contentPhase = "steady"
    peek.contentOffset = axis(0, 0, PEEK_CONTENT_PROFILE)
    setPeekSize(peek, size, true)
    return
  }
  if (peek.contentKey === key) {
    peek.content = content
    peek.contentRect = rect ? copyRect(rect) : null
    peek.contentSize = copy(size)
    setPeekSize(peek, size, false)
    if (peek.pendingContent) {
      peek.pendingContent = null
      peek.pendingKey = ""
      peek.pendingRect = null
      peek.pendingSize = null
      peek.contentPhase = "entering"
      peek.contentOffset = retargetAxis(peek.contentOffset, 0, PEEK_CONTENT_PROFILE)
    }
    return
  }
  if (peek.pendingContent && peek.pendingKey === key) {
    peek.pendingContent = content
    peek.pendingRect = rect ? copyRect(rect) : null
    peek.pendingSize = copy(size)
    return
  }
  peek.pendingContent = content
  peek.pendingKey = key
  peek.pendingRect = rect ? copyRect(rect) : null
  peek.pendingSize = copy(size)
  peek.contentPhase = "exiting"
  peek.contentOffset = retargetAxis(peek.contentOffset, -PEEK_CONTENT_TRAVEL, PEEK_CONTENT_PROFILE)
}

function setPeekTarget(peek, desired, capsuleRect, edge, bounds, capsuleSampleProgress, reducedMotion) {
  if (!desired || !desired.content) {
    if (!peek.content) return
    if (reducedMotion) {
      clearPeekContent(peek)
      peek.key = ""
      peek.placement = "closed"
      peek.placementTransition = null
      peek.present = false
      peek.reveal = axis(0, 0, PROFILES.expansion)
      return
    }
    peek.pendingContent = null
    peek.pendingKey = ""
    peek.pendingRect = null
    peek.pendingSize = null
    peek.contentPhase = "steady"
    peek.contentOffset = retargetAxis(peek.contentOffset, 0, PEEK_CONTENT_PROFILE)
    peek.present = false
    peek.reveal = retargetAxis(peek.reveal, 0, PROFILES.expansion)
    return
  }
  var nextKey = typeof desired.key === "string" && desired.key !== "" ? desired.key
    : typeof desired.content.key === "string" ? desired.content.key : ""
  var nextPlacement = desired.placement === "below" ? "below" : "closed"
  var nextRect = desired.rect ? copyRect(desired.rect) : null
  var nextSize = peekSize(desired, nextRect)
  var changed = peek.key !== nextKey || peek.placement !== nextPlacement
  var placementChanged = peek.placement !== nextPlacement
  if (reducedMotion) peek.placementTransition = null
  else if (placementChanged && peek.content && peek.contentKey === nextKey) {
    var sourceRect = sampledPeekRect(peek, capsuleRect, edge, bounds, capsuleSampleProgress)
    peek.placementTransition = sourceRect ? { sourceRect: sourceRect } : null
  }
  peek.key = nextKey
  peek.placement = nextPlacement
  peek.present = true
  setPeekContent(peek, desired.content, nextKey, nextRect, nextSize, reducedMotion)
  peek.reveal = retargetAxis(peek.reveal, 1, PROFILES.expansion)
  if (reducedMotion) {
    peek.reveal.value = 1
    peek.reveal.velocity = 0
  } else if (changed && peek.reveal.value < 0.001 && peek.reveal.target < 0.001) {
    peek.reveal = axis(0, 1, PROFILES.expansion)
  }
}

function capsuleToken(desired) {
  var rect = desired && desired.rect ? desired.rect : {}
  return String(desired && desired.mode || "idle") + "|" + ["x", "y", "width", "height", "radius"].map(function(name) {
    return finite(rect[name], 0)
  }).join("|")
}

function setCapsuleTarget(capsule, desired, edge, bounds, reducedMotion) {
  if (!desired || !desired.rect) return
  var currentRect = capsule.pose ? rectForPose(capsule.pose, edge, bounds) : null
  var previousMode = capsule.mode
  var token = capsuleToken(desired)
  var sameTarget = !!capsule.transition && capsule.transition.token === token
  var outerProfile = desired.profile === "expansion" || previousMode === "expanded"
    ? PROFILES.expansion : profile(desired.profile)
  var targetPose = targetValues(makePose(desired.rect, edge, bounds, outerProfile))
  if (!capsule.pose) {
    capsule.pose = makePose(clampRect(desired.rect, bounds), edge, bounds, outerProfile)
  } else if (!sameTarget || reducedMotion) {
    var fitted = reducedMotion || samePoseTarget(capsule.pose, targetPose, outerProfile)
      ? targetPose : fitTarget(capsule, targetPose, edge, bounds, outerProfile)
    capsule.pose.cross = retargetAxis(capsule.pose.cross, fitted.cross, PROFILES.collapse)
    capsule.pose.near = retargetAxis(capsule.pose.near, fitted.near, PROFILES.collapse)
    capsule.pose.span = retargetAxis(capsule.pose.span, fitted.span, outerProfile)
    capsule.pose.depth = retargetAxis(capsule.pose.depth, fitted.depth, outerProfile)
    capsule.pose.radius = retargetAxis(capsule.pose.radius, fitted.radius, outerProfile)
  }
  if (!sameTarget) {
    capsule.transition = {
      token: token,
      fromMode: previousMode,
      sourceRect: currentRect ? copyRect(currentRect) : copyRect(desired.rect),
      targetRect: copyRect(desired.rect)
    }
  }
  capsule.mode = desired.mode || "idle"
  if (reducedMotion) {
    var axes = [capsule.pose.cross, capsule.pose.near, capsule.pose.span, capsule.pose.depth, capsule.pose.radius]
    for (var index = 0; index < axes.length; index++) {
      axes[index].value = axes[index].target
      axes[index].velocity = 0
    }
  }
}

function capsuleSettled(capsule) {
  if (!capsule || !capsule.pose) return true
  return [capsule.pose.cross, capsule.pose.near, capsule.pose.span, capsule.pose.depth, capsule.pose.radius].every(settledAxis)
}

function capsuleProgress(capsule, edge, bounds) {
  if (!capsule || !capsule.pose || !capsule.transition) return 1
  return rectProgress(rectForPose(capsule.pose, edge, bounds), capsule.transition.sourceRect, capsule.transition.targetRect)
}

function createBody(slot) {
  return {
    slot: slot,
    key: "",
    role: "absent",
    pose: null,
    incoming: null,
    outgoing: null,
    contentMix: axis(1, 1, PROFILES.content),
    contentDirection: 1,
    geometryMorph: null,
    lastCompact: null,
    sharedTitle: createSharedTitle()
  }
}

function initialState() {
  return {
    edge: "top",
    bounds: { width: 0, height: 0 },
    capsule: createCapsule(),
    bodies: [createBody(0), createBody(1)],
    peek: createPeek(),
    alerting: false,
    pulseSeconds: 0,
    mapped: false,
    unsettled: false
  }
}

function contentToken(desired) {
  var media = desired && desired.content ? desired.content.media : null
  var trackToken = media && typeof media.trackToken === "string" ? media.trackToken : ""
  return String(desired.key || "") + "|" + (desired.expanded ? "expanded" : "compact") + "|" + trackToken
}

function titleIdentity(value) {
  if (!value || typeof value.key !== "string" || value.key === "" || typeof value.trackToken !== "string" || value.trackToken === "") return null
  return { key: value.key, trackToken: value.trackToken }
}

function sameTitleIdentity(left, right) {
  return !!left && !!right && left.key === right.key && left.trackToken === right.trackToken
}

function titleIntent(desired) {
  var source = desired && desired.sharedTitle ? desired.sharedTitle : {}
  var identity = titleIdentity(source.identity)
  var media = desired && desired.content ? desired.content.media : null
  return {
    ownerWanted: source.owned === true,
    identity: identity,
    text: identity && typeof source.text === "string" ? source.text : "",
    artUrl: identity && typeof source.artUrl === "string" ? source.artUrl : "",
    subtitle: identity && media && typeof media.artist === "string" ? media.artist : "",
    target: source.target === "expanded" ? "expanded" : "compact",
    compact: source.compact ? copy(source.compact) : null,
    expanded: source.expanded ? copy(source.expanded) : null
  }
}

function createSharedTitle() {
  return {
    ownerWanted: false,
    identity: null,
    text: "",
    artUrl: "",
    subtitle: "",
    pending: null,
    compact: null,
    expanded: null,
    target: "compact",
    offset: axis(0, 0, PROFILES.content),
    crossfade: axis(1, 1, PROFILES.content),
    crossfading: false
  }
}

function replaceTitleLayout(state, intent) {
  state.ownerWanted = intent.ownerWanted
  state.compact = intent.compact
  state.expanded = intent.expanded
  state.target = intent.target
}

function retargetSharedTitle(body, desired, reducedMotion, metadataReplacement) {
  var intent = titleIntent(desired)
  var state = body.sharedTitle || createSharedTitle()
  replaceTitleLayout(state, intent)
  if (reducedMotion) {
    state.identity = intent.identity
    state.text = intent.text
    state.artUrl = intent.artUrl
    state.subtitle = intent.subtitle
    state.pending = null
    state.offset = axis(0, 0, PROFILES.content)
    state.crossfade = axis(1, 1, PROFILES.content)
    state.crossfading = false
    body.sharedTitle = state
    return
  }
  if (!intent.identity) {
    state.pending = null
    if (state.identity) state.offset = retargetAxis(state.offset, -32, PROFILES.content)
    else state.offset = axis(0, 0, PROFILES.content)
    state.crossfade = axis(1, 1, PROFILES.content)
    state.crossfading = false
    body.sharedTitle = state
    return
  }
  if (!state.identity) {
    state.identity = intent.identity
    state.text = intent.text
    state.artUrl = intent.artUrl
    state.subtitle = intent.subtitle
    state.pending = null
    state.offset = axis(32, 0, PROFILES.content)
    state.crossfade = axis(1, 1, PROFILES.content)
    state.crossfading = false
    body.sharedTitle = state
    return
  }
  if (state.pending && sameTitleIdentity(state.pending.identity, intent.identity)) {
    state.pending.text = intent.text
    state.pending.artUrl = intent.artUrl
    state.pending.subtitle = intent.subtitle
    body.sharedTitle = state
    return
  }
  if (sameTitleIdentity(state.identity, intent.identity)) {
    state.text = intent.text
    state.artUrl = intent.artUrl
    state.subtitle = intent.subtitle
    state.pending = null
    state.offset = retargetAxis(state.offset, 0, PROFILES.content)
    state.crossfade = axis(1, 1, PROFILES.content)
    state.crossfading = false
    body.sharedTitle = state
    return
  }
  state.pending = { identity: intent.identity, text: intent.text, artUrl: intent.artUrl, subtitle: intent.subtitle }
  if (metadataReplacement) {
    var retainedMix = state.crossfading ? clamp(state.crossfade.value, 0, 1) : 0
    state.offset = axis(0, 0, PROFILES.content)
    state.crossfade = axis(retainedMix, 1, PROFILES.content)
    state.crossfading = true
  } else {
    state.offset = retargetAxis(state.offset, -32, PROFILES.content)
    state.crossfade = axis(1, 1, PROFILES.content)
    state.crossfading = false
  }
  body.sharedTitle = state
}

function advanceSharedTitle(state, seconds) {
  if (!state) return createSharedTitle()
  if (!state.crossfade) state.crossfade = axis(1, 1, PROFILES.content)
  if (state.crossfading) {
    state.crossfade = advanceAxis(state.crossfade, seconds)
    if (state.crossfade.value < 0.995) return state
    if (state.pending) {
      state.identity = state.pending.identity
      state.text = state.pending.text
      state.artUrl = state.pending.artUrl
      state.subtitle = state.pending.subtitle
    }
    state.pending = null
    state.crossfade = axis(1, 1, PROFILES.content)
    state.crossfading = false
    return state
  }
  state.offset = advanceAxis(state.offset, seconds)
  if (state.offset.target !== -32 || state.offset.value > -31.98) return state
  if (state.pending) {
    state.identity = state.pending.identity
    state.text = state.pending.text
    state.artUrl = state.pending.artUrl
    state.subtitle = state.pending.subtitle
    state.pending = null
    state.offset = axis(32, 0, PROFILES.content)
    return state
  }
  state.identity = null
  state.text = ""
  state.artUrl = ""
  state.subtitle = ""
  return state
}

function renderSharedTitle(state, bodyKey, contentOwnsHeader) {
  var title = state || createSharedTitle()
  var identityMatchesBody = !title.identity || !bodyKey || title.identity.key === bodyKey
  var owned = !contentOwnsHeader && identityMatchesBody && (title.ownerWanted || !!title.identity || !!title.pending)
  return {
    owned: owned,
    present: !!title.identity,
    identity: title.identity ? copy(title.identity) : null,
    text: title.text,
    artUrl: title.artUrl || "",
    subtitle: title.subtitle || "",
    opacity: 1,
    offsetY: title.offset.value,
    offsetVelocity: title.offset.velocity,
    transition: title.crossfading && title.pending ? {
      outgoing: { identity: title.identity ? copy(title.identity) : null, text: title.text, artUrl: title.artUrl || "", subtitle: title.subtitle || "" },
      incoming: { identity: copy(title.pending.identity), text: title.pending.text, artUrl: title.pending.artUrl || "", subtitle: title.pending.subtitle || "" },
      progress: clamp(title.crossfade.value, 0, 1)
    } : null,
    compact: title.compact ? copy(title.compact) : null,
    expanded: title.expanded ? copy(title.expanded) : null,
    target: title.target
  }
}

function setBodyTarget(body, desired, edge, bounds, selectedProfile, reducedMotion) {
  var targetPose = targetValues(makePose(desired.rect, edge, bounds, selectedProfile))
  if (!body.pose) {
    body.pose = makePose(clampRect(desired.rect, bounds), edge, bounds, selectedProfile)
    if (!reducedMotion) {
      body.pose.span.value = 0
      body.pose.depth.value = 0
      body.pose.radius.value = 0
    }
  } else {
    var fitted = reducedMotion || samePoseTarget(body.pose, targetPose, selectedProfile) ? targetPose : fitTarget(body, targetPose, edge, bounds, selectedProfile)
    body.pose.cross = retargetAxis(body.pose.cross, fitted.cross, PROFILES.collapse)
    body.pose.near = retargetAxis(body.pose.near, fitted.near, PROFILES.collapse)
    body.pose.span = retargetAxis(body.pose.span, fitted.span, selectedProfile)
    body.pose.depth = retargetAxis(body.pose.depth, fitted.depth, selectedProfile)
    body.pose.radius = retargetAxis(body.pose.radius, fitted.radius, selectedProfile)
  }
  if (body.role !== "expanded") body.lastCompact = targetValues(body.pose)
}

function geometryMorphToken(desired) {
  var source = desired && desired.sourceRect ? desired.sourceRect : {}
  var capsule = desired && desired.sourceCapsuleRect ? desired.sourceCapsuleRect : {}
  return contentToken(desired) + "|" + ["x", "y", "width", "height", "radius"].map(function(name) {
    return finite(source[name], 0)
  }).join("|") + "|" + ["x", "y", "width", "height", "radius"].map(function(name) {
    return finite(capsule[name], 0)
  }).join("|")
}

function mediaOwnerToken(content) {
  var media = content && content.media ? content.media : null
  var token = media && typeof media.trackToken === "string" ? media.trackToken : ""
  var separator = token.lastIndexOf("|")
  return separator > 0 ? token.slice(0, separator) : ""
}

function samePlayerTrackReplacement(incoming, desired) {
  if (!incoming || !desired || incoming.key !== desired.key || incoming.expanded !== !!desired.expanded) return false
  var previousMedia = incoming.content && incoming.content.media ? incoming.content.media : null
  var nextMedia = desired.content && desired.content.media ? desired.content.media : null
  if (!previousMedia || !nextMedia || previousMedia.trackToken === nextMedia.trackToken) return false
  var previousOwner = mediaOwnerToken(incoming.content)
  return previousOwner !== "" && previousOwner === mediaOwnerToken(desired.content)
}

function setContent(body, desired) {
  var token = contentToken(desired)
  if (!body.incoming) {
    body.incoming = { token: token, key: desired.key, content: desired.content, expanded: !!desired.expanded, layout: copy(desired.rect) }
    body.outgoing = null
    body.geometryMorph = null
    body.contentMix = axis(1, 1, PROFILES.content)
    return false
  }
  if (body.incoming.token === token) {
    body.incoming.content = desired.content
    body.incoming.expanded = !!desired.expanded
    body.incoming.layout = copy(desired.rect)
    return false
  }
  if (samePlayerTrackReplacement(body.incoming, desired)) {
    body.incoming = { token: token, key: desired.key, content: desired.content, expanded: !!desired.expanded, layout: copy(desired.rect) }
    body.outgoing = null
    body.geometryMorph = null
    body.contentMix = axis(1, 1, PROFILES.content)
    return true
  }
  if (desired.expanded && body.incoming.key === desired.key && !body.incoming.expanded) {
    body.outgoing = body.incoming
    body.incoming = { token: token, key: desired.key, content: desired.content, expanded: true, layout: copy(desired.rect) }
    body.geometryMorph = {
      token: geometryMorphToken(desired),
      sourceRect: copyRect(desired.sourceRect),
      sourceCapsuleRect: copyRect(desired.sourceCapsuleRect),
      targetRect: copyRect(desired.rect)
    }
    body.contentMix = axis(1, 1, PROFILES.content)
    return false
  }
  if (!desired.expanded && body.incoming.key === desired.key && body.incoming.expanded) {
    body.incoming = { token: token, key: desired.key, content: desired.content, expanded: false, layout: copy(desired.rect) }
    body.outgoing = null
    body.geometryMorph = null
    body.contentMix = axis(1, 1, PROFILES.content)
    return
  }
  if (body.outgoing && body.outgoing.token === token) {
    var previousIncoming = body.incoming
    body.incoming = body.outgoing
    body.incoming.content = desired.content
    body.incoming.expanded = !!desired.expanded
    body.incoming.layout = copy(desired.rect)
    body.outgoing = previousIncoming
    body.contentDirection = -body.contentDirection
    body.geometryMorph = null
    body.contentMix = {
      value: 1 - body.contentMix.value,
      velocity: -body.contentMix.velocity,
      target: 1,
      omega: PROFILES.content.omega,
      zeta: PROFILES.content.zeta
    }
    return false
  }
  if (body.outgoing) {
    body.incoming = { token: token, key: desired.key, content: desired.content, expanded: !!desired.expanded, layout: copy(desired.rect) }
    body.geometryMorph = null
    return
  }
  body.outgoing = body.incoming
  body.incoming = { token: token, key: desired.key, content: desired.content, expanded: !!desired.expanded, layout: copy(desired.rect) }
  body.geometryMorph = null
  body.contentDirection = desired.expanded ? 1 : -1
  body.contentMix = axis(0, 1, PROFILES.content)
  return false
}

function retireBody(body, edge, bounds) {
  if (!body.key || !body.pose) return
  body.role = "retiring"
  var target = body.lastCompact || poseValues(body.pose)
  body.pose.cross = retargetAxis(body.pose.cross, target.cross, PROFILES.collapse)
  body.pose.near = retargetAxis(body.pose.near, target.near, PROFILES.collapse)
  body.pose.span = retargetAxis(body.pose.span, 0, PROFILES.collapse)
  body.pose.depth = retargetAxis(body.pose.depth, 0, PROFILES.collapse)
  body.pose.radius = retargetAxis(body.pose.radius, 0, PROFILES.collapse)
}

function suspendBody(body) {
  if (!body.key || !body.pose) return false
  if (body.role !== "primary" && body.role !== "secondary" && body.role !== "suspended") return false
  body.role = "suspended"
  return true
}

function resetBody(body) {
  return createBody(body.slot)
}

function chooseBody(state, claimed) {
  for (var expanded = 0; expanded < state.bodies.length; expanded++) {
    if (!claimed[expanded] && state.bodies[expanded].role === "expanded") return expanded
  }
  for (var index = 0; index < state.bodies.length; index++) {
    if (!claimed[index] && !state.bodies[index].key) return index
  }
  for (var retired = 0; retired < state.bodies.length; retired++) {
    if (!claimed[retired] && state.bodies[retired].role === "retiring") return retired
  }
  for (var fallback = 0; fallback < state.bodies.length; fallback++) {
    if (!claimed[fallback]) return fallback
  }
  return -1
}

function desiredBodies(intent) {
  var result = []
  if (intent && intent.primary) result.push(intent.primary)
  if (intent && intent.secondary) result.push(intent.secondary)
  return result
}

function desiredCapsule(intent) {
  if (intent && intent.capsule && intent.capsule.rect) return intent.capsule
  var primary = intent && intent.primary ? intent.primary : null
  if (!primary || !primary.rect) return null
  var secondary = intent && intent.secondary ? intent.secondary : null
  if (secondary && secondary.rect) {
    var left = Math.min(primary.rect.x, secondary.rect.x)
    var top = Math.min(primary.rect.y, secondary.rect.y)
    var right = Math.max(primary.rect.x + primary.rect.width, secondary.rect.x + secondary.rect.width)
    var bottom = Math.max(primary.rect.y + primary.rect.height, secondary.rect.y + secondary.rect.height)
    return {
      mode: "compactPair",
      profile: "compact",
      rect: { x: left, y: top, width: right - left, height: bottom - top,
        radius: Math.max(finite(primary.rect.radius, 0), finite(secondary.rect.radius, 0)) }
    }
  }
  return {
    mode: primary.role || "compact",
    profile: primary.profile || "compact",
    rect: primary.rect
  }
}

function compactPairAssignments(state, desired) {
  if (desired.length !== 2 || desired[0].role !== "primary" || desired[1].role !== "secondary") return null
  var assignments = { primary: -1, secondary: -1 }
  for (var index = 0; index < state.bodies.length; index++) {
    var body = state.bodies[index]
    if (!body.key || (body.role !== "primary" && body.role !== "secondary")) continue
    if (assignments[body.role] === -1) assignments[body.role] = index
  }
  if (assignments.primary === -1 || assignments.secondary === -1) return null
  return [
    { body: assignments.primary, desired: desired[0] },
    { body: assignments.secondary, desired: desired[1] }
  ]
}

function reconcile(previous, intent, reducedMotion) {
  var state = copy(previous || initialState())
  var source = intent || {}
  var nextEdge = ["top", "bottom", "left", "right"].indexOf(source.edge) >= 0 ? source.edge : "top"
  var nextBounds = {
    width: Math.max(0, finite(source.bounds && source.bounds.width, 0)),
    height: Math.max(0, finite(source.bounds && source.bounds.height, 0))
  }
  if (!state.capsule) state.capsule = createCapsule()
  if (!state.peek) state.peek = createPeek()
  rebaseCapsule(state.capsule, state.edge, state.bounds, nextEdge, nextBounds)
  for (var rebaseIndex = 0; rebaseIndex < state.bodies.length; rebaseIndex++) {
    rebaseBody(state.bodies[rebaseIndex], state.edge, state.bounds, nextEdge, nextBounds)
  }
  state.edge = nextEdge
  state.bounds = nextBounds
  state.alerting = source.alerting === true
  var closedPeek = !!source.peek && source.peek.placement === "closed"
  var sampledCapsuleRect = state.capsule && state.capsule.pose
    ? rectForPose(state.capsule.pose, state.edge, state.bounds) : null
  setPeekTarget(state.peek, source.peek, sampledCapsuleRect, state.edge, state.bounds,
    capsuleProgress(state.capsule, state.edge, state.bounds), reducedMotion)
  var capsule = desiredCapsule(source)
  if (closedPeek && capsule && state.peek.contentRect) capsule = Object.assign({}, capsule, { rect: state.peek.contentRect })
  if (capsule) setCapsuleTarget(state.capsule, capsule, state.edge, state.bounds, reducedMotion)
  var desired = desiredBodies(source)
  var claimed = [false, false]
  var assignments = []
  var compactPair = compactPairAssignments(state, desired)
  if (compactPair) {
    for (var compactIndex = 0; compactIndex < compactPair.length; compactIndex++) {
      claimed[compactPair[compactIndex].body] = true
      assignments.push(compactPair[compactIndex])
    }
  } else {
    for (var wanted = 0; wanted < desired.length; wanted++) {
      if (desired[wanted].role === "expanded") {
        var expandedSlot = state.bodies.findIndex(function(candidate, index) {
          return !claimed[index] && candidate.role === "expanded"
        })
        if (expandedSlot >= 0) {
          claimed[expandedSlot] = true
          assignments.push({ body: expandedSlot, desired: desired[wanted] })
          continue
        }
      }
      for (var existing = 0; existing < state.bodies.length; existing++) {
        if (!claimed[existing] && state.bodies[existing].key === desired[wanted].key) {
          claimed[existing] = true
          assignments.push({ body: existing, desired: desired[wanted] })
          break
        }
      }
    }
    for (var pending = 0; pending < desired.length; pending++) {
      var alreadyAssigned = assignments.some(function(entry) { return entry.desired === desired[pending] })
      if (alreadyAssigned) continue
      var chosen = chooseBody(state, claimed)
      if (chosen < 0) continue
      claimed[chosen] = true
      assignments.push({ body: chosen, desired: desired[pending] })
    }
  }
  for (var assignment = 0; assignment < assignments.length; assignment++) {
    var target = assignments[assignment]
    var body = state.bodies[target.body]
    var desiredBody = target.desired
    if (desiredBody.role === "expanded" && !desiredBody.sourceRect && body.pose) {
      desiredBody = Object.assign({}, desiredBody, {
        sourceRect: copyRect(rectForPose(body.pose, state.edge, state.bounds)),
        sourceCapsuleRect: state.capsule && state.capsule.pose
          ? copyRect(rectForPose(state.capsule.pose, state.edge, state.bounds)) : copyRect(desiredBody.rect)
      })
    }
    var previousRole = body.role
    if (body.key && body.key !== desiredBody.key) body.outgoing = null
    body.key = desiredBody.key
    body.role = desiredBody.role
    var continuingCollapse = body.pose && body.pose.span.omega === PROFILES.collapse.omega && !settledAxis(body.pose.span)
    var selectedProfile = desiredBody.role !== "expanded" && (previousRole === "expanded" || continuingCollapse)
      ? PROFILES.collapse : profile(desiredBody.profile)
    var regionDesired = desiredBody.role === "expanded" && desiredBody.sourceRect
      ? Object.assign({}, desiredBody, { rect: desiredBody.sourceRect }) : desiredBody
    setBodyTarget(body, regionDesired, state.edge, state.bounds, selectedProfile, reducedMotion)
    var metadataReplacement = setContent(body, desiredBody)
    retargetSharedTitle(body, desiredBody, reducedMotion, metadataReplacement)
    if (reducedMotion) {
      var axes = [body.pose.cross, body.pose.near, body.pose.span, body.pose.depth, body.pose.radius, body.contentMix,
        body.sharedTitle.offset, body.sharedTitle.crossfade]
      for (var axisIndex = 0; axisIndex < axes.length; axisIndex++) {
        axes[axisIndex].value = axes[axisIndex].target
        axes[axisIndex].velocity = 0
      }
      body.outgoing = null
    }
  }
  for (var bodyIndex = 0; bodyIndex < state.bodies.length; bodyIndex++) {
    if (!claimed[bodyIndex]) {
      if (closedPeek && suspendBody(state.bodies[bodyIndex])) continue
      if (reducedMotion) state.bodies[bodyIndex] = resetBody(state.bodies[bodyIndex])
      else retireBody(state.bodies[bodyIndex], state.edge, state.bounds)
    }
  }
  state.mapped = state.bodies.some(function(body) { return !!body.key }) || !!state.peek.content
  state.unsettled = reducedMotion ? false : state.mapped
  return state
}

function bodySettled(body) {
  if (!body.key || !body.pose) return true
  var axes = [body.pose.cross, body.pose.near, body.pose.span, body.pose.depth, body.pose.radius, body.contentMix,
    body.sharedTitle.offset, body.sharedTitle.crossfade]
  for (var index = 0; index < axes.length; index++) {
    if (!settledAxis(axes[index])) return false
  }
  return true
}

function geometrySettled(body) {
  if (!body.key || !body.pose) return true
  return [body.pose.cross, body.pose.near, body.pose.span, body.pose.depth, body.pose.radius].every(settledAxis)
}

function advance(previous, seconds) {
  var state = copy(previous || initialState())
  var delta = Math.max(0, finite(seconds, 0))
  if (!state.capsule) state.capsule = createCapsule()
  if (!state.peek) state.peek = createPeek()
  if (state.capsule.pose) {
    state.capsule.pose.cross = advanceAxis(state.capsule.pose.cross, delta)
    state.capsule.pose.near = advanceAxis(state.capsule.pose.near, delta)
    state.capsule.pose.span = advanceAxis(state.capsule.pose.span, delta)
    state.capsule.pose.depth = advanceAxis(state.capsule.pose.depth, delta)
    state.capsule.pose.radius = advanceAxis(state.capsule.pose.radius, delta)
  }
  for (var index = 0; index < state.bodies.length; index++) {
    var body = state.bodies[index]
    if (!body.key || !body.pose) continue
    body.pose.cross = advanceAxis(body.pose.cross, delta)
    body.pose.near = advanceAxis(body.pose.near, delta)
    body.pose.span = advanceAxis(body.pose.span, delta)
    body.pose.depth = advanceAxis(body.pose.depth, delta)
    body.pose.radius = advanceAxis(body.pose.radius, delta)
    body.contentMix = advanceAxis(body.contentMix, delta)
    body.sharedTitle = advanceSharedTitle(body.sharedTitle, delta)
    if (body.geometryMorph && capsuleSettled(state.capsule)
        && capsuleProgress(state.capsule, state.edge, state.bounds) >= 0.999) {
      body.outgoing = null
      body.geometryMorph = null
    } else if (!body.geometryMorph && body.outgoing && body.contentMix.value > 0.995) body.outgoing = null
    if (body.role === "retiring" && body.pose.span.value < 0.02 && body.pose.depth.value < 0.02) state.bodies[index] = resetBody(body)
  }
  if (state.peek.content) {
    state.peek.contentOffset = advanceAxis(state.peek.contentOffset, delta)
    if (state.peek.contentPhase === "exiting" && settledAxis(state.peek.contentOffset)) {
      if (state.peek.pendingContent) {
        state.peek.content = state.peek.pendingContent
        state.peek.contentKey = state.peek.pendingKey
        state.peek.contentRect = state.peek.pendingRect ? copyRect(state.peek.pendingRect) : null
        state.peek.contentSize = copy(state.peek.pendingSize)
        state.peek.pendingContent = null
        state.peek.pendingKey = ""
        state.peek.pendingRect = null
        state.peek.pendingSize = null
        setPeekSize(state.peek, state.peek.contentSize, false)
        if (state.peek.placement === "closed" && state.peek.contentRect) {
          setCapsuleTarget(state.capsule, { mode: "peek", profile: "expansion", rect: state.peek.contentRect },
            state.edge, state.bounds, false)
        }
        state.peek.contentPhase = "entering"
        state.peek.contentOffset = axis(PEEK_CONTENT_TRAVEL, 0, PEEK_CONTENT_PROFILE)
      } else {
        state.peek.contentPhase = "steady"
        state.peek.contentOffset = retargetAxis(state.peek.contentOffset, 0, PEEK_CONTENT_PROFILE)
      }
    } else if (state.peek.contentPhase === "entering" && settledAxis(state.peek.contentOffset)) {
      state.peek.contentPhase = "steady"
    }
    state.peek.width = advanceAxis(state.peek.width, delta)
    state.peek.height = advanceAxis(state.peek.height, delta)
    state.peek.reveal = advanceAxis(state.peek.reveal, delta)
    if (state.peek.placementTransition && capsuleSettled(state.capsule)
        && capsuleProgress(state.capsule, state.edge, state.bounds) >= 0.999) state.peek.placementTransition = null
    if (!state.peek.present && settledAxis(state.peek.reveal)) state.peek = createPeek()
  }
  if (state.alerting && state.mapped) state.pulseSeconds += delta
  state.mapped = state.bodies.some(function(body) { return !!body.key }) || !!state.peek.content
  state.unsettled = state.alerting && state.mapped
  if (!capsuleSettled(state.capsule)) state.unsettled = true
  for (var bodyIndex = 0; bodyIndex < state.bodies.length; bodyIndex++) {
    if (!bodySettled(state.bodies[bodyIndex])) state.unsettled = true
  }
  if (state.peek.content && !settledAxis(state.peek.reveal)) state.unsettled = true
  if (state.peek.content && !settledAxis(state.peek.contentOffset)) state.unsettled = true
  if (state.peek.content && (!settledAxis(state.peek.width) || !settledAxis(state.peek.height))) state.unsettled = true
  return state
}

function clear(previous) {
  var state = copy(previous || initialState())
  state.capsule = createCapsule()
  state.bodies = [createBody(0), createBody(1)]
  state.peek = createPeek()
  state.mapped = false
  state.unsettled = false
  state.alerting = false
  return state
}

function handoffVector(edge) {
  if (edge === "bottom") return { x: 0, y: -1 }
  if (edge === "left") return { x: 1, y: 0 }
  if (edge === "right") return { x: -1, y: 0 }
  return { x: 0, y: 1 }
}

function handoffDepth(rect, edge) {
  return edge === "left" || edge === "right" ? Math.max(0, rect.width) : Math.max(0, rect.height)
}

function usesCapsule(body, capsule) {
  if (!body || !capsule || !capsule.pose) return false
  if (body.role === "expanded") return true
  var transition = capsule.transition
  return !!transition && !capsuleSettled(capsule) && (transition.fromMode === "expanded" || capsule.mode === "expanded")
}

function layerOffset(surfaceRect, layout) {
  return {
    x: (surfaceRect.width - layout.width) / 2,
    y: (surfaceRect.height - layout.height) / 2
  }
}

function renderBody(body, capsule, edge, bounds, alerting, pulse) {
  if (!body.key || !body.pose) return { visible: false, slot: body.slot }
  var regionRect = rectForPose(body.pose, edge, bounds)
  var capsuleRect = capsule && capsule.pose ? rectForPose(capsule.pose, edge, bounds) : regionRect
  var regionUsesCapsule = usesCapsule(body, capsule)
  var surfaceRect = regionUsesCapsule ? capsuleRect : regionRect
  var morph = body.geometryMorph
  var progress = morph ? capsuleProgress(capsule, edge, bounds) : 1
  var incomingOffset = body.incoming ? layerOffset(surfaceRect, body.incoming.layout) : { x: 0, y: 0 }
  var outgoingOffset = body.outgoing ? layerOffset(surfaceRect, body.outgoing.layout) : { x: 0, y: 0 }
  var titleSampleRect = body.role === "expanded" && morph
    ? blendRect(morph.sourceRect, morph.targetRect, progress) : regionUsesCapsule && body.role === "expanded"
      ? capsuleRect : regionRect

  if (morph && body.incoming && body.outgoing) {
    var sourceOffsetX = morph.sourceRect.x - morph.sourceCapsuleRect.x
    var sourceOffsetY = morph.sourceRect.y - morph.sourceCapsuleRect.y
    var vector = handoffVector(edge)
    var depth = handoffDepth(morph.sourceRect, edge)
    incomingOffset = {
      x: sourceOffsetX * (1 - progress) + vector.x * depth * (1 - progress),
      y: sourceOffsetY * (1 - progress) + vector.y * depth * (1 - progress)
    }
    outgoingOffset = {
      x: morph.sourceRect.x - surfaceRect.x - vector.x * depth * progress,
      y: morph.sourceRect.y - surfaceRect.y - vector.y * depth * progress
    }
  } else if (regionUsesCapsule && body.role !== "expanded") {
    var regionOffset = { x: regionRect.x - surfaceRect.x, y: regionRect.y - surfaceRect.y }
    if (body.incoming) incomingOffset = { x: regionOffset.x, y: regionOffset.y }
    if (body.outgoing) outgoingOffset = { x: regionOffset.x, y: regionOffset.y }
  }

  var mix = clamp(body.contentMix.value, 0, 1)
  if (!morph && body.incoming && body.outgoing) {
    var rollDistance = Math.max(body.incoming.layout.height, body.outgoing.layout.height)
    incomingOffset.y += body.contentDirection * (1 - mix) * rollDistance
    outgoingOffset.y -= body.contentDirection * mix * rollDistance
  }
  var contentOwnsHeader = !!body.outgoing && !!body.incoming
    && body.outgoing.content && body.incoming.content
    && body.outgoing.content.key !== body.incoming.content.key
  var hiddenRetiringSibling = capsule && capsule.mode === "expanded" && body.role === "retiring"
  var hiddenSuspendedBody = body.role === "suspended"
  return {
    visible: !hiddenRetiringSibling && !hiddenSuspendedBody && surfaceRect.width > 0.001 && surfaceRect.height > 0.001,
    slot: body.slot,
    key: body.key,
    role: body.role,
    settled: bodySettled(body) && (!regionUsesCapsule || capsuleSettled(capsule)),
    geometrySettled: regionUsesCapsule ? capsuleSettled(capsule) : geometrySettled(body),
    rect: surfaceRect,
    regionRect: regionRect,
    titleSampleRect: titleSampleRect,
    contentProjection: morph ? progress : 1,
    opacity: 1,
    velocity: regionUsesCapsule
      ? { cross: capsule.pose.cross.velocity, near: capsule.pose.near.velocity, span: capsule.pose.span.velocity, depth: capsule.pose.depth.velocity }
      : { cross: body.pose.cross.velocity, near: body.pose.near.velocity, span: body.pose.span.velocity, depth: body.pose.depth.velocity },
    rectVelocity: regionUsesCapsule ? rectVelocityForPose(capsule.pose, edge) : rectVelocityForPose(body.pose, edge),
    sharedTitle: renderSharedTitle(body.sharedTitle, body.key, contentOwnsHeader),
    incoming: body.incoming ? {
      content: body.incoming.content,
      expanded: body.incoming.expanded,
      layout: body.incoming.layout,
      opacity: 1,
      blur: 0,
      offsetX: incomingOffset.x,
      offsetY: incomingOffset.y
    } : null,
    outgoing: body.outgoing ? {
      content: body.outgoing.content,
      expanded: body.outgoing.expanded,
      layout: body.outgoing.layout,
      opacity: 1,
      blur: 0,
      offsetX: outgoingOffset.x,
      offsetY: outgoingOffset.y
    } : null,
    alertOpacity: alerting && body.role !== "secondary" ? pulse : 0
  }
}

function renderCapsule(capsule, edge, bounds, mapped) {
  if (!capsule || !capsule.pose) return { visible: false, rect: { x: 0, y: 0, width: 0, height: 0, radius: 0 }, mode: "idle", settled: true }
  return {
    visible: !!mapped,
    rect: rectForPose(capsule.pose, edge, bounds),
    velocity: { cross: capsule.pose.cross.velocity, near: capsule.pose.near.velocity, span: capsule.pose.span.velocity, depth: capsule.pose.depth.velocity },
    mode: capsule.mode,
    settled: capsuleSettled(capsule),
    progress: capsuleProgress(capsule, edge, bounds)
  }
}

function attachedPeekRect(capsuleRect, placement, size, edge, bounds) {
  if (!capsuleRect) return null
  if (placement !== "below") return copyRect(capsuleRect)
  var gap = 6
  var width = Math.max(0, finite(size && size.width, 0))
  var height = Math.max(0, finite(size && size.height, 0))
  var rect = {
    x: capsuleRect.x + (capsuleRect.width - width) / 2,
    y: capsuleRect.y + (capsuleRect.height - height) / 2,
    width: width,
    height: height,
    radius: Math.min(24, width / 2, height / 2)
  }
  if (edge === "top") rect.y = capsuleRect.y + capsuleRect.height + gap
  else if (edge === "bottom") rect.y = capsuleRect.y - gap - height
  else if (edge === "left") rect.x = capsuleRect.x + capsuleRect.width + gap
  else rect.x = capsuleRect.x - gap - width
  if (edge === "top" || edge === "bottom") rect.x = clamp(rect.x, 0, Math.max(0, bounds.width - width))
  else rect.y = clamp(rect.y, 0, Math.max(0, bounds.height - height))
  return rectFits(rect, bounds) ? rect : null
}

function sampledPeekRect(peek, capsuleRect, edge, bounds, progress) {
  if (!peek || !capsuleRect) return null
  var target = attachedPeekRect(capsuleRect, peek.placement, {
    width: peek.width ? peek.width.value : 0,
    height: peek.height ? peek.height.value : 0
  }, edge, bounds)
  if (!target) return null
  target = revealedPeekRect(target, peek.placement, edge, peek.reveal.value)
  var transition = peek.placementTransition
  if (!transition || !transition.sourceRect) return target
  return blendRect(transition.sourceRect, target, clamp(progress, 0, 1))
}

function revealedPeekRect(rect, placement, edge, amount) {
  if (!rect) return null
  if (placement !== "below") return copyRect(rect)
  var progress = clamp(amount, 0, 1)
  if (edge === "top") return Object.assign(copyRect(rect), { height: rect.height * progress })
  if (edge === "bottom") return Object.assign(copyRect(rect), {
    y: rect.y + rect.height * (1 - progress), height: rect.height * progress
  })
  if (edge === "left") return Object.assign(copyRect(rect), { width: rect.width * progress })
  return Object.assign(copyRect(rect), {
    x: rect.x + rect.width * (1 - progress), width: rect.width * progress
  })
}

function renderPeek(peek, capsule, edge, bounds) {
  if (!peek || !peek.content || !capsule || !capsule.pose) return {
    visible: false,
    placement: "none",
    rect: null,
    contentKey: "",
    contentPhase: "steady",
    contentOffset: 0,
    contentOffsetVelocity: 0
  }
  var capsuleRect = rectForPose(capsule.pose, edge, bounds)
  var rect = sampledPeekRect(peek, capsuleRect, edge, bounds, capsuleProgress(capsule, edge, bounds))
  var present = peek.present || peek.reveal.value > 0.001
  var placement = peek.placementTransition ? "below" : peek.placement
  return {
    visible: present && !!rect && rect.width > 0.001 && rect.height > 0.001,
    key: peek.key,
    content: peek.content,
    contentKey: peek.contentKey,
    contentPhase: peek.contentPhase,
    contentOffset: peek.contentOffset.value,
    contentOffsetVelocity: peek.contentOffset.velocity,
    placement: placement,
    size: { width: peek.width ? peek.width.value : 0, height: peek.height ? peek.height.value : 0 },
    rect: rect,
    settled: settledAxis(peek.reveal) && capsuleSettled(capsule) && settledAxis(peek.contentOffset)
      && settledAxis(peek.width) && settledAxis(peek.height) && !peek.placementTransition,
    reveal: clamp(peek.reveal.value, 0, 1),
    contentProjection: placement === "closed" ? capsuleProgress(capsule, edge, bounds) : clamp(peek.reveal.value, 0, 1)
  }
}

function renderFrame(state) {
  var source = state || initialState()
  var capsule = source.capsule || createCapsule()
  var peek = source.peek || createPeek()
  var pulse = source.alerting ? 0.2 + 0.7 * (0.5 + 0.5 * Math.sin(source.pulseSeconds * Math.PI * 2 / 0.72)) : 0
  return {
    mapped: !!source.mapped,
    unsettled: !!source.unsettled,
    capsule: renderCapsule(capsule, source.edge, source.bounds, source.mapped),
    bodies: [
      renderBody(source.bodies[0], capsule, source.edge, source.bounds, source.alerting, pulse),
      renderBody(source.bodies[1], capsule, source.edge, source.bounds, source.alerting, pulse)
    ],
    peek: renderPeek(peek, capsule, source.edge, source.bounds)
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    PROFILES: PROFILES,
    sampleSpring: sampleSpring,
    advanceAxis: advanceAxis,
    sameTitleIdentity: sameTitleIdentity,
    initialState: initialState,
    reconcile: reconcile,
    advance: advance,
    clear: clear,
    renderFrame: renderFrame
  }
}
