import QtQuick
import qs.Commons

Item {
  id: root

  property var content: null
  property bool expanded: false
  property bool actionsEnabled: true
  property bool reducedMotion: false
  property bool mediaTitleOwnedByBody: false
  property bool mediaArtworkOwnedByBody: false
  signal actionRequested(string actionId)
  signal seekRequested(string trackToken, real positionSeconds)

  clip: true

  readonly property var compact: root.content || ({})
  readonly property string compactText: typeof root.compact.compactText === "string" ? root.compact.compactText : ""
  readonly property bool usesCompactText: root.compactText !== ""
  readonly property bool isMedia: !!root.compact.media
  readonly property var details: root.compact.expanded || ({})
  readonly property var centerDetails: root.details.center || ({})
  readonly property bool centerHasProgress: typeof root.centerDetails.progress === "number"
  readonly property bool showExpanded: root.expanded
  readonly property color primaryText: Color.bar.text
  readonly property color secondaryText: Color.muted
  readonly property color accent: Color.accent
  readonly property color surface: Color.bar.background
  readonly property color surfaceBorder: Color.bar.text
  readonly property color onAccent: Color.bar.background

  function mediaDiagnostic() {
    if (!root.isMedia || !root.compact.media) return null
    var media = root.compact.media
    return {
      trackToken: media.trackToken,
      artwork: mediaContent.artworkStatus,
      timing: typeof media.positionSeconds === "number" && typeof media.durationSeconds === "number",
      seekEligible: media.canSeek === true && root.actionsEnabled
    }
  }

  Item {
    id: compactContent
    anchors.horizontalCenter: parent.horizontalCenter
    anchors.verticalCenter: parent.verticalCenter
    width: Math.max(0, root.compact.compactCentered && root.usesCompactText
      ? Math.min(parent.width - 8, compactLabelMetrics.advanceWidth + (compactIcon.visible ? 16 : 0))
      : parent.width - (root.usesCompactText ? 8 : 16))
    height: 22
    visible: !root.showExpanded && !root.isMedia

    TextMetrics {
      id: compactLabelMetrics
      font: compactLabel.font
      text: compactLabel.text
    }

    Item {
      id: compactIcon
      width: 12
      height: 12
      anchors.verticalCenter: parent.verticalCenter
      anchors.left: parent.left
      visible: root.compact.icon !== ""

      ActivityIcon {
        anchors.centerIn: parent
        name: root.compact.icon || ""
        size: 12
        color: root.primaryText
        fallbackText: root.compact.icon || "◦"
      }
    }

    Text {
      id: compactLabel
      anchors.left: compactIcon.visible ? compactIcon.right : parent.left
      anchors.leftMargin: compactIcon.visible ? 4 : 0
      anchors.right: compactValue.visible ? compactValue.left : parent.right
      anchors.rightMargin: compactValue.visible ? 4 : 0
      anchors.verticalCenter: parent.verticalCenter
      text: root.compactText || root.compact.label || root.compact.value || ""
      textFormat: Text.PlainText
      color: root.primaryText
      font.family: Style.font.family
      font.pixelSize: root.usesCompactText ? 10 : 11
      font.weight: Font.DemiBold
      elide: Text.ElideRight
      visible: width > 22
    }

    Text {
      id: compactValue
      width: visible ? Math.min(parent.width * 0.34, implicitWidth) : 0
      anchors.right: parent.right
      anchors.baseline: compactLabel.baseline
      text: root.compact.value || ""
      textFormat: Text.PlainText
      color: root.secondaryText
      font.family: Style.font.family
      font.pixelSize: 10
      elide: Text.ElideRight
      maximumLineCount: 1
      visible: !root.usesCompactText && text !== "" && parent.width > 96
    }
  }

  Item {
    id: expandedContent
    anchors.fill: parent
    anchors.margins: 12
    visible: root.showExpanded && !root.isMedia

    Text {
      id: leadingIcon
      width: 36
      anchors.left: parent.left
      anchors.top: parent.top
      text: root.details.leading ? root.details.leading.icon || root.compact.icon || "" : root.compact.icon || ""
      textFormat: Text.PlainText
      color: root.accent
      font.family: Style.font.family
      font.pixelSize: 24
      horizontalAlignment: Text.AlignHCenter
      elide: Text.ElideRight
    }

    Text {
      id: leadingLabel
      anchors.left: leadingIcon.right
      anchors.leftMargin: 8
      anchors.top: parent.top
      anchors.right: trailingValue.left
      anchors.rightMargin: 8
      text: root.details.leading ? root.details.leading.label || root.compact.label || "" : root.compact.label || ""
      textFormat: Text.PlainText
      color: root.primaryText
      font.family: Style.font.family
      font.pixelSize: 13
      font.weight: Font.DemiBold
      elide: Text.ElideRight
    }

    Text {
      id: trailingValue
      width: Math.min(80, Math.max(36, implicitWidth))
      anchors.right: parent.right
      anchors.top: parent.top
      text: root.details.trailing ? root.details.trailing.value || root.compact.value || "" : root.compact.value || ""
      textFormat: Text.PlainText
      color: root.secondaryText
      font.family: Style.font.family
      font.pixelSize: 12
      horizontalAlignment: Text.AlignRight
      elide: Text.ElideRight
    }

    Text {
      id: centerLabel
      anchors.left: leadingLabel.left
      anchors.right: parent.right
      anchors.top: leadingLabel.bottom
      anchors.topMargin: 4
      text: root.centerDetails.label || ""
      textFormat: Text.PlainText
      color: root.secondaryText
      font.family: Style.font.family
      font.pixelSize: 11
      elide: Text.ElideRight
    }

    Text {
      id: centerValue
      anchors.left: leadingLabel.left
      anchors.right: parent.right
      anchors.top: centerLabel.bottom
      anchors.topMargin: 2
      text: root.centerDetails.value || ""
      textFormat: Text.PlainText
      color: root.primaryText
      font.family: Style.font.family
      font.pixelSize: 14
      font.weight: Font.DemiBold
      elide: Text.ElideRight
    }

    Rectangle {
      id: expandedProgressTrack
      anchors.left: leadingLabel.left
      anchors.right: parent.right
      anchors.top: centerValue.bottom
      anchors.topMargin: 8
      height: 3
      radius: 2
      color: root.secondaryText
      visible: root.centerHasProgress

      Rectangle {
        width: parent.width * (root.centerHasProgress ? root.centerDetails.progress : 0)
        height: parent.height
        radius: parent.radius
        color: root.accent
      }
    }

    Text {
      id: bottomLabel
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.bottom: actionRow.top
      anchors.bottomMargin: 7
      text: root.details.bottom ? root.details.bottom.label || root.details.bottom.value || "" : ""
      textFormat: Text.PlainText
      color: root.secondaryText
      font.family: Style.font.family
      font.pixelSize: 11
      elide: Text.ElideRight
      visible: text !== ""
    }

    Row {
      id: actionRow
      anchors.right: parent.right
      anchors.bottom: parent.bottom
      spacing: 4
      readonly property int actionCount: root.details.actions ? root.details.actions.length : 0
      readonly property real availableWidth: parent.width
      visible: !!root.details.actions && root.details.actions.length > 0

      Repeater {
        model: root.details.actions || []

        delegate: Rectangle {
          id: actionButton
          required property var modelData
          readonly property var action: modelData
          readonly property bool actionEnabled: root.actionsEnabled && action.enabled
          width: Math.max(44, Math.min(104, Math.floor((actionRow.availableWidth - (actionRow.actionCount - 1) * actionRow.spacing) / Math.max(1, actionRow.actionCount)), label.implicitWidth + 18))
          height: 26
          radius: 13
          color: action.role === "primary" ? root.accent : root.surface
          opacity: actionEnabled ? 1 : 0.45
          activeFocusOnTab: actionEnabled

          border.width: activeFocus ? 1 : 0
          border.color: root.surfaceBorder

          Keys.onReturnPressed: if (actionEnabled) root.actionRequested(action.id)
          Keys.onEnterPressed: if (actionEnabled) root.actionRequested(action.id)
          Keys.onSpacePressed: if (actionEnabled) root.actionRequested(action.id)

          Item {
            anchors.fill: parent
            enabled: actionButton.actionEnabled
            Accessible.role: Accessible.Button
            Accessible.name: actionButton.action.label
            Accessible.focusable: actionButton.actionEnabled
            Accessible.focused: actionButton.activeFocus
            Accessible.onPressAction: if (actionButton.actionEnabled) root.actionRequested(actionButton.action.id)
          }

          Text {
            id: label
            anchors.centerIn: parent
            width: parent.width - 14
            text: action.label
            textFormat: Text.PlainText
            color: action.role === "primary" ? root.onAccent : root.primaryText
            font.family: Style.font.family
            font.pixelSize: 10
            font.weight: Font.DemiBold
            horizontalAlignment: Text.AlignHCenter
            elide: Text.ElideRight
          }

          MouseArea {
            anchors.fill: parent
            cursorShape: actionButton.actionEnabled ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: {
              if (!actionButton.actionEnabled) return
              actionButton.forceActiveFocus()
              root.actionRequested(actionButton.action.id)
            }
          }
        }
      }
    }
  }

  MediaContent {
    id: mediaContent
    anchors.fill: parent
    visible: root.isMedia
    media: root.isMedia ? root.compact.media : null
    actions: root.compact.actions || []
    expanded: root.showExpanded
    interactive: root.actionsEnabled
    reducedMotion: root.reducedMotion
    titleOwnedByBody: root.mediaTitleOwnedByBody
    artworkOwnedByBody: root.mediaArtworkOwnedByBody
    onActionRequested: function(actionId) { root.actionRequested(actionId) }
    onSeekRequested: function(trackToken, positionSeconds) { root.seekRequested(trackToken, positionSeconds) }
  }
}
