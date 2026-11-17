import QtQuick
import QtQuick.Shapes
import Quickshell
import Quickshell.Hyprland
import Quickshell.Wayland
import qs.Commons as Commons
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
  readonly property var barState: bar && bar.shell ? bar.shell.bar : null
  readonly property bool presenterAvailable: !!anchorItem && anchorItem.visible && anchorItem.width > 0 && anchorItem.height > 0
    && !!anchorWindow && anchorWindow.visible && !!anchorWindow.screen && !(barState ? barState.barHidden : bar && bar.barHidden) && !screenFullscreen
  readonly property real barThickness: barState && typeof barState.barSizeFor === "function"
    ? barState.barSizeFor(screenName) : anchorWindow && anchorWindow.thickness !== undefined
    ? anchorWindow.thickness : bar && bar.barSize ? bar.barSize : 0
  readonly property var activePeekContent: ViewModel.peekContent(service ? service.peekActive : null)
  readonly property var peekMeasurement: {
    var content = root.activePeekContent
    if (!content || !content.key) return { key: "", width: 0, height: 0 }
    var barSize = root.barThickness
    var horizontal = root.barPosition === "top" || root.barPosition === "bottom"
    var textHeight = peekTitleTextMetrics.boundingRect.height
      + (content.value ? 2 + peekValueTextMetrics.boundingRect.height : 0)
    var measuredHeight = Math.ceil(Math.max(18, textHeight) + 24)
    var clearanceHeight = horizontal ? Math.ceil(barSize + 17) : 0
    return {
      key: content.key,
      width: Math.ceil(Math.max(peekTitleTextMetrics.advanceWidth, peekValueTextMetrics.advanceWidth) + 50),
      height: Math.max(measuredHeight, clearanceHeight)
    }
  }
  readonly property var metrics: {
    anchorWatcher.transform
    var revision = service && service.state ? service.state.revision : 0
    return {
      screen: { width: screen ? screen.width : 0, height: screen ? screen.height : 0 },
      anchor: { x: anchorScreenPos.x, y: anchorScreenPos.y, width: anchorItem ? anchorItem.width : 0, height: anchorItem ? anchorItem.height : 0 },
      bar: { position: barPosition, size: root.barThickness },
      focusedScreen: service ? service.focusedScreen : "",
      slotWidth: slotWidth,
      compactHeight: Math.min(22, Math.max(12, anchorItem ? anchorItem.height : 22)),
      margin: 8,
      gap: 6,
      peekMeasurement: root.peekMeasurement,
      nowMs: Date.now() + revision * 0
    }
  }
  readonly property var compactSchedule: root.service && typeof root.service.compactScheduleFor === "function"
    ? root.service.compactScheduleFor(root.screenName) : root.service && root.service.hubSchedule ? root.service.hubSchedule : null
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
  readonly property var splitShape: motion.visual.split
  readonly property var primaryRect: root.splitShape ? root.splitShape.primary : motion.visual.capsule.rect
  readonly property var capsuleOutline: ViewModel.barIslandOutline(root.primaryRect, root.metrics)
  readonly property var bubbleOutline: ViewModel.plainActivityOutline(root.splitShape ? root.splitShape.bubble : null)
  readonly property color barBase: bar && bar.background !== undefined ? bar.background : Commons.Color.bar.background
  readonly property color barInk: bar && bar.barForeground !== undefined ? bar.barForeground : Commons.Color.bar.text
  readonly property string requestedLook: bar && bar.shell && bar.shell.barConfig
    ? bar.shell.barConfig.background || (bar.shell.barConfig.transparent ? "none" : "opaque") : "opaque"
  // The host holds its previous fill until the wallpaper foreground is ready.
  property bool glassy: false
  Binding on glassy {
    when: root.requestedLook !== "none"
    value: root.requestedLook === "glassy"
    restoreMode: Binding.RestoreNone
  }
  readonly property color capsuleFill: bar && bar.transparent ? "transparent" : root.glassy
    ? Qt.rgba(barBase.r, barBase.g, barBase.b, Math.min(barBase.a, 0.35)) : barBase
  readonly property var peekVisual: motion.visual.peek
  readonly property var peekOutline: root.closedPeekPresentation ? root.capsuleOutline
    : ViewModel.plainActivityOutline(root.peekVisual ? root.peekVisual.rect : null)
  readonly property bool peekInputActive: root.presenterAvailable && !!root.frame.peek && !!root.peekVisual && root.peekVisual.visible
    && root.peekVisual.key === root.frame.peek.content.key && peekContent.contentInteractive
    && !!root.peekOutline && root.peekOutline.contentSafe !== false
  readonly property var firstInputOutline: root.closedPeekPresentation ? root.peekOutline
    : root.unifiedSurface ? root.capsuleOutline : bodyOne.outline
  readonly property bool firstInputContentSafe: !!root.firstInputOutline && root.firstInputOutline.contentSafe !== false
  readonly property bool firstInputActive: root.presenterAvailable && (root.closedPeekPresentation ? root.peekInputActive : root.unifiedSurface
    ? motion.visual.capsule.visible && (bodyOne.interactive || bodyTwo.interactive) : bodyOne.interactive) && root.firstInputContentSafe
  readonly property var secondInputOutline: root.peekVisual && root.peekVisual.placement === "below" ? root.peekOutline
    : root.splitShape ? root.bubbleOutline : bodyTwo.outline
  readonly property bool secondInputContentSafe: !!root.secondInputOutline && root.secondInputOutline.contentSafe !== false
  readonly property bool secondInputActive: root.presenterAvailable && (root.peekVisual && root.peekVisual.placement === "below" ? root.peekInputActive
    : root.splitShape ? !!root.frame.secondary && !!root.splitShape.bubble
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

  function expandKey(key, reason) {
    if (service && service.hubEntryVisible) {
      var content = frame.secondary && frame.secondary.key === key ? frame.secondary : frame.primary
      return !!content && content.key === key && service.openHub(content.tool, screenName, key)
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

  function setHoverSuppression(value) {
    if (typeof bar.setCenterHoverRevealSuppressed === "function")
      bar.setCenterHoverRevealSuppressed(value)
    else
      bar.centerHoverRevealSuppressed = value
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
      setHoverSuppression(owner.islandSuppressionBaseline === true)
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
      setHoverSuppression(true)
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
      composition: root.splitShape && root.splitShape.bubble ? "split" : root.unifiedSurface ? "islandcn" : "independent",
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
        preferredHeight: service && service.hubState && service.hubState.layout ? service.hubState.layout.preferredHeight : 0,
        preflightKey: frame.preflight ? frame.preflight.key : ""
      },
      motion: {
        first: bodyOne.visual ? { key: bodyOne.visual.key, role: bodyOne.visual.role, velocity: bodyOne.visual.velocity } : null,
        second: bodyTwo.visual ? { key: bodyTwo.visual.key, role: bodyTwo.visual.role, velocity: bodyTwo.visual.velocity } : null
      },
      media: bodyOne.mediaDiagnostic() || bodyTwo.mediaDiagnostic(),
      theme: {
        fontFamily: Commons.Style.font.family,
        background: String(root.capsuleFill),
        foreground: String(root.barInk),
        accent: String(Commons.Color.accent)
      }
    }
  }

  screen: anchorWindow ? anchorWindow.screen : null
  // Map after the host commits its strip. On the same layer the last mapped
  // window receives the pointer in the part of the strip the island occupies.
  visible: false
  Binding on visible {
    value: !!root.anchorWindow && root.anchorWindow.visible && !!root.anchorWindow.screen
    delayed: true
  }
  color: "transparent"
  exclusionMode: ExclusionMode.Ignore
  anchors { top: true; bottom: true; left: true; right: true }

  // Omarchy scopes its glass blur and alpha cutoff to the bar layer namespace.
  WlrLayershell.namespace: "omarchy-bar"
  WlrLayershell.layer: WlrLayer.Top
  WlrLayershell.keyboardFocus: presenterAvailable && opened ? (focusPrimed ? WlrKeyboardFocus.OnDemand : WlrKeyboardFocus.Exclusive) : WlrKeyboardFocus.None

  HyprlandFocusGrab {
    active: root.opened && root.grabReady
    windows: [root]
    onCleared: root.close("outside-click")
  }

  mask: Region {
    OutlineRegion { outline: root.firstInputActive ? root.firstInputOutline : null }
    OutlineRegion { outline: root.secondInputActive ? root.secondInputOutline : null }
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
    id: peekTitleTextMetrics
    text: root.activePeekContent ? root.activePeekContent.label || "Activity" : ""
    font.family: Commons.Style.font.family
    font.pixelSize: 12
    font.weight: Font.DemiBold
  }

  TextMetrics {
    id: peekValueTextMetrics
    text: root.activePeekContent ? root.activePeekContent.value || "" : ""
    font.family: Commons.Style.font.family
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
      root.setHoverSuppression(owner.islandSuppressionBaseline === true)
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
        root.close("escape")
        event.accepted = true
      }
    }

    // The host already paints the strip. Paint only the continuation beyond
    // its edge, or a translucent theme would get a second coat inside the bar.
    Item {
      id: outsideBar
      anchors.fill: parent
      anchors.topMargin: root.barPosition === "top" ? root.barThickness : 0
      anchors.bottomMargin: root.barPosition === "bottom" ? root.barThickness : 0
      anchors.leftMargin: root.barPosition === "left" ? root.barThickness : 0
      anchors.rightMargin: root.barPosition === "right" ? root.barThickness : 0
      clip: true

      Item {
        id: outsideBarCanvas
        x: -outsideBar.x
        y: -outsideBar.y
        Shape {
          x: root.capsuleOutline.bounds.x
          y: root.capsuleOutline.bounds.y
          width: root.capsuleOutline.bounds.width
          height: root.capsuleOutline.bounds.height
          visible: (root.unifiedSurface || root.closedPeekPresentation) && root.hasVisuals
          preferredRendererType: Shape.CurveRenderer
          ShapePath {
            fillColor: root.capsuleFill
            strokeWidth: -1
            PathSvg { path: root.capsuleOutline.perimeter }
          }
        }

        Shape {
          x: root.capsuleOutline.bounds.x + (rotation === 90 ? root.capsuleOutline.bounds.width : 0)
          y: root.capsuleOutline.bounds.y
          width: rotation === 90 ? motion.visual.capsule.rect.height : motion.visual.capsule.rect.width
          height: rotation === 90 ? motion.visual.capsule.rect.width : motion.visual.capsule.rect.height
          transformOrigin: Item.TopLeft
          rotation: root.splitShape && root.splitShape.vertical ? 90 : 0
          visible: root.unifiedSurface && !!root.splitShape && !!root.splitShape.bubble
          preferredRendererType: Shape.CurveRenderer
          ShapePath {
            fillColor: root.capsuleFill
            strokeWidth: -1
            PathSvg { path: root.splitShape ? root.splitShape.neck : "" }
          }
        }

        Rectangle {
          visible: root.unifiedSurface && !!root.splitShape && !!root.splitShape.bubble
          x: root.bubbleOutline.body.x
          y: root.bubbleOutline.body.y
          width: root.bubbleOutline.body.width
          height: root.bubbleOutline.body.height
          radius: Math.min(width, height) / 2
          color: root.capsuleFill
        }

        Shape {
          x: root.peekOutline ? root.peekOutline.bounds.x : 0
          y: root.peekOutline ? root.peekOutline.bounds.y : 0
          width: root.peekOutline ? root.peekOutline.bounds.width : 0
          height: root.peekOutline ? root.peekOutline.bounds.height : 0
          visible: !!root.peekVisual && root.peekVisual.visible && !root.closedPeekPresentation
          preferredRendererType: Shape.CurveRenderer
          ShapePath {
            fillColor: root.capsuleFill
            strokeWidth: -1
            PathSvg { path: root.peekOutline ? root.peekOutline.perimeter : "" }
          }
        }
      }
    }

    MouseArea {
      x: root.capsuleOutline.body.x
      y: root.capsuleOutline.body.y
      width: root.capsuleOutline.body.width
      height: root.capsuleOutline.body.height
      enabled: !root.opened && root.unifiedSurface && root.firstInputActive && !root.closedPeekPresentation
      cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
      onClicked: function(mouse) {
        var key = ViewModel.activityKeyAtPoint(motion.visual.bodies, x + mouse.x, y + mouse.y)
        if (key) root.expandKey(key, "card")
      }
    }

    ActivityVisual {
      id: bodyOne
      visible: !root.closedPeekPresentation
      backgroundLayer: outsideBarCanvas
      backgroundVisible: !root.unifiedSurface
      islandSkin: root.unifiedSurface
      foreground: root.barInk
      surfaceColor: root.capsuleFill
      service: root.service
      screenName: root.screenName
      visual: motion.visual.bodies[0]
      interactive: !root.closedPeekPresentation && root.frame.visible && drawn && visual.role !== "retiring"
        && outline.contentSafe !== false
      reducedMotion: root.reducedMotion
      detailHeightBudget: root.frame.detailHeightBudget || 0
      outlineMetrics: root.metrics
      z: visual && visual.role === "expanded" ? 2 : 1
      onClicked: function(key) {
        root.expandKey(key, visual && visual.role === "secondary" ? "secondary" : "card")
      }
      onActionRequested: function(actionId) { root.invoke(actionId) }
      onSeekRequested: function(trackToken, positionSeconds) { root.seek(trackToken, positionSeconds) }
      onLayoutReported: function(key, widthToken, preferredHeight) { root.reportLayout(key, widthToken, preferredHeight, false) }
    }

    ActivityVisual {
      id: bodyTwo
      visible: !root.closedPeekPresentation
      backgroundLayer: outsideBarCanvas
      backgroundVisible: !root.unifiedSurface
      islandSkin: root.unifiedSurface
      foreground: root.barInk
      surfaceColor: root.capsuleFill
      service: root.service
      screenName: root.screenName
      visual: motion.visual.bodies[1]
      interactive: !root.closedPeekPresentation && root.frame.visible && drawn && visual.role !== "retiring"
        && outline.contentSafe !== false
      reducedMotion: root.reducedMotion
      detailHeightBudget: root.frame.detailHeightBudget || 0
      outlineMetrics: root.metrics
      z: visual && visual.role === "expanded" ? 2 : 1
      onClicked: function(key) {
        root.expandKey(key, visual && visual.role === "secondary" ? "secondary" : "card")
      }
      onActionRequested: function(actionId) { root.invoke(actionId) }
      onSeekRequested: function(trackToken, positionSeconds) { root.seek(trackToken, positionSeconds) }
      onLayoutReported: function(key, widthToken, preferredHeight) { root.reportLayout(key, widthToken, preferredHeight, false) }
    }

    // Expanded controls get first refusal. Unhandled clicks in the original
    // bar slot still collapse the island.
    MouseArea {
      x: root.metrics.anchor.x
      y: root.metrics.anchor.y
      width: root.metrics.anchor.width
      height: root.metrics.anchor.height
      enabled: root.opened
      z: 0
      cursorShape: Qt.PointingHandCursor
      onClicked: root.close("bar-click")
    }

    PeekContent {
      id: peekContent
      foreground: root.barInk
      visual: root.peekVisual
      outline: root.peekOutline
      interactive: root.peekInputActive
      z: 3
      onClicked: root.promotePeek()
    }
  }
}
