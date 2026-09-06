import QtQuick
import "MotionModel.js" as MotionModel

QtObject {
  id: root

  property bool reducedMotion: false
  property var state: MotionModel.initialState()
  property var lastIntent: null
  readonly property var visual: MotionModel.renderFrame(state)
  readonly property bool hasVisuals: visual.mapped
  readonly property bool unsettled: !reducedMotion && visual.unsettled

  function accept(intent) {
    root.lastIntent = intent
    root.state = MotionModel.reconcile(root.state, intent, root.reducedMotion)
  }

  function abandon() {
    root.lastIntent = null
    root.state = MotionModel.clear(root.state)
  }

  onReducedMotionChanged: {
    if (root.lastIntent) root.state = MotionModel.reconcile(root.state, root.lastIntent, root.reducedMotion)
  }

  property FrameAnimation clock: FrameAnimation {
    running: root.unsettled
    onTriggered: root.state = MotionModel.advance(root.state, frameTime)
  }
}
