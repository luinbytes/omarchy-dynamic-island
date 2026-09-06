import QtQuick
import QtQuick.Effects
import QtQuick.Shapes
import qs.Commons
import qs.Ui as Ui

Item {
  id: root

  property var media: null
  property var actions: []
  property bool expanded: false
  property bool interactive: false
  property bool reducedMotion: false
  property bool titleOwnedByBody: false
  property bool artworkOwnedByBody: false
  property real headerRightInset: 32
  property string sourceLabel: ""
  property bool canCyclePlayer: false
  readonly property bool minimal: !expanded && width < 64
  readonly property real preferredHeight: expanded ? 12 + 48 + 8 + 28 + 20 + 44 + 8 : 22
  readonly property string subtitle: media && media.artist ? String(media.artist) : sourceLabel
  signal actionRequested(string actionId)
  signal seekRequested(string trackToken, real positionSeconds)
  signal cyclePlayerRequested()

  readonly property bool hasTiming: !!media && typeof media.positionSeconds === "number" && typeof media.durationSeconds === "number" && media.durationSeconds > 0
  readonly property bool canSeek: root.interactive && !!media && media.canSeek === true && root.hasTiming
  readonly property string artworkStatus: {
    var status = root.expanded ? expandedArtImage.status : compactArtImage.status
    if (status === Image.Ready) return "ready"
    if (status === Image.Error) return "error"
    if (status === Image.Loading) return "loading"
    return "fallback"
  }

  function actionAvailable(actionId) {
    for (var index = 0; index < actions.length; index++) {
      if (actions[index].id === actionId) return actions[index].enabled !== false
    }
    return false
  }

  function actionEnabled(actionId) {
    return root.interactive && root.actionAvailable(actionId)
  }

  function timeText(seconds) {
    var value = Math.max(0, Math.floor(Number(seconds) || 0))
    return Math.floor(value / 60) + ":" + String(value % 60).padStart(2, "0")
  }

  function seekAt(ratio) {
    if (!root.canSeek || !root.media) return
    root.seekRequested(root.media.trackToken, Math.max(0, Math.min(1, ratio)) * root.media.durationSeconds)
  }

  onMediaChanged: {
    if (!media || seekTrackToken !== media.trackToken) {
      seeking = false
      seekTrackToken = ""
    }
  }

  property bool seeking: false
  property string seekTrackToken: ""
  property real seekPreview: 0

  Item {
    anchors.fill: parent
    visible: !root.expanded

    Item {
      id: compactArt
      visible: !root.artworkOwnedByBody
      width: 16
      height: 16
      anchors.left: parent.left
      anchors.leftMargin: root.minimal ? (parent.width - width) / 2 : 6
      anchors.verticalCenter: parent.verticalCenter
      clip: true

      Rectangle { anchors.fill: parent; radius: 4; color: Color.muted }
      Rectangle { id: compactArtMask; anchors.fill: parent; radius: 4; visible: false; layer.enabled: true }

      Image {
        id: compactArtImage
        anchors.fill: parent
        source: root.media && root.media.artUrl ? root.media.artUrl : ""
        sourceSize.width: 16
        sourceSize.height: 16
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
        visible: status === Image.Ready
        layer.enabled: true
        layer.effect: MultiEffect {
          maskEnabled: true
          maskSource: compactArtMask
        }
      }

      Shape {
        anchors.centerIn: parent
        width: 10
        height: 10
        visible: compactArtImage.status !== Image.Ready
        ShapePath {
          fillColor: Color.bar.background
          strokeColor: "transparent"
          startX: 6
          startY: 1
          PathLine { x: 6; y: 7 }
          PathLine { x: 2; y: 8.5 }
          PathLine { x: 2; y: 3 }
          PathLine { x: 6; y: 1 }
        }
        Rectangle { x: 6; y: 7; width: 3; height: 3; radius: 1.5; color: Color.bar.background }
      }
    }

    Text {
      x: compactArt.x + compactArt.width + 6
      width: Math.max(0, compactIndicator.x - x - 6)
      visible: !root.minimal && !root.titleOwnedByBody
      anchors.verticalCenter: parent.verticalCenter
      text: root.media ? root.media.title : ""
      textFormat: Text.PlainText
      color: Color.bar.text
      font.family: Style.font.family
      font.pixelSize: 11
      font.weight: Font.DemiBold
      elide: Text.ElideRight
    }

    Item {
      id: compactIndicator
      visible: !root.minimal
      width: 14
      height: 14
      anchors.right: parent.right
      anchors.rightMargin: 6
      anchors.verticalCenter: parent.verticalCenter

      Row {
        anchors.centerIn: parent
        spacing: 1
        Repeater {
          model: 3
          delegate: Rectangle {
            required property int index
            width: 3
            height: 3
            anchors.verticalCenter: parent.verticalCenter
            radius: 1.5
            color: root.media && root.media.playing ? Color.accent : Color.muted
            SequentialAnimation on height {
              running: root.interactive && !root.reducedMotion && !root.expanded && !root.minimal && root.media && root.media.playing
              loops: Animation.Infinite
              PauseAnimation { duration: index * 120 }
              NumberAnimation { to: 4 + index * 2; duration: 320 + index * 40 }
              NumberAnimation { to: 3; duration: 360 + index * 40 }
            }
          }
        }
      }
    }
  }

  Item {
    anchors.fill: parent
    visible: root.expanded

    Item {
      id: expandedArt
      visible: !root.artworkOwnedByBody
      width: 48
      height: 48
      anchors.left: parent.left
      anchors.leftMargin: 12
      anchors.top: parent.top
      anchors.topMargin: 12
      clip: true

      Rectangle { anchors.fill: parent; radius: 12; color: Color.muted }
      Rectangle { id: expandedArtMask; anchors.fill: parent; radius: 12; visible: false; layer.enabled: true }

      Image {
        id: expandedArtImage
        anchors.fill: parent
        source: root.media && root.media.artUrl ? root.media.artUrl : ""
        sourceSize.width: 48
        sourceSize.height: 48
        fillMode: Image.PreserveAspectCrop
        asynchronous: true
        visible: status === Image.Ready
        layer.enabled: true
        layer.effect: MultiEffect {
          maskEnabled: true
          maskSource: expandedArtMask
        }
      }

      Shape {
        anchors.centerIn: parent
        width: 30
        height: 30
        visible: expandedArtImage.status !== Image.Ready
        ShapePath {
          fillColor: Color.bar.background
          strokeColor: "transparent"
          startX: 18
          startY: 2
          PathLine { x: 18; y: 21 }
          PathLine { x: 6; y: 25 }
          PathLine { x: 6; y: 8 }
          PathLine { x: 18; y: 2 }
        }
        Rectangle { x: 18; y: 20; width: 9; height: 9; radius: 4.5; color: Color.bar.background }
      }
    }

    Text {
      id: title
      anchors.left: expandedArt.right
      anchors.leftMargin: 12
      anchors.right: expandedIndicator.left
      anchors.rightMargin: 8
      anchors.top: expandedArt.top
      text: root.media ? root.media.title : ""
      textFormat: Text.PlainText
      color: Color.bar.text
      font.family: Style.font.family
      font.pixelSize: 14
      font.weight: Font.DemiBold
      elide: Text.ElideRight
      visible: !root.titleOwnedByBody
    }

    Text {
      id: subtitleText
      anchors.left: title.left
      anchors.right: title.right
      anchors.top: title.bottom
      anchors.topMargin: 4
      text: root.subtitle
      textFormat: Text.PlainText
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: 11
      elide: Text.ElideRight
      visible: text !== "" && !root.titleOwnedByBody
    }

    Item {
      id: expandedIndicator
      width: 18
      height: 18
      anchors.right: parent.right
      anchors.rightMargin: 12 + root.headerRightInset
      anchors.top: expandedArt.top

      Row {
        anchors.centerIn: parent
        spacing: 1
        Repeater {
          model: 3
          delegate: Rectangle {
            required property int index
            width: 3
            height: 3
            anchors.verticalCenter: parent.verticalCenter
            radius: 1.5
            color: root.media && root.media.playing ? Color.accent : Color.muted
            SequentialAnimation on height {
              running: root.interactive && !root.reducedMotion && root.expanded && root.media && root.media.playing
              loops: Animation.Infinite
              PauseAnimation { duration: index * 120 }
              NumberAnimation { to: 5 + index * 2; duration: 320 + index * 40 }
              NumberAnimation { to: 3; duration: 360 + index * 40 }
            }
          }
        }
      }
    }

    Item {
      id: timeline
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.leftMargin: 12
      anchors.rightMargin: 12
      anchors.top: expandedArt.bottom
      anchors.topMargin: 8
      height: 28
      activeFocusOnTab: root.canSeek
      Rectangle {
        anchors.fill: parent
        color: "transparent"
        radius: 4
        border.width: parent.activeFocus ? 1 : 0
        border.color: Color.accent
      }
      Accessible.role: Accessible.Slider
      Accessible.name: "Playback position"
      readonly property real value: root.hasTiming ? (root.seeking ? root.seekPreview : root.media.positionSeconds) : 0
      readonly property real minimumValue: 0
      readonly property real maximumValue: root.hasTiming ? root.media.durationSeconds : 0
      readonly property real stepSize: 5
      Accessible.readOnly: !root.canSeek
      Accessible.onIncreaseAction: if (root.canSeek) root.seekAt((value + stepSize) / maximumValue)
      Accessible.onDecreaseAction: if (root.canSeek) root.seekAt((value - stepSize) / maximumValue)
      Keys.onLeftPressed: function(event) {
        if (!root.canSeek || !root.media) return
        root.seekAt((root.media.positionSeconds - 5) / root.media.durationSeconds)
        event.accepted = true
      }
      Keys.onRightPressed: function(event) {
        if (!root.canSeek || !root.media) return
        root.seekAt((root.media.positionSeconds + 5) / root.media.durationSeconds)
        event.accepted = true
      }

      Text {
        anchors.left: parent.left
        anchors.top: parent.top
        text: root.hasTiming ? root.timeText(root.seeking ? root.seekPreview : root.media.positionSeconds)
          : root.media && root.media.playing ? "Playing" : "Paused"
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: 10
      }

      Text {
        anchors.right: parent.right
        anchors.top: parent.top
        text: root.hasTiming ? "−" + root.timeText(Math.max(0, root.media.durationSeconds - (root.seeking ? root.seekPreview : root.media.positionSeconds))) : ""
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: 10
      }

      Rectangle {
        id: timelineTrack
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.bottom: parent.bottom
        height: 3
        radius: 1.5
        color: Color.muted
        visible: root.hasTiming

        Rectangle {
          width: parent.width * (root.hasTiming ? Math.max(0, Math.min(1, (root.seeking ? root.seekPreview : root.media.positionSeconds) / root.media.durationSeconds)) : 0)
          height: parent.height
          radius: parent.radius
          color: Color.accent
        }
      }

      MouseArea {
        anchors.fill: parent
        enabled: root.interactive
        cursorShape: root.canSeek ? Qt.PointingHandCursor : Qt.ArrowCursor
        onPressed: function(mouse) {
          if (!root.canSeek) return
          root.seeking = true
          root.seekTrackToken = root.media.trackToken
          root.seekPreview = Math.max(0, Math.min(1, mouse.x / width)) * root.media.durationSeconds
        }
        onPositionChanged: function(mouse) {
          if (root.seeking && root.hasTiming) root.seekPreview = Math.max(0, Math.min(1, mouse.x / width)) * root.media.durationSeconds
        }
        onReleased: {
          if (root.seeking && root.seekTrackToken === root.media.trackToken) root.seekRequested(root.seekTrackToken, root.seekPreview)
          root.seeking = false
          root.seekTrackToken = ""
        }
        onCanceled: {
          root.seeking = false
          root.seekTrackToken = ""
        }
      }
    }

    Row {
      anchors.horizontalCenter: parent.horizontalCenter
      anchors.bottom: parent.bottom
      anchors.bottomMargin: 8
      spacing: 12

      Repeater {
        model: ["previous", "playPause", "next"]

        delegate: Item {
          id: control
          required property string modelData
          readonly property string actionId: modelData
          readonly property bool controlEnabled: root.actionEnabled(actionId)
          width: 44
          height: 44
          opacity: root.actionAvailable(actionId) ? 1 : 0.45
          activeFocusOnTab: controlEnabled
          Keys.onReturnPressed: if (controlEnabled) root.actionRequested(actionId)
          Keys.onEnterPressed: if (controlEnabled) root.actionRequested(actionId)
          Keys.onSpacePressed: if (controlEnabled) root.actionRequested(actionId)

          Item {
            anchors.fill: parent
            enabled: control.controlEnabled
            Accessible.role: Accessible.Button
            Accessible.name: control.actionId === "previous" ? "Previous" : control.actionId === "next" ? "Next" : root.media && root.media.playing ? "Pause" : "Play"
            Accessible.focusable: control.controlEnabled
            Accessible.focused: control.activeFocus
            Accessible.onPressAction: if (control.controlEnabled) root.actionRequested(control.actionId)
          }

          Rectangle {
            anchors.fill: parent
            radius: width / 2
            color: "transparent"
            border.width: control.activeFocus ? 1 : 0
            border.color: Color.accent
          }

          Shape {
            width: 24
            height: 24
            anchors.centerIn: parent
            visible: control.actionId === "playPause" && (!root.media || !root.media.playing)
            ShapePath {
              fillColor: Color.bar.text
              strokeColor: "transparent"
              startX: 5
              startY: 3
              PathLine { x: 22; y: 12 }
              PathLine { x: 5; y: 21 }
              PathLine { x: 5; y: 3 }
            }
          }

          Item {
            width: 24
            height: 24
            anchors.centerIn: parent
            visible: control.actionId === "playPause" && root.media && root.media.playing
            Rectangle { x: 4; y: 3; width: 4; height: 18; color: Color.bar.text }
            Rectangle { x: 16; y: 3; width: 4; height: 18; color: Color.bar.text }
          }

          Item {
            width: 24
            height: 24
            anchors.centerIn: parent
            visible: control.actionId === "previous" || control.actionId === "next"
            Rectangle { x: control.actionId === "previous" ? 2 : 20; y: 3; width: 3; height: 18; color: Color.bar.text }
            Shape {
              width: 20
              height: 24
              x: control.actionId === "previous" ? 4 : 0
              ShapePath {
                fillColor: Color.bar.text
                strokeColor: "transparent"
                startX: control.actionId === "previous" ? 18 : 2
                startY: 3
                PathLine { x: control.actionId === "previous" ? 2 : 18; y: 12 }
                PathLine { x: control.actionId === "previous" ? 18 : 2; y: 21 }
                PathLine { x: control.actionId === "previous" ? 18 : 2; y: 3 }
              }
            }
          }

          MouseArea {
            anchors.fill: parent
            enabled: root.interactive
            cursorShape: control.controlEnabled ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: {
              if (!control.controlEnabled) return
              control.forceActiveFocus()
              root.actionRequested(control.actionId)
            }
          }
        }
      }
    }

    Ui.Button {
      id: playerSelector
      anchors.right: parent.right
      anchors.rightMargin: 12
      anchors.bottom: parent.bottom
      anchors.bottomMargin: 15
      width: 34
      height: 34
      visible: root.canCyclePlayer
      enabled: visible && root.interactive
      text: "⇄"
      foreground: Color.bar.text
      fontSize: 13
      focusable: enabled
      tooltipText: "Switch media player"
      Accessible.role: Accessible.Button
      Accessible.name: tooltipText
      Accessible.focusable: enabled
      Accessible.onPressAction: if (enabled) root.cyclePlayerRequested()
      onClicked: root.cyclePlayerRequested()
    }
  }
}
