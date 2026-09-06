# Media rebuild QA

## Result

The dedicated media renderer is implemented and installed for review. The adapted compact and expanded layouts pass rendered inspection on the tested scale-1, top-bar desktop. This is not full Apple visual or feature parity, and subjective approval remains with the user.

The media card now has rounded artwork with an error fallback, one title and artist pair, elapsed and remaining time, a seekable timeline, centered vector transport controls with 44px targets, and playing-state bars. Compact media uses artwork and one title. A 22px secondary bubble uses artwork alone. Generic activities keep their existing renderer.

## Fresh verification

| Check | Result |
| --- | --- |
| Portable verifier, native plugin validator, whitespace | PASS |
| QML static checking | Earlier lint used the legacy default binary; Qt 6 checking exposes native-type and binding warnings, not a clean gate |
| Real file artwork, compact and expanded renders | PASS; artwork reports ready and rounded masks render correctly |
| Deliberately invalid PNG | PASS; Image.Error produces the local vector fallback |
| Spotify HTTPS artwork | PASS; read-only native selection and compact render show loaded remote artwork |
| Keyboard timeline seek | PASS; owned player moved from 21.696 to 26.883 seconds |
| Mouse drag to 60% of a 120-second track | PASS; owned player reached 72.774 seconds |
| Next, Play/Pause, Escape | PASS; owned track changed, pause changed, and the Island collapsed |
| Reduced motion | PASS; geometry snapped to 408×184 and indicator pixels remained identical across 500ms |
| Normal motion | Fresh 60fps recording covers opening, closing, and reversal; frame inspection confirms retained text and coordinated reveal |
| Track and player replacement | Model and bridge regressions pass, including replacement objects with the same native name and track counter |
| Secondary media, disabled semantics | Source and contract checks pass; live two-source and assistive-technology acceptance remain open |

The source remains on `feature/quattro-integration`. No commit, push, Omarchy source patch, or shell restart was performed for this rebuild. Verification used the existing shell process, PID 411517, and native plugin disable, rescan, and enable operations.

The installed `island-media-rebuild-qa-4` snapshot matches the source directory. The silent mpv, recorder, and capture helpers were stopped, and the stale owned IPC socket was removed. The temporary reduced-motion setting was removed, restoring the original widget entry. The plugin remains enabled for manual review and follows the user's paused Spotify without controlling it.

## Findings corrected during verification

The first live load failed because the custom timeline assigned `value` and `maximumValue` to the `Accessible` attached object. Those range properties belong to the item itself. The corrected timeline exposes its range and increase/decrease actions using [Qt's documented accessibility contract](https://doc.qt.io/qt-6/qml-qtquick-accessible.html). A regression rejects the invalid attached-property form.

The later title-rendering probe established that `/usr/bin/qmllint` is the legacy `1.0` tool, while Quickshell uses Qt 6. The verifier now selects Qt 6 explicitly and supplies a temporary `qs` import alias without changing the host. Earlier clean-lint statements are not valid Qt 6 proof. Qt 6 reports anonymous native `QObject` members, outer-component bindings, inherited `state` overrides, and the native `PanelWindow` factory as static warnings. Native component loading and actual controls passed, but static checking must not be described as warning-free.

Review also corrected numeric native track-ID handling, player-instance token collisions after restart, silently truncated player keys, replacement-object transport routing, overlapping secondary media content, and disabled controls disappearing from the accessibility tree.

An early input sequence stopped when native player selection changed from the paused test player to Spotify. The guard sent no further test keys. A reordered sequence tested Next before Pause and passed. User playback was not controlled.

Some later screenshot attempts aborted because an outside dismissal closed the Island before capture. Those attempts are not render passes. The recorder reported a nonfatal NVENC sample-aspect-ratio warning; its final exit was zero. Existing duplicate-IPC warnings from other plugins remain outside this change.

## Evidence and limits

`media-controls-final.log` and `media-drag-final.log` record real controls against the agent-owned silent mpv. `media-rebuild-expanded.png` is the final control-run render. `media-rebuild-compact-final.png`, `media-rebuild-error-fallback.png`, and `media-rebuild-qa4-motion.mp4` cover compact, fallback, and motion states. These files were local QA evidence and are not included in this repository.

The earlier `media-rebuild-before` capture landed behind the user's fullscreen game and is not a valid layout comparison. The supplied rejected screenshot remains the baseline. The game was never controlled or stopped. Recording was deferred until GPU pressure fell.

Timers, charging/device events, recording/privacy, system feedback, transfers, and real multi-activity switching remain planned in the [product rebuild plan](product-rebuild-plan.md). Data-URL artwork, browser-specific runtime coverage, a source picker, other scales and bar edges, live screen-reader behavior, and exact Apple parity remain unverified or unsupported as described in the [media integration guide](media-integration.md).
