# Activity-sized Island QA

This revision removes the permanent six-tool footer and scrollable utility panels. Each visible panel reports its content height. Hidden preflight measurement selects the opening target before the expansion starts. Only the current activity and owning screen may update that target.

The ellipsis opens a temporary chooser for Music, Weather, Notes, Agents, Notifications, and System. Escape closes the chooser first, then the Island. Collections use explicit pages. Notes retains the complete draft in its repository and edits contiguous slices.

The latest requirement gives every tool the same outline family, with outward shoulders at the bar join. Height remains content-derived. Body creation and retirement use geometry, not opacity. Tool changes reuse the expanded body. Content and track-title handoffs move through clipping at constant opacity. The existing underdamped expansion spring supplies a small rebound.

## Native findings

The original DP-1 render reproduced the reported issue. Utility cards were 356 pixels tall with clipped scroll content. The first revised local build rendered System at 220 pixels, pressure at 205, Music at 184, Weather at 270, and Agents at 252. All measurements are for the current 1920-by-1080, scale-1 monitor, not universal size constants.

Live inspection caught an empty Notes label clipped despite a passing portable suite, a Weather binding loop, destroyed Notes preflight callbacks, missing media metadata presentation, and notification history that required manual refresh after startup. Follow-up installed passes corrected these failures.

## Installed result

The final local verification used the historical build name `compact-readable-2`. Previous QA builds and a manifest backup were kept locally for rollback at the time. The ui-qa-6 expanded pass established a 408-pixel body with 28-pixel distal corners and 18-pixel outward shoulders at this display size. The complete outline is 444 pixels wide. Their visible body heights are:

| State | Height | Rendered result |
| --- | ---: | --- |
| Empty Notes | 114 | PASS, full empty label |
| Notification history | 153 | PASS, loaded without manual refresh |
| Paused Music | 184 | PASS, source and unavailable-timing fallback |
| System event | 220 | PASS, event and utilization fit |
| Three Agents | 252 | PASS, setup stays behind its action |
| Weather | 270 | PASS, all six forecast pages inspected |

The joined captures and their JSON records show exact geometry, focused owner, and shell PID 2218. `joined-morph-final.mp4` records opening, tool changes, and closing at 60 fps. Its contact sheet was inspected. This recording uses ui-qa-4; ui-qa-5 changes hourly tile rendering and ui-qa-6 corrects chooser title ownership. The geometry and motion files match. Final hourly pages and the chooser correction have separate fresh captures.

The user identified a real overlapping shared music title above the chooser. `before-chooser-title-overlap.png` reproduces it. The chooser now exclusively owns its header on the selected body and monitor, without an opacity animation. `after-chooser-title-fixed.png` and `after-chooser-title-restored.png` show the corrected chooser and restored music title. The matching installed source and fresh focused tests pass.

An apparent forecast overlap in image previews prompted fixed delegates and isolated tile rendering. Original-pixel OCR positions showed evenly separated hour labels, so this is not recorded as a proven application overlap or a proven GPU fix. Four stable tile delegates avoid replacement churn; their small rendering layers do not fade.

Final gates passed: the complete portable verifier, source and installed manifest validators, source-to-installed directory comparison, and whitespace check. Qt6 lint covered 21 QML files, exited 0, and reported 292 warnings with no errors. No ui-qa-6 component errors or binding-loop warnings appeared during the final pass. Native reload still logs duplicate IPC registration warnings from other host plugins. The host was not patched.

The recorder exited. No second shell, browser, VM, or user-service restart was started. The existing worktree remains dirty on `feature/quattro-integration`; no commit, push, or PR was made.

The before and after screenshots are cropped to the Island. They were local QA evidence and are not included in this repository. The native shell process was not restarted. Omarchy source remains read-only.

## Acceptance boundary

The subsequent compact readability pass replaced two anonymous 22-pixel circles with two labeled 122-pixel capsules and a 6-pixel gap. System counts now distinguish zombies from blocked processes. Agent counts include their state. Resource percentages retain the resource name without duration prose. Secondary media retains its artwork and keyed title. The final native captures show System and Agents together and Agents with secondary Music. Exact-key clicks passed for System and Agents on compact-readable-1 and Music on compact-readable-2. The final repeated System click stopped before input because the pointer moved away. No playback, note, or notification action was invoked.

This pass keeps the 250-pixel bar allocation, theme, font family, opaque motion, and existing expanded outline. The `final-readable-*` captures were local QA evidence and are not included in this repository. Other compact provider states, vertical bars, and non-default display scales have model checks but no new native acceptance in this pass.

Portable tests validate model behavior and lossless text paging, not Apple visual parity. Native QA does not yet cover populated Notes editing and IME input, every theme or display scale, all media providers, or every activity interruption. The renderer and live publishers remain unfinished. No notification actions, note edits, or media transport actions were performed in the navigation pass. Exact Apple parity and subjective motion acceptance remain unapproved.

The shoulder input mask uses native [Quickshell region subtraction](https://quickshell.org/docs/v0.3.1/types/Quickshell/Region/). No host extension is required.

## Decisions

Experience First removed global tabs and scrolling. Model the Domain kept paging inside each activity panel. Boundary Discipline kept exact notification and activity identities at action boundaries. Prove It Works required live captures and exposed failures that source tests missed. The two candidate designs and their comparison were local QA evidence and are not included in this repository.
