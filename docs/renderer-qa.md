# First renderer QA

## Result

The first renderer passed automated and live checks on 2026-09-04. The temporary plugin installation was removed through Omarchy's plugin manager afterward. Quattro source was not changed and the existing shell was not restarted.

This is a fixture-driven renderer milestone, not full macOS visual parity. Live system publishers and subjective user acceptance remain unfinished.

## Verified

- Portable reducer, per-screen projection, constrained geometry, focus sequencing, fixture assertions, and package contracts.
- Installed Omarchy plugin validator, direct QML lint, and whitespace checks.
- Fresh rendered compact, minimal, secondary-bubble, alerting, and expanded states.
- Primary and secondary click selection, enabled action invocation, disabled action isolation, Tab/Enter, Escape, native summon, and repeated summon.
- Focus retention with the pointer outside the card and over the bar. The first outside click dismisses the modal card and is consumed; compact transparent areas pass clicks to the underlying window.
- Stable center-widget positions during expansion, reduced-motion geometry snapping, delayed alert restoration, and expiry unmapping.
- One expanded owner on DP-1 with a passive view on HDMI-A-1. Both displays were 1920×1080 at scale 1 with a top bar.
- Fixtures absent in an unmodified production-default snapshot. After removal: no installed plugin path, registry entry, Island layer, or fixture IPC target; shell ping still returned `ok`. Both agent-owned test windows were stopped.

Bottom/side bars, constrained displays, and pinned expansion across focus changes have portable coverage, not live acceptance in those configurations. Hidden duplicate anchor layouts and other scale factors still need runtime coverage. Actions remain symbolic; no real application was controlled by fixture actions.

## Evidence and review

Local QA evidence included `runtime-verification.md`, `decisions.tsv`, the two design candidates and judgment, and six `*-final.png` captures. These artifacts are not included in this repository. The runtime record preserves final results and explicitly qualifies earlier observations whose original command output was not saved locally.

The live engine cached previously loaded QML URLs. Each temporary QA snapshot used fresh paths inside the installed plugin; fixture snapshots changed only the fixture loader opt-in in addition to those manifest paths. The final production snapshot retained unmodified source. No host patch or second shell process was used.

The combined verifier's `--upstream /usr/share/omarchy` check rejected the installed tree because it was not a Git checkout. Compatibility was checked directly with `omarchy plugin validate .` and `qmllint -I /usr/share/omarchy/shell` instead.

Independent review by `gpt-5.6-sol` found no remaining actionable source defects after fixes. Its comment audit found no comment candidates or suppression flags. Historical evidence-link weaknesses are recorded rather than represented as captured proof.

The removed QA package was kept as a local backup during verification. That backup contains test snapshots, is not a release artifact, and is not included in this repository. Source changes remain uncommitted on `feature/quattro-integration`.

## Decisions guided by principles

- **Model the Domain** and **Foundational Thinking**: retain the reducer's tagged presentation and derive a pure display frame; represent focus acquisition with an explicit latch.
- **Exhaust the Design Space** and **Laziness Protocol**: compare two ownership designs, then use widget-owned windows without a service anchor registry.
- **Separate Before Serializing Shared State**: keep implementation ownership disjoint from read-only design and review work.
- **Sequence Work into Verifiable Units**: finish fixture QA and removal before renderer implementation; verify rendering before final teardown.
- **Experience First**: use a continuously animated capsule and retain keyboard focus, with explicit modal outside-dismiss behavior.
- **Boundary Discipline**: use public Quattro and Quickshell contracts; keep all fixes inside the plugin.
- **Build the Lever**: add repeatable frame diagnostics and executable source-contract tests.
- **Fix Root Causes** and **Prove It Works**: reproduce geometry, expiry, focus, and click-through failures, then verify the fixes in the live compositor as well as portable tests.

## Next implementation step

Add a real publisher through an existing public system or shell API, starting with one bounded activity such as media. Preserve the plugin-owned broker, symbolic owner-action boundary, fixture opt-in, and host-patch prohibition. Do not claim feature parity until real publishers and reference-based visual acceptance are complete.
