# Automatic activity selection

## Why the island changes

The collapsed island follows current work. It has no Pin control. Opening a tool is temporary and must not stop activity observation. Closing that tool returns to automatic selection. An incoming event must not replace an open note editor or steal keyboard focus.

Apple documents compact, minimal, and expanded presentations, relevance scores, stale dates, and explicit activity endings. Its design guidance asks developers to remove finished activities after a short interval. Apple does not publish its full cross-application ranking algorithm. The desktop timings and resource thresholds here are project choices, not recovered Apple constants.

Sources consulted on 2026-09-05:

- [Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities).
- [Design dynamic Live Activities](https://developer.apple.com/videos/play/wwdc2023/10194/).
- [Linux Pressure Stall Information](https://docs.kernel.org/accounting/psi.html).
- [Quickshell NotificationServer](https://quickshell.org/docs/v0.3.1/types/Quickshell.Services.Notifications/NotificationServer/).

## Native boundaries

Quattro remains the notification server. Its installed notification service exposes `popupModel`, `doNotDisturb`, native actions, and `historyDir`. The toast windows are bound directly to `popupModel.count`. There is no presenter-replacement contract in that installed service.

Island must not empty that model, change DND, untrack notifications, or create a competing server to hide native banners. Notification previews and a list can be added independently. Exclusive banner takeover is unsupported by this host version without a separate native contract.

The installed Herdr widget exposes status snapshots. Those can supply working and attention indicators without reading terminal text or transcripts. Reported status must retain its source and must not turn an inferred idle or done value into verified task success.

Fresh hook observations take precedence over Herdr. Stale or disconnected hook records cannot mask a current Herdr feed. Herdr's generic blocked state is not proof of an approval request. Optional hook installation remains an explicit user action; this revision does not install hooks automatically.

CPU and GPU utilization measure activity, not failure. Memory usage must account for reclaimable memory. Linux PSI reports time spent waiting for CPU, memory, or I/O resources. A sleeping process is not a stalled process. Process exit is not proof of a crash. Automatic health indicators must say what was actually observed and must never kill or restart an app.

Zombie processes are not collected or presented as live activities. Legacy zombie tracker state is discarded. Sustained uninterruptible waits and aggregate resource pressure remain eligible observations.

Within the active tier, playing media takes precedence over routine working agents. Notifications and attention requests still interrupt it. Paused media retains its existing 15-second grace; there is no random rotation or pinning.

## Automatic peeks

Peeks are temporary presentations, separate from manual navigation. A closed Island morphs into a shallow 306 px-wide summary. When a detail view is already open, the summary appears in its own equal-width pill below it. The lower pill does not move the detail view or paint across the gap.

The event policy coalesces bursts for 250 ms and gives each accepted peek a five-second lease. These are desktop choices. New notifications, meaningful agent state changes, media identity or play-state changes, and sustained system warning or recovery events qualify. Progress, sample values, age labels, repeated status, history loading, and startup snapshots do not.

Clicking a peek explicitly opens its detail. Automatic arrival and expiry never replace the selected tool or take keyboard focus. Source baselines survive consumption, so clicking or suppressing a peek does not replay it.

DND suppresses all automatic peek sources. Automatic events belong on every eligible visible, non-fullscreen Island, with one shared event lease. A manually opened view keeps its owning display and receives the separate below-detail pill; the other displays receive a shallow closed peek. If no eligible display exists, the event is consumed without a later replay.

This presentation does not replace Quattro's native notification server or banners. Native appearance, input, expiry, and focus checks remain required after installation.

## Acceptance boundary

Apple Dynamic Island is the required visual and motion reference, not loose inspiration. Acceptance includes silhouette, compact and two-activity composition, expanded spacing, shared-text movement, blur, reveal order, spring settling, interrupted transitions, and collapse continuity. System font and the Omarchy bar color remain the explicitly requested desktop adaptations. A generic dashboard or tabbed panel does not pass merely because its outer rectangle animates.

Renderer and live publishers remain unfinished. Portable tests establish deterministic selection and input handling, not rendered quality or Apple parity. Native loading, timed handoff, input ownership, and visual acceptance require separate evidence.

The rendered checks must cover these sequences:

1. Pause an owned player. Keep its identity visible during the 15-second grace, then remove it from both collapsed slots without another player event.
2. Change paused metadata during the grace. The original deadline must remain. Resume just before the deadline and confirm that playback cancels the pending retirement.
3. Receive a notification while another activity runs. Show its preview once, retire it on time, and restore the underlying activity. Its history row remains available.
4. Keep a note editor focused while agent attention and resource events arrive. Preserve the editor, caret, selected tool, and owning monitor.
5. Stop agent observations. Show unknown or last-known status when stale, not success. Retire stale compact attention without deleting the detail record.
6. Observe resource pressure long enough to qualify, recover, and observe it again. Avoid repeated entrance animations on normal sample updates.
7. Interrupt sampling. Two isolated high values must not count as continuous pressure. An absent process must not become a crash claim.
8. Compare opening, closing, identity replacement, two-body changes, rapid reversal, and reduced motion against inspected Apple footage. Source geometry and numerical trajectories alone cannot pass this check.

The official expansion clip was recreated on 2026-09-05. Its SHA-256 digest and measured width and height samples match `test/island/apple-motion-reference.json`. The inspected contact sheet was local QA evidence and is not included in this repository. The plugin's corresponding final rendered comparison remains outstanding.
