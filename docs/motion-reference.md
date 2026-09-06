# Motion reference and verification

The measurements and milestone captures below describe earlier revisions. The current user contract overrides their choreography. Bodies remain opaque, use one shared bar-joined outline, and grow or shrink geometrically. Activity handoffs use clipped translation. Same-player music track changes are the explicit exception: title, artist, and artwork fade in place while the panel and transport stay fixed.

## Current motion reference

The user selected [Nootch](https://github.com/DeepanshuMishraa/nootch) as the opening and closing reference. At revision `6131a30689db863b1745eca777e8739ab809096d`, its [outer panel animation](https://github.com/DeepanshuMishraa/nootch/blob/6131a30689db863b1745eca777e8739ab809096d/Sources/Nootch/NotchPanel.swift#L971) uses damping 0.88. Its [default response](https://github.com/DeepanshuMishraa/nootch/blob/6131a30689db863b1745eca777e8739ab809096d/Sources/Nootch/Domain.swift#L349) is 0.32 seconds. Its shape animates flare dimensions and corner radius alongside the frame.

The current implementation translates that response into the existing analytical solver with `omega = 2 * pi / 0.32` and `zeta = 0.88`. This is a source-referenced approximation, not a captured SwiftUI trajectory or Apple's unpublished constants. Nootch's fades, glass, and pinning are not part of this plugin's requested design.

One persistent capsule owns the perimeter. Either compact activity opens from the whole joined capsule, while keyed content retains its own source position. Full detail targets 306 px rather than 408 px. Opening content must follow the growing geometry without the previous full-panel-height slide. Cross-activity replacement still uses bounded, clipped content handoffs.

The historical Apple measurement fixture remains unchanged. It records a different motion reference and must not be rewritten to fit the new timing. Native opening, closing, reversal, and text continuity still require fresh rendered checks. The renderer and live publishers remain unfinished.

## Target

The reference is Apple's Dynamic Island, not a generic spring preset. The desktop plugin retains desktop dimensions and content. This work targets normalized motion and content choreography. It does not establish a pixel-exact replica, feature parity, or Apple's unpublished animation constants.

[Design dynamic Live Activities](https://developer.apple.com/videos/play/wwdc2023/10194/) supplies the expansion reference. The ISS activity demonstration shows an edge-anchored bloom and a small rebound. Its outgoing content blurs while expanded content becomes legible. Apple's [Face ID demonstration](https://www.apple.com/newsroom/videos/iphone-14-pro-dynamic-island-face-id/large_2x.mp4) supplies a separate, monotonic collapse reference.

The measured expansion takes roughly 800 ms to settle after its onset. Collapse takes roughly 500 ms. These are measurements of specific public clips, not a universal contract across Apple devices, activities, or OS versions.

## Reproduce the measurements

Extract a 14-second video-only clip beginning at 758 seconds from the official HD asset without transcoding. The checked-in fixture records the resulting clip hash. Different FFmpeg muxer versions may produce different container bytes, so a hash mismatch requires checking the decoded frames rather than replacing the fixture.

```bash
ffmpeg -hide_banner -loglevel error -threads 1 -ss 758 \
  -i 'https://devstreaming-cdn.apple.com/videos/wwdc/2023/10194/5/1F92A457-3B0A-4F2A-A29C-9EC6753BEC87/downloads/wwdc2023-10194_hd.mp4' \
  -t 14 -map 0:v:0 -an -c copy apple-expanded-reference.mp4
curl --fail --location \
  'https://www.apple.com/newsroom/videos/iphone-14-pro-dynamic-island-face-id/large_2x.mp4' \
  --output apple-face-id-reference.mp4
node scripts/measure-island-motion.mjs apple-expanded-reference.mp4 5.7 1.17 1120:550:400:200
node scripts/measure-island-motion.mjs apple-face-id-reference.mp4 3.4 0.67 400:450:760:235
```

The measurement command emits a SHA-256 digest, crop, threshold, frame rate, and dark-pixel bounding rectangle per frame. It requires Node.js, FFmpeg, and ffprobe. Use a constant-frame-rate source and a crop containing only the Island's dark shape. Black phone borders, subtitles, fingers, and background objects can invalidate a bounding box. Inspect the crop visually before relying on the numbers.

`test/island/apple-motion-reference.json` retains independently measured dimensions. Production motion code must never import those sample arrays. The comparison normalizes each dimension from its starting to ending size and samples the production spring equation. Its fixed 60 ms alignment accounts for the measurement window beginning before the main motion. The runtime does not add that delay to a click.

The earlier comparison gated normalized RMSE at 3.5%, maximum error at 8%, and peak error at 1.5 percentage points. Expansion peak timing had to be within 100 ms of the measured peak. These were approximation tolerances, not pixel-parity thresholds. The current `node scripts/compare-island-motion.mjs` command checks the Nootch source contract instead and explicitly reports that it does not compare the historical Apple capture. Neither check measures text, color, frame pacing, or compositor behavior.

## Earlier keyed-body motion contract

Logical activity and keyboard ownership remain in the existing service and surface. Visual state is local to each widget-owned window. A visual body follows an activity key rather than a primary or secondary role. Selecting the secondary therefore expands from its own location.

One analytical clock advances geometry and retained content. Retargeting preserves sampled position and velocity. Expansion and collapse use separate profiles. Content uses fixed layout dimensions during a morph, with at most two layers per body. Outgoing content cannot invoke actions. Reduced motion settles synchronously and stops the clock.

Logical close releases keyboard ownership immediately. A short visual exit may remain mapped without an input region. Anchor loss or plugin disable must release it immediately. None of these operations requires a Quattro patch.

## Bar continuity and content refinement

The user's follow-up requires the bar itself to appear to grow. Both presentations therefore keep the native bar background and foreground. There is no switch to a separate popup palette. A fresh live capture sampled the adjacent bar and expanded body at the same `srgb(8,7,9)` value for the current opaque theme. Other alpha settings still need rendered verification.

Frame inspection of Apple's expansion clip showed that incoming content remains blurred during early growth. The previous content spring reached 91% at 200 ms while the body had reached only 61%. The revised critical content spring uses omega 10 instead of 20. At 100, 200, 300, and 400 ms, its normalized reveal is approximately 26%, 59%, 80%, and 91%. Geometry calibration is unchanged. The content begins immediately rather than waiting behind a click delay.

This shared content profile also slows identity crossfades and initial appearance. Fresh 60 fps recordings cover opening, closing, and rapid reversal. Their frames show the delayed reveal without stretching text. Portable motion and theme regressions, the native validator, and QML lint pass. These checks do not establish Apple's unpublished constants or complete visual parity.

Local QA evidence included `bar-morph-before.mp4`, `bar-morph-after.mp4`, `bar-morph-opening.png`, and `bar-morph-after.png`. These artifacts are not included in this repository. The corrected plugin remains installed for user review. The silent test player and recorder were stopped after capture.

Fix Root Causes keeps the body on the bar palette. Experience First stages legibility behind the expanding shape. Laziness Protocol retains the calibrated geometry and changes one content profile. Prove It Works adds sampled timing regressions and fresh compositor evidence.

## Required rendered proof

Record compact to expanded, expanded to compact, rapid reversal, selected-secondary expansion, alert replacement, final expiry, and reduced motion in the existing Quickshell session. Inspect the resulting frames, not only diagnostic geometry. Check focus acknowledgement, repeated summon, Escape, enabled and disabled actions, and outside dismissal after the last source change.

Keep before captures immutable. Compare geometry separately from different desktop content and dimensions. A nonzero image difference is not pixel parity. Untested scales, bar edges, subjective approval, live publishers, and any reference mismatch remain explicit in the QA handoff.

## Motion milestone QA, 2026-09-04

Portable tests, the installed plugin validator, direct QML lint, and whitespace checks passed. The four normalized geometry comparisons returned RMSE between 0.92% and 2.23%. They also passed peak magnitude and expansion peak timing gates.

Fresh 60 fps desktop recordings show expansion, collapse, split activity, rapid reversal, and final visual exit. Frame inspection confirms fixed-size compact text, content blur/crossfade, edge-anchored growth, and clipped retained content. Exact image parity is not established. Desktop dimensions, typography, content, and background differ from the Apple clips.

Live tests passed for keyboard action activation, Escape from action focus, repeated summon, disabled-button absorption, selected-secondary visual identity, reduced motion, alert restoration, and expiry cleanup on two 1920×1080 top-bar displays at scale 1. The final keyboard/timer sequence retained shell PID 372078 throughout. Other bar edges and scales have portable coverage only.

Earlier runs exposed and corrected a visibility binding loop, content extending outside the shrinking body, and a deferred callback surviving teardown. Independent source review found and corrected an unnecessary geometry rebase that erased velocity and changed the active collapse profile during content updates. Regression tests cover that finding.

Some keyboard attempts aborted before sending keys when an outside dismissal removed focus. An earlier alert timing check failed during a period with external shell restarts. The task did not restart Quickshell. Fresh checks in a stable session passed. Existing duplicate-IPC warnings from other plugins remain outside this task; final motion snapshot logs had no Island warnings.

The production-default snapshot had no fixture IPC target. The temporary installation was then removed through the plugin manager. Registry and layer queries were empty, shell ping returned `ok`, and no recording helpers remained. The removed package was kept as a local backup during verification and is not included in this repository.

The immutable before recording is `plugin-baseline-motion.mp4`. The final motion recording and inspected contact sheet are `plugin-motion-final.mp4` and `plugin-motion-final-contact.png`. `final-capture.log` preserves its IPC observations and recorder exit. `reference-check.json` preserves the numerical comparison. These were local QA artifacts, not release assets, and are not included in this repository.

Principles that changed the implementation:

- Model the Domain chose keyed visual bodies with mutable roles, not role-fixed rectangles.
- Experience First preserved velocity and secondary origin while keeping logical focus release immediate.
- Exhaust the Design Space and Laziness Protocol selected an analytical sampler with the native candidate's two-layer bound.
- Redesign from First Principles combined those ideas under one visual owner.
- Separate Before Serializing Shared State kept implementation, measurement, and review ownership disjoint.
- Build the Lever added repeatable extraction and comparison commands instead of relying on visual memory.
- Prove It Works required compositor recordings and input tests in addition to numerical checks.
