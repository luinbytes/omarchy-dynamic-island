---
name: verify-omarchy-island
description: Verify the Omarchy Island Quattro plugin scaffold and, once integrated, its quickbar activity surface in a disposable Omarchy VM.
---

# Verify Omarchy Island

## Status

The repository currently contains an offline Quattro scaffold. Real-surface proof is BLOCKED until the files are integrated into an Omarchy checkout and exercised by a disposable `omarchy-iso` VM. The active Omarchy desktop is never a verification target.

## Launch

There is no safe launch command for this standalone scaffold. It is not a complete Omarchy checkout and must not start a second Quickshell process. After integration, launch through the sibling `omarchy-iso` checkout with its `omarchy-iso-test` command and wait for the guest `omarchy-shell` readiness signal. Stop the VM through the same harness after evidence is captured.

## Doctor

Run the offline doctor before any work:

```bash
OMARCHY_UPSTREAM="${OMARCHY_UPSTREAM:-../omarchy}"
if ! git -C "$OMARCHY_UPSTREAM" rev-parse --git-dir >/dev/null 2>&1; then
  echo "OMARCHY_UPSTREAM must name an Omarchy checkout or sibling ../omarchy checkout" >&2
  exit 1
fi
node scripts/verify-scaffold.mjs --upstream "$OMARCHY_UPSTREAM"
```

This checks the scaffold files, model cases, manifest, pinned Quattro host commit, and QML syntax. It does not launch a shell. For an integrated checkout, also confirm the host commit with `git rev-parse HEAD` and use the VM harness health check before driving it.

## Drive

The available drive is the portable model fixture:

```bash
node test/island/run-activity-model.js
```

It exercises publication, replacement, deterministic selection, target screens, transient restoration, expiry, expansion, anchor loss, removal, symbolic invocation, and hostile payload rejection. No user-facing visual drive is available until the plugin is integrated.

After integration, drive one mapped feature per run through the disposable VM's fixture IPC. Publish only bounded, synthetic activity snapshots. Use the running shell's existing IPC surface and inspect the resulting layer and state logs. Never launch a standalone Quickshell process or drive the active desktop.

## Evidence

Keep the model output, verifier output, VM logs, screenshots, and short animation recordings under a run-specific directory such as `/tmp/omarchy-island-verification/<run-id>/`. Capture the command and resulting state for every scenario. For visual work, capture idle, compact, alerting, expanded, collapse, and reduced-motion states. Inspect screenshots for clipping, overlap, alignment, focus, and stale input masks. Record a short video for transitions. Verify symbolic action effects and activity removal in logs alongside the visible state.

Source inspection and model tests do not replace real-surface proof. A visual pass requires a disposable VM running an integrated Omarchy checkout. Manual visual acceptance remains separate from automated evidence.

## Cleanup

The current offline commands create no long-running process. For VM verification, stop only the VM, recorder, and watchers started by the run through their owning harness. Do not kill by process name. Preserve the run directory and its evidence, then confirm owned descendants and listeners are gone.

## Helpers

The repeatable scaffold helper is `scripts/verify-scaffold.mjs`. Run it from the repository root. Add `--upstream PATH` to enable the pinned-host and `qmllint` checks. It never launches Quickshell.
