pragma ComponentBehavior: Bound

import QtQuick
import qs.Commons
import qs.Ui as Ui
import "NotePages.js" as NotePages

Item {
  id: root

  required property var repository
  property real headerRightInset: 32
  readonly property var snapshot: repository ? repository.snapshot : ({ notes: [], selectedNote: null,
    selectedId: "", query: "", panelMode: "list", listPage: 0,
    editorSession: ({ page: 0, cursor: 0, anchor: 0 }), saveState: "loading", error: "", ready: false })
  readonly property var selectedNote: snapshot.selectedNote || null
  readonly property bool editing: snapshot.panelMode === "editor" && !!selectedNote
  readonly property int notesPerPage: 3
  readonly property int listPageCount: Math.max(1, Math.ceil((snapshot.notes || []).length / notesPerPage))
  readonly property int listPage: Math.max(0, Math.min(listPageCount - 1, Number(snapshot.listPage) || 0))
  readonly property var listNotes: (snapshot.notes || []).slice(listPage * notesPerPage, (listPage + 1) * notesPerPage)
  readonly property var editorSession: snapshot.editorSession || ({ page: 0, cursor: 0, anchor: 0 })
  readonly property string draftBody: selectedNote ? selectedNote.body : ""
  readonly property int editorCharacterLimit: Math.max(16, Math.min(NotePages.DEFAULT_MAX_CHARACTERS,
    Math.floor(Math.max(1, width - 20) / Math.max(1, editorFontMetrics.maximumCharacterWidth)) * NotePages.DEFAULT_MAX_LINES))
  readonly property var pageInfo: NotePages.page(draftBody, editorSession.page,
    editorCharacterLimit, NotePages.DEFAULT_MAX_LINES)
  readonly property real preferredHeight: Math.ceil(editing ? editorColumn.implicitHeight : listColumn.implicitHeight)
  property bool syncingEditor: false
  property bool syncingSearch: false
  property bool compositionPending: false
  property bool componentReady: false
  property bool syncNeedsForce: false
  property bool syncNeedsFocus: false
  property string editorNoteId: ""
  property int editorPageIndex: -1

  implicitWidth: 376
  implicitHeight: preferredHeight
  clip: true

  component PageGlyph: Rectangle {
    id: glyphButton
    required property string glyph
    signal invoked
    width: 24
    height: 24
    radius: 12
    color: Qt.rgba(Color.bar.text.r, Color.bar.text.g, Color.bar.text.b, activeFocus ? 0.14 : 0.07)
    opacity: enabled ? 1 : 0.35
    activeFocusOnTab: enabled
    Accessible.role: Accessible.Button
    Accessible.name: glyph === "‹" ? "Previous page" : "Next page"
    Accessible.focusable: enabled
    Accessible.onPressAction: if (glyphButton.enabled) glyphButton.invoked()
    Keys.onReturnPressed: function(event) { if (glyphButton.enabled) glyphButton.invoked(); event.accepted = true }
    Keys.onEnterPressed: function(event) { if (glyphButton.enabled) glyphButton.invoked(); event.accepted = true }
    Keys.onSpacePressed: function(event) { if (glyphButton.enabled) glyphButton.invoked(); event.accepted = true }
    Text {
      anchors.centerIn: parent
      text: glyphButton.glyph
      textFormat: Text.PlainText
      color: Color.bar.text
      font.family: Style.font.family
      font.pixelSize: 15
    }
    MouseArea {
      anchors.fill: parent
      enabled: glyphButton.enabled
      cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
      onClicked: glyphButton.invoked()
    }
  }

  function scheduleSync(force, focus) {
    root.syncNeedsForce = root.syncNeedsForce || force === true
    root.syncNeedsFocus = root.syncNeedsFocus || focus === true
    if (root.componentReady) panelSyncTimer.restart()
  }

  function saveLabel() {
    if (snapshot.error) return snapshot.error
    if (snapshot.saveState === "saved") return "Saved"
    if (snapshot.saveState === "failed") return "Save failed"
    if (snapshot.saveState === "blocked") return "Unavailable"
    return snapshot.ready ? "Saving" : "Loading"
  }

  function syncSearch() {
    if (searchInput.text === root.snapshot.query) return
    root.syncingSearch = true
    searchInput.text = root.snapshot.query
    root.syncingSearch = false
  }

  function restoreEditor(force) {
    if (root.syncingEditor || !root.selectedNote) return
    if (editor.inputMethodComposing) {
      root.compositionPending = true
      return
    }
    var page = root.pageInfo
    if (!force && root.editorNoteId === root.selectedNote.id && root.editorPageIndex === page.index
        && editor.text === page.text) return
    root.syncingEditor = true
    root.editorNoteId = root.selectedNote.id
    root.editorPageIndex = page.index
    editor.text = page.text
    var cursor = Math.max(0, Math.min(page.text.length, root.editorSession.cursor - page.start))
    var anchor = Math.max(0, Math.min(page.text.length, root.editorSession.anchor - page.start))
    editor.cursorPosition = cursor
    if (anchor !== cursor) editor.select(Math.min(anchor, cursor), Math.max(anchor, cursor))
    root.syncingEditor = false
  }

  function editorAnchor() {
    if (editor.selectionStart === editor.selectionEnd) return editor.cursorPosition
    return editor.cursorPosition === editor.selectionStart ? editor.selectionEnd : editor.selectionStart
  }

  function rememberEditorPosition() {
    if (root.syncingEditor || !root.selectedNote) return
    root.repository.rememberEditorSession(root.selectedNote.id, root.pageInfo.index,
      root.pageInfo.start + editor.cursorPosition, root.pageInfo.start + root.editorAnchor())
  }

  function commitEditor() {
    if (root.syncingEditor || !root.selectedNote || root.selectedNote.trashedAt !== null) return
    if (editor.inputMethodComposing) {
      root.compositionPending = true
      return
    }
    root.compositionPending = false
    var page = root.pageInfo
    var nextBody = NotePages.splicePage(root.draftBody, page, editor.text)
    if (nextBody === null || nextBody === root.draftBody) {
      root.rememberEditorPosition()
      return
    }
    var globalCursor = page.start + editor.cursorPosition
    var globalAnchor = page.start + root.editorAnchor()
    root.syncingEditor = true
    var result = root.repository.editNote(root.selectedNote.id, nextBody)
    if (result.accepted && result.note) {
      var nextPage = NotePages.pageIndexForOffset(result.note.body, globalCursor,
        root.editorCharacterLimit, NotePages.DEFAULT_MAX_LINES)
      root.repository.rememberEditorSession(result.note.id, nextPage, globalCursor, globalAnchor)
    }
    root.syncingEditor = false
    root.scheduleSync(true, false)
  }

  function createAndEdit() {
    var result = root.repository.createNote()
    if (!result.accepted) return
    root.scheduleSync(true, true)
  }

  function openNote(id) {
    var result = root.repository.openNote(id)
    if (!result.accepted) return
    root.scheduleSync(true, true)
  }

  function changeEditorPage(delta) {
    if (!root.selectedNote) return
    var target = NotePages.page(root.draftBody, root.pageInfo.index + delta,
      root.editorCharacterLimit, NotePages.DEFAULT_MAX_LINES)
    root.repository.rememberEditorSession(root.selectedNote.id, target.index, target.start, target.start)
    root.scheduleSync(true, true)
  }

  onSnapshotChanged: root.scheduleSync(false, false)
  onRepositoryChanged: root.scheduleSync(true, false)
  Component.onCompleted: {
    root.componentReady = true
    root.scheduleSync(true, false)
  }

  Timer {
    id: panelSyncTimer
    interval: 0
    repeat: false
    onTriggered: {
      var force = root.syncNeedsForce
      var focus = root.syncNeedsFocus
      root.syncNeedsForce = false
      root.syncNeedsFocus = false
      root.syncSearch()
      root.restoreEditor(force)
      if (focus && root.editing) editor.forceActiveFocus()
    }
  }

  FontMetrics {
    id: editorFontMetrics
    font.family: Style.font.family
    font.pixelSize: 12
  }

  FontMetrics {
    id: listStatusMetrics
    font.family: Style.font.family
    font.pixelSize: 9
  }

  Column {
    id: listColumn
    width: root.width
    spacing: 6
    visible: !root.editing

    Item {
      width: parent.width
      height: 30
      Rectangle {
        id: searchBox
        anchors.left: parent.left
        anchors.right: newNoteButton.left
        anchors.rightMargin: 8
        height: 30
        radius: 10
        color: Qt.rgba(Color.bar.text.r, Color.bar.text.g, Color.bar.text.b, 0.08)
        border.width: searchInput.activeFocus ? 1 : 0
        border.color: Color.accent
        TextInput {
          id: searchInput
          anchors.fill: parent
          anchors.leftMargin: 10
          anchors.rightMargin: 10
          verticalAlignment: TextInput.AlignVCenter
          color: Color.bar.text
          font.family: Style.font.family
          font.pixelSize: 11
          selectByMouse: true
          clip: true
          onTextChanged: if (!root.syncingSearch && root.repository) root.repository.setQuery(text)
        }
        Text {
          anchors.fill: searchInput
          verticalAlignment: Text.AlignVCenter
          text: "Search notes"
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 11
          visible: searchInput.text === ""
          enabled: false
        }
      }
      Ui.Button {
        id: newNoteButton
        anchors.right: parent.right
        anchors.rightMargin: root.headerRightInset
        height: 30
        text: "New"
        foreground: Color.bar.text
        bordered: true
        focusable: true
        enabled: root.snapshot.ready
        onClicked: root.createAndEdit()
      }
    }

    Text {
      width: parent.width
      height: visible ? Math.ceil(listStatusMetrics.height) : 0
      text: root.saveLabel()
      textFormat: Text.PlainText
      color: root.snapshot.error ? Color.accent : Color.muted
      font.family: Style.font.family
      font.pixelSize: 9
      elide: Text.ElideRight
      visible: text !== "Saved"
    }

    Repeater {
      model: root.listNotes
      delegate: Rectangle {
        id: noteRow
        required property var modelData
        width: listColumn.width
        height: 42
        radius: 11
        color: Qt.rgba(Color.bar.text.r, Color.bar.text.g, Color.bar.text.b, 0.055)
        opacity: modelData.trashedAt === null ? 1 : 0.58
        activeFocusOnTab: true
        function activate() { root.openNote(modelData.id) }
        Keys.onReturnPressed: function(event) { noteRow.activate(); event.accepted = true }
        Keys.onEnterPressed: function(event) { noteRow.activate(); event.accepted = true }
        Keys.onSpacePressed: function(event) { noteRow.activate(); event.accepted = true }
        Accessible.role: Accessible.ListItem
        Accessible.name: modelData.title
        Accessible.focusable: true
        Accessible.onPressAction: noteRow.activate()
        Text {
          anchors.left: parent.left
          anchors.leftMargin: 10
          anchors.right: parent.right
          anchors.rightMargin: 10
          anchors.top: parent.top
          anchors.topMargin: 6
          text: noteRow.modelData.title
          textFormat: Text.PlainText
          color: Color.bar.text
          font.family: Style.font.family
          font.pixelSize: 11
          font.weight: Font.DemiBold
          elide: Text.ElideRight
        }
        Text {
          anchors.left: parent.left
          anchors.leftMargin: 10
          anchors.bottom: parent.bottom
          anchors.bottomMargin: 5
          text: noteRow.modelData.trashedAt === null ? "Note" : "In trash"
          textFormat: Text.PlainText
          color: Color.muted
          font.family: Style.font.family
          font.pixelSize: 9
        }
        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: noteRow.activate() }
      }
    }

    Text {
      width: parent.width
      height: 44
      verticalAlignment: Text.AlignVCenter
      horizontalAlignment: Text.AlignHCenter
      text: root.snapshot.ready ? ((root.snapshot.query || "") ? "No matching notes" : "No notes yet") : "Notes are unavailable"
      textFormat: Text.PlainText
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: 11
      visible: root.listNotes.length === 0
    }

    Row {
      anchors.horizontalCenter: parent.horizontalCenter
      spacing: 8
      visible: root.listPageCount > 1
      height: visible ? 24 : 0
      PageGlyph { glyph: "‹"; enabled: root.listPage > 0; onInvoked: root.repository.setListPage(root.listPage - 1) }
      Text {
        anchors.verticalCenter: parent.verticalCenter
        text: (root.listPage + 1) + " / " + root.listPageCount
        textFormat: Text.PlainText
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: 9
      }
      PageGlyph { glyph: "›"; enabled: root.listPage + 1 < root.listPageCount; onInvoked: root.repository.setListPage(root.listPage + 1) }
    }

    Ui.Button {
      anchors.horizontalCenter: parent.horizontalCenter
      text: "Retry save"
      foreground: Color.bar.text
      fontSize: 9
      focusable: true
      visible: root.snapshot.saveState === "failed"
      onClicked: root.repository.retrySave()
    }
  }

  Column {
    id: editorColumn
    width: root.width
    spacing: 6
    visible: root.editing

    Item {
      width: parent.width
      height: 28
      Ui.Button {
        id: backButton
        anchors.left: parent.left
        text: "Back"
        foreground: Color.bar.text
        fontSize: 10
        focusable: true
        onClicked: root.repository.setPanelMode("list")
      }
      Text {
        anchors.left: backButton.right
        anchors.leftMargin: 8
        anchors.right: trashButton.left
        anchors.rightMargin: 8
        anchors.verticalCenter: parent.verticalCenter
        text: root.selectedNote ? root.selectedNote.title : ""
        textFormat: Text.PlainText
        color: Color.bar.text
        font.family: Style.font.family
        font.pixelSize: 13
        font.weight: Font.DemiBold
        elide: Text.ElideRight
      }
      Ui.Button {
        id: trashButton
        anchors.right: parent.right
        anchors.rightMargin: root.headerRightInset
        text: root.selectedNote && root.selectedNote.trashedAt === null ? "Trash" : "Restore"
        foreground: Color.bar.text
        fontSize: 9
        focusable: true
        onClicked: {
          if (!root.selectedNote) return
          if (root.selectedNote.trashedAt === null) root.repository.trashNote(root.selectedNote.id)
          else root.repository.restoreNote(root.selectedNote.id)
        }
      }
    }

    Rectangle {
      width: parent.width
      height: Math.max(68, editor.contentHeight + 20)
      radius: 12
      color: Qt.rgba(Color.bar.text.r, Color.bar.text.g, Color.bar.text.b, 0.055)
      border.width: editor.activeFocus ? 1 : 0
      border.color: Color.accent
      TextEdit {
        id: editor
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.margins: 10
        height: contentHeight
        readOnly: !root.snapshot.ready || !root.selectedNote || root.selectedNote.trashedAt !== null
        selectByMouse: true
        wrapMode: TextEdit.Wrap
        textFormat: TextEdit.PlainText
        color: readOnly ? Color.muted : Color.bar.text
        font.family: Style.font.family
        font.pixelSize: 12
        onTextChanged: root.commitEditor()
        onCursorPositionChanged: root.rememberEditorPosition()
        onSelectionStartChanged: root.rememberEditorPosition()
        onSelectionEndChanged: root.rememberEditorPosition()
        onInputMethodComposingChanged: if (!inputMethodComposing && root.compositionPending) root.commitEditor()
      }
      Text {
        anchors.fill: editor
        text: root.selectedNote && root.selectedNote.trashedAt !== null ? "This note is in trash. Restore it to edit." : "Write a note"
        textFormat: Text.PlainText
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: 12
        visible: editor.text === "" || (root.selectedNote && root.selectedNote.trashedAt !== null)
        enabled: false
      }
    }

    Row {
      anchors.horizontalCenter: parent.horizontalCenter
    spacing: 6
      visible: root.pageInfo.count > 1
      height: visible ? 24 : 0
      PageGlyph { glyph: "‹"; enabled: root.pageInfo.index > 0; onInvoked: root.changeEditorPage(-1) }
      Text {
        anchors.verticalCenter: parent.verticalCenter
        text: (root.pageInfo.index + 1) + " / " + root.pageInfo.count
        textFormat: Text.PlainText
        color: Color.muted
        font.family: Style.font.family
        font.pixelSize: 9
      }
      PageGlyph { glyph: "›"; enabled: root.pageInfo.index + 1 < root.pageInfo.count; onInvoked: root.changeEditorPage(1) }
    }

    Row {
      width: parent.width
      spacing: 8
      Text {
        width: Math.max(0, parent.width - retryButton.width - parent.spacing)
        text: root.saveLabel()
        textFormat: Text.PlainText
        color: root.snapshot.error ? Color.accent : Color.muted
        font.family: Style.font.family
        font.pixelSize: 9
        elide: Text.ElideRight
      }
      Ui.Button {
        id: retryButton
        width: visible ? implicitWidth : 0
        text: "Retry save"
        foreground: Color.bar.text
        fontSize: 9
        focusable: true
        visible: root.snapshot.saveState === "failed"
        onClicked: root.repository.retrySave()
      }
    }
  }
}
