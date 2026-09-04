---
name: verify-omarchy-island
description: Verify the independent Omarchy Island user plugin package, activity model, and optional disposable-session runtime.
---

# Verify Omarchy Island

## Scope

Work in `luinbytes/omarchy-dynamic-island` on its task branch. This is a user plugin with ID `luinbytes.island`. Never copy it into Omarchy source or create an Omarchy fork for verification. Upstream checkouts are read-only references.

## Portable checks

Run from the plugin repository:

```bash
node scripts/verify-scaffold.mjs
```

This checks the root manifest, packaged entry points, and model behavior. If an Omarchy checkout and QML lint tools are available, use the verifier's `--upstream PATH` option for compatibility checks. Missing runtime tools must remain explicit.

## Disposable-session QA

Use an existing disposable Omarchy Quattro session. Install this branch using the root [README](../../../README.md). Run `omarchy plugin validate .` from its installed directory before enabling `luinbytes.island`.

Do not patch the host shell or start a second Quickshell process. Inspect the existing shell logs for component errors. The widget is hidden in this increment, so expect the existing bar to retain its appearance.

To exercise fixed scenarios, start the disposable shell session with `OMARCHY_ISLAND_FIXTURES=1` in its environment. The plugin loads the fixture only with this explicit opt-in. Run against that session's existing shell:

```bash
omarchy-shell omarchy-island-fixture ping
omarchy-shell omarchy-island-fixture compact
omarchy-shell omarchy-island-fixture minimal
omarchy-shell omarchy-island-fixture two
omarchy-shell omarchy-island-fixture alerting
omarchy-shell omarchy-island-fixture expanded
omarchy-shell omarchy-island-fixture expiry
omarchy-shell omarchy-island-fixture status
omarchy-shell omarchy-island-fixture malformed
```

Allow expiry to elapse before checking status. Expect bounded PASS output for valid scenarios, idle after expiry, and REJECT output for malformed input. Rescan plugins and inspect logs for duplicate IPC targets. Disable the plugin and confirm the fixture becomes unavailable. Restart the session without the fixture environment variable and confirm the fixture is absent.

The fixture accepts fixed scenarios only. It is not a public activity API.

## Evidence and cleanup

Record commands, responses, shell logs, and a screenshot of the unchanged bar. Portable checks do not prove QML startup. No renderer or animation pass is possible until those features exist.

Stop only sessions, VMs, and supporting processes started by the verification run. Check their process and listener state after stopping them. Preserve intentional evidence and the user's existing sessions.

## Feature references

- [Activity contract](features/activity-contract.md)
- [Quickbar anchor](features/quickbar-anchor.md)
- [Live publishers](features/live-activity-publishers.md)
