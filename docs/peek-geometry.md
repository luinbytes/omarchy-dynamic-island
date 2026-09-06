# Peek sizing and closing geometry

Small peeks use the larger of their two measured text lines plus 50 pixels for the icon, gap, and padding. Their height remains 68 pixels. Screen bounds cap the width. This applies to notifications and other live-activity peeks, including Codex usage.

Measurements carry the content key. During replacement, outgoing text retains its own dimensions until the next content and its matching dimensions commit together. Width and height use the existing motion clock.

Opening or closing details during a peek retains the sampled peek rectangle and moves it with the main surface. The attached outline remains active until that movement settles, preventing the text from snapping into the bar before the geometry arrives.

The shared outline narrows across its final 32 pixels of exposed depth. Its distal edge becomes a rounded tip while its shoulders remain connected to the bar. Main views and closed peeks use this outline. Attached peeks use the same rotated tip profile. Geometry determines the shape in either direction; closing does not start another timer or fade the surface.

Content and input targets are suppressed inside the taper phase. The narrowing surface must not expose clipped text or leave invisible controls active.

## Verification checkpoint

Native Quickshell captures on a top-edge DP-1 bar showed a short notification changing from the previous 306 by 68 pixel footprint to 83 by 68 pixels. A 17-frame expiry sequence showed the surface narrowing into the bar. The existing shell process remained running throughout installation and verification.

Portable checks cover keyed measurement handoffs, screen constraints, all four bar edges, bounded curve controls, and contour continuity. Focused QML lint and the Omarchy plugin validator passed.

After the focused monitor became available, a native media-detail closing sequence also showed the rounded tip before compact text returned. No playback controls or workspace changes were sent.

A further 18-frame native sequence covered a closed peek, opening details with that peek attached, and closing details back into the peek. Review found and corrected an immediate placement jump before this sequence. A ten-frame interruption sequence then closed details while the attached peek was only 9 pixels high. The final fix preserves that revealed geometry rather than replacing it with the full 68-pixel rectangle.

Zero-height, partial, settled, and reversed placement changes pass four-edge model regressions. Those checks are not rendered proof for every edge or reversal timing. The renderer and live publishers remain unfinished; this checkpoint does not establish Apple motion parity.

## Design decisions

- Model the Domain kept content identity and its measurement together.
- Laziness Protocol reused the existing motion clock instead of adding a separate closing sequence.
- Fix Root Causes changed the shared outline rather than translating or fading a separate card.
- Prove It Works required native captures in addition to model tests.
- Boundary Discipline kept provider changes and private QA captures outside the public package.
