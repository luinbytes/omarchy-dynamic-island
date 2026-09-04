# Handoff for Quattro integration

## Read this file, then remove it

Read this file completely before starting work. Your first repository change must remove this file from the branch tip and from GitHub's current tree.

```bash
git rm HANDOFF.md
git commit -m "chore: remove consumed handoff"
git push
```

Confirm that `HANDOFF.md` no longer exists at the remote branch tip. Do not rewrite or force-push history to remove the earlier blob.

## Resume target

Continue Omarchy Island as a native first-party Omarchy Quattro plugin.

- Repository: `https://github.com/luinbytes/omarchy-dynamic-island`
- Default branch: `main`
- Verified base commit: `fcd04a9ae95774047036b36238131231d7d4c81b`
- Working branch: `feature/quattro-integration`
- Pinned Omarchy commit: `f99d33a8ddee7b36509a71a6d20d5d23355ce8b1`

The working branch contains no product changes beyond this handoff. It starts from the verified `main` commit.

## What exists

The initial implementation unit is complete.

- `shell/plugins/island/manifest.json` declares first-party `service` and `bar-widget` entry points.
- `shell/plugins/island/ActivityModel.js` owns the pure activity reducer.
- `shell/plugins/island/Service.qml` owns mutable reducer state, expiry scheduling, and symbolic owner effects.
- `shell/services/ActivityBroker.qml` transports commands without owning state.
- `shell/plugins/island/BarWidget.qml` is hidden, closed, and zero-width until a renderer exists.
- `test/island/` covers the reducer and manifest contracts.
- `scripts/verify-scaffold.mjs` checks required files, portable tests, the pinned Omarchy host, and QML syntax.
- `.codex/skills/verify-omarchy-island/` records the offline and future disposable-VM verification paths.

The reducer state has this shape:

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
```

Commands are `publish`, `update`, `end`, `tick`, `expand`, `collapse`, and `invoke`. The reducer returns `{ state, effects }`. Owner actions remain symbolic until an existing domain owner executes them.

## Decisions already made

- Use a native center quickbar slot plus a screen-local layer surface for expansion.
- Keep one continuous scene graph for compact and expanded states.
- Keep `ActivityBroker` stateless. `Service.qml` owns the only activity map.
- Keep time outside the reducer. `nextWakeAt(state)` drives one QML timer.
- Reject unknown fields, malformed identities, cyclic payloads, executable actions, and ambiguous selectors at the boundary.
- Use stable keys produced from the JSON tuple `[source, id]` through `identityKey`.
- Do not create duplicate collectors for media, audio, power, Bluetooth, reminders, recording, or notifications.
- Do not install `omarchy.island` as a user plugin. Quattro reserves the `omarchy.*` namespace for first-party plugins.

Review `docs/scaffold-architecture.md` before changing these decisions. Use `docs/omarchy-island-research-and-implementation-plan.md` for product behavior and `docs/omarchy-island-delivery-plan.md` for the I1 through I4 sequence.

The user supplied two public reference implementations:

- `https://github.com/Ebullioscopic/Atoll`
- `https://github.com/NKR00711/DynamicIsland_Mac`

Use them to study behavior and visual details. Inspect their licenses before reusing code or assets.

## Verification already recorded

The base commit passed:

- 11 reducer scenarios.
- Hostile and malformed payload rejection.
- The manifest contract.
- JavaScript syntax checks.
- `qmllint` against the pinned Omarchy checkout.
- An independent pre-commit comment audit with zero findings.

Re-run the portable checks first:

```bash
node scripts/verify-scaffold.mjs
```

For the pinned host checks, create a temporary Omarchy checkout and remove it after verification:

```bash
git clone --filter=blob:none --no-checkout https://github.com/basecamp/omarchy.git /tmp/omarchy-island-upstream
git -C /tmp/omarchy-island-upstream checkout --detach f99d33a8ddee7b36509a71a6d20d5d23355ce8b1
node scripts/verify-scaffold.mjs --upstream /tmp/omarchy-island-upstream
```

## Next implementation unit

Prove the first-party integration before building the visual renderer.

1. Resolve a separate clean Omarchy checkout and read its closest `AGENTS.md` files.
2. Branch from the pinned `quattro` commit without changing this repository's `main` history.
3. Port the island paths into that checkout at their matching upstream locations.
4. Inject exactly one shell-owned `ActivityBroker` into the island service and future first-party publishers.
5. Adapt the portable tests to Omarchy's shell test layout. Do not weaken the existing standalone tests.
6. Adapt the verification skill to the location required by the Omarchy repository. The delivery plan expects `agents/skills/omarchy-island-verification/`, while this standalone repository uses `.codex/skills/verify-omarchy-island/`.
7. Prove shell startup, one broker, one service, clean teardown, and hostile-payload rejection in a disposable `omarchy-iso` VM.
8. Record source, unit, QML, and VM evidence separately. An offline pass is not visual or runtime proof.

Do not copy the complete Quattro shell into this repository to make integration appear local. Keep host edits in the Omarchy checkout. Reconcile the delivery path with the user before opening or pushing an upstream pull request.

## Safety boundaries

- Do not edit packaged Omarchy files under `/usr/share` or the active user's shell configuration.
- Do not launch, restart, or kill the active Quickshell session.
- Use Quickshell only. Do not add Waybar configuration.
- Run visual and interaction checks only in a disposable `omarchy-iso` VM.
- Preserve unrelated local work. Use an isolated worktree when the Omarchy checkout is dirty or shared.
- Stop every VM, recorder, browser, watcher, and helper process that you start.
- Do not claim macOS visual parity until fresh screenshots and transition recordings pass human review.

## Known gaps

- No renderer or animation system exists yet.
- No live activity publisher is connected.
- No disposable-VM proof exists.
- No CI or required GitHub check exists.
- No project license has been selected.
- The standalone verifier checks a pinned host contract but does not load the plugin through the real shell registry.

The first action after deleting this file is to run the portable verifier and inspect the pinned Omarchy integration points. Do not repeat the completed architecture exploration unless current upstream evidence invalidates it.
