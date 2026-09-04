# Omarchy Island delivery plan

This program ships Omarchy Island as a first-party Quattro activity surface. It preserves one shell process, one owner per data domain, and one continuous quickbar-to-expanded renderer. The stack lands I1, I2, I3, then I4. The operator reviews every visual PR and performs every merge.

## How to read this

One box is one unit of work. Every box names the evidence that checks it. A nested box is a sub-step of the box above it. Check a box only when its evidence exists, a file, a log line, a screenshot, a test run, or a SHA. The body is a how-to. The appendices explain and record.

The program runs `pstack/skills/poteto-mode/playbooks/autopilot-stack.md`. Owners stop each PR at merge-ready. The operator reviews and merges I1, I2, I3, and I4 in order.

Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] State the protocol and this plan to the operator, then stop. Start execution only on her explicit go.
- [ ] On her go, arm a `/goal` with this exact text. "Run docs/omarchy-island-delivery-plan.md in I1, I2, I3, I4 order. Require unit, ten-lane live, and perf evidence for every PR. The operator reviews and merges each PR. Finish when Omarchy Island is bundled, documented, visually accepted, and proven against the definition of done."
- [ ] Read the current execution instructions at program start. Re-read them at every tick.
  - [ ] Read `git show origin/main:pstack/skills/poteto-mode/playbooks/autopilot-stack.md` when the skill suite is vendored. Otherwise read the installed playbook and record its version.
  - [ ] Read `git show origin/main:pstack/skills/swarm/SKILL.md` when vendored. Otherwise read the installed skill and record its version.
  - [ ] Read `git show origin/main:agents/skills/omarchy-island-verification/SKILL.md` after I1 adds it. Before I1, read `agents/skills/visual-verification.md` and `agents/skills/acceptance-tests.md` from `origin/quattro`.
  - [ ] Read `git show origin/main:pstack/skills/poteto-mode/playbooks/opening-a-pr.md` when vendored. Otherwise read the installed playbook and record its version.
  - [ ] Read `git show origin/main:pstack/skills/how/SKILL.md` and the installed `interrogate`, `unslop`, `no-comments`, and `prove-it-works` skills.
- [ ] Arm the 30-minute audit tick. In a local session, use a real terminal `/loop`. In a cloud root, use a cloud-sleeper wake chain. Never leave the cadence to memory.
- [ ] Use this tick prompt, verbatim. "Re-read the execution playbook from trunk and the armed /goal. Audit the operation against both and fix drift in this tick. Probe every active lane and judge progress by side effects only. Stand down a stuck lane and dispatch its replacement now. Then send the operator a status message, whether or not anything changed, with the queue table of PR, owner, state, and head SHA, the verdicts since the last tick, what merged, open operator gates, and blockers."
- [ ] On the operator's hold or stand-down, send every owner a zero-writes order at once.

### Spawn owners

- [ ] Spawn one owner per PR with the full lifecycle that `autopilot-stack.md` names.
- [ ] Follow this dependency graph. I1 branches from `quattro`. I2 stacks on I1. I3 stacks on I2. I4 stacks on I3.
- [ ] Hold file boundaries. I1 owns the broker, reducer, verification skill, and synthetic fixtures. I2 owns island rendering and bar integration. I3 owns first-party source projections and actions. I4 owns IPC, configuration, migration, docs, and rollout tests.
- [ ] Hold the review gate. I2, I3, and I4 change interaction. They wait for operator review in chat with screenshots and a video before merge.

### PR mechanics, for every PR

- [ ] Resolve the forge once. Default to `gh`. If `command -v origin` succeeds and Origin can resolve the repository, use `origin pr` for every PR operation. Record any fallback to `gh`. Never require `gt`.
- [ ] Open each PR ready, never draft. I1 targets `quattro`. Each stack child targets its parent branch until the parent merges.
- [ ] Run the repository lint and shell test entry points once before the PR-facing push. Push with hooks on.
- [ ] Run `/unslop` before each commit and `/no-comments` before review.
- [ ] Triage every Bugbot and security-reviewer comment against repository evidence.
- [ ] Rebase onto current `origin/quattro` before babysit and again before the merge-ready report.

### Verdict and merge, for every PR

