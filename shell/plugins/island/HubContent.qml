pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Ui as Ui

Item {
  id: root

  required property var service
  required property string screenName
  required property var content
  property bool active: true
  property bool interactive: false
  property bool controlsEnabled: true
  property bool chooserNavigationEnabled: false
  property bool chooserSelectionEnabled: false
  property bool reducedMotion: false
  property bool titleOwnedByBody: false
  property bool artworkOwnedByBody: false
  property bool reportLayout: false
  property real heightBudget: 0
  readonly property string tool: content && content.tool ? content.tool : "music"
  readonly property string contentKey: content && content.key ? String(content.key) : ""
  readonly property int widthToken: Math.max(0, Math.round(width))
  readonly property var mediaPlayers: {
    var publisher = service ? service.music : null
    return publisher && Array.isArray(publisher.players) ? publisher.players : []
  }
  readonly property string mediaSourceLabel: {
    var publisher = service ? service.music : null
    for (var index = 0; index < mediaPlayers.length; index++) {
      if (mediaPlayers[index] && mediaPlayers[index].key === publisher.publishedKey) return String(mediaPlayers[index].label || "")
    }
    return ""
  }
  readonly property bool chooserOpen: active && interactive && service && service.hubState
    && service.hubState.expanded && service.hubState.ownerScreen === screenName
    && service.hubState.entityKey === (content && content.key ? content.key : "")
    && service.hubState.chooserOpen === true
  readonly property var activePanel: tool === "codex" ? codexLoader.item
    : tool === "weather" ? weatherLoader.item
    : tool === "agents" ? agentsLoader.item
    : tool === "notifications" ? notificationLoader.item
    : tool === "system" ? systemLoader.item : null
  readonly property real panelPreferredHeight: {
    var value = activePanel && activePanel.preferredHeight !== undefined ? Number(activePanel.preferredHeight) : 0
    return isFinite(value) && value > 0 ? value : 0
  }
  readonly property bool measurementReady: active && widthToken > 0 && preferredHeight > 0
    && (chooserOpen || tool === "music" || panelPreferredHeight > 0)
  readonly property real preferredHeight: {
    if (!active) return 0
    if (chooserOpen) return chooserColumn.implicitHeight + 32
    if (tool === "music") return content && content.media
      ? mediaContent.preferredHeight : emptyMusic.implicitHeight + 64
    return panelPreferredHeight > 0 ? panelPreferredHeight + 32 : 0
  }

  signal layoutReported(string key, int widthToken, real preferredHeight)

  function publishLayout() {
    if (!reportLayout || !measurementReady || !content || !content.key) return
    root.layoutReported(String(content.key), widthToken, preferredHeight)
  }

  function cycleMediaPlayer() {
    var publisher = service ? service.music : null
    if (!publisher || mediaPlayers.length < 2 || typeof publisher.selectPlayer !== "function") return false
    var currentIndex = -1
    for (var index = 0; index < mediaPlayers.length; index++) {
      if (mediaPlayers[index] && mediaPlayers[index].key === publisher.publishedKey) {
        currentIndex = index
        break
      }
    }
    var next = mediaPlayers[(currentIndex + 1) % mediaPlayers.length]
    return !!next && publisher.selectPlayer(String(next.key)) === true
  }

  onPreferredHeightChanged: layoutReportTimer.restart()
  onWidthTokenChanged: layoutReportTimer.restart()
  onContentKeyChanged: layoutReportTimer.restart()
  onHeightBudgetChanged: layoutReportTimer.restart()
  onMeasurementReadyChanged: layoutReportTimer.restart()
  Component.onCompleted: layoutReportTimer.restart()

  Timer {
    id: layoutReportTimer
    interval: 0
    repeat: false
    onTriggered: root.publishLayout()
  }

  Item {
    id: detailBody
    anchors.fill: parent
    anchors.margins: root.tool === "music" ? 0 : 12
    visible: root.active && !root.chooserOpen
    enabled: root.interactive && root.controlsEnabled

    MediaContent {
      id: mediaContent
      anchors.fill: parent
      visible: root.tool === "music" && !!root.content.media
      media: root.content.media || null
      actions: root.content.actions || []
      expanded: true
      interactive: root.interactive && root.controlsEnabled
      reducedMotion: root.reducedMotion
      titleOwnedByBody: root.titleOwnedByBody
      artworkOwnedByBody: root.artworkOwnedByBody
      headerRightInset: 32
      sourceLabel: root.mediaSourceLabel
      canCyclePlayer: root.mediaPlayers.length > 1
      onActionRequested: function(actionId) { root.service.music.control(root.content.media.trackToken, actionId) }
      onSeekRequested: function(trackToken, positionSeconds) { root.service.music.seekPublished(trackToken, positionSeconds) }
      onCyclePlayerRequested: root.cycleMediaPlayer()
    }

    Text {
      id: emptyMusic
      anchors.centerIn: parent
      visible: root.tool === "music" && !root.content.media
      text: "Play something in a browser, mpv or Spotify."
      width: Math.max(0, parent.width - 48)
      wrapMode: Text.WordWrap
      horizontalAlignment: Text.AlignHCenter
      textFormat: Text.PlainText
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: 12
    }

    Loader {
      id: codexLoader
      anchors.fill: parent
      active: root.active && root.tool === "codex"
      sourceComponent: Component { CodexPanel { usage: root.service.codexUsage } }
    }

    Loader {
      id: weatherLoader
      anchors.fill: parent
      active: root.active && root.tool === "weather"
      sourceComponent: Component { WeatherPanel { store: root.service.weather } }
    }

    Loader {
      id: agentsLoader
      anchors.fill: parent
      active: root.active && root.tool === "agents"
      sourceComponent: Component { AgentsPanel { store: root.service.agents } }
    }

    Loader {
      id: notificationLoader
      anchors.fill: parent
      active: root.active && root.tool === "notifications"
      sourceComponent: Component {
        NotificationPanel {
          store: root.service.notifications
          content: root.content.notification || null
        }
      }
    }

    Loader {
      id: systemLoader
      anchors.fill: parent
      active: root.active && root.tool === "system"
      sourceComponent: Component {
        SystemPanel {
          store: root.service.systemActivity
          content: root.content.systemEvent || null
        }
      }
    }
  }

  Item {
    id: chooserBody
    anchors.fill: parent
    anchors.margins: 12
    visible: root.chooserOpen
    enabled: visible

    Column {
      id: chooserColumn
      width: parent.width
      spacing: 2

      Item {
        id: chooserHeader
        width: parent.width
        implicitHeight: Math.max(chooserHeaderText.implicitHeight, chooserButton.height)

        Text {
          id: chooserHeaderText
          width: parent.width - 36
          text: "Open activity"
          textFormat: Text.PlainText
          color: Color.bar.text
          font.family: Style.font.family
          font.pixelSize: 14
          font.weight: Font.DemiBold
          elide: Text.ElideRight
        }
      }

      Repeater {
        id: chooserRepeater
        model: [
          { id: "music", label: "Music", icon: "media" },
          { id: "weather", label: "Weather", icon: "weather" },
          { id: "codex", label: "Codex", icon: "codex" },
          { id: "agents", label: "Agents", icon: "robot" },
          { id: "notifications", label: "Notifications", icon: "bell" },
          { id: "system", label: "System", icon: "CPU" }
        ]

        delegate: Ui.Button {
          id: chooserToolButton
          required property var modelData
          width: chooserColumn.width
          text: modelData.label
          iconText: ""
          leftAlign: true
          leftPadding: chooserToolButton.horizontalPadding + 20
          selected: root.tool === modelData.id
          foreground: Color.bar.text
          fontSize: 11
          focusable: root.chooserSelectionEnabled
          enabled: root.chooserSelectionEnabled
          Accessible.role: Accessible.Button
          Accessible.name: "Open " + modelData.label
          Accessible.focusable: enabled
          Accessible.onPressAction: if (enabled) root.service.chooseHubTool(modelData.id, root.screenName)
          onClicked: root.service.chooseHubTool(modelData.id, root.screenName)

          ActivityIcon {
            anchors.left: parent.left
            anchors.leftMargin: 7
            anchors.verticalCenter: parent.verticalCenter
            name: chooserToolButton.modelData.icon
            size: 14
            color: Color.bar.text
            fallbackText: ""
          }
        }
      }
    }
  }

  Ui.Button {
    id: chooserButton
    anchors.top: parent.top
    anchors.right: parent.right
    anchors.topMargin: 8
    anchors.rightMargin: 10
    width: 30
    height: 26
    z: 4
    visible: root.active && root.interactive
    enabled: visible && root.chooserNavigationEnabled
    text: root.chooserOpen ? "×" : "•••"
    foreground: Color.bar.text
    fontSize: 11
    focusable: visible
    tooltipText: root.chooserOpen ? "Close activity chooser" : "Open activity chooser"
    Accessible.role: Accessible.Button
    Accessible.name: tooltipText
    Accessible.focusable: visible
    Accessible.onPressAction: if (enabled) root.service.toggleHubChooser(root.screenName)
    onClicked: root.service.toggleHubChooser(root.screenName)
  }

  onChooserOpenChanged: if (chooserOpen) Qt.callLater(function() {
    var first = chooserRepeater.itemAt(0)
    if (root.chooserOpen && first) first.forceActiveFocus()
  })
}
