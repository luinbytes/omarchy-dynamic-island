var suite = require("./activity-model-cases.js")

var failures = 0
for (var i = 0; i < suite.cases.length; i++) {
  var test = suite.cases[i]
  try {
    test.run()
    process.stdout.write("ok - " + test.name + "\n")
  } catch (error) {
    failures += 1
    process.stderr.write("not ok - " + test.name + "\n" + String(error && error.stack ? error.stack : error) + "\n")
  }
}

if (failures > 0) process.exitCode = 1
