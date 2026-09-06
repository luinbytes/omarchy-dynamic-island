#!/usr/bin/env node

const fs = require("node:fs")
const path = require("node:path")

function fail() {
  process.stderr.write("notification history read failed\n")
  process.exit(1)
}

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : ""
}

function safeInteger(value, minimum, maximum) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null
}

function text(value, maximum) {
  return typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum) : ""
}

function omapagerKey(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,120}$/.test(value) ? value : ""
}

function omapagerEntry(value, name) {
  if (!value || typeof value !== "object") return null
  var key = omapagerKey(value.key)
  var seconds = Number(value.ts)
  var closedAt = Number(name.slice(0, name.indexOf("-")))
  if (!key || !Number.isSafeInteger(closedAt) || closedAt <= 0 || !Number.isFinite(seconds)
      || seconds <= 0 || !Number.isSafeInteger(Math.round(seconds * 1000)) || name !== `${closedAt}-${key}.json`) return null
  return {
    key,
    app: text(value.app, 80),
    source: text(value.source, 80),
    summary: text(value.summary, 160),
    body: text(value.body, 512),
    bodyLine: text(value.bodyLine, 512),
    urgency: typeof value.urgency === "number" || typeof value.urgency === "string" ? value.urgency : 1,
    ts: seconds,
    restored: true
  }
}

function main() {
  const requestedDirectory = option("--dir")
  const format = option("--format") || "native"
  const limit = safeInteger(option("--limit"), 1, 10)
  const maximumBytes = safeInteger(option("--max-bytes"), 1024, 65536)
  if (!path.isAbsolute(requestedDirectory) || (format !== "native" && format !== "omapager")
      || limit === null || maximumBytes === null) fail()

  let directoryStat
  try {
    directoryStat = fs.lstatSync(requestedDirectory)
  } catch (error) {
    if (error && error.code === "ENOENT") {
      process.stdout.write(JSON.stringify(format === "omapager"
        ? { version: 2, backend: "omapager", entries: [] }
        : { version: 1, entries: [] }))
      return
    }
    fail()
  }
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) fail()

  const directory = path.resolve(requestedDirectory)
  let names
  try {
    var expression = format === "omapager" ? /^\d+-[A-Za-z0-9._-]{1,120}\.json$/ : /^(\d+)-(\d+)\.json$/
    names = fs.readdirSync(directory, { withFileTypes: true })
      .filter(entry => entry.isFile() && !entry.isSymbolicLink() && expression.test(entry.name))
      .map(entry => entry.name)
      .sort((left, right) => {
        const leftTimestamp = Number(left.slice(0, left.indexOf("-")))
        const rightTimestamp = Number(right.slice(0, right.indexOf("-")))
        return rightTimestamp - leftTimestamp || left.localeCompare(right)
      })
      .slice(0, limit)
  } catch (error) {
    fail()
  }

  const entries = []
  for (const name of names) {
    const filePath = path.resolve(directory, name)
    if (path.dirname(filePath) !== directory) fail()
    let descriptor
    try {
      descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
      const stat = fs.fstatSync(descriptor)
      if (!stat.isFile() || stat.size < 1 || stat.size > maximumBytes) fail()
      const buffer = Buffer.alloc(stat.size)
      const bytesRead = fs.readSync(descriptor, buffer, 0, stat.size, 0)
      if (bytesRead !== stat.size) fail()
      const parsed = JSON.parse(buffer.toString("utf8"))
      if (format === "omapager") {
        const entry = omapagerEntry(parsed, name)
        if (!entry) fail()
        entries.push(entry)
      } else {
        const timestamp = safeInteger(parsed && parsed.timestamp, 1, Number.MAX_SAFE_INTEGER)
        const originalId = safeInteger(parsed && parsed.originalId, 0, Number.MAX_SAFE_INTEGER)
        if (timestamp === null || originalId === null || name !== `${timestamp}-${originalId}.json`) fail()
        entries.push({
          originalId,
          app: typeof parsed.app === "string" ? parsed.app : "",
          summary: typeof parsed.summary === "string" ? parsed.summary : "",
          body: typeof parsed.body === "string" ? parsed.body : "",
          urgency: typeof parsed.urgency === "number" || typeof parsed.urgency === "string" ? parsed.urgency : 1,
          timestamp
        })
      }
    } catch (error) {
      fail()
    } finally {
      if (descriptor !== undefined) {
        try { fs.closeSync(descriptor) } catch (error) {}
      }
    }
  }
  process.stdout.write(JSON.stringify(format === "omapager"
    ? { version: 2, backend: "omapager", entries }
    : { version: 1, entries }))
}

main()
