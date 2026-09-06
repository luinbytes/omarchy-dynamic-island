import QtQuick
import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import "ActivityModel.js" as ActivityModel
import "CodexModel.js" as CodexModel
import "HubModel.js" as HubModel
import "OmapagerHandoffModel.js" as OmapagerHandoffModel
import "PeekModel.js" as PeekModel
import "PresentationGateModel.js" as PresentationGateModel

Item {
  id: root

  property var shell: null
  readonly property ActivityBroker activityBroker: ActivityBroker {}
  readonly property string focusedScreen: {
    var monitor = Hyprland.focusedMonitor
    return monitor && monitor.name ? String(monitor.name) : ""
  }
  property var state: ActivityModel.initialState()
  property var lastOwnerAction: ({ key: "", actionId: "" })
  readonly property bool fixturesEnabled: Quickshell.env("OMARCHY_ISLAND_FIXTURES") === "1"
  readonly property var activitiesByKey: root.state.activitiesByKey
  readonly property var presentation: root.state.presentation
  readonly property var activityNextWakeAt: ActivityModel.nextWakeAt(root.state)
  property var hubState: HubModel.initialState()
  readonly property var hubSchedule: hubState && hubState.schedule ? hubState.schedule : HubModel.emptySchedule()
  property var hubSources: ({})
  property var hubNextWakeAt: null
  property var peekState: PeekModel.initialState()
  readonly property var peekActive: peekState && peekState.active ? peekState.active : null
  property var peekNextWakeAt: null
  property var presentationGate: PresentationGateModel.initialState()
  property bool presentationCommitPending: false
  property string pendingPeekPromotionId: ""
  property int presenterClaimsRevision: 0
  readonly property var nextWakeAt: root.earlierDeadline(root.activityNextWakeAt,
    root.earlierDeadline(root.hubNextWakeAt, root.peekNextWakeAt))
  readonly property alias music: mediaPublisher
  readonly property alias weather: weatherStore
  readonly property alias agents: agentStore
  readonly property alias notifications: notificationStore
  readonly property alias systemActivity: systemStore
  readonly property var codexUsageProvider: root.codexUsageWidget()
  readonly property var codexUsage: CodexModel.normalize(
    root.codexUsageProvider ? root.codexUsageProvider.usage : null,
    !!root.codexUsageProvider)
  readonly property var domainSnapshots: ({
    activitiesByKey: root.activitiesByKey,
    codex: root.codexUsage,
    weather: weatherStore.snapshot,
    agents: agentStore.snapshot,
    notifications: notificationStore.snapshot,
    notificationPreviewUntil: notificationStore.previewUntil,
    system: systemStore.snapshot,
    media: mediaPublisher.peekSourceSnapshot
  })
  readonly property bool hubEntryVisible: !fixturesEnabled
  readonly property bool omapagerAutomaticDisplayHandoffReady: {
    var snapshot = notificationStore.snapshot
    var sources = root.peekState && root.peekState.sources ? root.peekState.sources : null
    var notifications = sources ? sources.notifications : null
    return !root.fixturesEnabled && notificationStore.usesOmapager === true
      && notificationStore.omapagerAutomaticDisplayClaimsAvailable === true
      && snapshot.available === true && snapshot.ready === true && notificationStore.dnd !== true
      && notifications && notifications.initialized === true && notifications.ready === true
      && notifications.backend === "omapager"
  }
  readonly property bool omapagerAutomaticDisplayClaimsOwnable: notificationStore.omapagerAutomaticDisplayClaimsAvailable
    && OmapagerHandoffModel.canOwnClaims(notificationStore.omapagerAutomaticDisplayClaims)
  readonly property var omapagerAutomaticDisplayClaims: {
    root.presenterClaimsRevision
    if (!root.omapagerAutomaticDisplayHandoffReady) return []
    return OmapagerHandoffModel.claimsFor(true, root.islandWidgets())
  }

  function openHub(tool, screen, entityKey) {
    var next = HubModel.navigate(hubState, tool, screen, entityKey)
    if (next === hubState) return false
    hubState = next
    presentationGate = PresentationGateModel.bypass(root.presentationGate, screen, root.peekState)
    return true
  }

  function toggleHubChooser(screen) {
    var next = HubModel.toggleChooser(hubState, screen)
    if (next === hubState) return false
    hubState = next
    return true
  }

  function closeHubChooser(screen) {
    var next = HubModel.closeChooser(hubState, screen)
    if (next === hubState) return false
    hubState = next
    return true
  }

  function chooseHubTool(tool, screen) {
    var next = HubModel.chooseTool(hubState, tool, screen)
    if (next === hubState) return false
    hubState = next
    return true
  }

  function reportHubLayout(screen, key, widthToken, preferredHeight, expectedWidthToken, heightBudget) {
    var pending = root.hubState && root.hubState.pendingRoute ? root.hubState.pendingRoute : null
    var next = HubModel.acceptLayout(hubState, {
      screen: screen,
      key: key,
      widthToken: widthToken,
      expectedWidthToken: expectedWidthToken,
      preferredHeight: preferredHeight,
      heightBudget: heightBudget
    })
    if (next === hubState) return false
    hubState = next
    if (pending && root.pendingPeekPromotionId !== "" && pending.entityKey === key && pending.ownerScreen === screen) {
      var committed = next.expanded === true && next.ownerScreen === screen && next.entityKey === key
      if (committed) root.consumePeek(root.pendingPeekPromotionId)
      root.pendingPeekPromotionId = ""
    }
    return true
  }

  function compactScheduleFor(screenName) {
    var hub = root.hubState || {}
    var pendingRoute = hub.pendingRoute || null
    var ownsExpanded = hub.expanded === true && hub.ownerScreen === screenName
    var ownsPreflight = pendingRoute && pendingRoute.ownerScreen === screenName
    if (ownsExpanded) return root.hubSchedule
    var schedule = PresentationGateModel.scheduleFor(root.presentationGate, root.hubSchedule, screenName)
    if (ownsPreflight || PresentationGateModel.isHeld(root.presentationGate, screenName)) return schedule
    var previewKey = root.notificationPreviewKey()
    if (!PresentationGateModel.hasShownNotification(root.presentationGate, screenName, previewKey)) return schedule
    return root.scheduleWithoutShownPreview()
  }

  function notificationPreviewKeyFor(sources) {
    var notifications = sources && sources.notifications ? sources.notifications : null
    var preview = notifications && notifications.preview ? notifications.preview : null
    var previewUntil = sources ? sources.notificationPreviewUntil : null
    return preview && typeof preview.key === "string" && typeof previewUntil === "number" && previewUntil > Date.now()
      ? preview.key : ""
  }

  function notificationPreviewKey() {
    return root.notificationPreviewKeyFor(root.hubSources)
  }

  function scheduleWithoutShownPreview() {
    var notifications = root.hubSources && root.hubSources.notifications ? root.hubSources.notifications : null
    if (!notifications || !notifications.preview) return root.hubSchedule
    var sources = Object.assign({}, root.hubSources, {
      notifications: Object.assign({}, notifications, { preview: null }),
      notificationPreviewUntil: null
    })
    return HubModel.reconcile(root.hubState, sources, {
      nowMs: Date.now(),
      focusedScreen: root.focusedScreen,
      reason: "shown-notification"
    }).schedule
  }

  function presentedSchedulesFor(rawPeek) {
    var pending = rawPeek && rawPeek.pending ? rawPeek.pending : null
    var targets = pending && Array.isArray(pending.targetScreens) ? pending.targetScreens : []
    var schedules = {}
    for (var index = 0; index < targets.length; index++) {
      var screen = typeof targets[index] === "string" ? targets[index] : ""
      if (screen && !Object.prototype.hasOwnProperty.call(schedules, screen)) schedules[screen] = root.compactScheduleFor(screen)
    }
    return schedules
  }

  function codexUsageWidget() {
    var hostBar = shell && shell.bar ? shell.bar : null
    var instances = hostBar && typeof hostBar.moduleWidgets === "function"
      ? hostBar.moduleWidgets("lu.codex-usage") : []
    var fallback = null
    for (var index = 0; index < instances.length; index++) {
      var widget = instances[index]
      if (!widget || !widget.usage || typeof widget.usage !== "object") continue
      if (widget.usage.available === true) return widget
      if (!fallback) fallback = widget
    }
    return fallback
  }

  function islandWidgets() {
    var hostBar = shell && shell.bar ? shell.bar : null
    return hostBar && typeof hostBar.moduleWidgets === "function"
      ? hostBar.moduleWidgets("luinbytes.island") : []
  }

  function eligiblePeekScreens() {
    var result = []
    var instances = root.islandWidgets()
    for (var index = 0; index < instances.length; index++) {
      var widget = instances[index]
      var screenName = widget && typeof widget.screenName === "string" ? widget.screenName : ""
      if (screenName && widget.presenterAvailable === true
          && result.indexOf(screenName) < 0) result.push(screenName)
    }
    return result
  }

  function eligiblePeekScreen(screenName) {
    return typeof screenName === "string" && screenName !== "" && root.eligiblePeekScreens().indexOf(screenName) >= 0
  }

  function fullscreenFor(screenName) {
    if (typeof screenName !== "string" || screenName === "" || typeof Hyprland.monitorFor !== "function") return true
    var screens = Quickshell.screens || []
    var screen = null
    for (var index = 0; index < screens.length; index++) {
      if (screens[index] && screens[index].name === screenName) {
        screen = screens[index]
        break
      }
    }
    if (!screen) return true
    var monitor = Hyprland.monitorFor(screen)
    return !!(monitor && monitor.activeWorkspace && monitor.activeWorkspace.hasFullscreen === true)
  }

  function publishPresentation(nextHubState, nextPeekState, nextGate, nextHubSources) {
    var priorPeek = root.peekState || {}
    var activatesPeek = !!(nextPeekState && nextPeekState.active) && !priorPeek.active
    var holdsCompact = !!(nextPeekState && nextPeekState.pending)
    if (holdsCompact) {
      if (nextGate !== root.presentationGate) root.presentationGate = nextGate
      if (nextHubState !== root.hubState) root.hubState = nextHubState
      if (nextPeekState !== root.peekState) root.peekState = nextPeekState
    } else if (activatesPeek) {
      if (nextPeekState !== root.peekState) root.peekState = nextPeekState
      if (nextGate !== root.presentationGate) root.presentationGate = nextGate
      if (nextHubState !== root.hubState) root.hubState = nextHubState
    } else {
      if (nextHubState !== root.hubState) root.hubState = nextHubState
      if (nextGate !== root.presentationGate) root.presentationGate = nextGate
      if (nextPeekState !== root.peekState) root.peekState = nextPeekState
    }
    if (nextHubSources !== root.hubSources) root.hubSources = nextHubSources
  }

  function reconcilePresentation(reason) {
    root.presentationCommitPending = false
    var nowMs = Date.now()
    var targetScreens = root.eligiblePeekScreens()
    var sources = root.domainSnapshots
    var peekResult = PeekModel.reconcile(root.peekState, sources, {
      nowMs: nowMs,
      targetScreens: targetScreens,
      dnd: notificationStore.dnd === true,
      reason: reason || "snapshot"
    })
    var hubResult = HubModel.reconcile(root.hubState, sources, {
      nowMs: nowMs,
      focusedScreen: root.focusedScreen,
      reason: reason || "snapshot"
    })
    var nextGate = PresentationGateModel.reconcile(root.presentationGate, root.hubSchedule, peekResult.state, {
      priorPresentedByScreen: root.presentedSchedulesFor(peekResult.state),
      notificationPreviewKey: root.notificationPreviewKeyFor(sources)
    })
    root.publishPresentation(hubResult.state, peekResult.state, nextGate, sources)
    root.hubNextWakeAt = hubResult.nextWakeAt
    root.peekNextWakeAt = peekResult.nextWakeAt
    return { hub: hubResult, peek: peekResult }
  }

  function reconcilePeek(reason) {
    return root.reconcilePresentation(reason)
  }

  function schedulePresentationReconcile() {
    root.presenterClaimsRevision = root.presenterClaimsRevision >= 2147483646 ? 1 : root.presenterClaimsRevision + 1
    if (presentationCommitPending) return
    presentationCommitPending = true
    Qt.callLater(function() {
      if (!root.presentationCommitPending) return
      root.presentationCommitPending = false
      root.reconcilePresentation("snapshot")
    })
  }

  function consumePeek(id) {
    var result = PeekModel.consume(root.peekState, id)
    var nextGate = PresentationGateModel.reconcile(root.presentationGate, root.hubSchedule, result.state, {
      priorPresentedByScreen: root.presentedSchedulesFor(result.state),
      notificationPreviewKey: root.notificationPreviewKey()
    })
    root.publishPresentation(root.hubState, result.state, nextGate, root.hubSources)
    root.peekNextWakeAt = result.nextWakeAt
    return result.changed === true
  }

  function promotePeek(screen) {
    var active = root.peekActive
    var candidate = active && active.candidate ? active.candidate : null
    var recipients = active && Array.isArray(active.targetScreens) ? active.targetScreens : []
    if (!candidate || active.expiresAt <= Date.now() || typeof screen !== "string" || screen === ""
        || recipients.indexOf(screen) < 0 || !root.eligiblePeekScreen(screen)) {
      if (candidate && active.expiresAt <= Date.now()) root.reconcilePeek("expired-click")
      return false
    }
    var alreadyOpen = root.hubState && root.hubState.expanded === true && root.hubState.ownerScreen === screen
      && root.hubState.tool === candidate.tool && root.hubState.entityKey === candidate.entityKey
    if (alreadyOpen) {
      root.consumePeek(candidate.id)
      return true
    }
    if (root.pendingPeekPromotionId === candidate.id && root.hubState && root.hubState.pendingRoute
      && root.hubState.pendingRoute.ownerScreen === screen && root.hubState.pendingRoute.entityKey === candidate.entityKey) return true
    if (!root.openHub(candidate.tool, screen, candidate.entityKey)) return false
    root.pendingPeekPromotionId = candidate.id
    return true
  }

  WeatherStore { id: weatherStore }
  AgentStore {
    id: agentStore
    shell: root.shell
    enabled: !root.fixturesEnabled
  }
  NotificationStore {
    id: notificationStore
    shell: root.shell
    enabled: !root.fixturesEnabled
  }

  Binding {
    target: notificationStore.omapagerAutomaticDisplayClaimsAvailable ? notificationStore.omapagerService : null
    property: "automaticDisplayClaims"
    value: root.omapagerAutomaticDisplayClaims
    when: root.omapagerAutomaticDisplayHandoffReady && root.omapagerAutomaticDisplayClaimsOwnable
    restoreMode: Binding.RestoreBindingOrValue
  }
  SystemStore {
    id: systemStore
    enabled: !root.fixturesEnabled
  }

  signal commandRejected(string reason)
  signal ownerActionRequested(string key, string actionId)
  signal ownerSeekRequested(string key, string trackToken, real positionSeconds)

  function resetFixtureState() {
    root.lastOwnerAction = { key: "", actionId: "" }
    root.state = ActivityModel.initialState()
    return root.state
  }

  function receive(command) {
    return dispatch(command, Date.now(), root.focusedScreen)
  }

  function dispatch(command, nowMs, targetScreen) {
    var result = ActivityModel.reduce(root.state, command, {
      nowMs: nowMs,
      focusedScreen: targetScreen === undefined ? root.focusedScreen : String(targetScreen)
    })
    if (!result.accepted) {
      root.commandRejected(result.error)
      return result
    }
    if (result.changed) root.state = result.state
    for (var i = 0; i < result.effects.length; i++) {
      var effect = result.effects[i]
      if (effect.type === "invoke-owner") {
        root.lastOwnerAction = { key: effect.key, actionId: effect.actionId }
        root.ownerActionRequested(effect.key, effect.actionId)
      }
    }
    return result
  }

  function publish(activity) { return receive({ type: "publish", activity: activity }) }
  function update(activity) { return receive({ type: "update", activity: activity }) }
  function end(source, id, revision) {
    var command = { type: "end", source: source, id: id }
    if (revision !== undefined) command.revision = revision
    return receive(command)
  }
  function tick() { return receive({ type: "tick" }) }
  function expand(source, id, screen, reason) {
    var command = { type: "expand", source: source, id: id }
    if (screen !== undefined) command.screen = screen
    if (reason !== undefined) command.reason = reason
    return receive(command)
  }
  function collapse(reason) {
    if (hubState.expanded || hubState.pendingRoute) hubState = HubModel.collapse(hubState)
    var command = { type: "collapse", reason: reason === undefined ? "user" : reason }
    return receive(command)
  }
  function invoke(source, id, actionId) {
    return receive({ type: "invoke", source: source, id: id, actionId: actionId })
  }
  function seek(source, id, trackToken, positionSeconds) {
    if (typeof source !== "string" || typeof id !== "string" || typeof trackToken !== "string"
      || typeof positionSeconds !== "number" || !isFinite(positionSeconds)) return false
    var key = ActivityModel.identityKey(source, id)
    var activity = root.activitiesByKey ? root.activitiesByKey[key] : null
    var media = activity && activity.media ? activity.media : null
    if (!media || root.presentation.selectedKey !== key || media.trackToken !== trackToken || media.canSeek !== true) return false
    root.ownerSeekRequested(key, trackToken, positionSeconds)
    return true
  }

  function wakeInterval(wakeAt) {
    var delta = Number(wakeAt) - Date.now()
    if (!isFinite(delta) || delta <= 0) return 1
    return Math.min(2147483647, Math.max(1, Math.floor(delta)))
  }

  function earlierDeadline(left, right) {
    var leftValid = typeof left === "number" && isFinite(left)
    var rightValid = typeof right === "number" && isFinite(right)
    if (!leftValid) return rightValid ? right : null
    if (!rightValid) return left
    return Math.min(left, right)
  }

  function renderStatus() {
    var widgets = []
    var hostBar = shell && shell.bar ? shell.bar : null
    var instances = hostBar && typeof hostBar.moduleWidgets === "function" ? hostBar.moduleWidgets("luinbytes.island") : []
    for (var i = 0; i < instances.length; i++) {
      if (instances[i] && typeof instances[i].diagnostic === "function") widgets.push(instances[i].diagnostic())
    }
    return JSON.stringify({
      focusedScreen: focusedScreen,
      peekTargetScreens: root.eligiblePeekScreens(),
      revision: state.revision,
      presentation: {
        phase: presentation.phase,
        reason: presentation.reason,
        primaryKey: presentation.primaryKey,
        secondaryKey: presentation.secondaryKey,
        selectedKey: presentation.selectedKey,
        ownerScreen: presentation.ownerScreen
      },
      action: lastOwnerAction,
      hub: {
        tool: hubState.tool,
        entityKey: hubState.entityKey,
        expanded: hubState.expanded,
        chooserOpen: hubState.chooserOpen === true,
        ownerScreen: hubState.ownerScreen,
        pendingKey: hubState.pendingRoute ? hubState.pendingRoute.entityKey : "",
        layout: hubState.layout ? {
          key: hubState.layout.key,
          widthToken: hubState.layout.widthToken,
          preferredHeight: hubState.layout.preferredHeight
        } : null,
        layoutError: hubState.layoutError || "",
        schedule: {
          primaryKey: hubSchedule.primary ? hubSchedule.primary.key : "",
          primaryTool: hubSchedule.primary ? hubSchedule.primary.tool : "",
          secondaryKey: hubSchedule.secondary ? hubSchedule.secondary.key : "",
          secondaryTool: hubSchedule.secondary ? hubSchedule.secondary.tool : "",
          reason: hubSchedule.reason,
          deadline: hubNextWakeAt,
          candidates: hubSchedule.candidateCount
        },
        counts: {
          notifications: notificationStore.snapshot.entries.length,
          agents: agentStore.snapshot.sessions.length,
          systemEvents: systemStore.snapshot.events.length
        }
      },
      compactGate: (function() {
        var pending = root.peekState && root.peekState.pending ? root.peekState.pending : null
        var gate = PresentationGateModel.diagnostic(root.presentationGate, root.peekState)
        return {
          pendingSequence: pending && pending.candidate ? pending.candidate.sequence : 0,
          pendingUntil: pending ? pending.coalesceUntil : null,
          heldScreens: gate.heldScreens,
          bypassedScreens: gate.bypassedScreens,
          shownNotificationScreens: gate.shownNotificationScreens
        }
      })(),
      notifications: {
        provider: notificationStore.snapshot.backend || "native",
        available: notificationStore.snapshot.available === true,
        ready: notificationStore.snapshot.ready === true,
        dnd: notificationStore.snapshot.dnd === true,
        liveCount: notificationStore.snapshot.entries.filter(function(entry) { return entry.live === true }).length,
        count: notificationStore.snapshot.entries.length,
        error: notificationStore.snapshot.error || "",
        displayHandoff: {
          available: notificationStore.omapagerAutomaticDisplayClaimsAvailable === true,
          ready: root.omapagerAutomaticDisplayHandoffReady === true,
          claimedScreens: root.omapagerAutomaticDisplayClaims.map(function(claim) { return claim.screenName })
        }
      },
      codex: {
        providerPresent: root.codexUsage.providerPresent === true,
        available: root.codexUsage.available === true,
        sessionUsed: root.codexUsage.sessionUsed,
        weeklyUsed: root.codexUsage.weeklyUsed,
        remaining: root.codexUsage.remaining,
        paceState: root.codexUsage.paceState
      },
      peek: peekActive && peekActive.candidate ? {
        id: peekActive.candidate.id,
        kind: peekActive.candidate.kind,
        subjectKey: peekActive.candidate.subjectKey,
        targetScreens: peekActive.targetScreens,
        expiresAt: peekActive.expiresAt
      } : null,
      media: mediaPublisher.diagnostic(),
      widgets: widgets
    })
  }

  onFocusedScreenChanged: {
    if (root.activitiesByKey && Object.keys(root.activitiesByKey).length > 0) root.tick()
    root.schedulePresentationReconcile()
  }
  onStateChanged: root.schedulePresentationReconcile()
  onDomainSnapshotsChanged: root.schedulePresentationReconcile()
  Component.onCompleted: root.schedulePresentationReconcile()

  Connections {
    target: root.activityBroker
    function onCommandRequested(command) { root.receive(command) }
  }

  MediaPublisher {
    id: mediaPublisher
    shell: root.shell
    service: root
    enabled: !root.fixturesEnabled
    onCommandRequested: function(command) { root.receive(command) }
  }

  Timer {
    id: wakeTimer

    interval: root.nextWakeAt === null ? 0 : root.wakeInterval(root.nextWakeAt)
    repeat: false
    running: root.nextWakeAt !== null
    onTriggered: {
      root.tick()
      root.reconcilePresentation("deadline")
      if (root.nextWakeAt !== null) wakeTimer.restart()
    }
  }

  Loader {
    active: root.fixturesEnabled
    sourceComponent: Component {
      IslandFixture {
        service: root
        activityBroker: root.activityBroker
      }
    }
  }

  IpcHandler {
    target: "luinbytes.island"

    function status(): string {
      return root.renderStatus()
    }

    function agentEvent(event: string): bool {
      return agentStore.ingest(event)
    }
  }
}