- [ ] At the merge-ready head SHA, run the swarm per `pstack/skills/swarm/SKILL.md`. Use one gates lane, the ten live lanes from the PR's Verify, live block, the perf lane from its Verify, perf block, and one audit lane that reads the diff and receipts and distrusts the PR body.
- [ ] Mark clean only when every lane is `PASS`. Return findings to the owner. Run a fresh swarm and verdict for every new head.
- [ ] After operator approval, merge the bottom PR into `quattro`. Rebase the next child onto current `quattro`. Prove its patch IDs are unchanged before continuing.

### Boot recipe, for every live lane

Each live lane runs from an isolated worktree at the PR head. Drive the real shell through `agents/skills/omarchy-island-verification/SKILL.md` after I1 creates it.

- [ ] Run `git fetch origin <head-branch> && git checkout <head-SHA>` in an isolated worktree.
- [ ] Start the disposable graphical acceptance VM through `omarchy-iso`. Start no second Quickshell process. Wait for `omarchy-shell` to report ready.
- [ ] Deliver synthetic activity input through the fixture IPC. Use `qs ipc`, Hyprland layer reads, logs, and compositor state only for read-only diagnostics.
- [ ] Save every screenshot to `/tmp/swarm-<pr-id>/worker-<n>/<slug>.png` and return the paths with the report.
- [ ] Stop every lane-owned VM, shell process, recorder, and watcher. Prove owned listeners and descendants are gone.

## Establish the activity contract and verification harness (I1)

**Depends on.** None.

**Files.**

- [ ] Create `shell/services/ActivityBroker.qml`, `shell/plugins/island/ActivityModel.js`, and focused reducer tests.
- [ ] Create `agents/skills/omarchy-island-verification/SKILL.md` and deterministic synthetic activity fixtures.
- [ ] Edit `shell/shell.qml` only to inject one broker into first-party owners and the future island service.

**Build.**

- [ ] Implement primitive-only activity validation, keyed replacement, priority, expiry, underlying-activity restoration, symbolic actions, target screens, and one presentation phase in `ActivityModel.js`.
- [ ] Keep `ActivityBroker` stateless. The island service owns the only mutable activity map and expiry scheduler.
- [ ] Add synthetic idle, compact, minimal, two-activity, alerting, expanded, expiry, and malformed payload scenarios.

**You see.**

- [ ] The fixture prints `ISLAND_FIXTURE_PASS state=<state> revision=<n>` for every valid transition and `ISLAND_FIXTURE_REJECT reason=<reason>` for invalid input.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add `test/shell.d/island-model-test.sh` with replacement, ordering, expiry, stale callback, restoration, two-activity, target-screen, and hostile payload cases. Run `bash test/shell.d/island-model-test.sh`.
- [ ] Extend the shell injection contract test to assert one `ActivityBroker`. Run the focused contract test and `./test/shell`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `gpt-5.6-terra` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run shell startup at trunk and head. Record that trunk lacks the fixture, then gate one broker and a ready shell at head. Save `broker-startup.png`. Pass when the desktop is usable and the head log names one broker.
- [ ] Lane 2. Publish the compact fixture. Save `compact-state-log.png`. Pass when the state log shows one compact primary and no QML error.
- [ ] Lane 3. Publish two ongoing activities. Save `two-activity-log.png`. Pass when the state log selects one primary and one secondary by policy.
- [ ] Lane 4. Publish a short pulse over media. Save `pulse-restore-log.png`. Pass when expiry restores the exact media key and revision.
- [ ] Lane 5. Replace one key 100 times. Save `replacement-log.png`. Pass when one map row remains and revision reaches the final value.
- [ ] Lane 6. Remove the selected activity. Save `removal-log.png`. Pass when selection moves deterministically without an intermediate invalid state.
- [ ] Lane 7. Publish an expired activity. Save `expired-reject-log.png`. Pass when no live activity is added.
- [ ] Lane 8. Publish an oversized and malformed payload. Save `payload-reject-log.png`. Pass when it is rejected and the shell remains responsive.
- [ ] Lane 9. Restart the shell once. Save `restart-clean.png`. Pass when no stale activity state survives and exactly one broker loads.
- [ ] Lane 10. Run the verification skill cleanup path. Save `cleanup-proof.png`. Pass when lane-owned processes and listeners are absent.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Measure shell CPU, resident memory, reducer duration, and event throughput at trunk and head. Trunk runs an equivalent no-op IPC burst. Head also reports reducer work and fixture completion time.
- [ ] Probe. Interleave five 60-second idle samples and five 1,000-event bursts at trunk and head through `pidstat`, `/usr/bin/time`, and reducer timing logs.
- [ ] Baseline. Record the trunk median CPU, resident memory, and no-op burst time first.
- [ ] Rule. Fail when head idle CPU rises by more than 0.2 percentage points, resident memory rises by more than 5 MiB, any reducer step exceeds 2 ms, or 1,000 replacements take more than 250 ms.

