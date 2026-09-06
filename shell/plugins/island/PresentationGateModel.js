function finite(value) {
  return typeof value === "number" && isFinite(value)
}

function cleanScreen(value) {
  return typeof value === "string" ? value.trim() : ""
}

function cleanKey(value) {
  return typeof value === "string" ? value.trim() : ""
}

function copy(value) {
  if (Array.isArray(value)) return value.map(copy)
  if (!value || typeof value !== "object") return value
  var result = {}
  var keys = Object.keys(value)
  for (var index = 0; index < keys.length; index++) result[keys[index]] = copy(value[keys[index]])
  return result
}

function pendingInfo(rawPeek) {
  var pending = rawPeek && rawPeek.pending && typeof rawPeek.pending === "object" ? rawPeek.pending : null
  if (!pending || !finite(pending.coalesceUntil) || pending.coalesceUntil < 0) return null
  var targets = Array.isArray(pending.targetScreens) ? pending.targetScreens : []
  var screens = []
  for (var index = 0; index < targets.length; index++) {
    var screen = cleanScreen(targets[index])
    if (screen && screens.indexOf(screen) < 0) screens.push(screen)
  }
  if (!screens.length) return null
  return { epoch: String(Math.floor(pending.coalesceUntil)), screens: screens }
}

function initialState() {
  return { revision: 0, heldByScreen: {}, bypassedEpochByScreen: {}, shownNotificationByScreen: {} }
}

function usableState(raw) {
  var source = raw && typeof raw === "object" ? raw : initialState()
  var held = {}
  var rawHeld = source.heldByScreen && typeof source.heldByScreen === "object" ? source.heldByScreen : {}
  var heldScreens = Object.keys(rawHeld)
  for (var index = 0; index < heldScreens.length; index++) {
    var screen = cleanScreen(heldScreens[index])
    var entry = rawHeld[heldScreens[index]]
    if (!screen || !entry || typeof entry !== "object" || typeof entry.epoch !== "string" || !entry.schedule) continue
    held[screen] = { epoch: entry.epoch, schedule: entry.schedule }
  }
  var bypassed = {}
  var rawBypassed = source.bypassedEpochByScreen && typeof source.bypassedEpochByScreen === "object"
    ? source.bypassedEpochByScreen : {}
  var bypassedScreens = Object.keys(rawBypassed)
  for (var bypassedIndex = 0; bypassedIndex < bypassedScreens.length; bypassedIndex++) {
    var bypassedScreen = cleanScreen(bypassedScreens[bypassedIndex])
    var epoch = rawBypassed[bypassedScreens[bypassedIndex]]
    if (bypassedScreen && typeof epoch === "string" && epoch) bypassed[bypassedScreen] = epoch
  }
  var shownNotifications = {}
  var rawShownNotifications = source.shownNotificationByScreen && typeof source.shownNotificationByScreen === "object"
    ? source.shownNotificationByScreen : {}
  var shownScreens = Object.keys(rawShownNotifications)
  for (var shownIndex = 0; shownIndex < shownScreens.length; shownIndex++) {
    var shownScreen = cleanScreen(shownScreens[shownIndex])
    var shown = rawShownNotifications[shownScreens[shownIndex]]
    if (!shownScreen || !shown || typeof shown !== "object") continue
    var previewKey = cleanKey(shown.previewKey)
    if (!previewKey || !finite(shown.activeSequence)) continue
    shownNotifications[shownScreen] = { previewKey: previewKey, activeSequence: shown.activeSequence }
  }
  return {
    revision: finite(source.revision) ? source.revision : 0,
    heldByScreen: held,
    bypassedEpochByScreen: bypassed,
    shownNotificationByScreen: shownNotifications
  }
}

function sameKeys(left, right) {
  var leftKeys = Object.keys(left)
  var rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (var index = 0; index < leftKeys.length; index++) {
    var key = leftKeys[index]
    if (!Object.prototype.hasOwnProperty.call(right, key) || left[key] !== right[key]) return false
  }
  return true
}

