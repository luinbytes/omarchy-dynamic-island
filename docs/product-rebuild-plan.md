# Island product rebuild

Status: this earlier implementation outline is on hold. The user's research-first instruction supersedes its proposed ordering. See [live hub research and feature brainstorm](live-hub-research.md) for the current unapproved product alternatives. Do not resume implementation from this outline without the user's go-ahead.

## Acceptance target

The previous media card is not an accepted Apple-style implementation. It repeats track metadata, has no artwork, and puts small labeled buttons into a generic activity template. Geometry-only animation tests cannot establish the quality of the complete interaction.

The product is a native Omarchy live activity hub centered in Quickshell. Music, local weather, notes, and Codex agent activity are required product areas. The media rebuild is one implementation unit, not the product boundary. Quattro remains unchanged. The user's system font, bar palette, and fullscreen behavior take precedence over copying Apple's black hardware cutout.

## Required daily-use layouts

Collapsed is a designed presentation, not an expanded card with its details hidden. Apple's [ActivityKit presentation contract](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities) distinguishes compact leading and trailing regions from the minimal presentations used for simultaneous activities. Preserve that organization and motion language while adapting the information to Omarchy.

| Area | Compact leading and trailing | Expanded | Persistence and source |
| --- | --- | --- | --- |
| Music | Artwork, readable track identity, playback state; stable position when another activity arrives | Artwork, title and artist, elapsed and remaining time, seeking, transport, player selection | Native MPRIS through the host media service; exact-player controls |
| Weather | Condition glyph and temperature; next material change or precipitation when available | Location, current conditions, hourly outlook, update age and location settings | Explicit automatic location option and manual city or coordinates; cached weather with stale state |
| Notes | Pinned note preview and a meaningful note indicator | Quick capture, edit, pin, search and list existing notes | Plugin-owned local storage; no cloud upload or clipboard scraping |
| Agent activity | Agent identity or count plus truthful working, waiting, completed or failed state | Session list, project label, state age and explicit open-session action where supported | Opt-in local adapter; no inference of success from an idle process |

One selected activity occupies the compact pill. A second live activity gets a distinct attached or detached minimal presentation, preserving its identity and meaningful state. Additional activities remain reachable through an explicit switcher. Do not cycle automatically through music, weather, notes and agents on a timer. A pinned note and a weather reading are available utilities; they must not continuously displace a playing track or an agent waiting for the user.

Opening keeps the current activity selected. Closing keeps its compact leading and trailing content. Shared elements such as track text, weather temperature or an agent label retain identity across layouts; details can fade independently. A different activity is a content handoff, not a transformation of unrelated words. The shared media title is the first verified instance of this behavior, not yet a generic renderer for every domain.

The centered slot is the primary target, but placement remains a native bar-widget setting. Do not rewrite the user's bar arrangement while implementing the plugin. Compact widths must remain bounded so adjacent bar widgets do not move on every update.

## Location and agent privacy

Automatic location must be explicit and disclose its source. Prefer a supported host location setting or permission-mediated OS source. If neither exists, offer manual location; do not silently send the user's IP address or precise coordinates to a geolocation service. Weather requests carry only the selected location and required forecast parameters. Show unavailable and stale states instead of invented readings.

Agent adapters publish only bounded session identity, user-visible project label, state, sequence and update time. Prompts, assistant responses, secrets and terminal contents are not Island payloads. An expired heartbeat means disconnected or unknown, not completed. Displayed status records whether it is a semantic event or an observed heuristic. A completion indicator must be backed by an explicit source event.

