pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Ui as Ui

Item {
  id: root

  required property var store
  property real headerRightInset: 32
  property int page: 0
  property bool setupOpen: false
  readonly property var snapshot: store.snapshot
  readonly property int pageSize: 3
  readonly property var orderedSessions: orderedFor(snapshot.sessions)
  readonly property int pageCount: Math.max(1, Math.ceil(orderedSessions.length / pageSize))
  readonly property var visibleSessions: pageFor(orderedSessions, page, pageSize)
  readonly property real preferredHeight: Math.ceil(contentColumn.implicitHeight)

  implicitWidth: 376
  implicitHeight: preferredHeight
  clip: true

  function orderedFor(sessions) {
    var result = sessions.slice()
    result.sort(function(left, right) {
      var rank = root.sessionRank(left) - root.sessionRank(right)
      if (rank !== 0) return rank
      if (left.observedAt !== right.observedAt) return right.observedAt - left.observedAt
      return left.sessionId < right.sessionId ? -1 : left.sessionId > right.sessionId ? 1 : 0
    })
    return result
  }

  function pageFor(sessions, pageIndex, size) {
    return sessions.slice(pageIndex * size, (pageIndex + 1) * size)
  }

  function sessionRank(session) {
    if (session.stale) return 4
    if (session.approvalNoted || session.state === "approval-requested") return 0
    if (session.state === "blocked") return 1
    if (session.state === "working") return 2
    return 3
  }

  function statusLabel(session) {
    var label = session.state
    if (session.approvalNoted || session.state === "approval-requested") label = "Approval requested"
    else if (session.state === "blocked") label = session.source === "Herdr" ? "Blocked · reported" : "Blocked"
    else if (session.state === "working") label = "Working"
    else if (session.state === "turn-ended") label = "Turn ended"
    else if (session.state === "interrupted") label = "Interrupted"
    else if (session.state === "disconnected") label = "Disconnected"
    else if (session.state === "idle") label = "Idle"
    else label = "Unknown"
    return session.stale ? "Last known · " + label : label
  }

  function previousPage() {
    page = Math.max(0, page - 1)
  }

  function nextPage() {
    page = Math.min(pageCount - 1, page + 1)
  }

  onPageCountChanged: page = Math.min(page, pageCount - 1)

  Column {
    id: contentColumn
    width: root.width > 0 ? root.width : root.implicitWidth
    spacing: 6

    Item {
      width: parent.width
      height: 28

      Text {
        anchors.left: parent.left
        anchors.right: headerActions.left
        anchors.rightMargin: 8
        anchors.verticalCenter: parent.verticalCenter
        text: root.setupOpen ? "Agent setup" : "Agents"
        textFormat: Text.PlainText
        elide: Text.ElideRight
        color: Color.bar.text
        font.family: Style.font.family
        font.pixelSize: 15
        font.weight: Font.DemiBold
      }

      Row {
        id: headerActions
        anchors.right: parent.right
        anchors.rightMargin: root.headerRightInset
        anchors.verticalCenter: parent.verticalCenter
        spacing: 3

        Ui.Button {
          text: root.setupOpen ? "Done" : "Setup"
          height: 24
          foreground: Color.bar.text
          fontSize: 9
          horizontalPadding: 7
          verticalPadding: 0
          focusable: true
          Accessible.role: Accessible.Button
          Accessible.name: root.setupOpen ? "Close agent setup" : "Open agent setup"
          Accessible.focusable: true
          Accessible.onPressAction: root.setupOpen = !root.setupOpen
          onClicked: root.setupOpen = !root.setupOpen
        }

        Text {
          anchors.verticalCenter: parent.verticalCenter
          visible: !root.setupOpen && root.pageCount > 1
          text: (root.page + 1) + "/" + root.pageCount
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 9
        }

        Ui.Button {
          visible: !root.setupOpen && root.pageCount > 1
          text: "‹"
          width: 26
          height: 24
          radius: height / 2
          foreground: Color.bar.text
          fontSize: 13
          horizontalPadding: 0
          verticalPadding: 0
          enabled: root.page > 0
          focusable: visible
          Accessible.role: Accessible.Button
          Accessible.name: "Previous agent page"
          Accessible.focusable: visible && enabled
          Accessible.onPressAction: if (enabled) root.previousPage()
          onClicked: root.previousPage()
        }

        Ui.Button {
          visible: !root.setupOpen && root.pageCount > 1
          text: "›"
          width: 26
          height: 24
          radius: height / 2
          foreground: Color.bar.text
          fontSize: 13
          horizontalPadding: 0
          verticalPadding: 0
          enabled: root.page + 1 < root.pageCount
          focusable: visible
          Accessible.role: Accessible.Button
          Accessible.name: "Next agent page"
          Accessible.focusable: visible && enabled
          Accessible.onPressAction: if (enabled) root.nextPage()
          onClicked: root.nextPage()
        }
      }
    }

    Text {
      width: parent.width
      visible: !root.setupOpen
      text: root.store.sourceLabel
      textFormat: Text.PlainText
      elide: Text.ElideRight
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: 9
    }

    Text {
      width: parent.width
      visible: !root.setupOpen && root.visibleSessions.length === 0
      text: root.snapshot.enabled ? "No active agent sessions" : "No live agent source"
      textFormat: Text.PlainText
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: 12
    }

    Repeater {
      model: root.setupOpen ? [] : root.visibleSessions

      delegate: Rectangle {
        id: sessionRow
        required property var modelData
        width: contentColumn.width
        height: 44
        radius: 10
        color: Qt.rgba(Color.bar.text.r, Color.bar.text.g, Color.bar.text.b, 0.055)

        Column {
          anchors.left: parent.left
          anchors.right: parent.right
          anchors.leftMargin: sessionRow.modelData.parentId ? 18 : 10
          anchors.rightMargin: 10
          anchors.verticalCenter: parent.verticalCenter
          spacing: 2

          Row {
            width: parent.width
            spacing: 6

            Text {
              width: Math.max(0, parent.width - sessionStatus.width - parent.spacing)
              text: sessionRow.modelData.displayName
                || (sessionRow.modelData.parentId ? "Child " : "Session ") + sessionRow.modelData.sessionId.slice(-10)
              textFormat: Text.PlainText
              elide: Text.ElideRight
              color: Color.bar.text
              font.family: Style.font.family
              font.pixelSize: 11
              font.weight: Font.DemiBold
            }

            Text {
              id: sessionStatus
              text: root.statusLabel(sessionRow.modelData)
              textFormat: Text.PlainText
              color: root.sessionRank(sessionRow.modelData) <= 1 ? Color.accent : Color.muted
              font.family: Style.font.family
              font.pixelSize: 9
            }
          }

          Text {
            width: parent.width
            text: (sessionRow.modelData.source || "Codex hooks") + " · "
              + sessionRow.modelData.event + " · " + sessionRow.modelData.ageSeconds + "s ago"
            textFormat: Text.PlainText
            elide: Text.ElideRight
            color: Color.muted
            font.family: Style.font.family
            font.pixelSize: 9
          }
        }
      }
    }

    Column {
      width: parent.width
      spacing: 6
      visible: root.setupOpen

      Text {
        width: parent.width
        text: root.store.setupMessage || root.store.sourceLabel
          + ". Herdr is read-only. Optional hooks report status without prompts or terminal contents."
        textFormat: Text.PlainText
        wrapMode: Text.WordWrap
        maximumLineCount: 4
        elide: Text.ElideRight
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: 10
      }

      Row {
        width: parent.width
        spacing: 6

        Ui.Button {
          text: root.store.observing ? "Stop observing" : "Observe hooks"
          foreground: Color.bar.text
          fontSize: 9
          focusable: true
          Accessible.role: Accessible.Button
          Accessible.name: root.store.observing ? "Stop observing Codex hooks" : "Observe Codex hooks"
          Accessible.focusable: true
          Accessible.onPressAction: root.store.setObserving(!root.store.observing)
          onClicked: root.store.setObserving(!root.store.observing)
        }

        Ui.Button {
          text: "Install"
          tooltipText: "Add Island status hooks while preserving existing hooks"
          foreground: Color.bar.text
          fontSize: 9
          enabled: !root.store.configuring
          focusable: true
          Accessible.role: Accessible.Button
          Accessible.name: "Install Island Codex hooks"
          Accessible.focusable: enabled
          Accessible.onPressAction: if (enabled) root.store.configureHooks(true)
          onClicked: root.store.configureHooks(true)
        }

        Ui.Button {
          text: "Remove"
          foreground: Color.bar.text
          fontSize: 9
          enabled: !root.store.configuring
          focusable: true
          Accessible.role: Accessible.Button
          Accessible.name: "Remove Island Codex hooks"
          Accessible.focusable: enabled
          Accessible.onPressAction: if (enabled) root.store.configureHooks(false)
          onClicked: root.store.configureHooks(false)
        }
      }
    }
  }
}