function sameHolds(left, right) {
  var leftKeys = Object.keys(left)
  var rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (var index = 0; index < leftKeys.length; index++) {
    var key = leftKeys[index]
    var leftEntry = left[key]
    var rightEntry = right[key]
    if (!rightEntry || !leftEntry || leftEntry.epoch !== rightEntry.epoch || leftEntry.schedule !== rightEntry.schedule) return false
  }
  return true
}

function sameShown(left, right) {
  var leftKeys = Object.keys(left)
  var rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (var index = 0; index < leftKeys.length; index++) {
    var key = leftKeys[index]
    var leftEntry = left[key]
    var rightEntry = right[key]
    if (!rightEntry || !leftEntry || leftEntry.previewKey !== rightEntry.previewKey
        || leftEntry.activeSequence !== rightEntry.activeSequence) return false
  }
  return true
}

function priorScheduleFor(context, screen, fallback) {
  var presented = context && context.priorPresentedByScreen && typeof context.priorPresentedByScreen === "object"
    ? context.priorPresentedByScreen[screen] : null
  return presented && typeof presented === "object" ? presented : fallback
}

function notificationPreviewKey(context) {
  return context && Object.prototype.hasOwnProperty.call(context, "notificationPreviewKey")
    ? cleanKey(context.notificationPreviewKey) : null
}

function activeNotification(rawPeek) {
  var active = rawPeek && rawPeek.active && typeof rawPeek.active === "object" ? rawPeek.active : null
  var candidate = active && active.candidate && typeof active.candidate === "object" ? active.candidate : null
  if (!candidate || candidate.source !== "notifications") return null
  var previewKey = cleanKey(candidate.subjectKey)
  if (!previewKey || !finite(candidate.sequence)) return null
  var targets = Array.isArray(active.targetScreens) ? active.targetScreens : []
  var screens = []
  for (var index = 0; index < targets.length; index++) {
    var screen = cleanScreen(targets[index])
    if (screen && screens.indexOf(screen) < 0) screens.push(screen)
  }
  return screens.length ? { previewKey: previewKey, activeSequence: candidate.sequence, screens: screens } : null
}

function reconcile(previous, priorSchedule, rawPeek, rawContext) {
  var prior = usableState(previous)
  var context = rawContext && typeof rawContext === "object" ? rawContext : {}
  var pending = pendingInfo(rawPeek)
  var held = {}
  var bypassed = {}
  if (pending) {
    for (var index = 0; index < pending.screens.length; index++) {
      var screen = pending.screens[index]
      var priorBypass = prior.bypassedEpochByScreen[screen]
      var priorHold = prior.heldByScreen[screen]
      if (priorBypass === pending.epoch) {
        bypassed[screen] = pending.epoch
        if (priorHold && priorHold.epoch === pending.epoch) held[screen] = priorHold
        continue
      }
      if (priorHold && priorHold.epoch === pending.epoch) held[screen] = priorHold
      else {
        var presentedSchedule = priorScheduleFor(context, screen, priorSchedule)
        if (presentedSchedule && typeof presentedSchedule === "object") {
          held[screen] = { epoch: pending.epoch, schedule: copy(presentedSchedule) }
        }
      }
    }
  }
  var previewKey = notificationPreviewKey(context)
  var shownNotifications = {}
  var shownScreens = Object.keys(prior.shownNotificationByScreen)
  for (var shownIndex = 0; shownIndex < shownScreens.length; shownIndex++) {
    var shownScreen = shownScreens[shownIndex]
    var shown = prior.shownNotificationByScreen[shownScreen]
    if (previewKey === null || shown.previewKey === previewKey) shownNotifications[shownScreen] = shown
  }
  var activeNotificationState = activeNotification(rawPeek)
  if (activeNotificationState && (previewKey === null || activeNotificationState.previewKey === previewKey)) {
    for (var activeIndex = 0; activeIndex < activeNotificationState.screens.length; activeIndex++) {
      shownNotifications[activeNotificationState.screens[activeIndex]] = {
        previewKey: activeNotificationState.previewKey,
        activeSequence: activeNotificationState.activeSequence
      }
    }
  }
  if (sameHolds(prior.heldByScreen, held) && sameKeys(prior.bypassedEpochByScreen, bypassed)
      && sameShown(prior.shownNotificationByScreen, shownNotifications)) return previous || prior
  return {
    revision: prior.revision + 1,
    heldByScreen: held,
    bypassedEpochByScreen: bypassed,
    shownNotificationByScreen: shownNotifications
  }
}

