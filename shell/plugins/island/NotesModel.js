var VERSION = 1
var MAX_BODY_LENGTH = 16000
var MAX_QUERY_LENGTH = 256
var MAX_NOTES = 2000

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key)
}

function plainObject(value) {
  if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false
  if (typeof Object.getPrototypeOf !== "function") return true
  var prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function integer(value) {
  return typeof value === "number" && isFinite(value) && Math.floor(value) === value
}

function timestamp(value, label) {
  if (!integer(value) || value < 0 || value > (Number.MAX_SAFE_INTEGER || 9007199254740991)) {
    return { ok: false, error: label + " must be a nonnegative integer" }
  }
  return { ok: true, value: value }
}

function noteId(value) {
  if (typeof value !== "string" || !/^note-[A-Za-z0-9_-]{1,120}$/.test(value)) {
    return { ok: false, error: "note id is invalid" }
  }
  return { ok: true, value: value }
}

function body(value) {
  if (typeof value !== "string") return { ok: false, error: "note body must be a string" }
  if (value.length > MAX_BODY_LENGTH) return { ok: false, error: "note body is too long" }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) return { ok: false, error: "note body contains unsupported control characters" }
  return { ok: true, value: value.replace(/\r\n?/g, "\n") }
}

function validateQuery(value) {
  if (typeof value !== "string") return { ok: false, error: "note query must be a string" }
  if (value.length > MAX_QUERY_LENGTH) return { ok: false, error: "note query is too long" }
  if (/[\x00-\x1f\x7f]/.test(value)) return { ok: false, error: "note query contains control characters" }
  return { ok: true, value: value }
}

function copyNote(note) {
  return {
    id: note.id,
    body: note.body,
    pinned: note.pinned === true,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    trashedAt: note.trashedAt === null ? null : note.trashedAt
  }
}

function initialState() {
  return { version: VERSION, revision: 0, notesById: {} }
}

function copyState(state) {
  var source = state && plainObject(state) ? state : initialState()
  var result = initialState()
  result.revision = integer(source.revision) && source.revision >= 0 ? source.revision : 0
  var map = plainObject(source.notesById) ? source.notesById : {}
  var ids = Object.keys(map)
  for (var index = 0; index < ids.length; index++) result.notesById[ids[index]] = copyNote(map[ids[index]])
  return result
}

function result(state, accepted, changed, error, note) {
  return {
    accepted: accepted === true,
    changed: changed === true,
    error: error || "",
    state: state,
    note: note || null
  }
}

function changedState(state) {
  state.revision += 1
  return state
}

function activeNotes(state) {
  return visibleNotes(state, "").filter(function(note) { return note.trashedAt === null })
}

function activeCount(state) {
  return activeNotes(state).length
}

function create(state, rawId, nowMs) {
  var idResult = noteId(rawId)
  if (!idResult.ok) return result(state, false, false, idResult.error)
  var time = timestamp(nowMs, "created time")
  if (!time.ok) return result(state, false, false, time.error)
  var next = copyState(state)
  if (Object.keys(next.notesById).length >= MAX_NOTES) return result(state, false, false, "note limit reached")
  if (own(next.notesById, idResult.value)) return result(state, false, false, "note id already exists")
  var note = {
    id: idResult.value,
    body: "",
    pinned: false,
    createdAt: time.value,
    updatedAt: time.value,
    trashedAt: null
  }
  next.notesById[note.id] = note
  return result(changedState(next), true, true, "", copyNote(note))
}

function edit(state, rawId, rawBody, nowMs) {
  var idResult = noteId(rawId)
  if (!idResult.ok) return result(state, false, false, idResult.error)
  var bodyResult = body(rawBody)
  if (!bodyResult.ok) return result(state, false, false, bodyResult.error)
  var time = timestamp(nowMs, "edited time")
  if (!time.ok) return result(state, false, false, time.error)
  var next = copyState(state)
  var note = next.notesById[idResult.value]
  if (!note) return result(state, false, false, "note does not exist")
  if (note.trashedAt !== null) return result(state, false, false, "cannot edit a trashed note")
  if (note.body === bodyResult.value) return result(state, true, false, "", copyNote(note))
  note.body = bodyResult.value
  note.updatedAt = Math.max(note.updatedAt, time.value)
  return result(changedState(next), true, true, "", copyNote(note))
}

