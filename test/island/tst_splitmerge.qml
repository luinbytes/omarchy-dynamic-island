import QtQuick
import QtTest
import "../../shell/plugins/island"

TestCase {
  name: "SplitMergePreview"

  Component { id: preview; SplitMergeFixture { visible: false } }

  function test_cycle_data() {
    return [{ tag: "animated", reduced: false }, { tag: "reduced", reduced: true }]
  }

  function test_cycle(data) {
    const window = createTemporaryObject(preview, null, { reducedMotion: data.reduced })
    verify(window !== null)
    window.elapsed = window.leadIn - 1
    compare(window.pose.bubble, false)
    compare(window.pose.primary, 0)
    window.elapsed = window.leadIn
    compare(window.pose.ink, data.reduced ? 1 : 0)
    window.elapsed = window.mergeAt - 1
    compare(window.pose.primary, -28)
    compare(window.pose.ink, 1)
    window.elapsed = window.mergeAt
    compare(window.pose.bubble, !data.reduced)
    window.elapsed = window.cycle - 1
    compare(window.pose.primary, 0)
    compare(window.pose.bubble, false)
  }
}
