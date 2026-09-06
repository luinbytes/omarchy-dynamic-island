# Omarchy Island plugin architecture

## Ownership and packaging

This repository is an independent user plugin. The root `manifest.json` declares `luinbytes.island` with `service` and `bar-widget` entry points inside `shell/plugins/island/`. That nested directory is an internal source layout, not an instruction to copy files into Omarchy.

The stock Quattro loader creates the service. `Service.qml` creates its own stateless `ActivityBroker.qml` and owns the only mutable `IslandState` and expiry timer. No injected `shell.activityBroker`, modified host loader, first-party ID, or Omarchy fork is required.

## Activity model

`ActivityModel.js` implements the pure reducer shared by QML and Node tests. Its state contains a revision, keyed activities, and a tagged presentation. Commands are `publish`, `update`, `end`, `tick`, `expand`, `collapse`, and `invoke`.

The reducer receives time and screen context from its caller. It never reads the clock, starts a timer, or accesses QML objects. Actions produce symbolic owner effects. The service applies accepted state and emits those effects for future publishers.

The broker forwards commands without retaining activity state. Keeping it beside the service makes it part of the plugin's lifecycle. `BarWidget.qml` resolves that service and owns its screen-local renderer. It reserves a stable slot while activities are present. See the [renderer design](renderer-architecture.md).

## Packaging decision

Two layouts were considered: moving every QML file to the root, or using a root manifest with relative entry points into the existing source directory. Relative entry points preserve the tested reducer layout and satisfy the normal plugin installer without duplicate manifests.

The reserved `omarchy.*` namespace is not valid for user-installed plugins. The plugin uses `luinbytes.island` and credits `luinbytes`.

## Verification and remaining work

The portable verifier checks the manifest and activity behavior. Optional checks can read an unmodified Omarchy checkout for compatibility and QML imports. Such reads must not alter that checkout.

Runtime QA installs this repository as a user plugin and exercises the existing shell process. The fixture timer and reducer have passed on Omarchy. The first renderer requires its own geometry, input, and display checks. Live publisher integration and full visual parity remain unfinished.
