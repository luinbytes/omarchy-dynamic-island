pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Ui as Ui

Item {
  id: root

  required property var store
  property var content: null
  property real headerRightInset: 32
  property int page: 0
  readonly property string contentKey: content && typeof content === "object" ? String(content.key || "") : ""
  readonly property var snapshot: store ? store.snapshot : ({
    available: false,
    dnd: false,
    preview: null,
    entries: [],
    error: "Notification service unavailable"
  })
  readonly property var entries: entriesFor(snapshot.entries || [], content)
  readonly property var pages: pagesFor(entries)
  readonly property int pageCount: Math.max(1, pages.length)
  readonly property var pageData: entryForPage(pages, page)
  readonly property var entry: pageData ? pageData.entry : null
  readonly property real preferredHeight: Math.ceil(contentColumn.implicitHeight)

  implicitWidth: 376
  implicitHeight: preferredHeight
  clip: true

  function entriesFor(source, selectedContent) {
    var result = []
    var selectedKey = selectedContent && typeof selectedContent === "object" ? String(selectedContent.key || "") : ""
    if (selectedKey) {
      var current = null
      for (var index = 0; index < source.length; index++) {
        if (source[index].key === selectedKey) {
          current = source[index]
          break
        }
      }
      if (current) result.push(current)
      else result.push({
        key: selectedKey,
        live: false,
        retained: true,
        app: String(selectedContent.app || ""),
        summary: String(selectedContent.summary || ""),
        body: String(selectedContent.body || ""),
        urgency: String(selectedContent.urgency || "normal"),
        timestamp: Number(selectedContent.timestamp) || 0,
        canInvoke: false,
        canDismiss: false
      })
    }
    for (var sourceIndex = 0; sourceIndex < source.length; sourceIndex++) {
      if (source[sourceIndex].key !== selectedKey) result.push(source[sourceIndex])
    }
    return result
  }

  function entryForPage(values, pageIndex) {
    return values.length > 0 ? values[Math.min(pageIndex, values.length - 1)] : null
  }

  function bodyChunks(value, maximum, maximumLines) {
    var characters = Array.from(String(value || ""))
    if (characters.length === 0) return [""]
    var chunks = []
    var chunk = []
    var lineBreaks = 0
    var characterLimit = Math.max(1, Number(maximum) || 1)
    var lineBreakLimit = Math.max(1, Number(maximumLines) || 1) - 1
    for (var index = 0; index < characters.length; index++) {
      var character = characters[index]
      if (chunk.length > 0 && (chunk.length >= characterLimit || (character === "\n" && lineBreaks >= lineBreakLimit))) {
        chunks.push(chunk.join(""))
        chunk = []
        lineBreaks = 0
      }
      chunk.push(character)
      if (character === "\n") lineBreaks++
    }
    if (chunk.length > 0) chunks.push(chunk.join(""))
    return chunks
  }

  function pagesFor(values) {
    var result = []
    for (var entryIndex = 0; entryIndex < values.length; entryIndex++) {
      var chunks = root.bodyChunks(values[entryIndex].body, 120, 4)
      for (var bodyIndex = 0; bodyIndex < chunks.length; bodyIndex++) {
        result.push({ entry: values[entryIndex], body: chunks[bodyIndex], bodyPage: bodyIndex, bodyPageCount: chunks.length })
      }
    }
    return result
  }

  function timeLabel(timestamp) {
    var value = Number(timestamp)
    if (!isFinite(value) || value <= 0) return ""
    return Qt.formatDateTime(new Date(value), "hh:mm")
  }

  function previousPage() {
    page = Math.max(0, page - 1)
  }

  function nextPage() {
    page = Math.min(pageCount - 1, page + 1)
  }

  onPageCountChanged: page = Math.min(page, pageCount - 1)
  onContentKeyChanged: page = 0

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
        text: "Notifications"
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

        Text {
          anchors.verticalCenter: parent.verticalCenter
          visible: root.entries.length > 0
          text: (root.page + 1) + "/" + root.pageCount
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 9
        }

        Ui.Button {
          text: "‹"
          width: 26
          height: 24
          radius: height / 2
          foreground: Color.bar.text
          fontSize: 13
          horizontalPadding: 0
          verticalPadding: 0
          enabled: root.page > 0
          focusable: true
          Accessible.role: Accessible.Button
          Accessible.name: "Previous notification"
          Accessible.focusable: enabled
          Accessible.onPressAction: if (enabled) root.previousPage()
          onClicked: root.previousPage()
        }

        Ui.Button {
          text: "›"
          width: 26
          height: 24
          radius: height / 2
          foreground: Color.bar.text
          fontSize: 13
          horizontalPadding: 0
          verticalPadding: 0
          enabled: root.page + 1 < root.pageCount
          focusable: true
          Accessible.role: Accessible.Button
          Accessible.name: "Next notification"
          Accessible.focusable: enabled
          Accessible.onPressAction: if (enabled) root.nextPage()
          onClicked: root.nextPage()
        }

        Ui.Button {
          text: "↻"
          width: 26
          height: 24
          radius: height / 2
          foreground: Color.bar.text
          fontSize: 12
          horizontalPadding: 0
          verticalPadding: 0
          enabled: root.snapshot.available
          focusable: true
          Accessible.role: Accessible.Button
          Accessible.name: "Refresh notification history"
          Accessible.focusable: enabled
          Accessible.onPressAction: if (enabled) root.store.refreshHistory()
          onClicked: root.store.refreshHistory()
        }
      }
    }

    Text {
      width: parent.width
      visible: root.snapshot.error !== "" || !root.snapshot.available || root.snapshot.dnd
      text: root.snapshot.error || (!root.snapshot.available ? "Native notification service unavailable"
        : "Do Not Disturb · Island previews hidden")
      textFormat: Text.PlainText
      elide: Text.ElideRight
      color: root.snapshot.error || root.snapshot.dnd ? Color.accent : Color.muted
      font.family: Style.font.family
      font.pixelSize: 9
    }

    Text {
      width: parent.width
      visible: !root.entry
      text: root.snapshot.error ? "No readable notifications" : "No recent notifications"
      textFormat: Text.PlainText
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: 12
    }

    Column {
      width: parent.width
      spacing: 7
      visible: !!root.entry

      Row {
        width: parent.width
        spacing: 6

        Text {
          width: Math.max(0, parent.width - entryTime.width - parent.spacing)
          text: root.entry ? (root.entry.app || "Notification") : ""
          textFormat: Text.PlainText
          elide: Text.ElideRight
          color: root.entry && root.entry.urgency === "critical" ? Color.accent : Color.muted
          font.family: Style.font.family
          font.pixelSize: 10
        }

        Text {
          id: entryTime
          text: root.entry ? root.timeLabel(root.entry.timestamp) : ""
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 9
        }
      }

      Text {
        width: parent.width
        text: root.entry ? (root.entry.summary || "(No title)") : ""
        textFormat: Text.PlainText
        wrapMode: Text.WordWrap
        maximumLineCount: 2
        elide: Text.ElideRight
        color: Color.bar.text
        font.family: Style.font.family
        font.pixelSize: 16
        font.weight: Font.DemiBold
      }

      Text {
        width: parent.width
        visible: !!root.pageData && root.pageData.body !== ""
        text: root.pageData ? root.pageData.body : ""
        textFormat: Text.PlainText
        wrapMode: Text.WordWrap
        color: Color.bar.text
        font.family: Style.font.family
        font.pixelSize: 11
      }

      Text {
        width: parent.width
        text: !root.entry ? "" : (root.entry.retained ? "Expired notification · retained detail"
          : root.entry.live ? "Live notification" : "History · view only")
          + (root.pageData && root.pageData.bodyPageCount > 1
            ? " · Detail " + (root.pageData.bodyPage + 1) + "/" + root.pageData.bodyPageCount : "")
        textFormat: Text.PlainText
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: 9
      }

      Row {
        spacing: 5
        visible: !!root.entry && root.entry.live

        Ui.Button {
          text: "Open"
          visible: !!root.entry && root.entry.live && root.entry.canInvoke
          foreground: Color.bar.text
          fontSize: 9
          focusable: visible
          Accessible.role: Accessible.Button
          Accessible.name: "Open " + (root.entry ? root.entry.summary || "notification" : "notification")
          Accessible.focusable: visible
          Accessible.onPressAction: if (visible) root.store.invoke(root.entry.key)
          onClicked: root.store.invoke(root.entry.key)
        }

        Ui.Button {
          text: "Dismiss"
          visible: !!root.entry && root.entry.live && root.entry.canDismiss
          foreground: Color.bar.text
          fontSize: 9
          focusable: visible
          Accessible.role: Accessible.Button
          Accessible.name: "Dismiss " + (root.entry ? root.entry.summary || "notification" : "notification")
          Accessible.focusable: visible
          Accessible.onPressAction: if (visible) root.store.dismiss(root.entry.key)
          onClicked: root.store.dismiss(root.entry.key)
        }
      }
    }
  }
}