function bypass(previous, rawScreen, rawPeek) {
  var screen = cleanScreen(rawScreen)
  var pending = pendingInfo(rawPeek)
  if (!screen || !pending || pending.screens.indexOf(screen) < 0) return previous || initialState()
  var prior = usableState(previous)
  if (prior.bypassedEpochByScreen[screen] === pending.epoch && !prior.heldByScreen[screen]) return previous || prior
  var held = {}
  var heldScreens = Object.keys(prior.heldByScreen)
  for (var index = 0; index < heldScreens.length; index++) held[heldScreens[index]] = prior.heldByScreen[heldScreens[index]]
  var bypassed = {}
  var bypassedScreens = Object.keys(prior.bypassedEpochByScreen)
  for (var bypassedIndex = 0; bypassedIndex < bypassedScreens.length; bypassedIndex++) {
    var bypassedScreen = bypassedScreens[bypassedIndex]
    bypassed[bypassedScreen] = prior.bypassedEpochByScreen[bypassedScreen]
  }
  bypassed[screen] = pending.epoch
  return {
    revision: prior.revision + 1,
    heldByScreen: held,
    bypassedEpochByScreen: bypassed,
    shownNotificationByScreen: prior.shownNotificationByScreen
  }
}

function scheduleFor(state, currentSchedule, rawScreen) {
  var screen = cleanScreen(rawScreen)
  var held = state && state.heldByScreen && state.heldByScreen[screen]
  return held && held.schedule ? held.schedule : currentSchedule
}

function isBypassed(state, rawScreen) {
  var screen = cleanScreen(rawScreen)
  return !!(state && state.bypassedEpochByScreen && typeof state.bypassedEpochByScreen[screen] === "string"
    && state.bypassedEpochByScreen[screen] !== "")
}

function isHeld(state, rawScreen) {
  var screen = cleanScreen(rawScreen)
  return !!(state && state.heldByScreen && state.heldByScreen[screen] && state.heldByScreen[screen].schedule)
}

function hasShownNotification(state, rawScreen, rawPreviewKey) {
  var screen = cleanScreen(rawScreen)
  var previewKey = cleanKey(rawPreviewKey)
  var shown = state && state.shownNotificationByScreen ? state.shownNotificationByScreen[screen] : null
  return !!(previewKey && shown && shown.previewKey === previewKey)
}

function diagnostic(state, rawPeek) {
  var source = usableState(state)
  var pending = pendingInfo(rawPeek)
  var heldScreens = Object.keys(source.heldByScreen).sort()
  var bypassedScreens = Object.keys(source.bypassedEpochByScreen).sort()
  var shownNotificationScreens = Object.keys(source.shownNotificationByScreen).sort()
  return {
    pendingEpoch: pending ? pending.epoch : "",
    heldScreens: heldScreens,
    bypassedScreens: bypassedScreens,
    shownNotificationScreens: shownNotificationScreens
  }
}

if (typeof module !== "undefined") module.exports = {
  initialState: initialState,
  reconcile: reconcile,
  bypass: bypass,
  scheduleFor: scheduleFor,
  isBypassed: isBypassed,
  isHeld: isHeld,
  hasShownNotification: hasShownNotification,
  diagnostic: diagnostic
}
