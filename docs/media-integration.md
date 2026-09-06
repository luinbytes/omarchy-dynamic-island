# Native media and theme integration

## Behavior

The Island follows Quattro's active media player. Its compact view shows artwork, a single track title, and a playing-state indicator. The expanded media card shows artwork, one title and artist pair, elapsed and remaining time when available, and centered transport icons. A paused track remains available while selected by the native service. Another playing source can take precedence. Closing the expanded Island never pauses or stops a player.

Drag the timeline to seek. With keyboard focus on the timeline, Left and Right move five seconds. Seeking is available only when the player supports it and provides valid timing. A track change cancels an unfinished drag. The small animated bars indicate playback state; they are not an audio spectrum.

The renderer uses `Style.font.family` and the live `Color` roles from `qs.Commons`. Both compact and expanded bodies use `Color.bar.background` and `Color.bar.text`. The Island grows from the bar without switching to a popup palette. Muted text and accents also follow the theme. It does not copy theme files or maintain a theme watcher. These system styling choices intentionally differ from Apple's fixed black Island appearance.

## Supported player interface

The plugin consumes the public `omarchy.media` service. Quattro owns MPRIS discovery, playback-stream correlation, active-player selection, and player preferences. The Island does not run another discovery loop or depend on `playerctl`.

mpv needs an MPRIS bridge. This machine already has `mpv-mpris` installed and automatically loaded from `/etc/mpv/scripts/mpris.so`. Other installations need to enable a bridge before mpv can appear in any MPRIS consumer. See the [mpv-mpris project](https://github.com/hoyon/mpv-mpris).

Browsers participate when their desktop media-session integration exports an MPRIS player. The Island cannot discover every HTML audio/video element independently of the browser. Player capabilities and metadata vary; unavailable controls stay disabled. Quickshell documents these [MPRIS compatibility limits](https://quickshell.org/docs/v0.3.1/types/Quickshell.Services.Mpris/MprisPlayer/).

## Ownership and safeguards

`MediaPublisher.qml` owns one pure projection state and an owned low-rate progress timer. `MediaProjection.js` maps plain snapshots into the existing activity schema. One stable `luinbytes.island.media/now-playing` identity survives track and player changes. Equal snapshots do not publish a new revision. Source disappearance ends the activity once.

An action is pinned to the player that produced the publication. The publisher checks that player still exists and supports the action immediately before calling the host's `runAction`. This check matters because the host may otherwise fall back to another player. The Island never changes player preference just because it expands or collapses.

Optional media data belongs to the validated activity, not a second presentation store. The native numeric `uniqueId` identifies a track within its player. A publisher-owned instance counter also distinguishes replacement player objects that reuse the same native name and track ID. The seek route checks the displayed token against both stored activity data and the exact live player before writing `position`. Transport actions also require the exact published player object. Late artwork and paused timing changes trigger publication without requiring playback to resume.

Artwork accepts bounded, credential-free file, HTTP, and HTTPS URLs. Images decode asynchronously into fixed-size artwork boxes. Missing or failed artwork uses a local vector fallback. Data URLs and custom schemes are unsupported; this includes embedded artwork that an mpv bridge exposes only as a data URL.

Same-key, same-layout data updates replace content in place. Progress updates do not restart a transition. Identity and layout handoffs use clipped movement at constant opacity; the body morphs without fading.

Explicit fixture mode suppresses live media publication so fixed scenarios remain deterministic. Production keeps the fixtures off. The read-only `omarchy-shell luinbytes.island status` command exposes renderer and publisher diagnostics without enabling test controls.

## Verification

Run `node scripts/verify-scaffold.mjs` for snapshot normalization, revision lifecycle, capabilities, safe action routing, fixture isolation, theme bindings, and motion regressions. Use the installed Omarchy validator and QML lint for native compatibility.

Runtime QA must use a player owned by the test. Never pause, seek, or skip the user's current media to prove action wiring. Inspect fresh compact and expanded renders, change an owned player's track, pause/resume through the Island, and close that player. Check that the publisher follows native player selection and releases stale state.

Theme QA may briefly apply an in-memory palette through native shell IPC and restore the current theme payload afterward. Do not edit Quattro source or persistent theme files. Verify the actual rendered accent and the diagnostic palette both change. A source binding alone is not rendered proof.

A source picker, non-media publishers, browser-specific capture outside MPRIS, and full Apple visual parity remain unfinished. See the [product rebuild plan](product-rebuild-plan.md) for independently testable feature units and [media rebuild QA](media-rebuild-qa.md) for current runtime results.
