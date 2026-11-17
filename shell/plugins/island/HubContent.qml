pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons as Commons

Item {
  id: root
  property color foregroundColor: Commons.Color.bar.text

  required property var service
  required property string screenName
  required property var content
  property bool active: true
  property bool interactive: false
  property bool controlsEnabled: true
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
  readonly property var activePanel: tool === "codex" ? codexLoader.item
    : tool === "weather" ? weatherLoader.item
    : tool === "downloads" ? downloadPanel : tool === "agents" ? agentsLoader.item
    : tool === "notifications" ? notificationLoader.item
    : tool === "system" ? systemLoader.item : null
  readonly property real panelPreferredHeight: {
    var value = activePanel && activePanel.preferredHeight !== undefined ? Number(activePanel.preferredHeight) : 0
    return isFinite(value) && value > 0 ? value : 0
  }
  readonly property bool measurementReady: active && widthToken > 0 && preferredHeight > 0
    && (tool === "music" || panelPreferredHeight > 0)
  readonly property real preferredHeight: {
    if (!active) return 0
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
    visible: root.active
    enabled: root.interactive && root.controlsEnabled

    Column {
      id: downloadPanel
      width: parent.width
      spacing: 6
      visible: root.tool === "downloads"
      readonly property var snapshot: root.service && root.service.downloads ? root.service.downloads.snapshot : ({})
      readonly property var rows: (snapshot.active || []).concat(snapshot.recent || [])
      readonly property real preferredHeight: implicitHeight
      Text {
        text: "Downloads"
        color: root.foregroundColor
        font.family: Commons.Style.font.family
        font.weight: Font.DemiBold
      }
      Text {
        visible: !downloadPanel.rows.length
        text: downloadPanel.snapshot.available ? "No recent downloads" : "Downloads folder unavailable"
        color: root.foregroundColor
        font.family: Commons.Style.font.family
      }
      Repeater {
        model: downloadPanel.rows.slice(0, 8)
        delegate: Text {
          required property var modelData
          width: downloadPanel.width
          text: (modelData.completed ? "✓ " : "↓ ") + modelData.name + " · " + Number(modelData.size / 1048576).toLocaleString(Qt.locale(), "f", 1) + " MiB"
          textFormat: Text.PlainText
          elide: Text.ElideMiddle
          color: root.foregroundColor
          font.family: Commons.Style.font.family
        }
      }
    }
    MediaContent {
      foregroundColor: root.foregroundColor
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
      color: Commons.Color.muted
      font.family: Commons.Style.font.family
      font.pixelSize: 12
    }

    Loader {
      id: codexLoader
      anchors.fill: parent
      active: root.active && root.tool === "codex"
      sourceComponent: Component {
        CodexPanel {
          foregroundColor: root.foregroundColor
          usage: root.service.codexUsage
        }
      }
    }

    Loader {
      id: weatherLoader
      anchors.fill: parent
      active: root.active && root.tool === "weather"
      sourceComponent: Component {
        WeatherPanel {
          foregroundColor: root.foregroundColor
          store: root.service.weather
        }
      }
    }

    Loader {
      id: agentsLoader
      anchors.fill: parent
      active: root.active && root.tool === "agents"
      sourceComponent: Component {
        AgentsPanel {
          foregroundColor: root.foregroundColor
          store: root.service.agents
        }
      }
    }

    Loader {
      id: notificationLoader
      anchors.fill: parent
      active: root.active && root.tool === "notifications"
      sourceComponent: Component {
        NotificationPanel {
          foregroundColor: root.foregroundColor
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
          foregroundColor: root.foregroundColor
          store: root.service.systemActivity
          content: root.content.systemEvent || null
        }
      }
    }
  }
}
