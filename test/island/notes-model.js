const assert = require("node:assert/strict")
const fs = require("node:fs")
const notes = require("../../shell/plugins/island/NotesModel.js")

let state = notes.initialState()
let result = notes.create(state, "note-100-1", 100)
assert.equal(result.accepted, true, "a note can start empty")
state = result.state

result = notes.edit(state, "note-100-1", "First line\r\nSecond line\nCaf\u00e9", 110)
assert.equal(result.accepted, true, "Unicode note edits are accepted")
assert.equal(result.note.body, "First line\nSecond line\nCaf\u00e9", "line endings normalize at the boundary")
state = result.state

result = notes.create(state, "note-120-2", 120)
state = result.state
result = notes.edit(state, "note-120-2", "Pinned task", 121)
state = result.state
result = notes.togglePin(state, "note-120-2", 122)
state = result.state
assert.deepEqual(notes.visibleNotes(state, "").map(note => note.id), ["note-120-2", "note-100-1"], "pinned active notes sort before newer unpinned notes")
assert.deepEqual(notes.visibleNotes(state, "caf").map(note => note.id), ["note-100-1"], "search matches Unicode body text")
assert.equal(notes.activeCount(state), 2, "active count ignores the current search")
assert.equal(notes.noteFor(state, "note-120-2").title, "Pinned task", "selected notes are resolved outside search results")

result = notes.trash(state, "note-100-1", 130)
assert.equal(result.accepted, true, "trash is a state transition")
state = result.state
assert.equal(result.note.trashedAt, 130, "trash records recovery metadata")
assert.equal(notes.edit(state, "note-100-1", "lost", 131).accepted, false, "trashed notes cannot be edited")
assert.equal(notes.trash(state, "note-100-1", 132).changed, false, "repeated trash converges")

result = notes.restore(state, "note-100-1", 140)
assert.equal(result.accepted, true, "a trashed note can return")
state = result.state
assert.equal(result.note.trashedAt, null, "restore removes recovery metadata")
assert.equal(notes.restore(state, "note-100-1", 141).changed, false, "repeated restore converges")

const serialized = notes.serialize(state)
const parsed = notes.parseDocument(serialized)
assert.equal(parsed.ok, true, "versioned note documents round trip")
assert.deepEqual(notes.documentFor(parsed.state), notes.documentFor(state), "persistence retains every note field")
assert.equal(notes.parseDocument("{bad json").ok, false, "malformed JSON is rejected")
assert.equal(notes.parseDocument(JSON.stringify({ version: notes.VERSION, revision: 0, notes: [{ id: "note-1", body: "x", pinned: false, createdAt: 1, updatedAt: 1, trashedAt: null }, { id: "note-1", body: "y", pinned: false, createdAt: 1, updatedAt: 1, trashedAt: null }] })).ok, false, "duplicate note identifiers are rejected")
assert.equal(notes.parseDocument("").ok, false, "a blank existing document is corrupt")
assert.equal(notes.edit(state, "note-100-1", "\u0000", 150).accepted, false, "unsafe control characters are rejected")
assert.equal(notes.validateQuery("search").ok, true, "the repository query boundary is exported to QML")
assert.equal(notes.firstActiveId(notes.initialState()), "", "an empty repository has no implicit selection")

const repositorySource = fs.readFileSync(require.resolve("../../shell/plugins/island/NotesRepository.qml"), "utf8")
for (const method of ["createNote", "editNote", "selectNote", "openNote", "setQuery", "togglePin", "trashNote", "restoreNote",
  "editorSessionFor", "rememberEditorSession", "setPanelMode", "setListPage", "retrySave"]) {
  assert.match(repositorySource, new RegExp(`function ${method}\\(`), `repository exposes ${method}`)
}
assert.match(repositorySource, /atomicWrites: true/, "repository writes through atomic FileView")
assert.match(repositorySource, /command = \["mkdir", "-p", "-m", "700", root\.dataDirectory\]/, "repository creates only its own private data directory")
assert.match(repositorySource, /notes file is invalid\. It was not overwritten/, "malformed documents block writes")
assert.match(repositorySource, /FileViewError\.FileNotFound/, "only a missing file starts an empty repository")
assert.match(repositorySource, /function blockLoad\(/, "non-missing load failures block overwrite")
assert.match(repositorySource, /NotesModel\.validateQuery\(/, "repository calls the QML-visible query validator")
assert.match(fs.readFileSync(require.resolve("../../shell/plugins/island/NotesModel.js"), "utf8"), /function validateQuery\(/, "query validation has a QML-visible function name")
assert.match(repositorySource, /onSaved:/, "repository waits for FileView save completion")
assert.match(repositorySource, /onSaveFailed:/, "repository reports FileView save failure")
assert.match(repositorySource, /revision: noteState\.revision/, "snapshot exposes persistence revision")
assert.match(repositorySource, /activeCount: NotesModel\.activeCount/, "snapshot active count is query-independent")
assert.match(repositorySource, /selectedNote: NotesModel\.noteFor/, "snapshot selection is query-independent")
assert.match(repositorySource, /editorSession: root\.editorSessionFor/, "ephemeral caret state follows the selected note")
assert.match(repositorySource, /property var editorSessionsById:/, "editor sessions are separate from the persisted note document")
assert.doesNotMatch(repositorySource, /property var state:/, "repository avoids Item.state shadowing")
const panelSource = fs.readFileSync(require.resolve("../../shell/plugins/island/NotesPanel.qml"), "utf8")
assert.match(panelSource, /TextEdit \{/, "panel has a real text editor")
assert.match(panelSource, /Search notes/, "panel has note search")
assert.match(panelSource, /Restore/, "panel exposes recoverable trash")
assert.match(panelSource, /Style\.font\.family/, "panel uses the system font")
assert.match(panelSource, /readonly property real preferredHeight:/, "panel reports content-derived height")
assert.match(panelSource, /property real headerRightInset: 32/, "panel reserves only its upper-right heading inset")
assert.match(panelSource, /NotePages\.splicePage/, "page edits splice into the complete draft")
assert.match(panelSource, /inputMethodComposing/, "active IME composition delays repaging")
assert.match(panelSource, /maximumCharacterWidth/, "the page character budget accounts for wide glyphs")
assert.match(panelSource, /readonly property int notesPerPage: 3/, "the note list is bounded to three rows")
assert.match(panelSource, /id: panelSyncTimer/, "panel synchronization is owned by the panel lifecycle")
assert.doesNotMatch(panelSource, /Qt\.callLater/, "preflight destruction cannot strand note callbacks")
assert.doesNotMatch(panelSource, /Flickable|ListView|ScrollView/, "the panel has no scroll surface")
assert.doesNotMatch(panelSource, /\b(?:Pin|Unpin)\b/, "the panel does not expose note pin controls")

console.log("notes model persistence and recovery assertions passed")
