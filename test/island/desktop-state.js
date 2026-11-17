const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const {notifications, downloadTracker} = require("../../scripts/island-desktop-state.cjs")

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "island-state-"))
try {
  const tracker = downloadTracker(dir)
  for (const suffix of [".crdownload", ".part"]) {
    const name = "sample" + suffix
    fs.writeFileSync(path.join(dir,name), "abc")
    tracker.observe(name)
    assert.equal(tracker.snapshot().active[0].size, 3)
    fs.renameSync(path.join(dir,name), path.join(dir,"saved"))
    tracker.observe("saved")
    assert.equal(tracker.snapshot().recent[0].name, "saved")
    assert.equal(tracker.snapshot().active.length, 0)
  }
  fs.writeFileSync(path.join(dir,"cancelled.part"), "")
  tracker.observe("cancelled.part")
  fs.unlinkSync(path.join(dir,"cancelled.part"))
  assert.equal(tracker.snapshot().active.length, 0)
  assert.ok(tracker.snapshot().recent.every(row => row.name !== "cancelled"))
  fs.mkdirSync(path.join(dir,"history"))
  fs.writeFileSync(path.join(dir,"123-4.json"), JSON.stringify({timestamp:123,originalId:4,summary:"Legacy",execArgv:["secret"]}))
  assert.equal(notifications(dir).live[0].summary,"Legacy")
  assert.ok(!JSON.stringify(notifications(dir)).includes("secret"))
  fs.writeFileSync(path.join(dir,"quiet.json"), '{"dnd":true}')
  fs.writeFileSync(path.join(dir,"live.json"), '[{"key":"sample","ts":2,"summary":"Stock"}]')
  const stock = notifications(dir)
  assert.ok(stock.modern && stock.dnd)
  assert.equal(stock.live[0].summary, "Stock")
} finally { fs.rmSync(dir, {recursive:true,force:true}) }
