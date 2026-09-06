import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const motion = require("../shell/plugins/island/MotionModel.js")
const directory = path.dirname(fileURLToPath(import.meta.url))
const historicalReference = path.resolve(directory, "../test/island/apple-motion-reference.json")
const responseSeconds = 0.32
const dampingFraction = 0.88
const omega = Math.PI * 2 / responseSeconds
const directions = ["expansion", "collapse"]

if (!fs.existsSync(historicalReference)) throw new Error("Historical Apple comparison data is missing")
const results = directions.map(direction => {
  const profile = motion.PROFILES[direction]
  const samples = [0.1, 0.2].map(seconds => ({
    seconds,
    progress: motion.sampleSpring(0, 0, 1, profile.omega, profile.zeta, seconds).value
  }))
  const pass = Number.isFinite(profile.omega) && Number.isFinite(profile.zeta)
    && Math.abs(profile.omega - omega) < 0.000001 && profile.zeta === dampingFraction
    && samples.every(sample => Number.isFinite(sample.progress) && sample.progress > 0 && sample.progress <= 1.02)
  return { direction, omega: profile.omega, zeta: profile.zeta, samples, pass }
})

console.log(JSON.stringify({
  scope: "Nootch source contract. The outer panel spring uses response 0.32 seconds and damping 0.88. This is an analytical Qt translation, not captured macOS parity.",
  source: "https://github.com/DeepanshuMishraa/nootch/blob/main/Sources/Nootch/NotchPanel.swift",
  historicalAppleComparison: {
    path: "test/island/apple-motion-reference.json",
    preserved: true,
    compared: false,
    reason: "Its captured approximation remains historical evidence and does not define the new requested timing."
  },
  results
}, null, 2))
if (results.some(result => !result.pass)) process.exitCode = 1
