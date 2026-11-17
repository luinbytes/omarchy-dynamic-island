import QtQuick
import QtQuick.Controls
import QtQuick.Shapes
import QtQuick.Window
import "MotionModel.js" as Motion

Window {
  id: root
  title: "Island · Split and merge"
  width: 390
  height: 140
  minimumWidth: 290
  minimumHeight: 140
  visible: true
  color: "#24262b"

  property real elapsed: 0
  property alias reducedMotion: reduced.checked
  readonly property int leadIn: 850
  readonly property int mergeAt: 2650
  readonly property int cycle: 4550
  readonly property bool splitting: elapsed < mergeAt
  readonly property real seconds: Math.max(0, elapsed - (splitting ? leadIn : mergeAt)) / 1000
  readonly property var pose: Motion.splitFrame(
    elapsed < leadIn || reducedMotion ? Motion.splitTiming.settle : seconds,
    elapsed >= leadIn && splitting, Motion.splitGeometry.height, Motion.splitGeometry.gap)
  function replay() {
    playback.restart()
  }
  NumberAnimation on elapsed {
    id: playback
    from: 0
    to: root.cycle
    duration: root.cycle
    loops: Animation.Infinite
    running: root.visible
  }

  Rectangle {
    width: parent.width
    height: 34
    color: "#393c43"
    Item {
      anchors.centerIn: parent
      width: Motion.splitGeometry.width
      height: Motion.splitGeometry.height
      Rectangle {
        width: (Motion.splitGeometry.width + root.pose.primary)
        height: parent.height
        radius: height / 2
        color: "#101114"
      }
      Rectangle {
        x: Motion.splitGeometry.width + root.pose.left
        width: Math.max(height, root.pose.right - root.pose.left)
        height: parent.height
        radius: height / 2
        visible: root.pose.bubble
        color: "#101114"
      }
      Shape {
        anchors.fill: parent
        visible: root.pose.bubble
        preferredRendererType: Shape.CurveRenderer
        ShapePath {
          fillColor: "#101114"
          strokeWidth: -1
          PathSvg { path: root.pose.bubble ? Motion.neckPath(Motion.splitGeometry.width + root.pose.primary, Motion.splitGeometry.width + root.pose.left, Motion.splitGeometry.height) : "" }
        }
      }
      Item {
        width: (Motion.splitGeometry.width + root.pose.primary)
        height: parent.height
        Text {
          anchors.left: parent.left
          anchors.leftMargin: 10
          anchors.verticalCenter: parent.verticalCenter
          text: "♫   Night Drive"
          color: "#f1f2f3"
          font.pixelSize: 11
        }
        Text {
          anchors.right: parent.right
          anchors.rightMargin: 25
          anchors.verticalCenter: parent.verticalCenter
          text: "2:14"
          color: "#c4c7cd"
          font.pixelSize: 10
        }
      }
      Text {
        x: Motion.splitGeometry.width + root.pose.left + (Math.max(parent.height, root.pose.right - root.pose.left) - width) / 2
        anchors.verticalCenter: parent.verticalCenter
        visible: root.pose.bubble
        opacity: root.pose.ink
        text: "↓"
        color: "#b4e7d0"
        font.pixelSize: 14
        font.bold: true
      }
    }
  }

  Text {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 49
    text: root.elapsed < root.leadIn ? "Music playing" : root.splitting ? "Download started" : "Download finished"
    color: "#eceef1"
    font.pixelSize: 14
  }
  Row {
    anchors.horizontalCenter: parent.horizontalCenter
    y: 83
    spacing: 10
    Button { text: "Replay"; onClicked: root.replay() }
    CheckBox { id: reduced; text: "Reduced motion" }
  }
}
