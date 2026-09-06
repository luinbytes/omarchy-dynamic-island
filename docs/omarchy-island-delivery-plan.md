# Omarchy Island plugin delivery plan

## Scope

Deliver an independent user plugin from `luinbytes/omarchy-dynamic-island` on `feature/quattro-integration`. This plan supersedes the earlier first-party integration plan. Do not create an Omarchy fork, modify host source, or deliver plugin changes to an Omarchy repository.

## Activity foundation

- Keep one root manifest with the user plugin ID `luinbytes.island`.
- Keep the broker, reducer, service, and widget within this plugin.
- Use stock Quattro service loading without additional host properties.
- Check activity selection, expiry, actions, rejection, and package validity with the portable verifier.
- Install the branch in a disposable Omarchy session using the README instructions.
- Verify service startup, fixed fixture behavior, disable, restart, and clean teardown in that session.

Portable checks, packaging, and the live fixture timer scenarios have passed on Omarchy. Fixture teardown removes its IPC target when the plugin is disabled.

## Renderer

The first renderer uses a native bar widget and a plugin-owned Quickshell window. Verify geometry, keyboard access, reduced motion, multiple monitors, and input behavior using real screenshots and interaction evidence. The [renderer design](renderer-architecture.md) records ownership and acceptance limits. Full visual parity remains unfinished.

The [first renderer QA record](renderer-qa.md) documents the completed top-bar, dual-monitor checks and remaining acceptance limits. The temporary installation was removed after verification.

## Publishers

Connect supported activities through existing public host or system interfaces. Keep action delegation explicit. If an activity cannot be accessed without changing Omarchy internals, document the limitation and choose a plugin-scoped alternative.

## Delivery

Keep tests and the root README current. Commit and push only this repository's task branch when requested. Record the pushed SHA and leave user QA findings explicit. Do not merge or publish a release without authorization.
