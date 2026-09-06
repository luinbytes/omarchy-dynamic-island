import QtQuick
import QtQuick.Shapes
import Quickshell
import Quickshell.Hyprland
import Quickshell.Wayland
import qs.Commons
import "ActivityModel.js" as ActivityModel
import "ViewModel.js" as ViewModel
import "HubModel.js" as HubModel

PanelWindow {
  id: root

  required property var service
  required property Item anchorItem
  required property var bar
  property bool reducedMotion: false
  property real slotWidth: 250
  property bool focusPrimed: false
  property bool grabReady: false
  property bool presentedExpansion: false
  readonly property bool keyboardActive: root.contentItem.Window.active
  readonly property var anchorWindow: anchorItem ? anchorItem.QsWindow.window : null
  readonly property string screenName: screen && screen.name ? String(screen.name) : ""
  readonly property string barPosition: bar && bar.position ? String(bar.position) : "top"
  readonly property var screenMonitor: screen && typeof Hyprland.monitorFor === "function" ? Hyprland.monitorFor(screen) : null
  readonly property bool screenFullscreen: !!screenMonitor && !!screenMonitor.activeWorkspace
    && screenMonitor.activeWorkspace.hasFullscreen === true
  readonly property bool presenterAvailable: !!anchorItem && anchorItem.visible && anchorItem.width > 0 && anchorItem.height > 0
    && !!anchorWindow && !!anchorWindow.screen && !(bar && bar.barHidden) && !screenFullscreen
  readonly property var activePeekContent: ViewModel.peekContent(service ? service.peekActive : null)
  readonly property var peekMeasurement: {
    var content = root.activePeekContent
    if (!content || !content.key) return { key: "", width: 0, height: 0 }
    return {
      key: content.key,
      width: Math.ceil(Math.max(peekTitleTextMetrics.advanceWidth, peekValueTextMetrics.advanceWidth) + 50),
      height: 68
    }
  }
  readonly property var metrics: {
    anchorWatcher.transform
    var revision = service && service.state ? service.state.revision : 0
    return {
      screen: { width: screen ? screen.width : 0, height: screen ? screen.height : 0 },
      anchor: { x: anchorScreenPos.x, y: anchorScreenPos.y, width: anchorItem ? anchorItem.width : 0, height: anchorItem ? anchorItem.height : 0 },
      bar: { position: barPosition, size: bar && bar.barSize ? bar.barSize : 0 },
      focusedScreen: service ? service.focusedScreen : "",
      slotWidth: slotWidth,
      compactHeight: Math.min(22, Math.max(12, anchorItem ? anchorItem.height : 22)),
      margin: 8,
      gap: 6,
      compactPairWidths: root.compactPairWidths,
      peekMeasurement: root.peekMeasurement,
      nowMs: Date.now() + revision * 0
    }
  }
  readonly property var compactSchedule: root.service && typeof root.service.compactScheduleFor === "function"
    ? root.service.compactScheduleFor(root.screenName) : root.service && root.service.hubSchedule ? root.service.hubSchedule : null
  readonly property var compactPairSource: {
    var schedule = root.compactSchedule
    return {
      primary: schedule ? root.compactCardFor(schedule.primary, false) : null,
      secondary: schedule && schedule.secondary ? root.compactCardFor(schedule.secondary, true) : null
    }
  }
  readonly property var compactPairWidths: ({
    primary: root.measureCompactWidth(root.compactPairSource.primary, primaryCompactTextMetrics),
    secondary: root.measureCompactWidth(root.compactPairSource.secondary, secondaryCompactTextMetrics)
  })
  readonly property var liveFrame: ViewModel.frameFor(service ? service.state : null, screenName, metrics, ActivityModel.selection)
  readonly property var baseFrame: service && service.hubEntryVisible
    ? HubModel.frameFor(service.hubState, root.compactSchedule, screenName, ViewModel.screenMetrics(metrics), ViewModel)
    : liveFrame
  readonly property var frame: ViewModel.projectPeekFrame(baseFrame, service ? service.peekActive : null, screenName, metrics)
  readonly property bool ownerExpanded: frame.phase === "expanded" && frame.isOwner
  readonly property bool opened: presenterAvailable && ownerExpanded
  readonly property bool hasVisuals: motion.hasVisuals
  readonly property bool unifiedSurface: !!root.service && root.service.hubEntryVisible
  readonly property bool closedPeekPresentation: !!root.peekVisual && root.peekVisual.placement === "closed"
  readonly property var capsuleOutline: ViewModel.activityOutline(motion.visual.capsule.rect, root.metrics)
  readonly property var peekVisual: motion.visual.peek
  readonly property var peekOutline: root.closedPeekPresentation ? root.capsuleOutline
    : ViewModel.attachedPeekOutline(root.peekVisual ? root.peekVisual.rect : null, root.metrics)
  readonly property bool peekInputActive: root.presenterAvailable && !!root.frame.peek && !!root.peekVisual && root.peekVisual.visible
    && !!root.peekOutline && root.peekOutline.contentSafe !== false
  readonly property var firstInputOutline: root.closedPeekPresentation ? root.peekOutline
    : root.unifiedSurface ? root.capsuleOutline : bodyOne.outline
  readonly property bool firstInputContentSafe: !!root.firstInputOutline && root.firstInputOutline.contentSafe !== false
  readonly property bool firstInputActive: root.presenterAvailable && (root.closedPeekPresentation ? root.peekInputActive : root.unifiedSurface
    ? motion.visual.capsule.visible && (bodyOne.interactive || bodyTwo.interactive) : bodyOne.interactive) && root.firstInputContentSafe
  readonly property var secondInputOutline: root.peekVisual && root.peekVisual.placement === "below" ? root.peekOutline : bodyTwo.outline
  readonly property bool secondInputContentSafe: !!root.secondInputOutline && root.secondInputOutline.contentSafe !== false
  readonly property bool secondInputActive: root.presenterAvailable && (root.peekVisual && root.peekVisual.placement === "below" ? root.peekInputActive
    : !root.unifiedSurface && bodyTwo.interactive) && root.secondInputContentSafe
  readonly property var hoverRegion: {
    var first = root.firstInputOutline && root.firstInputOutline.bounds ? root.firstInputOutline.bounds : null
    var second = root.secondInputActive && root.secondInputOutline && root.secondInputOutline.bounds ? root.secondInputOutline.bounds : null
    if (!first && !second) return { x: 0, y: 0, width: 0, height: 0 }
    if (!first) return { x: second.x, y: second.y, width: second.width, height: second.height }
    if (!second) return { x: first.x, y: first.y, width: first.width, height: first.height }
    var right = Math.max(first.x + first.width, second.x + second.width)
    var bottom = Math.max(first.y + first.height, second.y + second.height)
    return {
      x: Math.min(first.x, second.x),
      y: Math.min(first.y, second.y),
      width: right - Math.min(first.x, second.x),
      height: bottom - Math.min(first.y, second.y)
    }
  }

  function identityFor(key) {
    try {
      var parts = JSON.parse(key || "")
      return Array.isArray(parts) && parts.length === 2 ? { source: parts[0], id: parts[1] } : null
    } catch (error) {
      return null
    }
  }

  function compactCardFor(card, paired) {
    if (!card) return null
    if (typeof HubModel.compactCard === "function") return HubModel.compactCard(card, paired)
    return card
  }

  function compactTextFor(card) {
    if (!card) return ""
    if (card.media) return String(card.media.title || "")
    if (typeof card.compactText === "string" && card.compactText !== "") return card.compactText
    return String(card.label || card.value || "")
  }

  function measureCompactWidth(card, metricsItem) {
    if (!card || !card.key) return 0
    var textWidth = metricsItem && isFinite(metricsItem.advanceWidth) ? metricsItem.advanceWidth : 0
    if (card.media) return Math.max(54, Math.ceil(textWidth + 54))
    var iconWidth = card.icon ? 12 : 0
    return Math.max(32, Math.ceil(textWidth + iconWidth + (iconWidth > 0 ? 4 : 0) + 8))
  }

  function expandKey(key, reason) {
    if (service && service.hubEntryVisible) {
      var content = frame.secondary && frame.secondary.key === key ? frame.secondary : frame.primary
      return service.openHub(content ? content.tool : service.hubState.tool, screenName, key)
    }
    var identity = identityFor(key)
    if (!service || !identity) return false
    var result = service.expand(identity.source, identity.id, screenName, reason || "widget")
    return !!result && result.accepted === true
  }

  function promotePeek() {
    return !!root.service && root.service.promotePeek(root.screenName) === true
  }

  function islandWidgets() {
    if (bar && typeof bar.moduleWidgets === "function") {
      var widgets = bar.moduleWidgets("luinbytes.island")
      if (widgets && typeof widgets.length === "number") return widgets
    }
    return anchorItem ? [anchorItem] : []
  }

  function islandPointerWidget(widgets) {
    for (var i = 0; i < widgets.length; i++) {
      if (widgets[i] && widgets[i].islandPointerOver === true) return widgets[i]
    }
    return anchorItem && anchorItem.islandPointerOver === true ? anchorItem : null
  }

  function islandSuppressionOwner(widgets) {
    for (var i = 0; i < widgets.length; i++) {
      if (widgets[i] && widgets[i].islandSuppressionLease === true) return widgets[i]
    }
    return anchorItem && anchorItem.islandSuppressionLease === true ? anchorItem : null
  }

  function settleCenterHoverSuppression(forceRelease) {
    if (!bar || !("centerHoverRevealSuppressed" in bar)) return
    var widgets = islandWidgets()
    var hovered = islandPointerWidget(widgets)
    if (hovered) {
      syncCenterHoverSuppression()
      return
    }
    var owner = islandSuppressionOwner(widgets)
    if (bar.activePopout && widgets.indexOf(bar.activePopout) < 0) {
      if (owner) owner.islandSuppressionLease = false
      return
    }
    if (!forceRelease && bar.centerSectionRevealHeld === true) {
      return
    }
    if (owner) {
      bar.centerHoverRevealSuppressed = owner.islandSuppressionBaseline === true
      owner.islandSuppressionLease = false
    }
  }

  function syncCenterHoverSuppression(forceRelease) {
    if (!bar || !("centerHoverRevealSuppressed" in bar)) return
    var widgets = islandWidgets()
    if (bar.activePopout && widgets.indexOf(bar.activePopout) < 0) return
    var hovered = islandPointerWidget(widgets)
    if (hovered) {
      centerHoverSettleTimer.stop()
      var owner = islandSuppressionOwner(widgets)
      if (!owner) {
        hovered.islandSuppressionBaseline = bar.centerHoverRevealSuppressed === true
        hovered.islandSuppressionLease = true
      } else if (owner !== hovered && owner.islandPointerOver !== true) {
        hovered.islandSuppressionBaseline = owner.islandSuppressionBaseline === true
        hovered.islandSuppressionLease = true
        owner.islandSuppressionLease = false
      }
      bar.centerHoverRevealSuppressed = true
      return
    }
    if (!forceRelease) {
      centerHoverSettleTimer.restart()
      return
    }
    settleCenterHoverSuppression(true)
  }

  function setSurfacePointerOver(value) {
    if (!anchorItem || !("islandSurfacePointerOver" in anchorItem)) return
    anchorItem.islandSurfacePointerOver = value === true
    syncCenterHoverSuppression()
  }

  function clearPointerState() {
    if (!anchorItem) return
    if ("islandBarPointerOver" in anchorItem) anchorItem.islandBarPointerOver = false
    if ("islandSurfacePointerOver" in anchorItem) anchorItem.islandSurfacePointerOver = false
    syncCenterHoverSuppression(true)
  }

  function open(payload) {
    if (service && service.hubEntryVisible && typeof payload === "string" && HubModel.TOOLS.indexOf(payload) >= 0)
      return service.openHub(payload, screenName)
    if (opened) {
      Qt.callLater(function() { if (root.opened) capsule.forceActiveFocus() })
      return true
    }
    return expandKey(frame.primary ? frame.primary.key : "", "summon")
  }

  function close(reason) {
    if (!service || !opened) return true
    var result = service.collapse(reason || "widget")
    return !!result && result.accepted === true
  }

  function invoke(actionId) {
    var identity = identityFor(frame.selected ? frame.selected.key : "")
    if (!service || !identity || !actionId) return false
    var result = service.invoke(identity.source, identity.id, actionId)
    return !!result && result.accepted === true
  }

  function seek(trackToken, positionSeconds) {
    var identity = identityFor(frame.selected ? frame.selected.key : "")
    if (!service || !identity) return false
    return service.seek(identity.source, identity.id, trackToken, positionSeconds) === true
  }

  function reportLayout(key, widthToken, preferredHeight, preflight) {
    if (!service || typeof key !== "string" || !key || !isFinite(widthToken) || !isFinite(preferredHeight)) return false
    var expected = preflight ? frame.preflight : frame.selected ? {
      key: frame.selected.key,
      widthToken: Math.round(frame.geometry.card.width),
      heightBudget: frame.detailHeightBudget
    } : null
    if (!expected || expected.key !== key || Math.round(widthToken) !== expected.widthToken) return false
    return service.reportHubLayout(screenName, key, widthToken, preferredHeight,
      expected.widthToken, expected.heightBudget) === true
  }

  function syncMotion() {
    motionCommitTimer.restart()
  }

  function commitMotion() {
    if (presenterAvailable) motion.accept(ViewModel.motionIntentFor(frame, metrics))
    else motion.abandon()
  }

  function rectFor(item) {
    return item.drawn ? { x: Math.round(item.rect.x), y: Math.round(item.rect.y), width: Math.round(item.rect.width), height: Math.round(item.rect.height), radius: Math.round(item.rect.radius) } : null
  }

  function outlineFor(item) {
    return item.drawn ? {
      x: Math.round(item.outline.bounds.x),
      y: Math.round(item.outline.bounds.y),
      width: Math.round(item.outline.bounds.width),
      height: Math.round(item.outline.bounds.height),
      shoulderRadius: Math.round(item.outline.shoulderRadius)
    } : null
  }

  function diagnostic() {
    return {
      screen: screenName,
      phase: frame.phase,
      mapped: backingWindowVisible,
      presenterAvailable: presenterAvailable,
      actualRects: { primary: rectFor(bodyOne), secondary: rectFor(bodyTwo) },
      peek: {
        placement: peekVisual ? peekVisual.placement : "none",
        rect: peekVisual && peekVisual.rect ? {
          x: Math.round(peekVisual.rect.x), y: Math.round(peekVisual.rect.y),
          width: Math.round(peekVisual.rect.width), height: Math.round(peekVisual.rect.height)
        } : null,
        visible: !!peekVisual && peekVisual.visible === true
      },
      composition: root.unifiedSurface ? "unified" : "independent",
      surfaceOutline: root.unifiedSurface ? root.capsuleOutline.bounds : null,
      outlines: { primary: outlineFor(bodyOne), secondary: outlineFor(bodyTwo) },
      animation: { primary: motion.unsettled, secondary: motion.unsettled },
      focus: { opened: opened, primed: focusPrimed, active: capsule.activeFocus, windowActive: root.contentItem.Window.active, keyboardFocus: opened ? (focusPrimed ? "OnDemand" : "Exclusive") : "None" },
      reducedMotion: reducedMotion,
      hover: {
        islandPointerOver: anchorItem && anchorItem.islandPointerOver === true,
        centerHoverRevealSuppressed: bar && bar.centerHoverRevealSuppressed === true,
        revealHeld: bar && bar.centerSectionRevealHeld === true
      },
      keys: { primary: frame.primary ? frame.primary.key : "", secondary: frame.secondary ? frame.secondary.key : "", selected: frame.selected ? frame.selected.key : "" },
      hubLayout: {
        ready: frame.layoutReady === true,
        chooserOpen: frame.chooserOpen === true,
        preferredHeight: service && service.hubState && service.hubState.layout ? service.hubState.layout.preferredHeight : 0,
        preflightKey: frame.preflight ? frame.preflight.key : ""
      },
      motion: {
        first: bodyOne.visual ? { key: bodyOne.visual.key, role: bodyOne.visual.role, velocity: bodyOne.visual.velocity } : null,
        second: bodyTwo.visual ? { key: bodyTwo.visual.key, role: bodyTwo.visual.role, velocity: bodyTwo.visual.velocity } : null
      },
      media: bodyOne.mediaDiagnostic() || bodyTwo.mediaDiagnostic(),
      theme: {
        fontFamily: Style.font.family,
        background: String(Color.bar.background),
        foreground: String(Color.bar.text),
        accent: String(Color.accent)
      }
    }
  }

  screen: anchorWindow ? anchorWindow.screen : null
  visible: !!screen
  color: "transparent"
  exclusionMode: ExclusionMode.Ignore
  anchors { top: true; bottom: true; left: true; right: true }

  WlrLayershell.namespace: "luinbytes-island"
  WlrLayershell.layer: WlrLayer.Top
  WlrLayershell.keyboardFocus: presenterAvailable && opened ? (focusPrimed ? WlrKeyboardFocus.OnDemand : WlrKeyboardFocus.Exclusive) : WlrKeyboardFocus.None

  HyprlandFocusGrab {
    active: root.opened && root.grabReady
    windows: [root]
    onCleared: root.close("outside-click")
  }

  mask: Region {
    Region {
      x: root.firstInputActive ? Math.round(root.firstInputOutline.body.x) : 0
      y: root.firstInputActive ? Math.round(root.firstInputOutline.body.y) : 0
      width: root.firstInputActive ? Math.round(root.firstInputOutline.body.width) : 0
      height: root.firstInputActive ? Math.round(root.firstInputOutline.body.height) : 0
      topLeftRadius: root.firstInputActive ? Math.round(root.firstInputOutline.body.topLeftRadius) : 0
      topRightRadius: root.firstInputActive ? Math.round(root.firstInputOutline.body.topRightRadius) : 0
      bottomRightRadius: root.firstInputActive ? Math.round(root.firstInputOutline.body.bottomRightRadius) : 0
      bottomLeftRadius: root.firstInputActive ? Math.round(root.firstInputOutline.body.bottomLeftRadius) : 0
    }
    Region {
      x: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[0].box.x) : 0
      y: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[0].box.y) : 0
      width: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[0].box.width) : 0
      height: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[0].box.height) : 0
      Region {
        intersection: Intersection.Subtract
        shape: RegionShape.Ellipse
        x: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[0].cutout.x) : 0
        y: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[0].cutout.y) : 0
        width: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[0].cutout.width) : 0
        height: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[0].cutout.height) : 0
      }
    }
    Region {
      x: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[1].box.x) : 0
      y: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[1].box.y) : 0
      width: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[1].box.width) : 0
      height: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[1].box.height) : 0
      Region {
        intersection: Intersection.Subtract
        shape: RegionShape.Ellipse
        x: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[1].cutout.x) : 0
        y: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[1].cutout.y) : 0
        width: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[1].cutout.width) : 0
        height: root.firstInputActive ? Math.round(root.firstInputOutline.shoulders[1].cutout.height) : 0
      }
    }
    Region {
      x: root.secondInputActive ? Math.round(root.secondInputOutline.body.x) : 0
      y: root.secondInputActive ? Math.round(root.secondInputOutline.body.y) : 0
      width: root.secondInputActive ? Math.round(root.secondInputOutline.body.width) : 0
      height: root.secondInputActive ? Math.round(root.secondInputOutline.body.height) : 0
      topLeftRadius: root.secondInputActive ? Math.round(root.secondInputOutline.body.topLeftRadius) : 0
      topRightRadius: root.secondInputActive ? Math.round(root.secondInputOutline.body.topRightRadius) : 0
      bottomRightRadius: root.secondInputActive ? Math.round(root.secondInputOutline.body.bottomRightRadius) : 0
      bottomLeftRadius: root.secondInputActive ? Math.round(root.secondInputOutline.body.bottomLeftRadius) : 0
    }
    Region {
      x: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[0].box.x) : 0
      y: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[0].box.y) : 0
      width: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[0].box.width) : 0
      height: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[0].box.height) : 0
      Region {
        intersection: Intersection.Subtract
        shape: RegionShape.Ellipse
        x: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[0].cutout.x) : 0
        y: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[0].cutout.y) : 0
        width: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[0].cutout.width) : 0
        height: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[0].cutout.height) : 0
      }
    }
    Region {
      x: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[1].box.x) : 0
      y: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[1].box.y) : 0
      width: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[1].box.width) : 0
      height: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[1].box.height) : 0
      Region {
        intersection: Intersection.Subtract
        shape: RegionShape.Ellipse
        x: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[1].cutout.x) : 0
        y: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[1].cutout.y) : 0
        width: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[1].cutout.width) : 0
        height: root.secondInputActive ? Math.round(root.secondInputOutline.shoulders[1].cutout.height) : 0
      }
    }
  }

  TransformWatcher {
    id: anchorWatcher
    a: anchorWindow ? anchorWindow.contentItem : null
    b: anchorItem
  }

  readonly property point anchorScreenPos: {
    anchorWatcher.transform
    if (!anchorItem || !anchorWindow) return Qt.point(0, 0)
    var local = anchorItem.mapToItem(anchorWindow.contentItem, 0, 0)
    var offsetX = barPosition === "right" && screen ? screen.width - anchorWindow.width : 0
    var offsetY = barPosition === "bottom" && screen ? screen.height - anchorWindow.height : 0
    return Qt.point(local.x + offsetX, local.y + offsetY)
  }

  function beginFocusPrime() {
    if (!opened || !keyboardActive || grabReady) return
    grabReady = true
    focusPrimeTimer.restart()
  }

  onKeyboardActiveChanged: beginFocusPrime()
  onFrameChanged: syncMotion()
  onMetricsChanged: syncMotion()

  onHasVisualsChanged: {
    if (!hasVisuals) setSurfacePointerOver(false)
  }

  onOpenedChanged: {
    if (!opened) {
      focusPrimeTimer.stop()
      focusPrimed = false
      grabReady = false
      if (presenterAvailable) presentedExpansion = false
      if (bar && typeof bar.releasePopout === "function") bar.releasePopout(anchorItem)
      return
    }
    presentedExpansion = true
    focusPrimed = false
    beginFocusPrime()
    if (bar && typeof bar.requestPopout === "function") bar.requestPopout(anchorItem)
    Qt.callLater(function() {
      if (root.opened) capsule.forceActiveFocus()
    })
  }

  onPresenterAvailableChanged: {
    if (service && typeof service.schedulePresentationReconcile === "function") service.schedulePresentationReconcile()
    if (!presenterAvailable) {
      setSurfacePointerOver(false)
      motionCommitTimer.stop()
      motion.abandon()
      if (presentedExpansion || ownerExpanded) {
        presentedExpansion = false
        if (service) service.collapse("anchor-lost")
      }
      return
    }
    syncMotion()
  }

  Component.onCompleted: syncMotion()
  Component.onDestruction: {
    clearPointerState()
    if (presentedExpansion && service) service.collapse("anchor-destroyed")
  }

  TextMetrics {
    id: primaryCompactTextMetrics
    text: root.compactTextFor(root.compactPairSource.primary)
    font.family: Style.font.family
    font.pixelSize: root.compactPairSource.primary && root.compactPairSource.primary.media ? 11 : 10
    font.weight: Font.DemiBold
  }

  TextMetrics {
    id: secondaryCompactTextMetrics
    text: root.compactTextFor(root.compactPairSource.secondary)
    font.family: Style.font.family
    font.pixelSize: root.compactPairSource.secondary && root.compactPairSource.secondary.media ? 11 : 10
    font.weight: Font.DemiBold
  }

  TextMetrics {
    id: peekTitleTextMetrics
    text: root.activePeekContent ? root.activePeekContent.label || "Activity" : ""
    font.family: Style.font.family
    font.pixelSize: 12
    font.weight: Font.DemiBold
  }

  TextMetrics {
    id: peekValueTextMetrics
    text: root.activePeekContent ? root.activePeekContent.value || "" : ""
    font.family: Style.font.family
    font.pixelSize: 11
    font.weight: Font.Normal
  }

  Timer {
    id: motionCommitTimer
    interval: 0
    onTriggered: root.commitMotion()
  }

  Timer {
    id: focusPrimeTimer
    interval: 75
    onTriggered: if (root.opened) root.focusPrimed = true
  }

  Timer {
    id: centerHoverSettleTimer
    interval: 0
    onTriggered: root.settleCenterHoverSuppression(false)
  }

  Connections {
    target: root.bar
    function onActivePopoutChanged() {
      var widgets = root.islandWidgets()
      if (!root.bar.activePopout || widgets.indexOf(root.bar.activePopout) >= 0) {
        root.syncCenterHoverSuppression()
        return
      }
      var owner = root.islandSuppressionOwner(widgets)
      if (!owner) return
      root.bar.centerHoverRevealSuppressed = owner.islandSuppressionBaseline === true
      owner.islandSuppressionLease = false
    }
    function onCenterSectionRevealHeldChanged() {
      if (!root.bar || root.bar.centerSectionRevealHeld === true) return
      root.settleCenterHoverSuppression(false)
    }
  }

  IslandMotion {
    id: motion
    reducedMotion: root.reducedMotion
  }

  HubContent {
    id: layoutPreflight
    width: root.frame.preflight ? root.frame.preflight.widthToken : 0
    height: root.frame.preflight ? root.frame.preflight.heightBudget : 0
    visible: false
    enabled: false
    active: !!root.frame.preflight
    service: root.service
    screenName: root.screenName
    content: root.frame.preflight ? root.frame.preflight.content : ({ key: "", tool: "music" })
    interactive: false
    reducedMotion: true
    reportLayout: active
    heightBudget: root.frame.preflight ? root.frame.preflight.heightBudget : 0
    onLayoutReported: function(key, widthToken, preferredHeight) {
      root.reportLayout(key, widthToken, preferredHeight, true)
    }
  }

  Item {
    id: capsule
    anchors.fill: parent
    visible: root.presenterAvailable
    focus: root.opened
    activeFocusOnTab: root.opened
    Item {
      id: hoverTarget
      x: root.hoverRegion.x
      y: root.hoverRegion.y
      width: root.hoverRegion.width
      height: root.hoverRegion.height
      visible: root.presenterAvailable && root.hasVisuals && width > 0 && height > 0

      HoverHandler {
        enabled: hoverTarget.visible
        onHoveredChanged: root.setSurfacePointerOver(hovered)
        onEnabledChanged: {
          if (!enabled && hovered) root.setSurfacePointerOver(false)
        }
        Component.onDestruction: {
          if (hovered) root.setSurfacePointerOver(false)
        }
      }
    }
    Keys.onPressed: function(event) {
      if (event.key === Qt.Key_Escape) {
        if (!root.service || !root.service.closeHubChooser(root.screenName)) root.close("escape")
        event.accepted = true
      }
    }

    Shape {
      x: root.capsuleOutline.bounds.x
      y: root.capsuleOutline.bounds.y
      width: root.capsuleOutline.bounds.width
      height: root.capsuleOutline.bounds.height
      visible: root.unifiedSurface && root.hasVisuals && !root.closedPeekPresentation
      preferredRendererType: Shape.CurveRenderer
      ShapePath {
        fillColor: Color.bar.background
        strokeWidth: -1
        PathSvg { path: root.capsuleOutline.perimeter }
      }
    }

    MouseArea {
      x: root.capsuleOutline.body.x
      y: root.capsuleOutline.body.y
      width: root.capsuleOutline.body.width
      height: root.capsuleOutline.body.height
      enabled: root.unifiedSurface && root.firstInputActive && !root.closedPeekPresentation
      cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
      onClicked: function(mouse) {
        if (root.opened) root.close("card-click")
        else {
          var key = ViewModel.activityKeyAtPoint(motion.visual.bodies, x + mouse.x, y + mouse.y)
          if (key) root.expandKey(key, "card")
        }
      }
    }

    ActivityVisual {
      id: bodyOne
      visible: !root.closedPeekPresentation
      backgroundVisible: !root.unifiedSurface
      service: root.service
      screenName: root.screenName
      visual: motion.visual.bodies[0]
      interactive: !root.closedPeekPresentation && root.frame.visible && drawn && visual.role !== "retiring"
        && outline.contentSafe !== false
      reducedMotion: root.reducedMotion
      detailHeightBudget: root.frame.detailHeightBudget
      outlineMetrics: root.metrics
      z: visual && visual.role === "expanded" ? 2 : 1
      onClicked: function(key) {
        if (root.opened) root.close("card-click")
        else root.expandKey(key, visual && visual.role === "secondary" ? "secondary" : "card")
      }
      onActionRequested: function(actionId) { root.invoke(actionId) }
      onSeekRequested: function(trackToken, positionSeconds) { root.seek(trackToken, positionSeconds) }
      onLayoutReported: function(key, widthToken, preferredHeight) { root.reportLayout(key, widthToken, preferredHeight, false) }
    }

    ActivityVisual {
      id: bodyTwo
      visible: !root.closedPeekPresentation
      backgroundVisible: !root.unifiedSurface
      service: root.service
      screenName: root.screenName
      visual: motion.visual.bodies[1]
      interactive: !root.closedPeekPresentation && root.frame.visible && drawn && visual.role !== "retiring"
        && outline.contentSafe !== false
      reducedMotion: root.reducedMotion
      detailHeightBudget: root.frame.detailHeightBudget
      outlineMetrics: root.metrics
      z: visual && visual.role === "expanded" ? 2 : 1
      onClicked: function(key) {
        if (root.opened) root.close("card-click")
        else root.expandKey(key, visual && visual.role === "secondary" ? "secondary" : "card")
      }
      onActionRequested: function(actionId) { root.invoke(actionId) }
      onSeekRequested: function(trackToken, positionSeconds) { root.seek(trackToken, positionSeconds) }
      onLayoutReported: function(key, widthToken, preferredHeight) { root.reportLayout(key, widthToken, preferredHeight, false) }
    }

    PeekContent {
      id: peekContent
      visual: root.peekVisual
      outline: root.peekOutline
      interactive: root.peekInputActive
      z: 3
      onClicked: root.promotePeek()
    }
  }
}