**Review gate.** None. I1 is not review-gated.

**Merge.**

- [ ] Root records a clean verdict at the exact head SHA.
- [ ] Bugbot and security-review triage is complete.
- [ ] Rebase onto current `quattro` after the verdict and prove patch IDs unchanged.
- [ ] Stop at merge-ready. The operator squash-merges I1.

## Build the quickbar anchor and morphing surface (I2)

**Depends on.** I1.

**Files.**

- [ ] Create `shell/plugins/island/manifest.json`, `Service.qml`, `BarWidget.qml`, `IslandSurface.qml`, `IslandContent.qml`, `Geometry.js`, `Motion.qml`, and state views.
- [ ] Extend manifest, bar-widget, geometry, focus, and center-anchor fixture tests.
- [ ] Edit theme tokens only for original Omarchy island colors, dimensions, and motion values.

**Build.**

- [ ] Register a presenter only for a visible, nonzero, screen-backed bar slot with a current registration token. Exclude the hidden center-anchor placeholder in both mount orders.
- [ ] Draw compact and expanded states as one scene graph in a widget-owned screen-local layer surface. Keep the bar slot size stable and the layer input mask on the animated bounds.
- [ ] Reuse Quattro `KeyboardPanel` behavior for focus priming, immediate input release, screen fitting, popout coordination, and bar-click forwarding without rendering a second fixed card.
- [ ] Implement top, bottom, left, and right edge geometry, monitor removal collapse, passive-alert retargeting, keyboard navigation, accessibility names, and reduced motion.

**You see.**

- [ ] A centered black capsule occupies the configured quickbar slot, morphs into an unclipped activity card without moving neighboring modules, and returns to the latest slot rectangle.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add geometry tests for all four edges, scale factors, safe margins, compact fallback widths, and mid-animation retargeting. Run the focused Node test.
- [ ] Extend manifest entry-point and bar-widget contracts. Add the real-slot versus placeholder fixture. Run focused tests, `qmllint`, and `./test/shell`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `gpt-5.6-terra` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Run the stock centered bar at trunk and the idle island at head. Save `center-layout.png`. Pass when head adds one centered slot and preserves all stock modules and the expected desktop end state.
- [ ] Lane 2. Open and close on a top bar. Save `top-expanded.png`. Pass when the card grows down, remains concentric, and no neighbor moves.
- [ ] Lane 3. Open and close on a bottom bar. Save `bottom-expanded.png`. Pass when the card grows up and stays inside screen margins.
- [ ] Lane 4. Open on a left bar. Save `left-expanded.png`. Pass when the card grows inward and the vertical module flow is unchanged.
- [ ] Lane 5. Open on a right bar. Save `right-expanded.png`. Pass when the card grows inward and the vertical module flow is unchanged.
- [ ] Lane 6. Mount the center-anchor placeholder before the real slot. Save `placeholder-first.png`. Pass when one presenter and one visible surface exist.
- [ ] Lane 7. Mount the real slot before the placeholder. Save `real-first.png`. Pass when one presenter and one visible surface exist.
- [ ] Lane 8. Open by keyboard and navigate all actions. Save `keyboard-focus.png`. Pass when focus is visible, Escape collapses, and focus returns to the prior client.
- [ ] Lane 9. Enable reduced motion. Save `reduced-motion.png`. Pass when geometry snaps, repeated motion stops, and all information remains visible.
- [ ] Lane 10. Unplug the owning monitor during expansion. Save `monitor-removal.png`. Pass when the interaction collapses, no card teleports, and no stale input layer remains.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Measure idle shell CPU and memory, mapped layer count, frame time during 100 morphs, and end-to-end click-to-expanded latency. Trunk uses the stock bar click scenario. Head also isolates island animation work.
- [ ] Probe. Interleave trunk and head runs on the same VM and monitor profile. Capture `pidstat`, QML profiler frames, layer listings, and input timestamps.
- [ ] Baseline. Record trunk idle CPU, memory, stock popout frame time, and click latency first.
- [ ] Rule. Fail when island idle CPU exceeds 0.5%, memory delta exceeds 15 MiB, any steady-state surface maps twice per screen, p95 animation frame time exceeds 16.7 ms, or p95 click-to-expanded latency exceeds 100 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 1, 2, 3, 4, 5, 8, 9, and 10 screenshots into `docs/media/i2-review-<slug>.png`.
- [ ] Record a 30 to 60 second video of idle, compact, alerting, expanded, retarget, and collapse on a lane VM. Save it as `docs/media/i2-review.mp4`.
- [ ] Post the screenshots and video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root records a clean verdict at the exact head SHA.
- [ ] Bugbot and security-review triage is complete.
- [ ] Rebase onto current `quattro` after the verdict and prove patch IDs unchanged.
- [ ] Stop at merge-ready. The operator squash-merges I2.

