import QtQuick
import Quickshell
import qs.Ui as Ui

Ui.BarWidget {
  id: root

  moduleName: "luinbytes.island"
  // The attached panel supplies its own open indication. Quattro rounds a
  // positive extent to pixels and treats zero as a request for its default.
  readonly property real openPanelIndicatorWidth: 0.1
  readonly property real openPanelIndicatorHeight: openPanelIndicatorWidth
  readonly property var service: root.bar && root.bar.shell && typeof root.bar.shell.serviceFor === "function"
    ? root.bar.shell.serviceFor("luinbytes.island") : null
  property var registeredService: null
  readonly property real slotWidth: {
    var value = Number(root.setting("slotWidth", 250))
    return isFinite(value) ? Math.max(80, Math.min(320, value)) : 250
  }
  readonly property bool reducedMotion: root.setting("reducedMotion", false) === true
  readonly property string screenName: root.QsWindow.window && root.QsWindow.window.screen && root.QsWindow.window.screen.name
    ? String(root.QsWindow.window.screen.name) : ""
  property bool islandBarPointerOver: false
  property bool islandSurfacePointerOver: false
  readonly property bool islandPointerOver: islandBarPointerOver || islandSurfacePointerOver
  property bool islandSuppressionLease: false
  property bool islandSuppressionBaseline: false
  readonly property bool active: {
    if (!service || !service.activitiesByKey || !screenName) return false
    if (service.state.presentation.phase === "expanded" && service.state.presentation.ownerScreen === screenName) return true
    var keys = Object.keys(service.activitiesByKey)
    for (var i = 0; i < keys.length; i++) {
      var activity = service.activitiesByKey[keys[i]]
      if (!activity || !activity.target) continue
      if (activity.target.mode === "all") return true
      if (activity.target.mode === "focused" && screenName === service.focusedScreen) return true
      if (activity.target.mode === "screen" && screenName === String(activity.target.screen || "")) return true
    }
    return false
  }
  readonly property bool opened: surface.opened
  readonly property bool presenterAvailable: surface.presenterAvailable

  visible: (service && service.hubEntryVisible) || active || surface.hasVisuals
  implicitWidth: root.vertical ? Math.max(0, root.barSize) : slotWidth
  implicitHeight: root.vertical ? slotWidth : Math.min(Math.max(0, root.barSize), 22)

  function open(payload) {
    return surface.open(payload)
  }

  function close() {
    return surface.close("widget-close")
  }

  function diagnostic() {
    return surface.diagnostic()
  }

  function syncServiceRegistration() {
    var next = service && typeof service.registerWidget === "function" ? service : null
    if (registeredService === next) return
    if (registeredService) registeredService.unregisterWidget(root)
    registeredService = next
    if (registeredService) registeredService.registerWidget(root)
  }

  onServiceChanged: syncServiceRegistration()
  onScreenNameChanged: {
    if (registeredService) registeredService.schedulePresentationReconcile()
  }
  onPresenterAvailableChanged: {
    if (registeredService) registeredService.schedulePresentationReconcile()
  }
  Component.onCompleted: syncServiceRegistration()

  Component.onDestruction: {
    if (registeredService) {
      registeredService.unregisterWidget(root)
      registeredService = null
    }
    root.islandBarPointerOver = false
    root.islandSurfacePointerOver = false
    if (surface) surface.syncCenterHoverSuppression(true)
  }

  Item {
    id: idleHandle
    anchors.centerIn: parent
    width: root.vertical ? root.width : 44
    height: root.vertical ? 44 : root.height
    visible: root.presenterAvailable && root.service && root.service.hubEntryVisible
      && surface.frame.phase === "idle" && !surface.hasVisuals
    Accessible.role: Accessible.Button
    Accessible.name: "Open recent notifications"
    Accessible.onPressAction: root.open("notifications")
    Rectangle {
      anchors.centerIn: parent
      width: root.vertical ? 4 : 28
      height: root.vertical ? 28 : 4
      radius: 2
      color: surface.barInk
      opacity: idleMouse.containsMouse ? 0.85 : 0.55
    }
    MouseArea {
      id: idleMouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: root.open("notifications")
    }
  }

  HoverHandler {
    enabled: root.visible && surface.frame.visible && root.width > 0 && root.height > 0
    onHoveredChanged: {
      root.islandBarPointerOver = hovered
      if (surface) surface.syncCenterHoverSuppression()
    }
    onEnabledChanged: {
      if (!enabled && hovered) {
        root.islandBarPointerOver = false
        if (surface) surface.syncCenterHoverSuppression()
      }
    }
    Component.onDestruction: {
      if (hovered) {
        root.islandBarPointerOver = false
        if (surface) surface.syncCenterHoverSuppression()
      }
    }
  }

  IslandSurface {
    id: surface
    service: root.service
    anchorItem: root
    bar: root.bar
    slotWidth: root.slotWidth
    reducedMotion: root.reducedMotion
  }
}
