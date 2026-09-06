# Shared media title

The following design record predates the no-fade requirement. Shared title position still follows body geometry, but track-identity handoff now uses clipped vertical movement at constant opacity. References to fading and opacity animation below are historical, not current renderer behavior.

Status: unapproved implementation draft, frozen on 2026-09-05 for the user's research-first product review. The current source is not installed or native-QA accepted. Open issues include geometry-only font settling, the measured compact Text baseline, and minimal-exit projection. The design below is a candidate, not an approved cross-domain contract.

## Problem and target

The media rebuild put a title in both retained content layers. During expansion or collapse, those copies faded through one another. The collapse frame sheet visibly shows a second title above the first. The user's follow-up requires one title to travel into the compact bar text position.

The title must retain its identity, land on the native compact baseline, stay sharp while changing size, and reverse without jumping. Artwork, artist, timeline, and controls may keep their existing detail transitions. A different track is a content replacement, not a spatial transformation of the old song name.

## Design decision

Two designs were compared. A shared title owned by the existing keyed visual body scored 13/15. A separate media-presentation hierarchy scored 10/15 and depended on a track crossfade that the current content model does not provide.

The selected design renders one title above the retained detail layers and suppresses both of their title copies. Title movement derives from the capsule's sampled geometry and real compact and expanded endpoints. There is no independent title-position timer or spring. Bounded identity and opacity state handles replacement by a different track on the existing analytical clock.

The system font remains unchanged. Settled compact and expanded states use native 11px and 14px text. Between them, a single 14px glyph run scales uniformly using Qt's distance-field renderer. Baselines come from actual font metrics; font size is not treated as line height.

Qt documents `font.pixelSize` as an integer and recommends its scalable [Qt text renderer](https://doc.qt.io/qt-6/qml-qtquick-text.html) for transformed text. A Qt 6 rendering probe compared native 11px text with scaled 14px text. The test string differed by about 0.04px in advance width and 0.01px in baseline, and the elided versions looked consistent. These measurements justify testing the approach; they do not establish pixel parity across fonts or display scales.

Apple's public [matched geometry API](https://developer.apple.com/documentation/swiftui/view/matchedgeometryeffect(id:in:properties:anchor:issource:)) separates linked geometry from content transitions. That is a useful design reference, not evidence of Dynamic Island's private implementation. The existing Apple motion clips remain the shape and choreography reference.

## Acceptance checks

- One same-track title during expansion, collapse, and reversal, including the invisible portions of a content handoff.
- Exact compact and expanded anchor positions, measured baselines, bounded widths, and native font sizes at rest.
- Progress updates do not restart movement. Same-track metadata corrections update in place.
- Track replacement does not morph unrelated strings through one another.
- Minimal and secondary media bubbles remain artwork-only. Constrained endpoint geometry stays finite.
- Reduced motion snaps to the endpoint. Native controls, theme, focus, and fullscreen behavior remain unchanged.
- Actual native frames establish rendering; model tests and a standalone font probe do not replace them.

## Principles and choices

Experience First removes the doubled-title transition. Model the Domain separates track identity from geometric position. Redesign from First Principles moves title ownership out of both fading detail layers. Exhaust the Design Space compares two structures before implementation. Laziness Protocol keeps the existing body solver and rejects a four-module media hierarchy. Boundary Discipline leaves font measurement in QML and native control validation unchanged. Build the Lever adds a repeatable font probe and motion tests. Prove It Works requires actual collapse and reversal frames before claiming the visible correction.