## Connect first-party activity owners and actions (I3)

**Depends on.** I2.

**Files.**

- [ ] Add thin activity projections to media, OSD, battery, reminders, Bluetooth, microphone, recording, dictation, and selected notification owners.
- [ ] Hoist repeated per-monitor process collectors into one same-domain service before connecting them to the broker.
- [ ] Extend owner contract, fallback, action, burst, and teardown tests.

**Build.**

- [ ] Ship media as the first persistent vertical slice with artwork, metadata, progress, source identity, and delegated controls.
- [ ] Publish coalesced volume, brightness, power, Bluetooth, and reminder pulses. Restore the underlying persistent activity after every pulse.
- [ ] Publish only privacy state that the current microphone, owned recorder, or dictation source can prove. Do not claim camera or generic portal capture.
- [ ] Keep the existing notification daemon, OSD, media selector, power panel, Bluetooth scanner, and reminder scheduler authoritative and available as fallbacks.

**You see.**

- [ ] Real media, volume, brightness, charging, reminder, Bluetooth, microphone, recording, and dictation state appears in the island and every action delegates to the existing owner.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add owner projection tests for normalized snapshots, stable keys, action delegation, privacy redaction, teardown, and one collector per domain. Run each focused shell test.
- [ ] Add fallback tests with the island absent, disabled, hidden, and unsupported by a custom bar. Run `./test/shell`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `gpt-5.6-terra` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Play the same track at trunk and head. Save `media-parity.png`. Pass when both keep media functional and head adds accurate island metadata and controls without changing the selected player.
- [ ] Lane 2. Switch among two MPRIS players. Save `media-selection.png`. Pass when the existing media service and island select the same player after each switch.
- [ ] Lane 3. Send a burst of volume and brightness changes over media. Save `osd-restore.png`. Pass when pulses coalesce and restore the same media activity.
- [ ] Lane 4. Disable the island and change volume. Save `osd-fallback.png`. Pass when the existing OSD still appears once.
- [ ] Lane 5. Connect and disconnect a Bluetooth audio device. Save `bluetooth-pulse.png`. Pass when one pulse appears and the existing panel still owns discovery and actions.
- [ ] Lane 6. Start and expire a reminder. Save `reminder-expiry.png`. Pass when the countdown and expiry are accurate and the owner cleans up its timer.
- [ ] Lane 7. Exercise charging, low battery fixture, and full charge. Save `battery-states.png`. Pass when the existing UPower sample is reused and no second poller appears.
- [ ] Lane 8. Start and stop the owned screen recorder. Save `recording-privacy.png`. Pass when persistent status and stop action are accurate and no camera claim appears.
- [ ] Lane 9. Activate and mute a real microphone stream. Save `microphone-privacy.png`. Pass when the signal matches the existing PipeWire rule and includes a text label.
- [ ] Lane 10. Send a sensitive projected notification. Save `notification-redaction.png`. Pass when compact content is redacted, expansion is explicit, and the notification server count remains one.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Measure collector and helper process counts, idle CPU and memory, event-to-paint latency, and media progress frame time at trunk and head. Head also isolates projection and reducer time.
- [ ] Probe. Interleave five-minute trunk and head runs with identical media, OSD bursts, reminder, Bluetooth, microphone, and recording scenarios. Capture process trees, `pidstat`, broker timestamps, and QML frames.
- [ ] Baseline. Record trunk collector counts, CPU, memory, owner update latency, and media widget frame time first.
- [ ] Rule. Fail on any duplicated daemon or collector, idle CPU above 0.5% attributable to the island, memory delta above 15 MiB, p95 owner-event-to-paint above 100 ms, or p95 active frame time above 16.7 ms.

