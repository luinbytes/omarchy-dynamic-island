"use strict"

const fs = require("node:fs")
const path = require("node:path")
const { spawn } = require("node:child_process")

const MAX_PROCESSES = 512
const MAX_OUTPUT_BYTES = 128 * 1024
const MAX_GPU_OUTPUT_BYTES = 4096
const GPU_TIMEOUT_MS = 500
let ownedGpuChild = null

if (process.argv.length !== 2) {
  process.stderr.write("island-system-sample accepts no arguments\n")
  process.exit(64)
}

function readOptional(file) {
  try {
    return fs.readFileSync(file, "utf8")
  } catch (error) {
    return null
  }
}

function cpuTicks(errors) {
  const text = readOptional("/proc/stat")
  const line = text && text.split("\n").find(value => value.startsWith("cpu "))
  if (!line) {
    errors.push("CPU counters are unavailable")
    return null
  }
  const fields = line.trim().split(/\s+/).slice(1).map(Number)
  if (fields.length < 4 || fields.some(value => !Number.isSafeInteger(value) || value < 0)) {
    errors.push("CPU counters are invalid")
    return null
  }
  const total = fields.slice(0, 8).reduce((sum, value) => sum + value, 0)
  const idle = fields[3] + (fields[4] || 0)
  return Number.isSafeInteger(total) && total > 0 ? { total, idle } : null
}

function memory(errors) {
  const text = readOptional("/proc/meminfo")
  if (!text) {
    errors.push("Memory counters are unavailable")
    return null
  }
  const values = Object.create(null)
  for (const line of text.split("\n")) {
    const match = /^([A-Za-z_()]+):\s+([0-9]+)\s+kB$/.exec(line)
    if (match) values[match[1]] = Number(match[2]) * 1024
  }
  if (!Number.isSafeInteger(values.MemTotal) || !Number.isSafeInteger(values.MemAvailable)
    || values.MemTotal <= 0 || values.MemAvailable < 0 || values.MemAvailable > values.MemTotal) {
    errors.push("Memory counters are invalid")
    return null
  }
  return { totalBytes: values.MemTotal, availableBytes: values.MemAvailable }
}

function pressure(name) {
  const text = readOptional("/proc/pressure/" + name)
  const line = text && text.split("\n").find(value => value.startsWith("some "))
  const match = line && /(?:^|\s)avg10=([0-9]+(?:\.[0-9]+)?)(?:\s|$)/.exec(line)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
}

function processStat(pid) {
  const directory = "/proc/" + pid
  let owner
  try {
    owner = fs.statSync(directory).uid
  } catch (error) {
    return null
  }
  if (owner !== process.getuid()) return null
  const text = readOptional(path.join(directory, "stat"))
  if (!text) return null
  const open = text.indexOf("(")
  const close = text.lastIndexOf(")")
  if (open < 1 || close <= open || close + 2 >= text.length) return null
  const fields = text.slice(close + 2).trim().split(/\s+/)
  const state = fields[0]
  const startTimeTicks = fields[19]
  const name = text.slice(open + 1, close).replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 64)
  if (!/^[A-Za-z]$/.test(state) || !/^[0-9]{1,32}$/.test(startTimeTicks) || !name) return null
  return { pid, startTimeTicks, state, name }
}

function ownBlockedProcesses() {
  let entries
  try {
    entries = fs.readdirSync("/proc", { withFileTypes: true })
  } catch (error) {
    return []
  }
  const pids = entries.filter(entry => entry.isDirectory() && /^[0-9]+$/.test(entry.name))
    .map(entry => Number(entry.name)).filter(Number.isSafeInteger).sort((left, right) => left - right)
  const result = []
  for (const pid of pids) {
    const value = processStat(pid)
    if (value && value.state === "D") result.push(value)
    if (result.length >= MAX_PROCESSES) break
  }
  return result
}

function amdGpu() {
  let entries
  try {
    entries = fs.readdirSync("/sys/class/drm")
  } catch (error) {
    return null
  }
  const values = []
  for (const entry of entries.sort()) {
    if (!/^card[0-9]+$/.test(entry)) continue
    const base = path.join("/sys/class/drm", entry, "device")
    const vendor = readOptional(path.join(base, "vendor"))
    const busy = readOptional(path.join(base, "gpu_busy_percent"))
    if (!vendor || vendor.trim().toLowerCase() !== "0x1002" || busy === null) continue
    const value = Number(busy.trim())
    if (Number.isFinite(value) && value >= 0 && value <= 100) values.push(value)
  }
  return values.length ? { busyPercent: Math.max(...values), source: "amd-sysfs" } : null
}

function nvidiaGpu() {
  return new Promise(resolve => {
    let output = ""
    let settled = false
    let child
    const finish = value => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    try {
      child = spawn("nvidia-smi", ["--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"], {
        stdio: ["ignore", "pipe", "ignore"],
        shell: false
      })
      ownedGpuChild = child
    } catch (error) {
      resolve(null)
      return
    }
    const timer = setTimeout(() => {
      try { child.kill("SIGKILL") } catch (error) {}
      finish(null)
    }, GPU_TIMEOUT_MS)
    child.on("error", () => {
      ownedGpuChild = null
      finish(null)
    })
    child.stdout.on("data", chunk => {
      output += chunk.toString("utf8")
      if (Buffer.byteLength(output) > MAX_GPU_OUTPUT_BYTES) {
        try { child.kill("SIGKILL") } catch (error) {}
        finish(null)
      }
    })
    child.on("close", code => {
      ownedGpuChild = null
      if (code !== 0) {
        finish(null)
        return
      }
      const values = output.split(/\s+/).filter(Boolean).map(Number)
        .filter(value => Number.isFinite(value) && value >= 0 && value <= 100)
      finish(values.length ? { busyPercent: Math.max(...values), source: "nvidia-smi" } : null)
    })
  })
}

function stopOwnedGpuChild() {
  if (!ownedGpuChild) return
  try { ownedGpuChild.kill("SIGKILL") } catch (error) {}
  ownedGpuChild = null
}

process.once("exit", stopOwnedGpuChild)
process.once("SIGTERM", () => {
  stopOwnedGpuChild()
  process.exit(143)
})
process.once("SIGINT", () => {
  stopOwnedGpuChild()
  process.exit(130)
})

async function main() {
  const errors = []
  const sample = {
    version: 1,
    sampledAt: 0,
    cpuTicks: cpuTicks(errors),
    memory: memory(errors),
    psi: { cpu: pressure("cpu"), memory: pressure("memory"), io: pressure("io") },
    gpu: amdGpu(),
    processes: ownBlockedProcesses(),
    errors
  }
  if (!sample.gpu) sample.gpu = await nvidiaGpu()
  sample.sampledAt = Date.now()
  let encoded = JSON.stringify(sample)
  while (Buffer.byteLength(encoded) > MAX_OUTPUT_BYTES && sample.processes.length > 0) {
    sample.processes.pop()
    encoded = JSON.stringify(sample)
  }
  if (Buffer.byteLength(encoded) > MAX_OUTPUT_BYTES) throw new Error("system sample exceeds output limit")
  process.stdout.write(encoded + "\n")
}

main().catch(error => {
  process.stderr.write("system sample failed\n")
  process.exitCode = 1
})
