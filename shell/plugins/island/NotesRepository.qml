import QtQuick
import Quickshell
import Quickshell.Io
import "NotesModel.js" as NotesModel

Item {
  id: root

  readonly property string dataHome: {
    var configured = Quickshell.env("XDG_DATA_HOME")
    if (configured) return configured
    var home = Quickshell.env("HOME")
    return home ? home + "/.local/share" : ""
  }
  readonly property string dataDirectory: dataHome ? dataHome + "/omarchy-island" : ""
  readonly property string notesPath: dataDirectory ? dataDirectory + "/notes.json" : ""
  property var noteState: NotesModel.initialState()
  property string selectedId: ""
  property string query: ""
  property string panelMode: "list"
  property int listPage: 0
  property var editorSessionsById: ({})
  property string saveState: "loading"
  property string error: ""
  property bool ready: false
  property bool loadAllowed: false
  property bool loadHandled: false
  property int idCounter: 0
  property int inFlightRevision: -1
  property int queuedRevision: -1
  property int saveRetries: 0
  readonly property var snapshot: ({
    notes: NotesModel.visibleNotes(noteState, query),
    selectedNote: NotesModel.noteFor(noteState, selectedId),
    selectedId: selectedId,
    query: query,
    panelMode: panelMode,
    listPage: listPage,
    editorSession: root.editorSessionFor(selectedId),
    saveState: saveState,
    error: error,
    ready: ready,
    revision: noteState.revision,
    activeCount: NotesModel.activeCount(noteState)
  })

  function rejected(message) {
    root.error = message
    return { accepted: false, changed: false, error: message, state: root.noteState, note: null }
  }

  function nextNoteId() {
    var now = Math.max(0, Math.floor(Date.now()))
    var candidate = ""
    do {
      root.idCounter += 1
      candidate = "note-" + now + "-" + root.idCounter
    } while (Object.prototype.hasOwnProperty.call(root.noteState.notesById, candidate))
    return candidate
  }

  function selectFallback() {
    if (root.selectedId && Object.prototype.hasOwnProperty.call(root.noteState.notesById, root.selectedId)) return
    root.selectedId = NotesModel.firstActiveId(root.noteState)
  }

  function editorSessionFor(id) {
    var value = typeof id === "string" ? root.editorSessionsById[id] : null
    return value ? { page: value.page, cursor: value.cursor, anchor: value.anchor }
      : { page: 0, cursor: 0, anchor: 0 }
  }

  function rememberEditorSession(id, page, cursor, anchor) {
    var note = typeof id === "string" ? root.noteState.notesById[id] : null
    if (!note || typeof page !== "number" || !isFinite(page) || page < 0
        || typeof cursor !== "number" || !isFinite(cursor)
        || typeof anchor !== "number" || !isFinite(anchor)) return false
    var limit = note.body.length
    var next = Object.assign({}, root.editorSessionsById)
    next[id] = {
      page: Math.max(0, Math.floor(page)),
      cursor: Math.max(0, Math.min(limit, Math.floor(cursor))),
      anchor: Math.max(0, Math.min(limit, Math.floor(anchor)))
    }
    root.editorSessionsById = next
    return true
  }

  function setPanelMode(mode) {
    if (mode !== "list" && mode !== "editor") return false
    root.panelMode = mode
    return true
  }

  function setListPage(page) {
    if (typeof page !== "number" || !isFinite(page)) return false
    root.listPage = Math.max(0, Math.floor(page))
    return true
  }

  function acceptMutation(result) {
    if (!result || result.accepted !== true) return root.rejected(result && result.error ? result.error : "note command was rejected")
    root.error = ""
    if (!result.changed) return result
    root.noteState = result.state
    root.selectFallback()
    root.scheduleSave()
    return result
  }

  function createNote() {
    if (!root.ready) return root.rejected(root.error || "notes are not ready")
    var result = NotesModel.create(root.noteState, root.nextNoteId(), Date.now())
    result = root.acceptMutation(result)
    if (result.accepted && result.note) {
      root.selectedId = result.note.id
      root.rememberEditorSession(result.note.id, 0, 0, 0)
      root.panelMode = "editor"
    }
    return result
  }

  function editNote(id, body) {
    if (!root.ready) return root.rejected(root.error || "notes are not ready")
    return root.acceptMutation(NotesModel.edit(root.noteState, id, body, Date.now()))
  }

  function selectNote(id) {
    if (!root.ready) return root.rejected(root.error || "notes are not ready")
    if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(root.noteState.notesById, id)) {
      return root.rejected("note does not exist")
    }
    root.selectedId = id
    root.error = ""
    return { accepted: true, changed: false, error: "", state: root.noteState, note: root.noteState.notesById[id] }
  }

  function openNote(id) {
    var result = root.selectNote(id)
    if (result.accepted) root.panelMode = "editor"
    return result
  }

  function setQuery(value) {
    if (!root.ready) return root.rejected(root.error || "notes are not ready")
    var checked = NotesModel.validateQuery(value)
    if (!checked.ok) return root.rejected(checked.error)
    root.query = checked.value
    root.listPage = 0
    root.error = ""
    return { accepted: true, changed: false, error: "", state: root.noteState, note: null }
  }

  function togglePin(id) {
    if (!root.ready) return root.rejected(root.error || "notes are not ready")
    return root.acceptMutation(NotesModel.togglePin(root.noteState, id, Date.now()))
  }

  function trashNote(id) {
    if (!root.ready) return root.rejected(root.error || "notes are not ready")
    return root.acceptMutation(NotesModel.trash(root.noteState, id, Date.now()))
  }

  function restoreNote(id) {
    if (!root.ready) return root.rejected(root.error || "notes are not ready")
    return root.acceptMutation(NotesModel.restore(root.noteState, id, Date.now()))
  }

  function scheduleSave() {
    if (!root.ready || root.saveState === "blocked") return
    root.queuedRevision = Math.max(root.queuedRevision, root.noteState.revision)
    root.saveRetries = 0
    if (root.inFlightRevision !== -1) {
      root.saveState = "dirty"
      return
    }
    root.saveState = "dirty"
    saveTimer.restart()
  }

  function retrySave() {
    if (!root.ready || root.saveState !== "failed") return false
    root.saveRetries = 0
    root.queuedRevision = Math.max(root.queuedRevision, root.noteState.revision)
    root.saveState = "dirty"
    root.error = ""
    saveTimer.restart()
    return true
  }

  function flushSave() {
    if (!root.ready || root.saveState === "blocked" || root.inFlightRevision !== -1 || root.queuedRevision === -1) return
    root.inFlightRevision = root.queuedRevision
    root.queuedRevision = -1
    root.saveState = "saving"
    notesFile.setText(NotesModel.serialize(root.noteState))
  }

  function acceptSaved() {
    if (root.inFlightRevision === -1) return
    var completedRevision = root.inFlightRevision
    root.inFlightRevision = -1
    root.saveRetries = 0
    if (root.queuedRevision !== -1 || root.noteState.revision > completedRevision) {
      root.saveState = "dirty"
      saveTimer.restart()
      return
    }
    root.saveState = "saved"
    root.error = ""
  }

  function acceptSaveFailed(errorValue) {
    if (root.inFlightRevision !== -1) root.queuedRevision = Math.max(root.queuedRevision, root.inFlightRevision)
    root.inFlightRevision = -1
    root.saveState = "failed"
    root.error = "notes save failed. " + String(errorValue || "unknown file error")
    if (root.saveRetries < 3) {
      root.saveRetries += 1
      saveTimer.restart()
    }
  }

  function blockLoad(errorValue) {
    if (!root.loadAllowed || root.loadHandled) return
    root.loadHandled = true
    root.ready = false
    root.queuedRevision = -1
    root.inFlightRevision = -1
    root.saveState = "blocked"
    root.error = "notes file could not be read. It was not overwritten. " + String(errorValue || "unknown file error")
  }

  function acceptLoaded(raw) {
    if (!root.loadAllowed || root.loadHandled) return
    root.loadHandled = true
    var parsed = NotesModel.parseDocument(raw)
    if (!parsed.ok) {
      root.ready = false
      root.saveState = "blocked"
      root.error = "notes file is invalid. It was not overwritten. " + parsed.error
      return
    }
    root.noteState = parsed.state
    root.selectedId = NotesModel.firstActiveId(root.noteState)
    root.ready = true
    root.saveState = "saved"
    root.error = ""
  }

  function acceptMissingFile() {
    if (!root.loadAllowed || root.loadHandled) return
    root.loadHandled = true
    root.noteState = NotesModel.initialState()
    root.selectedId = ""
    root.ready = true
    root.saveState = "saved"
    root.error = ""
  }

  function beginLoad() {
    if (!root.dataDirectory || !root.notesPath) {
      root.loadHandled = true
      root.saveState = "blocked"
      root.error = "notes storage path is unavailable"
      return
    }
    ensureDirectory.command = ["mkdir", "-p", "-m", "700", root.dataDirectory]
    ensureDirectory.running = true
  }

  FileView {
    id: notesFile
    path: root.notesPath
    watchChanges: false
    atomicWrites: true
    printErrors: false
    onLoaded: root.acceptLoaded(text())
    onLoadFailed: function(errorValue) {
      if (errorValue === FileViewError.FileNotFound) root.acceptMissingFile()
      else root.blockLoad(errorValue)
    }
    onSaved: root.acceptSaved()
    onSaveFailed: function(errorValue) { root.acceptSaveFailed(errorValue) }
  }

  Process {
    id: ensureDirectory
    running: false
    onExited: function(exitCode) {
      if (exitCode !== 0) {
        root.loadHandled = true
        root.saveState = "blocked"
        root.error = "notes storage directory could not be created"
        return
      }
      root.loadAllowed = true
      notesFile.reload()
    }
  }

  Timer {
    id: saveTimer
    interval: 180 * Math.pow(2, root.saveRetries)
    repeat: false
    onTriggered: root.flushSave()
  }

  Component.onCompleted: root.beginLoad()
}
