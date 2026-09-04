# Omarchy Island scaffold architecture

## Problem

This repository is a standalone Git repository, not an Omarchy checkout. The scaffold must preserve the future first-party paths without copying Quattro host files or touching the active desktop. The pinned target is Omarchy Quattro commit `f99d33a8ddee7b36509a71a6d20d5d23355ce8b1`.

## Usage from the caller

Quattro loads `Service.qml` once. A future owner publishes a plain activity command through `ActivityBroker.qml`. The service reduces that command into one serializable state.

```qml
activityBroker.publish({
  source: "media",
  id: "org.mpris.MediaPlayer2.spotify",
  revision: 7,
  priority: "normal",
  relevance: 50,
  updatedAt: 1788523200000,
  expiresAt: 0,
  target: { mode: "all" },
  compact: { label: "Track title" },
  actions: [{ id: "play-pause", label: "Play or pause", role: "primary" }]
})
```

The later visual renderer can resolve the service after Quattro injects `bar`.

```qml
readonly property var islandService: bar?.shell?.firstPartyServiceFor("omarchy.island")
```

The current inert `BarWidget.qml` deliberately omits that lookup because it has no renderer or interaction to drive yet.

The standalone test runner loads the same reducer that QML imports.

```bash
node test/island/run-activity-model.js
node scripts/verify-scaffold.mjs
```

## Shape

The initial scaffold uses these paths.

```text
shell/plugins/island/
  manifest.json
  ActivityModel.js
  Service.qml
  BarWidget.qml
shell/services/
  ActivityBroker.qml
test/island/
  activity-model-cases.js
  run-activity-model.js
scripts/
  verify-scaffold.mjs
.codex/skills/verify-omarchy-island/
  SKILL.md
  features/
```

`ActivityModel.js` owns the domain. Its state has one keyed activity map and one tagged presentation.

```text
IslandState {
  revision,
  activitiesByKey,
  presentation {
    phase,
    primaryKey,
    secondaryKey,
    selectedKey,
    underlyingKey,
    ownerScreen,
    reason,
    leaseToken
  }
}

Command = publish | update | end | tick | expand | collapse | invoke
reduce(state, command, context) -> { state, effects }
```

The reducer receives `context.nowMs` and `context.focusedScreen`. It never reads a clock, starts a timer, calls a QML object, or imports a Node API. `nextWakeAt(state)` returns the earliest activity expiry or transient lease deadline. The only reducer effect is the symbolic `invoke-owner` record. QML imports the file directly. Node uses a guarded CommonJS export.

`ActivityBroker.qml` forwards plain commands. It owns no activity map or publisher registry. `Service.qml` owns the only mutable reducer state, schedules one bounded `Timer` from `nextWakeAt(state)`, and executes owner effects. `BarWidget.qml` is inert in this increment. It reserves no geometry, exposes a closed `opened` state, and does not create the morphing layer until the visual prototype settles that design.

The manifest declares `service` and `bar-widget`. It includes all metadata required by Quattro's first-party contract. The `keepLoaded` flag keeps reducer state across plugin rescans. It also means that service changes require a shell restart during later live verification.

The public reducer interface is small. It hides validation, stable key generation, ordering, expiry, interruption, restoration, screen ownership, and action effect creation. Callers only create commands and consume the returned state and effects.

## Synthesis decision

The earlier architecture arena selected a bar slot plus a screen-local layer surface over a full bar replacement and split popup cards. This increment stops before that renderer. The current architecture pass adds two constraints from pinned Quattro source.

- The standalone repository mirrors only files that can land at the same upstream paths.
- One repeatable verifier checks the manifest, files, reducer, and QML syntax against the pinned checkout.
- The service exists in the first scaffold because it is the final owner of reducer state.
- The broker never becomes a temporary state owner.
- The first-party ID cannot be installed as a third-party user plugin.

## Tradeoffs accepted

- We accept an inert bar widget in exchange for a valid Quattro entry point before visual behavior exists.
- We accept a draft real-surface verification skill in exchange for preserving the active desktop. The skill cannot claim a pass until a disposable Omarchy VM exists.
- We accept a pinned integration check in exchange for keeping upstream host files out of this repository.
- We accept explicit command records in exchange for deterministic time, expiry, and action tests.

## Alternatives considered

- Copying Quattro's host files would make this repository look runnable, but every upstream change would create a hidden fork.
- Installing `omarchy.island` under `~/.config/omarchy/plugins` would be fast, but Quattro rejects the reserved first-party namespace there.
- Delaying `Service.qml` would force the broker or the widget to own temporary state and create a migration in the next increment.
- Putting timers inside the reducer would make expiry depend on QML runtime order and weaken Node tests.

## Open questions and risks

- Will the pinned upstream contract tests accept the minimum QML entry points without a full shell integration patch?
- Which disposable `omarchy-iso` checkout will prove the verification skill before visual work begins?
- Can the later layer surface observe an outside click without consuming the same click?

## Next implementation step

Integrate these paths into the pinned Omarchy checkout, wire the shell-owned broker into `Service.qml`, and prove the inert entry points in a disposable `omarchy-iso` VM. The following increment can then add the screen-local visual layer without changing activity ownership or the reducer contract.
