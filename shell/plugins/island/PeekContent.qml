import QtQuick
import QtQuick.Shapes
import qs.Commons

Item {
  id: root

  property var visual: null
  property var outline: null
  property bool interactive: false
  signal clicked()

  readonly property var card: root.visual && root.visual.content ? root.visual.content : ({})
  readonly property bool drawn: !!root.visual && root.visual.visible && !!root.outline
  readonly property real contentDisplacement: root.visual && typeof root.visual.contentOffset === "number"
    ? Math.max(-1, Math.min(1, root.visual.contentOffset)) : 0
  readonly property bool contentCurrent: !!root.visual && root.visual.key === root.visual.contentKey
  readonly property bool contentInteractive: root.contentCurrent && root.visual.contentPhase === "steady"
  readonly property bool contentSafe: !root.outline || root.outline.contentSafe !== false

  x: root.drawn ? root.outline.bounds.x : 0
  y: root.drawn ? root.outline.bounds.y : 0
  width: root.drawn ? root.outline.bounds.width : 0
  height: root.drawn ? root.outline.bounds.height : 0
  visible: root.drawn && width > 0 && height > 0
  clip: true

  Shape {
    anchors.fill: parent
    preferredRendererType: Shape.CurveRenderer

    ShapePath {
      fillColor: Color.bar.background
      strokeWidth: -1
      PathSvg { path: root.outline ? root.outline.perimeter : "" }
    }
  }

  Item {
    id: contentClip
    visible: root.contentSafe
    x: root.outline ? root.outline.body.x - root.outline.bounds.x : 0
    y: root.outline ? root.outline.body.y - root.outline.bounds.y : 0
    width: root.outline ? root.outline.body.width : 0
    height: root.outline ? root.outline.body.height : 0
    clip: true

    Item {
      id: payload
      x: root.contentDisplacement * contentClip.width
      width: parent.width
      height: parent.height

      ActivityIcon {
        id: icon
        anchors.left: parent.left
        anchors.leftMargin: 12
        anchors.verticalCenter: parent.verticalCenter
        width: 18
        height: 18
        name: root.card.icon || ""
        size: 14
        color: Color.bar.text
        fallbackText: root.card.icon || "◦"
      }

      Column {
        anchors.left: icon.right
        anchors.leftMargin: 8
        anchors.right: parent.right
        anchors.rightMargin: 12
        spacing: 2
        y: Math.max(4, (parent.height - height) / 2)

        Text {
          width: parent.width
          text: root.card.label || "Activity"
          textFormat: Text.PlainText
          elide: Text.ElideRight
          color: Color.bar.text
          font.family: Style.font.family
          font.pixelSize: 12
          font.weight: Font.DemiBold
        }

        Text {
          width: parent.width
          text: root.card.value || ""
          textFormat: Text.PlainText
          elide: Text.ElideRight
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 11
          visible: text !== ""
        }
      }
    }
  }

  MouseArea {
    anchors.fill: parent
    enabled: root.interactive && root.contentInteractive && root.contentSafe
    cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
    onClicked: root.clicked()
  }
}
