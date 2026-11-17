const fs = require("node:fs")
const path = require("node:path")

// Open regular files only. Persisted desktop records can contain private
// action arguments; project only the fields used by the island.
function readJson(file) {
  let fd
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK)
    const stat = fs.fstatSync(fd)
    if (!stat.isFile() || stat.size > 8 * 1024 * 1024) return null
    return JSON.parse(fs.readFileSync(fd, "utf8"))
  } catch { return null }
  finally { if (fd !== undefined) fs.closeSync(fd) }
}

function names(dir) {
  try { return fs.readdirSync(dir) } catch { return [] }
}

function notifications(dir) {
  const live = readJson(path.join(dir, "live.json"))
  const history = readJson(path.join(dir, "history.json"))
  const modern = Array.isArray(live) || Array.isArray(history)
  const quiet = modern ? readJson(path.join(dir, "quiet.json")) : readJson(path.join(dir, "../notifications.json"))
  function rows(folder, array) {
    const records = modern ? (Array.isArray(array) ? array : []) : names(folder)
      .filter(name => /^\d+-\d+\.json$/.test(name)).sort().reverse().slice(0, 64)
      .map(name => readJson(path.join(folder, name)))
    return records.filter(Boolean).sort((a,b) => (b.ts || b.timestamp) - (a.ts || a.timestamp)).slice(0, 64)
      .map(({key, ts, source, originalId, timestamp, app, summary, bodyLine, body, urgency}) =>
        ({key, ts, source, originalId, timestamp, app, summary, body: String(bodyLine || body || "").slice(0, 512), urgency}))
  }
  return {available: modern || fs.existsSync(path.join(dir,"history")), modern,
    dnd: quiet?.dnd === true || quiet?.doNotDisturb === true, live: rows(dir, live), history: rows(path.join(dir,"history"), history)}
}

function downloadTracker(dir) {
  const partials = new Map()
  const finished = new Map()
  function observe(name) {
    if (!name || path.basename(name) !== name) return
    let stat
    try { stat = fs.lstatSync(path.join(dir, name)) } catch { return }
    if (!stat.isFile()) return
    const id = stat.dev + ":" + stat.ino
    if (/\.(crdownload|part)$/i.test(name)) {
      partials.set(id, {file: name, name: name.replace(/\.(crdownload|part)$/i,""), size: stat.size,
        started: partials.get(id)?.started || Date.now()})
    } else if (partials.has(id)) {
      finished.set(id, {name, size: stat.size, completed: Date.now()})
      partials.delete(id)
    }
  }
  function snapshot() {
    for (const [id, row] of partials) {
      if (!fs.existsSync(path.join(dir,row.file))) partials.delete(id)
    }
    for (const [id, row] of finished) if (Date.now() - row.completed > 60000) finished.delete(id)
    return {available: fs.existsSync(dir), active: [...partials.values()].slice(0,32),
      recent: [...finished.values()].reverse().slice(0,8)}
  }
  return {observe, snapshot, baseline() { for (const name of names(dir)) if (/\.(crdownload|part)$/i.test(name)) observe(name) }}
}

function watch(mode, dir) {
  const downloads = mode === "downloads" ? downloadTracker(dir) : null
  const watchers = new Map()
  let previous
  let timer
  function publish() {
    timer = null
    const output = JSON.stringify(downloads ? downloads.snapshot() : notifications(dir))
    if (previous !== output) process.stdout.write(output + "\n")
    previous = output
  }
  function schedule() { if (!timer) timer = setTimeout(publish, 200) }
  function connect() {
    let attached = false
    for (const folder of downloads ? [dir] : [dir, path.join(dir,"history"), path.dirname(dir)]) {
      const existing = watchers.get(folder)
      if (existing) {
        let inode
        try { inode = fs.statSync(folder).ino } catch { /* Removed or not mounted. */ }
        if (inode === existing.inode) continue
        existing.watcher.close()
        watchers.delete(folder)
        attached = true
      }
      try {
        const watcher = fs.watch(folder, (_event, name) => {
          if (!downloads && folder === path.dirname(dir) && name !== path.basename(dir) && name !== "notifications.json") return
          if (downloads) downloads.observe(name)
          schedule()
        })
        watchers.set(folder, {watcher, inode: fs.statSync(folder).ino})
        attached = true
        watcher.on("error", () => watcher.close())
        watcher.on("close", () => {
          if (watchers.get(folder)?.watcher === watcher) watchers.delete(folder)
        })
        if (downloads) downloads.baseline()
      } catch { /* A missing directory can appear after login. */ }
    }
    if (attached || downloads || previous === undefined) publish()
  }
  connect()
  setInterval(connect, 5000)
}
if (require.main === module) watch(process.argv[2], process.argv[3])
module.exports = {notifications, downloadTracker}