The user cited [herdr](https://github.com/motionharvest/herdr). Its current [agent documentation](https://herdr.dev/docs/agents/) distinguishes semantic status integrations from screen-detected state. Codex session identity is not by itself a reliable working/completed signal. Establish the supported local event source before installing hooks or claiming Codex status integration.

## Research findings

Apple describes ongoing activities that expand for detail and support switching between two activities. Its examples include recording, transfers, and navigation. The desktop needs equivalent source adapters, not fabricated iOS states. See [Apple's interaction guide](https://support.apple.com/guide/iphone/view-live-activities-in-the-dynamic-island-iph28f50d10d/ios).

The media composition has artwork and a title/artist pair above a timeline, with large transport symbols below. The compact state reduces this to artwork and playback activity. A photographed [compact and expanded media reference](https://mobilelaby.com/blog-entry-how-to-use-dynamic-island-on-iphone.html) supplies the layout comparison. Reference images remain local research evidence; they are not packaged assets.

Apple's [Live Activities design session](https://developer.apple.com/videos/play/wwdc2023/10194/) supplies the expansion reference. Body growth, retained content, blur, and legibility must be inspected together. A spring coefficient or a low normalized geometry error alone is not a visual pass.

[Atoll](https://github.com/Ebullioscopic/Atoll) extends the idea into media, charging, recording, privacy, downloads, and utilities. [DynamicIsland_Mac](https://github.com/NKR00711/DynamicIsland_Mac) also adds timers, HUDs, and system panels. These are macOS product expansions, not proof that every feature belongs in Apple's Island. Their platform integrations cannot be copied directly into Linux.

Quickshell's [MPRIS player contract](https://quickshell.org/docs/v0.3.1/types/Quickshell.Services.Mpris/MprisPlayer/) supplies artwork, track identity, capabilities, and writable playback position. Missing metadata and unsupported capabilities are normal. Position reads advance without reactive notifications, so bounded sampling is required. Seeking must reject stale track identity and unsupported position control.

## Implementation units

| Unit | Deliverable | Required proof |
| --- | --- | --- |
| Media rebuild, current work | Dedicated artwork-led card, nonduplicated metadata, time labels, seek interaction, centered transport icons, compact playback indicator | Fresh renders with artwork and fallback; owned-player seek and controls; stale-track rejection |
| Motion acceptance | Coordinated artwork/content reveal, interruption continuity, no progress-driven re-entry, reduced motion | Before/after recordings at real display refresh; inspect opening, closing, reversal, track changes and split activities |
| Native hub and compact presentations | Stable selection, rich per-domain compact leading/trailing content, second-activity minimal state, explicit switcher and utility entry points | Music plus an agent event, pinned note plus music, constrained widths, keyboard and per-monitor behavior |
| Notes | Standalone quick capture, editor, pinning, list and search with local persistence | Save/reopen, Unicode, empty and oversized input, interrupted writes, no loss when collapsing or switching |
| Weather | Automatic or manual location settings, current and hourly weather, meaningful compact reading | Permission denial, manual override, offline cache, stale responses, units and missing fields; no background geolocation before opt-in |
| Codex agent activity | Local adapter, session list, compact status/count, waiting and completion transitions | Concurrent sessions, ordered events, restart identity, disconnected state, no prompt leakage and no invented completion |
| Timers | Start, pause, resume, cancel and completion presentation from a plugin-owned timer model or a documented native source | Deadline and suspend behavior, completion once, no surprise timer creation on startup |
| Power and devices | Charging transition, low battery, supported Bluetooth device state | UPower/device capability checks, deduplicated transitions, real hardware QA; unavailable on a batteryless desktop |
| System feedback | Bounded volume/brightness feedback that does not duplicate existing OSD ownership | Public host event contract first; keyboard-driven event QA; restoration of the prior activity |
| Recording and privacy | Truthful recording/capture status with duration and supported stop action | Source-specific native state and exact-owner controls; no inference from unrelated process names |
| Transfers and application activities | Progress, cancellation and completion for cooperating applications | Versioned publisher contract, expiry, malformed input, privacy and source-lifetime checks |
| Multi-activity and accessibility | Discoverable switching, keyboard navigation, focus order, capability-aware actions and per-monitor behavior | Two real simultaneous sources, fullscreen, disabled controls, display scales and all bar edges |

Calls, navigation, AirDrop, Wallet and Face ID do not have a universal Linux equivalent. They require a real application adapter or remain unsupported. No fake system permission, payment or privacy indicator will stand in for integration.

## Native integration placement

The installed host is a read-only compatibility reference. Its media service is already the publisher's discovery and control boundary.

The installed `omarchy.battery` service owns low-battery notifications and power-profile changes. A future Island publisher should observe `Quickshell.Services.UPower` for charging presentation, without calling those side-effecting service methods or duplicating its warnings. This machine cannot prove laptop charging behavior without suitable hardware.

The native Bluetooth panel observes `Bluetooth.devices` and `Bluetooth.defaultAdapter`. A passive Island publisher can use the same public Quickshell types. It must not start discovery, reconnect devices, or alter audio routing merely to display a connection event.

The current OSD is its own overlay with a `show` IPC command, not a shared event stream. Do not intercept that command or disable the host OSD to obtain Island feedback. Volume and brightness integration needs a supported source and an explicit nonduplicating presentation policy first.

No timer service was found in the inspected plugin tree. Timers can use a plugin-owned deadline model later. The user's daily-use hub requirements take priority: shared-element motion, compact/split presentation and selection, notes, weather, then the verified Codex adapter. Recording and transfer adapters follow only when their source exposes truthful state and exact-owner controls.

## Current media design constraints

- Keep the activity broker and keyed animation owner. Replace generic media rendering, not the whole shell.
- Display each title and artist once. Do not repeat an album name that duplicates the title.
- Load the player's artwork asynchronously, with bounded decode size and a missing/error fallback.
- Use exact-player and exact-track identity for seeking. A track change during a drag cancels that seek.
- Show elapsed and remaining time only when duration is known. Disable seeking for unsupported players.
- Keep playback indicators honest. A procedural playing-state animation is not an audio spectrum.
- Keep outgoing content noninteractive and respect reduced motion.
- Use the bar's background and foreground through every presentation. Keep `WlrLayer.Top` so fullscreen apps cover it.

## Verification and delivery

Preserve the supplied rejected screenshot and existing recordings as immutable baselines. Inspect actual rendered output after the final visual change. The adapted desktop design deliberately differs in font, bar integration, size, and platform services, so no zero-diff or complete Apple parity claim is valid.

One worker owns the coupled media source changes. The parent owns this plan, native QA, integration checks, and cleanup. Independent review checks the final source and evidence. No commits, pushes, host patches or shell restarts are authorized by this plan.

The dedicated media unit is implemented and has passed owned-player controls and rendered checks. See [media rebuild QA](media-rebuild-qa.md) for results, findings, and remaining proof. The other feature units above are a plan, not a claim that those integrations already exist.

## Decisions and principles

- Experience First and Redesign from First Principles replaced the generic activity template with a dedicated media composition.
- Foundational Thinking and Model the Domain put optional, validated media data in the existing reducer-owned activity. There is no second presentation store.
- Exhaust the Design Space compared two architecture sketches. The selected design supports remote artwork and uses native track identity; the alternative's fixed artwork box and error fallback were retained.
- Boundary Discipline validates external metadata and rechecks player identity, track identity, and seek capability before a playback-position write.
- Laziness Protocol preserves the existing broker, native player selection, calibrated body motion, theme bindings, and fullscreen layer.
- Separate Before Serializing Shared State assigns coupled source changes to one worker and integration, documentation, and live verification to the parent.
- Build the Lever adds repeatable model and renderer contract checks. Prove It Works keeps those checks separate from compositor captures, actual controls, and subjective approval.
