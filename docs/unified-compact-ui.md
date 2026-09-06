# Unified activity capsule

The user-selected layout has one continuous outer silhouette. Concurrent activities remain separate keyed content regions inside it. This replaces the detached-secondary design from earlier notes.

`ViewModel.combinedActivityOutline()` derives one perimeter from the visible sampled body bounds. `IslandSurface` uses that perimeter for its background and native input mask. `ActivityVisual` retains each activity's content and motion but suppresses its individual background in the hub.

The space between content regions routes to the nearest live activity. Retiring and invisible activities cannot receive that click. A single non-media activity centers its icon and text as one group. Multiple activities keep their distinct content alignment.

The implementation introduces no new animation clock, fade, publisher policy, or host patch. Existing shared title and artwork motion, dynamic expanded height, system font, and theme bindings remain intact.

## Verification

Historical local QA used the build name `unified-island-1`. Quickshell remained PID 2207. Source and installed files match. Scaffold, combined-outline, surface-contract, and native manifest checks pass. QML lint reports 296 warnings and no errors across 21 files.

Fresh compact captures included `unified-settled.png` and `unified-hdmi.png`. The first includes concurrent activities; the second shows the centered single activity after paused media retires. Both were inspected without moving the user's pointer. These captures were local QA evidence and are not included in this repository.

Expanded, rapid-reversal, and physical click validation remain pending after the earlier pointer guard stopped native input QA. Portable routing checks do not replace that evidence. Renderer and live publishers remain unfinished; this is not a claim of complete Apple parity.