**Review gate.** The operator reviews before merge.

- [ ] Copy all ten lane screenshots into `docs/media/i3-review-<slug>.png`.
- [ ] Record a 30 to 60 second video of media, interruption, restoration, privacy, and fallback behavior. Save it as `docs/media/i3-review.mp4`.
- [ ] Post the screenshots and video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root records a clean verdict at the exact head SHA.
- [ ] Bugbot and security-review triage is complete.
- [ ] Rebase onto current `quattro` after the verdict and prove patch IDs unchanged.
- [ ] Stop at merge-ready. The operator squash-merges I3.

## Publish the activity API and roll out the plugin (I4)

**Depends on.** I3.

**Files.**

- [ ] Add versioned `island publish`, `island update`, `island end`, and `island state` IPC handlers and hostile-input tests.
- [ ] Add fresh-install configuration, conservative migration logic if approved, rollback coverage, and user and publisher documentation.
- [ ] Add final reference captures made from original Omarchy fixtures. Do not commit Apple or Atoll assets.

**Build.**

- [ ] Freeze the primitive activity schema with payload, image, text, action, rate, and expiry limits. Permit symbolic owner actions only and no arbitrary commands.
- [ ] Bundle Omarchy Island as an opt-in first-party plugin. Add it to fresh defaults only after the I2 and I3 visual gates pass.
- [ ] Preserve every existing custom bar. Insert once only when a migration can prove the old section still matches the prior stock layout. Never steal a custom `centerAnchor`.
- [ ] Document the `Omarchy Island` name, Apple non-affiliation, clean-room asset boundary, publisher examples, compatibility version, disable path, and fallback behavior.

**You see.**

- [ ] A fresh Quattro profile can enable the bundled plugin, a third-party fixture can publish and end a bounded activity, an upgraded custom profile keeps its exact layout, and disable or rollback restores the prior desktop.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Add IPC schema, rate, payload, image, URL, action, replacement, expiry, and compatibility tests. Run the focused IPC suite.
- [ ] Add fresh install, stock upgrade, custom layout upgrade, repeated migration, disable, rollback, and package manifest tests. Run `./test/shell` and `./test/all`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. Ten lanes on `gpt-5.6-terra` at the PR head, per the boot recipe.

- [ ] Lane 1. Regression lane against trunk. Upgrade identical stock profiles at trunk and head. Save `stock-upgrade.png`. Pass when head adds the opt-in capability and both reach a usable desktop without layout loss.
- [ ] Lane 2. Install a fresh profile. Save `fresh-profile.png`. Pass when the bundled plugin validates and its documented default or opt-in state matches the approved rollout decision.
- [ ] Lane 3. Upgrade a heavily customized center layout. Save `custom-layout.png`. Pass when every prior entry and `centerAnchor` remains byte-for-byte unchanged.
- [ ] Lane 4. Run the migration twice on a stock profile. Save `idempotent-migration.png`. Pass when at most one island entry exists and the second run makes no change.
- [ ] Lane 5. Publish a valid third-party activity. Save `publisher-valid.png`. Pass when compact and expanded content match the validated payload.
- [ ] Lane 6. Flood malformed and oversized IPC payloads. Save `publisher-hostile.png`. Pass when limits reject them, no arbitrary action runs, and the shell stays responsive.
- [ ] Lane 7. Disable and re-enable the plugin with active media. Save `disable-enable.png`. Pass when owners continue working, fallbacks appear, and the island restores from current owner state without duplicates.
- [ ] Lane 8. Roll back the package with a customized profile. Save `rollback.png`. Pass when the older shell starts and ignores compatible residual configuration safely.
- [ ] Lane 9. Run a dual-monitor fractional-scale acceptance pass. Save `dual-scale.png`. Pass when anchors, masks, and content remain aligned on both outputs.
- [ ] Lane 10. Run the complete reduced-motion keyboard workflow. Save `accessible-workflow.png`. Pass when every action is reachable, named, visibly focused, and motion stays disabled.

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. Measure IPC validation throughput, memory under rejected payload flood, fresh-shell startup, enable latency, and steady idle cost at trunk and head. Head also isolates island IPC and restore work.
- [ ] Probe. Interleave trunk no-op IPC and head island IPC runs, fresh boot runs, enable runs, and ten-minute idle runs on the same VM image.
- [ ] Baseline. Record trunk startup, no-op IPC, memory, and idle CPU first.
- [ ] Rule. Fail when rejected-payload memory grows without bound, 10,000 validation attempts exceed 2 seconds, fresh startup regresses by more than 150 ms, enable-to-compact exceeds 250 ms, or steady island idle CPU exceeds 0.5%.

