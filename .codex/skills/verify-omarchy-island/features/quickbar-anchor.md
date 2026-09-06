# Quickbar anchor

The plugin declares a center bar widget. Its own Quickshell window draws the capsule over the widget anchor. The widget is hidden when idle and reserves a stable slot while active.

Use the existing Omarchy session with the user's authorization, or a disposable session. Install and enable through the normal plugin loader. Keep the host source read-only.

After each fixed fixture scenario, capture the Island area and inspect the actual render. Check minimal, compact, two activities, alerting, and expanded content. Check that expansion exceeds the bar height and leaves neighboring widget positions unchanged.

Click the primary capsule and secondary bubble separately. Verify the selected activity and owning monitor. Summon through `omarchy-shell shell summon luinbytes.island`, use Tab and Enter for actions, and press Escape to collapse. Repeat summon with the pointer outside the card, including over the bar. Verify actual window focus before sending test keys. A disabled action must neither invoke nor collapse. In compact mode, confirm that clicks outside the shapes reach a dedicated test window. In expanded mode, the first outside click dismisses and is consumed by the native grab.

Set the widget's `reducedMotion` setting through Quattro's `setBarWidget` IPC. Verify that geometry snaps to its target. Restore the previous setting after the check.

Inspect both connected monitors. Expanded content must appear on only its owning monitor. Hidden center-layout copies must not map duplicate Island windows. Verify that idle, disabled, and removed states release the window and keyboard focus.

Use pure geometry tests for constrained screens and all bar edges. Claim runtime acceptance for an edge, scale, or display arrangement only after inspecting it in that configuration. Full visual parity and live publishers remain unfinished.
