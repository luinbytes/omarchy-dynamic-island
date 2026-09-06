# Compact layout correction

The rejected compact view used an 18-pixel filled badge inside a 22-pixel bar. Its play glyph inherited font bearings. The progress rail also crowded the bottom edge.

The corrected view uses a 12-pixel unfilled container with an 8-pixel-high vector mark. Title and artist share a baseline. Horizontal insets are 8 pixels. Progress stays in the expanded view. Compact and expanded backgrounds now use matching native foreground roles.

## Evidence

The parent captured both versions from the running shell using an owned silent mpv player.

- Before, 250 by 22 pixels: `compact-before.png`.
- After, 250 by 22 pixels: `compact-after.png`.
- Portable verifier, native plugin validator, all-plugin QML lint, and whitespace checks pass.
- The installed `island-media-qa-2` source matches the repository plugin source.
- The owned silent player stopped after verification. The shell still responds to ping.

The before and after captures were local QA evidence and are not included in this repository.

The oversized-badge reproduction is corrected. Subjective approval remains with the user. The updated plugin stays installed for that review. No Quattro source was changed. This is not a claim of complete Apple visual parity. Other display scales have not been visually checked for this correction.

## Decisions

Fix Root Causes replaced the font-based transport mark and removed its oversized badge. Laziness Protocol kept the existing component API and expanded controls. Prove It Works required a fresh native-size capture instead of relying on source checks.
