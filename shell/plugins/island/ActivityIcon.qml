import QtQuick
import QtQuick.Shapes
import qs.Commons

Item {
  id: root

  property string name: ""
  property real size: 14
  property color color: Color.bar.text
  property string fallbackText: ""

  implicitWidth: Math.max(1, root.size)
  implicitHeight: Math.max(1, root.size)

  readonly property string canonicalName: {
    var aliases = {
      "!": "alert",
      "CPU": "cpu",
      "GPU": "gpu",
      "PSI": "psi",
      "RAM": "ram",
      "󰚩": "robot",
      "Ⅱ": "pause",
      "▶": "play",
      "agents": "robot",
      "bell": "bell",
      "codex": "codex",
      "media": "music",
      "music": "music",
      "notifications": "bell",
      "notes": "notes",
      "resource": "cpu",
      "system": "cpu",
      "weather": "weather"
    }
    return aliases[root.name] || String(root.name || "").toLowerCase()
  }

  readonly property var paths: ({
    alert: "M 7 1 L 13 12 H 1 Z M 7 5 V 8 M 7 10 V 10.5",
    bell: "M 7 1 C 4.8 1 3.4 2.8 3.4 5.3 L 3.4 8.2 L 1.8 10.2 L 12.2 10.2 L 10.6 8.2 L 10.6 5.3 C 10.6 2.8 9.2 1 7 1 Z M 5.5 11.4 C 5.8 12.7 6.4 13.3 7 13.3 C 7.6 13.3 8.2 12.7 8.5 11.4 Z",
    cpu: "M 3 3 H 11 V 11 H 3 Z M 5 5 H 9 V 9 H 5 Z M 5 0 V 3 M 9 0 V 3 M 5 11 V 14 M 9 11 V 14 M 0 5 H 3 M 0 9 H 3 M 11 5 H 14 M 11 9 H 14",
    codex: "M 2 2 H 12 V 12 H 2 Z M 4 5 L 6 7 L 4 9 M 7 9 H 10",
    gpu: "M 1 3 H 12 V 10 H 1 Z M 12 5 H 14 M 12 8 H 14 M 3 10 V 12 H 9 V 10 M 8.5 6.5 A 2 2 0 1 0 4.5 6.5 A 2 2 0 1 0 8.5 6.5",
    pause: "M 3 1 H 5 V 13 H 3 Z M 9 1 H 11 V 13 H 9 Z",
    play: "M 3 1 L 12 7 L 3 13 Z",
    psi: "M 1 8 H 3 L 5 3 L 8 12 L 10 6 H 13",
    ram: "M 1 3 H 13 V 10 H 1 Z M 3 5 H 5 V 8 H 3 Z M 8 5 H 10 V 8 H 8 Z M 3 10 V 12 M 5 10 V 12 M 8 10 V 12 M 10 10 V 12"
  })
  readonly property string path: root.paths[root.canonicalName] || ""
  readonly property bool filled: root.canonicalName === "bell"
    || root.canonicalName === "play"
    || root.canonicalName === "pause"
  readonly property string symbol: ({ music: "♪", notes: "≡", weather: "☀" })[root.canonicalName] || ""

  Shape {
    anchors.centerIn: parent
    width: 14
    height: 14
    visible: root.path !== ""
    scale: root.size / 14
    preferredRendererType: Shape.CurveRenderer

    ShapePath {
      fillColor: root.filled ? root.color : "transparent"
      strokeColor: root.color
      strokeWidth: root.filled ? -1 : 1.2
      capStyle: ShapePath.RoundCap
      joinStyle: ShapePath.RoundJoin
      PathSvg { path: root.path }
    }
  }

  Text {
    anchors.fill: parent
    text: root.canonicalName === "robot" ? "󰚩" : root.symbol || (root.fallbackText && root.fallbackText.length <= 2
      ? root.fallbackText : "◦")
    textFormat: Text.PlainText
    color: root.color
    font.family: Style.font.family
    font.pixelSize: Math.max(1, root.size)
    horizontalAlignment: Text.AlignHCenter
    verticalAlignment: Text.AlignVCenter
    elide: Text.ElideRight
    visible: root.path === ""
  }
}