**Review gate.** The operator reviews before merge.

- [ ] Copy lane 1, 2, 3, 5, 7, 8, 9, and 10 screenshots into `docs/media/i4-review-<slug>.png`.
- [ ] Record a 30 to 60 second video of install, publish, update, action, end, disable, and fallback. Save it as `docs/media/i4-review.mp4`.
- [ ] Post the screenshots and video in chat. Stop at merge-ready. Wait for the operator's click.

**Merge.**

- [ ] Root records a clean verdict at the exact head SHA.
- [ ] Bugbot and security-review triage is complete.
- [ ] Rebase onto current `quattro` after the verdict and prove patch IDs unchanged.
- [ ] Stop at merge-ready. The operator squash-merges I4.

## Close the program

- [ ] Every box above is checked with its evidence.
- [ ] Confirm the four PRs are present on current `quattro`, the final package and docs match that SHA, all review media is linked, no actionable review remains, and every agent-owned process and temporary artifact is gone.
- [ ] Reply to the operator with the final SHA, PR links, unit/live/perf receipts, visual verdict, unresolved manual limits, and exact working tree state.

## Appendix A. Prototype evidence

No Omarchy code prototype was run during research because the request authorized planning, not implementation or interruption of the live shell. Apple documentation, Atoll, DynamicIsland_Mac, pinned Quattro source, and the running bar layout established feasibility and constraints but do not prove the renderer.

I2 must not begin as ordinary implementation. Its owner first compares a persistent overlay, a bar-rendered compact view with overlay takeover, and existing popup primitives in the disposable VM. The retained branch, SHA, frame trace, screenshots, and video become I2 evidence. The unproven questions are full-screen transparent surface idle cost, first-frame handoff, outside-click forwarding, fractional-scale anchor drift, and side-bar motion quality.

## Appendix B. Alternatives rejected

- A full bar plugin loses because it replaces the user's quickbar.
- A growing child inside the bar loses because it clips or changes layout and the exclusive zone.
- Split compact and popup cards lose as the primary renderer because they cannot make one continuous geometry morph.
- A service-only centered overlay loses because it does not participate in quickbar layout and can overlap modules.
- A second Quickshell process or new daemon loses because it duplicates owners and violates Omarchy's shell model.
- An island-owned MPRIS, notification, UPower, Bluetooth, PipeWire, or reminder stack loses because current first-party components already own policy and actions.
- Downstream deduplication loses as a substitute for hoisting per-monitor collectors because it hides duplicate work.

## Appendix C. Risks

- I1 watches for a second mutable activity store, live QObjects in snapshots, stale timers, and unbounded input.
- I2 watches for hidden center-anchor placeholders, input masks that eat desktop clicks, stale layer surfaces, focus theft, fractional-scale drift, and idle compositor cost.
- I3 watches for duplicated collectors, owner-policy divergence, notification daemon duplication, unproven privacy claims, stale artwork, and fallback loss.
- I4 watches for IPC command injection, image and payload denial of service, custom-layout mutation, incompatible residual config, trademark confusion, and copied third-party assets.

## Appendix D. Links and reading list

- Read `docs/omarchy-island-research-and-implementation-plan.md` before I1.
- Read Omarchy `docs/omarchy-shell.md`, `shell/README.md`, `agents/skills/shell-dev.md`, `agents/skills/visual-verification.md`, and `agents/skills/acceptance-tests.md` from the exact `quattro` base SHA.
- Read Apple's Live Activities HIG, DynamicIsland API, motion guidance, accessibility guidance, and WWDC23 design session before I2.
- Use `pstack/skills/how/SKILL.md` for I1 and I2 placement reads. Use `pstack/skills/interrogate/SKILL.md` before I2 freezes geometry and before I4 freezes public IPC.
- Keep the decision and evidence trail through `pstack/skills/show-me-your-work/SKILL.md` for all four PRs.
