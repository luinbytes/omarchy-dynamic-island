import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const [file, start, duration, crop, threshold = "12"] = process.argv.slice(2)
const dimensions = (crop || "").split(":").map(Number)
if (!file || !Number.isFinite(Number(start)) || Number(start) < 0 || !Number.isFinite(Number(duration)) || !(Number(duration) > 0)
    || dimensions.length !== 4 || dimensions.some(value => !Number.isInteger(value) || value < 0)
    || !dimensions[0] || !dimensions[1] || !(Number(threshold) > 0 && Number(threshold) <= 255)) {
  console.error("Usage: node scripts/measure-island-motion.mjs VIDEO START_SECONDS DURATION_SECONDS WIDTH:HEIGHT:X:Y [DARK_THRESHOLD]")
  process.exit(1)
}
const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate", "-of", "json", file], { encoding: "utf8" })
if (probe.status !== 0) throw new Error(probe.stderr || "ffprobe failed")
const [numerator, denominator] = JSON.parse(probe.stdout).streams[0].avg_frame_rate.split("/").map(Number)
const rate = numerator / denominator
if (!(rate > 0)) throw new Error("Video has no usable frame rate")
const [width, height, offsetX, offsetY] = dimensions
const decoded = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-threads", "1", "-filter_threads", "1", "-ss", String(Number(start)), "-i", file, "-t", String(Number(duration)), "-vf", `crop=${dimensions.join(":")},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 256 * 1024 * 1024 })
if (decoded.status !== 0) throw new Error(String(decoded.stderr || "ffmpeg failed"))
const stride = width * height
const samples = []
for (let frame = 0; frame < Math.floor(decoded.stdout.length / stride); frame++) {
  let left = width, top = height, right = -1, bottom = -1
  for (let pixel = 0; pixel < stride; pixel++) {
    if (decoded.stdout[frame * stride + pixel] >= Number(threshold)) continue
    const x = pixel % width, y = Math.floor(pixel / width)
    left = Math.min(left, x)
    right = Math.max(right, x)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }
  samples.push({ seconds: frame / rate, rect: right < 0 ? null : { x: left + offsetX, y: top + offsetY, width: right - left + 1, height: bottom - top + 1 } })
}
console.log(JSON.stringify({ sha256: createHash("sha256").update(readFileSync(file)).digest("hex"), start: Number(start), duration: Number(duration), crop: dimensions, threshold: Number(threshold), rate, samples }, null, 2))
