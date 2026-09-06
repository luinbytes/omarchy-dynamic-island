const { spawnSync } = require("node:child_process")
const path = require("node:path")
const fs = require("node:fs")
const os = require("node:os")
const model = require("../shell/plugins/island/AgentModel.js")

function configuration() {
  const script = path.resolve(__filename).replace(/'/g, "'\\''")
  const events = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PermissionRequest", "Stop", "Interrupt", "SessionEnd", "SubagentStart", "SubagentStop"]
  const hooks = Object.fromEntries(events.map(event => [event, [{ hooks: [{ type: "command", command: "node '" + script + "'", timeout: 2 }] }]]))
  return { hooks }
}

function updateHooks(directory, remove) {
    const target = path.join(directory, "hooks.json")
    if (!remove) fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    const stat = fs.lstatSync(target, { throwIfNoEntry: false })
    const exists = !!stat
    if (!exists && remove) return false
    if (exists && !stat.isFile()) throw new Error("not a regular file")
    const previous = exists ? fs.readFileSync(target, "utf8") : "{}"
    const config = JSON.parse(previous)
    if (!config || Array.isArray(config) || typeof config !== "object") throw new Error("invalid config")
    if (config.hooks !== undefined && (!config.hooks || Array.isArray(config.hooks) || typeof config.hooks !== "object")) throw new Error("invalid hooks")
    if (remove && !config.hooks) return false
    config.hooks ||= {}
    const added = configuration().hooks
    let removed = false
    for (const [event, entries] of Object.entries(added)) {
      const current = config.hooks[event] || []
      if (!Array.isArray(current)) throw new Error("invalid hook event")
      const command = entries[0].hooks[0].command
      if (remove && !current.some(group => group && Array.isArray(group.hooks) && group.hooks.some(handler => handler && handler.command === command))) continue
      removed = true
      config.hooks[event] = current.map(group => {
        if (!group || !Array.isArray(group.hooks)) throw new Error("invalid hook group")
        if (!group.hooks.some(handler => handler && handler.command === command)) return group
        return { ...group, hooks: group.hooks.filter(handler => handler.command !== command) }
      }).filter(group => group.hooks.length > 0 || current.includes(group))
      if (!remove) config.hooks[event].push(...entries)
    }
    if (remove && !removed) return false
    const next = JSON.stringify(config, null, 2) + "\n"
    if (next !== previous) {
      if (exists ? fs.readFileSync(target, "utf8") !== previous : fs.existsSync(target)) throw new Error("configuration changed")
      if (exists) fs.writeFileSync(target + ".island-backup-" + process.hrtime.bigint(), previous, { flag: "wx", mode: 0o600 })
      const temporary = target + ".island-" + process.pid
      try {
        fs.writeFileSync(temporary, next, { flag: "wx", mode: 0o600 })
        fs.renameSync(temporary, target)
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
      }
    }
    return next !== previous
}

function main() {
if (process.argv.includes("--print-config")) {
  process.stdout.write(JSON.stringify(configuration(), null, 2) + "\n")
} else if (process.argv.includes("--install") || process.argv.includes("--remove")) {
  try {
    updateHooks(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), process.argv.includes("--remove"))
    process.stdout.write(process.argv.includes("--install") ? "Hooks installed. Review and trust them in Codex /hooks.\n" : "Island hooks removed. Other hooks were preserved.\n")
  } catch {
    process.stderr.write("Hook configuration could not be updated safely. Existing hooks were preserved.\n")
    process.exitCode = 1
  }
} else {
  let bytes = 0
  const chunks = []
  const deadline = setTimeout(() => process.exit(0), 900)
  process.stdin.on("data", chunk => {
    bytes += chunk.length
    if (bytes > 1024 * 1024) process.exit(0)
    chunks.push(chunk)
  })
  process.stdin.on("end", () => {
    clearTimeout(deadline)
    let raw
    try { raw = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { return }
    const event = model.fromHook(raw, Date.now())
    if (event) spawnSync("omarchy-shell", ["luinbytes.island", "agentEvent", JSON.stringify(event)], { timeout: 500, stdio: "ignore" })
    if (raw.hook_event_name === "Stop" || raw.hook_event_name === "SubagentStop") process.stdout.write("{}\n")
  })
}
}

if (require.main === module) main()
module.exports = { configuration, updateHooks }
