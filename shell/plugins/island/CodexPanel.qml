pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons

Item {
  id: root

  required property var usage
  property real headerRightInset: 32
  readonly property var snapshot: usage && typeof usage === "object" ? usage : ({
    providerPresent: false,
    available: false,
    sessionUsed: null,
    weeklyUsed: null,
    remaining: null,
    pace: "",
    paceState: "",
    margin: null,
    reset: ""
  })
  readonly property bool ready: snapshot.providerPresent === true && snapshot.available === true
  readonly property real preferredHeight: Math.ceil(contentColumn.implicitHeight)

  implicitWidth: 376
  implicitHeight: preferredHeight
  clip: true

  function percent(value, suffix) {
    return typeof value === "number" && isFinite(value) ? Math.round(value) + suffix : "Unavailable"
  }

  function paceMargin() {
    if (typeof snapshot.margin !== "number" || !isFinite(snapshot.margin)) return ""
    if (snapshot.paceState === "ahead") return Math.round(snapshot.margin) + "% ahead"
    if (snapshot.paceState === "behind") return Math.round(snapshot.margin) + "% behind"
    if (snapshot.paceState === "onpace") return Math.round(snapshot.margin) + "% margin"
    return ""
  }

  function weeklyText() {
    var used = root.percent(root.snapshot.weeklyUsed, "% used")
    var remaining = root.percent(root.snapshot.remaining, "% left")
    if (used === "Unavailable" && remaining === "Unavailable") return "Unavailable"
    if (used === "Unavailable") return remaining
    if (remaining === "Unavailable") return used
    return used + " · " + remaining
  }

  Column {
    id: contentColumn
    width: root.width > 0 ? root.width : root.implicitWidth
    spacing: 7

    Item {
      width: parent.width
      height: 28

      Text {
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.rightMargin: root.headerRightInset
        anchors.verticalCenter: parent.verticalCenter
        text: "Codex usage"
        textFormat: Text.PlainText
        elide: Text.ElideRight
        color: Color.bar.text
        font.family: Style.font.family
        font.pixelSize: 15
        font.weight: Font.DemiBold
      }
    }

    Text {
      width: parent.width
      visible: !root.ready
      text: root.snapshot.providerPresent ? "Codex Usage has no current limit data." : "Codex Usage is not available on this bar."
      textFormat: Text.PlainText
      wrapMode: Text.WordWrap
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: 12
    }

    Column {
      width: parent.width
      visible: root.ready
      spacing: 5

      Rectangle {
        visible: typeof root.snapshot.sessionUsed === "number" && isFinite(root.snapshot.sessionUsed)
        width: parent.width
        height: 38
        radius: 10
        color: Qt.rgba(Color.bar.text.r, Color.bar.text.g, Color.bar.text.b, 0.055)

        Text {
          anchors.left: parent.left
          anchors.leftMargin: 10
          anchors.verticalCenter: parent.verticalCenter
          text: "Session"
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 11
        }

        Text {
          anchors.right: parent.right
          anchors.rightMargin: 10
          anchors.verticalCenter: parent.verticalCenter
          text: root.percent(root.snapshot.sessionUsed, "% used")
          textFormat: Text.PlainText
          color: Color.bar.text
          font.family: Style.font.family
          font.pixelSize: 13
          font.weight: Font.DemiBold
        }
      }

      Rectangle {
        width: parent.width
        height: 38
        radius: 10
        color: Qt.rgba(Color.bar.text.r, Color.bar.text.g, Color.bar.text.b, 0.055)

        Text {
          anchors.left: parent.left
          anchors.leftMargin: 10
          anchors.verticalCenter: parent.verticalCenter
          text: "Weekly"
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 11
        }

        Text {
          anchors.right: parent.right
          anchors.rightMargin: 10
          anchors.verticalCenter: parent.verticalCenter
          text: root.weeklyText()
          textFormat: Text.PlainText
          color: Color.bar.text
          font.family: Style.font.family
          font.pixelSize: 13
          font.weight: Font.DemiBold
        }
      }

      Item {
        width: parent.width
        height: 18

        Text {
          anchors.left: parent.left
          anchors.verticalCenter: parent.verticalCenter
          text: "Pace"
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 10
        }

        Text {
          anchors.right: paceText.left
          anchors.rightMargin: 6
          anchors.verticalCenter: parent.verticalCenter
          text: root.paceMargin()
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 10
          visible: text !== ""
        }

        Text {
          id: paceText
          anchors.right: parent.right
          anchors.verticalCenter: parent.verticalCenter
          text: root.snapshot.pace || "Unavailable"
          textFormat: Text.PlainText
          color: root.snapshot.paceState === "behind" ? Color.urgent : Color.bar.text
          font.family: Style.font.family
          font.pixelSize: 10
          font.weight: Font.DemiBold
        }
      }

      Text {
        width: parent.width
        text: root.snapshot.reset ? "Resets " + root.snapshot.reset : "Reset time unavailable"
        textFormat: Text.PlainText
        elide: Text.ElideRight
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: 10
      }
    }
  }
}
