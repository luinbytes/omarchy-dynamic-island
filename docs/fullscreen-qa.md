# Fullscreen visibility correction

The Island previously used `WlrLayer.Overlay`. The native Quattro bar uses `WlrLayer.Top`. That difference kept the Island above a fullscreen game while the compositor hid the bar.

The correction changes only the layer declaration and adds regression assertions. Fullscreen visibility remains compositor-owned. No host patches, fullscreen polling, game rules, or game input were needed.

## Live evidence

The existing fullscreen game stayed on HDMI-A-1. Before the fix, the bar had compositor alpha 0 and the Island had alpha 1. After the fix, the Island occupied layer 2 with alpha 0. The Island on the non-fullscreen DP-1 monitor retained alpha 1.

Fresh local QA crops confirmed both states. `fullscreen-before.png` shows the unwanted Island. `fullscreen-hidden-confirmed.png` shows the unobstructed game. `fullscreen-other-monitor.png` shows the Island retained on the other display. These captures are not included in this repository.

An initial post-install capture showed both bar and Island visible during a transient desktop state. The confirmed capture followed a fresh check that the fullscreen game workspace was active. No input or window-state changes were sent to the game.

The portable verifier, native plugin validator, QML lint, and whitespace checks pass. Installed plugin source matches the repository. The existing shell remains responsive. The fix is installed and uncommitted.

Fix Root Causes corrected layer classification. Laziness Protocol avoided duplicate fullscreen logic. Prove It Works required compositor evidence and fresh captures.
