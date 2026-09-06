import QtQuick
import Quickshell.Io
import "FixtureChecks.js" as FixtureChecks

Item {
  id: root

  required property var service
  required property var activityBroker
  property string lastRejection: ""
  property var expectedState: ({ phase: "idle", ids: [], primaryKey: null, selectedKey: null })
  property var settledState: null
  property double settlesAt: 0
  property string failure: ""

  function activity(id, revision, nowMs, extras) {
    var value = {
      source: "fixture",
      id: id,
      revision: revision,
      priority: "normal",
      relevance: 50,
      createdAt: nowMs,
      updatedAt: nowMs,
      expiresAt: 0,
      target: { mode: "all" },
      compact: { icon: "●", label: "Fixture activity", value: "Ready", progress: 0.62 },
      expanded: {
        leading: { icon: "●", label: "Fixture activity" },
        center: { label: "Current value", value: "Renderer fixture", progress: 0.62 },
        trailing: { value: "62%" },
        bottom: { label: "Fixture actions are symbolic" }
      },
      actions: [
        { id: "open", label: "Open", role: "primary", enabled: true },
        { id: "later", label: "Later", role: "secondary", enabled: false }
      ]
    }
    for (var key in extras) {
      if (extras[key] === undefined) delete value[key]
      else value[key] = extras[key]
    }
    return value
  }

  function stateResult(state) {
    if (root.failure) return "ISLAND_FIXTURE_FAIL reason=" + root.failure
    var expected = root.settledState && Date.now() >= root.settlesAt ? root.settledState : root.expectedState
    var mismatch = FixtureChecks.check(service.state, expected)
    if (mismatch) return "ISLAND_FIXTURE_FAIL reason=" + mismatch
    return "ISLAND_FIXTURE_PASS state=" + state + " revision=" + service.state.revision
  }

  function rejectResult(reason) {
    return "ISLAND_FIXTURE_REJECT reason=" + String(reason || "rejected").replace(/\s+/g, "-")
  }

  function dispatch(command, expected, expectRejection) {
    if (root.failure) return "ISLAND_FIXTURE_FAIL reason=" + root.failure
    root.lastRejection = ""
    var before = service.state.revision
    root.activityBroker.deliver(command)
    if (expectRejection) {
      if (!root.lastRejection || service.state.revision !== before || FixtureChecks.check(service.state, root.expectedState)) {
        root.failure = "malformed-command-not-rejected-cleanly"
        return "ISLAND_FIXTURE_FAIL reason=" + root.failure
      }
      return rejectResult(root.lastRejection)
    }
    root.expectedState = expected
    root.failure = root.lastRejection ? "unexpected-rejection" : service.state.revision !== before + 1 ? "command-not-applied" : FixtureChecks.check(service.state, expected)
    return stateResult(service.presentation.phase)
  }

  function reset() {
    service.resetFixtureState()
    root.failure = ""
    root.settledState = null
    root.settlesAt = 0
    root.expectedState = { phase: "idle", ids: [], primaryKey: null, secondaryKey: null, selectedKey: null, underlyingKey: null }
    return stateResult(service.presentation.phase)
  }

  Connections {
    target: root.service
    function onCommandRejected(reason) { root.lastRejection = reason }
  }

  IpcHandler {
    target: "omarchy-island-fixture"

    function ping(): string {
      return stateResult("ready")
    }

    function status(): string {
      return stateResult(service.presentation.phase)
    }

    function renderStatus(): string {
      return service.renderStatus()
    }

    function reset(): string {
      return root.reset()
    }

    function compact(): string {
      var nowMs = Date.now()
      root.reset()
      return root.dispatch({ type: "publish", activity: root.activity("compact", 1, nowMs, {}) }, { phase: "compact", ids: ["compact"], primaryKey: "compact", selectedKey: "compact" })
    }

    function minimal(): string {
      var nowMs = Date.now()
      root.reset()
      return root.dispatch({ type: "publish", activity: root.activity("minimal", 1, nowMs, {
        compact: undefined,
        minimal: { icon: "●" }
      }) }, { phase: "minimal", ids: ["minimal"], primaryKey: "minimal", selectedKey: "minimal" })
    }

    function two(): string {
      var nowMs = Date.now()
      root.reset()
      root.dispatch({ type: "publish", activity: root.activity("first", 1, nowMs, {}) }, { phase: "compact", ids: ["first"], primaryKey: "first" })
      return root.dispatch({ type: "publish", activity: root.activity("second", 1, nowMs, {
        priority: "high"
      }) }, { phase: "compact", ids: ["first", "second"], primaryKey: "second", secondaryKey: "first", selectedKey: "first" })
    }

    function alerting(): string {
      var nowMs = Date.now()
      root.reset()
      root.dispatch({ type: "publish", activity: root.activity("media", 1, nowMs, {}) }, { phase: "compact", ids: ["media"], primaryKey: "media", selectedKey: "media" })
      root.settlesAt = nowMs + 500
      root.settledState = { phase: "compact", ids: ["media"], primaryKey: "media", selectedKey: "media", secondaryKey: null, underlyingKey: null }
      return root.dispatch({ type: "publish", activity: root.activity("pulse", 1, nowMs, {
        transientMs: 500
      }) }, { phase: "alerting", ids: ["media", "pulse"], primaryKey: "pulse", secondaryKey: "media", selectedKey: "pulse", underlyingKey: "media" })
    }

    function expanded(): string {
      var nowMs = Date.now()
      root.reset()
      root.dispatch({ type: "publish", activity: root.activity("expanded", 1, nowMs, {}) }, { phase: "compact", ids: ["expanded"], primaryKey: "expanded" })
      return root.dispatch({ type: "expand", source: "fixture", id: "expanded" }, { phase: "expanded", ids: ["expanded"], primaryKey: "expanded", selectedKey: "expanded" })
    }

    function expiry(): string {
      var nowMs = Date.now()
      root.reset()
      root.settlesAt = nowMs + 250
      root.settledState = { phase: "idle", ids: [], primaryKey: null, selectedKey: null, secondaryKey: null, underlyingKey: null }
      return root.dispatch({ type: "publish", activity: root.activity("expiry", 1, nowMs, {
        expiresAt: nowMs + 250
      }) }, { phase: "compact", ids: ["expiry"], primaryKey: "expiry", selectedKey: "expiry" })
    }

    function malformed(): string {
      root.reset()
      return root.dispatch({ type: "publish", activity: { source: "", id: "bad" } }, null, true)
    }

    function demo(): string {
      var nowMs = Date.now()
      root.reset()
      root.dispatch({ type: "publish", activity: root.activity("media", 1, nowMs, {
        priority: "high",
        compact: { icon: "▶", label: "Night Drive", value: "2:14", progress: 0.48 }
      }) }, { phase: "compact", ids: ["media"], primaryKey: "media" })
      return root.dispatch({ type: "publish", activity: root.activity("transfer", 1, nowMs, {
        compact: { icon: "⇣", label: "Downloading update", value: "62%", progress: 0.62 }
      }) }, { phase: "compact", ids: ["media", "transfer"], primaryKey: "media", secondaryKey: "transfer", selectedKey: "media" })
    }
  }
}