function togglePin(state, rawId, nowMs) {
  var idResult = noteId(rawId)
  if (!idResult.ok) return result(state, false, false, idResult.error)
  var time = timestamp(nowMs, "pinned time")
  if (!time.ok) return result(state, false, false, time.error)
  var next = copyState(state)
  var note = next.notesById[idResult.value]
  if (!note) return result(state, false, false, "note does not exist")
  if (note.trashedAt !== null) return result(state, false, false, "cannot pin a trashed note")
  note.pinned = !note.pinned
  note.updatedAt = Math.max(note.updatedAt, time.value)
  return result(changedState(next), true, true, "", copyNote(note))
}

function trash(state, rawId, nowMs) {
  var idResult = noteId(rawId)
  if (!idResult.ok) return result(state, false, false, idResult.error)
  var time = timestamp(nowMs, "trashed time")
  if (!time.ok) return result(state, false, false, time.error)
  var next = copyState(state)
  var note = next.notesById[idResult.value]
  if (!note) return result(state, false, false, "note does not exist")
  if (note.trashedAt !== null) return result(state, true, false, "", copyNote(note))
  note.pinned = false
  note.trashedAt = Math.max(note.updatedAt, time.value)
  note.updatedAt = Math.max(note.updatedAt, time.value)
  return result(changedState(next), true, true, "", copyNote(note))
}

function restore(state, rawId, nowMs) {
  var idResult = noteId(rawId)
  if (!idResult.ok) return result(state, false, false, idResult.error)
  var time = timestamp(nowMs, "restored time")
  if (!time.ok) return result(state, false, false, time.error)
  var next = copyState(state)
  var note = next.notesById[idResult.value]
  if (!note) return result(state, false, false, "note does not exist")
  if (note.trashedAt === null) return result(state, true, false, "", copyNote(note))
  note.trashedAt = null
  note.updatedAt = Math.max(note.updatedAt, time.value)
  return result(changedState(next), true, true, "", copyNote(note))
}

function titleFor(rawBody) {
  var lines = String(rawBody || "").split("\n")
  for (var index = 0; index < lines.length; index++) {
    var line = lines[index].trim()
    if (line !== "") return line.slice(0, 120)
  }
  return "Untitled"
}

function visibleNotes(state, rawQuery) {
  var queryResult = validateQuery(rawQuery)
  var needle = queryResult.ok ? queryResult.value.toLowerCase() : ""
  var source = copyState(state)
  var ids = Object.keys(source.notesById)
  var notes = []
  for (var index = 0; index < ids.length; index++) {
    var note = source.notesById[ids[index]]
    if (needle !== "" && note.body.toLowerCase().indexOf(needle) === -1) continue
    var item = copyNote(note)
    item.title = titleFor(item.body)
    notes.push(item)
  }
  notes.sort(function(left, right) {
    var leftTrashed = left.trashedAt === null ? 0 : 1
    var rightTrashed = right.trashedAt === null ? 0 : 1
    if (leftTrashed !== rightTrashed) return leftTrashed - rightTrashed
    var leftPinned = left.pinned ? 0 : 1
    var rightPinned = right.pinned ? 0 : 1
    if (leftPinned !== rightPinned) return leftPinned - rightPinned
    if (left.updatedAt !== right.updatedAt) return right.updatedAt - left.updatedAt
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  })
  return notes
}

function noteFor(state, rawId) {
  if (typeof rawId !== "string") return null
  var source = copyState(state)
  if (!own(source.notesById, rawId)) return null
  var note = copyNote(source.notesById[rawId])
  note.title = titleFor(note.body)
  return note
}

