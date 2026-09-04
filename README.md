# Omarchy Island

Omarchy Island is a first-party Quattro plugin for live system activities in the quickbar. The project aims to reproduce the interaction quality of macOS Dynamic Island while using Omarchy's own services and visual language.

## Current status

The repository contains the first implementation unit:

- a native `service` and `bar-widget` manifest;
- a pure activity reducer with deterministic selection, interruption, expiry, screen targeting, and symbolic actions;
- QML service and broker entry points;
- an inert quickbar widget that reserves no space before the renderer exists;
- portable model, manifest, JavaScript, and QML checks.

The visual renderer, animations, activity publishers, and shell integration are not implemented yet. Real visual proof must run in a disposable `omarchy-iso` VM, never against the active desktop.

## Verify the scaffold

Run the portable checks without an Omarchy checkout:

```bash
node scripts/verify-scaffold.mjs
```

Pass a checkout at the pinned Quattro commit to include host-contract and QML checks:

```bash
node scripts/verify-scaffold.mjs --upstream /path/to/omarchy
```

The expected host commit is `f99d33a8ddee7b36509a71a6d20d5d23355ce8b1`.

## Design documents

- [Research and implementation plan](docs/omarchy-island-research-and-implementation-plan.md)
- [Delivery plan](docs/omarchy-island-delivery-plan.md)
- [Scaffold architecture](docs/scaffold-architecture.md)
