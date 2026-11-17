import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const motion = require("../shell/plugins/island/MotionModel.js")
const directory = path.dirname(fileURLToPath(import.meta.url))
const historicalReference = path.resolve(directory, "../test/island/apple-motion-reference.json")
const expected = { expansion: [0.387, 0.792], collapse: [0.479, 0.894] }

if (!fs.existsSync(historicalReference)) throw new Error("Historical Apple comparison data is missing")
const results = Object.keys(expected).map(direction => {
  const [response, dampingFraction] = expected[direction]
  const omega = 2 * Math.PI / response
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
  scope: "Native spring samples for manual expansion and collapse.",
  source: "https://github.com/opencoredev/islandcn/blob/0011a41ea4882f3818caf35c98f3ee46b80c4a2c/lib/island/motion.ts",
  historicalAppleComparison: {
    path: "test/island/apple-motion-reference.json",
    preserved: true,
    compared: false,
    reason: "Its captured approximation remains historical evidence and does not define the new requested timing."
  },
  results
}, null, 2))
if (results.some(result => !result.pass)) process.exitCode = 1
