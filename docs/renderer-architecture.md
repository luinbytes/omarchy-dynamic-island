# Island renderer

## Ownership

The native bar widget owns a screen-local Quickshell `PanelWindow`. The widget resolves `luinbytes.island` through `bar.shell.serviceFor()`. The service remains the only activity-state owner.

The window fills its monitor. Two persistent visual bodies follow activity keys as their primary, secondary, or expanded roles change. This lets expansion exceed the bar height without resizing the bar or its exclusion zone.

The window uses `WlrLayer.Top`, matching Quattro's native bar. The compositor covers it with fullscreen applications. It must not use the modal `Overlay` layer or maintain a second fullscreen-detection policy.

Only a drawn widget can present a window. Effective visibility, positive dimensions, a live screen, and the bar's hidden state determine whether the anchor is available. Hidden center-layout copies must never map another Island window.

## Data and interaction

The renderer consumes the reducer's activity map and tagged presentation. A pure view model derives display content and fitted rectangles. It does not publish, expire, or rank activities independently.

The primary compact capsule can accompany a secondary minimal bubble. Expanding an activity assigns one owning monitor. Other monitors retain their passive view. Actions call the existing symbolic invocation route.

The window's input region follows the animated capsule and bubble. Compact transparent areas pass pointer input through. Expansion uses Quickshell's native Hyprland focus grab to retain keyboard focus even with focus-follows-mouse enabled. The grab starts only after the compositor acknowledges keyboard focus and includes only the Island window. Including the bar would let a pointer resting on it take focus away from the card.

The first outside click dismisses the expanded view and is consumed by the native grab. Switching to another bar control therefore takes a subsequent click. Escape also closes the card and releases focus. Repeated summon keeps the existing grab and selected activity. Reduced motion snaps geometry changes.

Top-bar presentation grows down from the widget anchor. Bottom and side bars use adapted inward placement. Rectangles fit within the monitor's logical dimensions.

## Design choice

Two ownership designs were considered. A service-owned window per screen would require anchor registration, duplicate election, and stale-object cleanup in the shared service. A widget-owned window gets its anchor and lifetime directly from Quattro's loader.

The widget-owned design keeps that lifecycle local. The renderer still uses one shared activity service. Pure display projection and geometry share one module. The later motion refinement adds a pure analytical model and one QML frame clock because velocity, content retention, and visual exits need one owner. It does not add an anchor registry.

The surface coalesces target changes through an owned one-shot timer. This avoids updating visual state while anchor visibility bindings evaluate, and cancels pending work when the surface is destroyed. Logical keyboard release remains immediate. See [motion references](motion-reference.md) for the chosen profiles, repeatable measurements, and parity limits.

## Acceptance limits

Synthetic fixtures exercise the renderer independently of live system publishers. Screenshot and input checks establish behavior on the tested compositor and monitor layout. They do not establish a pixel-exact match to Apple's implementation or acceptance on untested display scales.
