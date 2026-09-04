# Activity contract

## Sub-features

Publication, revision replacement, deterministic primary and secondary selection, target screens, transient pulse restoration, explicit expiry, expansion, collapse, selected removal, anchor-loss collapse, and symbolic owner invocation.

## How to get to it (user POV)

The user sees this contract through a future activity presented in the Omarchy quickbar. The current scaffold exposes it only through its portable fixture.

## Driving it with the Node fixture

Run `node test/island/run-activity-model.js`. The runner prints one `ok` line per case and exits nonzero on the first suite failure. Set `OMARCHY_UPSTREAM` to an Omarchy checkout, or use a sibling `../omarchy` checkout, then run `node scripts/verify-scaffold.mjs --upstream "$OMARCHY_UPSTREAM"` for the complete scaffold gate.

## Gotchas

The reducer cannot read clocks, QML objects, timers, or Node APIs. Every timestamp comes from the test or service context. A real-surface pass is BLOCKED until the plugin is integrated into a disposable Omarchy VM.