function parseNote(raw) {
  if (!plainObject(raw)) return { ok: false, error: "note must be an object" }
  var fields = Object.keys(raw)
  var allowed = { id: true, body: true, pinned: true, createdAt: true, updatedAt: true, trashedAt: true }
  for (var index = 0; index < fields.length; index++) {
    if (!own(allowed, fields[index])) return { ok: false, error: "note has an unsupported field" }
  }
  var idResult = noteId(raw.id)
  if (!idResult.ok) return idResult
  var bodyResult = body(raw.body)
  if (!bodyResult.ok) return bodyResult
  if (typeof raw.pinned !== "boolean") return { ok: false, error: "note pinned must be boolean" }
  var created = timestamp(raw.createdAt, "note createdAt")
  if (!created.ok) return created
  var updated = timestamp(raw.updatedAt, "note updatedAt")
  if (!updated.ok) return updated
  if (updated.value < created.value) return { ok: false, error: "note updatedAt precedes createdAt" }
  if (raw.trashedAt !== null && raw.trashedAt !== undefined) {
    var trashed = timestamp(raw.trashedAt, "note trashedAt")
    if (!trashed.ok) return trashed
    if (trashed.value < updated.value) return { ok: false, error: "note trashedAt precedes updatedAt" }
  }
  return {
    ok: true,
    value: {
      id: idResult.value,
      body: bodyResult.value,
      pinned: raw.trashedAt === null || raw.trashedAt === undefined ? raw.pinned : false,
      createdAt: created.value,
      updatedAt: updated.value,
      trashedAt: raw.trashedAt === null || raw.trashedAt === undefined ? null : raw.trashedAt
    }
  }
}

function parseDocument(raw) {
  if (typeof raw !== "string") return { ok: false, error: "notes document must be text" }
  if (raw.trim() === "") return { ok: false, error: "notes document is empty" }
  var document
  try {
    document = JSON.parse(raw)
  } catch (error) {
    return { ok: false, error: "notes document is not valid JSON" }
  }
  if (!plainObject(document)) return { ok: false, error: "notes document must be an object" }
  var fields = Object.keys(document)
  var allowed = { version: true, revision: true, notes: true }
  for (var fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
    if (!own(allowed, fields[fieldIndex])) return { ok: false, error: "notes document has an unsupported field" }
  }
  if (document.version !== VERSION) return { ok: false, error: "notes document version is unsupported" }
  var revision = timestamp(document.revision, "notes revision")
  if (!revision.ok) return revision
  if (!Array.isArray(document.notes) || document.notes.length > MAX_NOTES) return { ok: false, error: "notes document has an invalid notes list" }
  var state = initialState()
  state.revision = revision.value
  for (var index = 0; index < document.notes.length; index++) {
    var parsed = parseNote(document.notes[index])
    if (!parsed.ok) return parsed
    if (own(state.notesById, parsed.value.id)) return { ok: false, error: "notes document repeats a note id" }
    state.notesById[parsed.value.id] = parsed.value
  }
  return { ok: true, state: state }
}

function documentFor(state) {
  var source = copyState(state)
  var notes = Object.keys(source.notesById).sort().map(function(id) { return copyNote(source.notesById[id]) })
  return { version: VERSION, revision: source.revision, notes: notes }
}

function serialize(state) {
  return JSON.stringify(documentFor(state), null, 2) + "\n"
}

function firstActiveId(state) {
  var notes = activeNotes(state)
  return notes.length > 0 ? notes[0].id : ""
}

if (typeof module !== "undefined") {
  module.exports = {
    VERSION: VERSION,
    MAX_BODY_LENGTH: MAX_BODY_LENGTH,
    initialState: initialState,
    create: create,
    edit: edit,
    togglePin: togglePin,
    trash: trash,
    restore: restore,
    visibleNotes: visibleNotes,
    activeCount: activeCount,
    noteFor: noteFor,
    validateQuery: validateQuery,
    parseDocument: parseDocument,
    documentFor: documentFor,
    serialize: serialize,
    firstActiveId: firstActiveId,
    titleFor: titleFor
  }
}
