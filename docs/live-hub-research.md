# Omarchy Island research and feature brainstorm

Research date: 2026-09-05. Audience: the user and the next implementation agent. Status: proposal for review. No layout or implementation sequence in this document is approved.

## The product decision

Omarchy Island should be a daily-use activity hub in the center of Quickshell. Its required areas are music, weather with automatic or manual location, notes, and Codex agent activity. The collapsed presentation is part of each feature, not a placeholder for its expanded panel.

My recommendation is a context-aware primary pill with a separate second-activity indicator and a deliberate way to reach all four areas. The alternative worth comparing visually is Apple's stricter compact-to-two-minimal arrangement. An always-visible four-section toolbar offers more information, but changes the character of the product substantially.

The current music implementation must not decide the whole product's layout. Implementation is paused. The shared-title code is an unapproved draft with unresolved baseline, font-settling, and minimal-transition issues. It is not installed. Earlier media QA does not prove the new title draft or any proposed non-media feature.

## What the references establish

Apple distinguishes compact leading and trailing presentations, expanded content, and minimal presentations. With multiple applications providing activities, the system can show two minimal presentations, one attached and one detached. This is a stronger reference than making every activity a generic text card. See Apple's [ActivityKit presentation documentation](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities).

Apple's [Dynamic Island interaction guide](https://support.apple.com/guide/iphone/view-live-activities-in-the-dynamic-island-iph28f50d10d/ios) describes expansion, collapse, and switching activities. The [Live Activities design session](https://developer.apple.com/videos/play/wwdc2023/10194/) is the visual reference for shape and content choreography. Those sources do not publish a universal set of private spring coefficients or prove that every label uses a shared text object.

[Atoll](https://github.com/Ebullioscopic/Atoll) broadens the desktop idea with media, system activities, timers, weather, clipboard tools, and other utilities. It is useful for feature discovery. Its tabs, statistics, hover behavior, and utility panels are desktop design choices, not Apple's Dynamic Island specification.

[DynamicIsland_Mac](https://github.com/NKR00711/DynamicIsland_Mac) is an Atoll fork. Its README adds a broad dashboard-style feature inventory, including weather, timers, calendar, and system monitoring. These repositories are related evidence. Their feature lists are not proof of Linux compatibility or production quality.

The target therefore has two parts. Match Apple's organization and motion where the interaction has a direct equivalent. Design the additional desktop tools in the same visual language. The user-required Omarchy font and bar color intentionally differ from Apple's hardware cutout. A notes editor and a Codex session list have no single Apple Island layout to copy one-to-one.

## Three layouts worth comparing

These are structural sketches, not pixel-accurate mockups.

| Candidate | Collapsed organization | Expanded organization | Main tradeoff |
| --- | --- | --- | --- |
| A. Strict activity island | One activity uses leading and trailing regions. Two activities use two minimal presentations. | One activity's detail with a separate way to reach utilities | Closest to Apple's activity model, but less track text remains visible with two activities |
| B. Context pill and satellite | Selected activity keeps readable information. A second live activity has a compact status indicator beside it. | Selected detail plus an explicit activity and utility switcher | Best fit for the user's music and agent workflow, but deliberately differs from Apple's two-minimal rule |
| C. Persistent four-section hub | Music, weather, notes, and agents always occupy visible sections | Selected tool opens from its section | Most discoverable and information-dense, but resembles a toolbar and consumes more bar space |

Candidate B is my recommendation, not a settled choice. Candidate A should remain in the visual comparison because the user explicitly prioritizes Apple fidelity. Candidate C is a useful counterexample to test whether permanent access is more important than the Island's compact shape.

For B, a typical arrangement is:

```text
One activity       [ artwork | track title | playback state ]
Two activities     [ artwork | track title | playback state ]  [ agent state ]
Weather selected   [ condition | temperature | next change ]   [ music state ]
Agent selected     [ agent | project or count | needs input ]  [ music state ]
```

Labels describe regions, not literal text. A second indicator needs a useful state, not an unexplained dot. A group of three agents should normally become one grouped indicator, not three more pills. More activities remain available in the switcher.

No layout should rotate through tools automatically. Weather refreshes and note autosaves must not displace a playing track. Entering fullscreen must not lift the Island above the application.

## Required features and useful extensions

All entries below are product proposals unless identified as existing evidence. The first four areas are required by the user, not optional add-ons.

| Area | Useful collapsed content | Required expanded experience | Further ideas |
| --- | --- | --- | --- |
| Music | Artwork, track identity, playback state. Optional elapsed value if the width supports it without jitter | Main playback controls, seeking, time labels, artwork, metadata, and explicit player selection | Repeat, shuffle, per-player volume, chapter controls, queue where a player actually exposes it |
| Weather | Condition and temperature. A supported near-term change can replace less important detail | Current conditions, feels-like temperature, hourly outlook, high and low, location settings, units, update age, offline state | Wind, sunrise and sunset, air quality, second location, provider-backed weather warnings |
| Notes | A deliberately pinned preview or note indicator. Private notes stay redacted unless preview is enabled | Standalone quick capture, editor, note list, search, pinning, autosave, and recoverable deletion | Plain-text or Markdown export, checklists, explicit import, open in the user's editor |
| Agents | Working count, waiting count, or the selected project's state. Meaning must survive without animation or color | Standalone session list, project labels, state age, parent and child grouping, source confidence, and explicit jump to the owning session | Review-ready queue, completed-task history, optional native usage summary, other opt-in agent adapters |
| Timers | Remaining time and paused or running state | Named timers, start, pause, resume, cancel, and completion | Stopwatch and focus sessions |
| System activities | Charging, device connection, recording duration, or transfer progress when a real source exists | Source-specific detail and supported action | A bounded completion history and per-source mute settings |

The additional ideas need their own selection pass. Calendar reminders, file-drop shelves, clipboard history, resource graphs, and a command palette are plausible desktop additions. None should be enabled by default merely because Atoll offers something similar.

I would exclude automatic screen analysis, continuous clipboard collection, agent prompt previews, automatic approval buttons, fake audio spectra, and unsupported system indicators from the initial product. These either introduce new privacy and control risks or claim information the source does not supply.

## How the collapsed and expanded states relate

The small presentation retains the activity's identity, most important changing value, and relevant status. It does not retain every expanded field at unreadable size. For music that may be artwork, title, and playback state. For weather it is condition and temperature. For agents it is identity and whether attention is needed. For notes it is the user's chosen preview or private-note indicator.

Each activity needs a storyboard for arrival, update, expansion, collapse, interruption, replacement, and removal. A second activity also needs join, promotion, demotion, and exit scenes. Designing only two endpoint screenshots misses most of the experience.

Shared elements should have stable identities. A music title can move toward its compact baseline while artist, timeline, and controls leave. A temperature can move between its small reading and expanded headline. An agent identity can retain its position while the session list appears. A change of song or project is a content replacement, not the old words transforming into unrelated words.

The current title experiment found a real implementation trap. Qt's actual centered Text baseline differs from a calculation using FontMetrics height. It also separates geometric settling from content updates. These findings belong in the motion constraints, but they do not approve the current code shape.

The proposed motion rules are:

- The center anchor stays stable as the body changes size. Adjacent bar widgets do not shift on every text update.
- Position, scale, clipping, corner shape, and detail opacity form one coordinated transition.
- Closing or reopening mid-motion continues from the current position and velocity.
- Text stays readable and is elided against the actual available width. It does not pass through integer font-size steps.
- Track progress, weather refreshes, and agent heartbeats do not replay entry animations.
- Reduced motion has its own stable presentation. Information must not depend on a moving waveform or spinner.

Exact timing, shape overshoot, blur, and label trajectories remain measurement questions. Existing normalized body-motion tests cover only geometry. They are not a one-to-one visual verdict.

## Desktop interaction proposals

The default left click would expand the current activity. The second activity would be directly selectable. An explicit switcher would expose Music, Weather, Notes, and Agents even when they have no live activity. Escape would collapse and return focus without stopping music or discarding a note draft.

Hover could provide a quiet preview, but should not steal keyboard focus or open a large editor when the pointer crosses the bar. Hover-to-expand can be an optional desktop preference. Wheel-based activity switching is worth testing, but should not be the only discoverable route or conflict with scrolling inside notes and forecasts.

Keyboard access needs a stable focus order, visible focus, named icon controls, and shortcuts that do not replace existing Omarchy bindings. Narrow screens, long German titles, non-Latin text, fractional display scale, light themes, and missing artwork belong in the initial layout review.

The idle state needs deliberate design. My proposal is a small persistent entry point showing the user's chosen quiet content, such as weather. Hiding the entire plugin when no music plays would make Notes and Weather inaccessible. Whether idle shows weather or a neutral entry point remains a preference question.

## Native placement and data ownership

The root [manifest](../manifest.json) already declares a service and a center-section bar widget under `luinbytes.island`. [Service.qml](../shell/plugins/island/Service.qml) owns the activity broker. [ActivityModel.js](../shell/plugins/island/ActivityModel.js) already validates compact, minimal, and expanded regions, source identities, revisions, expiry, and symbolic actions. This is useful infrastructure for a hub, not a reason to force every domain into the media payload.

There are two important gaps. The current renderer hides when no activity exists. Ranking also uses update time after priority and relevance, which can let frequent publishers win ties. A multi-domain design needs separate user selection, activity importance, and data freshness. Persisted notes and forecast caches must not become disposable broker activities themselves.

The native media service remains the discovery and control boundary. [MPRIS](https://specifications.freedesktop.org/mpris/latest/Player_Interface.html) defines capability-dependent transport and seeking. A main music controller is feasible, but a universal library or queue is not implied. The [mpv-mpris bridge](https://github.com/hoyon/mpv-mpris) explicitly omits TrackList and Playlists. Browser support depends on the browser exporting a media session; it does not mean access to every browser tab.

The installed `omarchy.weather` is a bar widget, not a service exposing structured forecast state. Its private panel Loader is not an integration API. Omarchy already owns a weather-location file and `omarchy-weather-location` command. A future Island weather provider can follow that location contract and obtain bounded structured forecasts without patching the host. The shared setting must be clearly labeled because changing it also affects Omarchy weather. Evidence is in the installed [weather manifest](/usr/share/omarchy/shell/plugins/panels/weather/manifest.json), [widget boundary](/usr/share/omarchy/shell/plugins/panels/weather/BarWidget.qml), and [location command](/usr/share/omarchy/bin/omarchy-weather-location).

No native notes service was found. Notes therefore need plugin-owned storage with one writer and atomic persistence. The editor's save state is separate from whether its activity is visible. Shared bar settings are appropriate for small preferences, not the note collection. The installed [notification service](/usr/share/omarchy/shell/plugins/notifications/Service.qml:781) demonstrates the native atomic-file mechanism.

The installed `omarchy.agents` concerns usage and rate limits, not live task lifecycle. Reusing its label as a working-state signal would be incorrect. See its [manifest](/usr/share/omarchy/shell/plugins/agents/manifest.json).

## Weather options and limits

Omarchy's current automatic location behavior is IP-based. Research did not query the user's location. The first-use choice should explain automatic location, offer manual city search or coordinates, and retain a manual override. A VPN or network change must not silently override a chosen location.

The [XDG Location portal](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.Location.html) defines permission-mediated sessions and a city-level accuracy request. Its documented existence does not prove the current desktop has a working backend. It is an alternative to investigate, not a promised dependency.

[Open-Meteo](https://open-meteo.com/en/docs) is a practical forecast candidate with current and hourly fields. Its current values are model-based. Fine-grained precipitation support varies geographically, so the interface must not invent a precise rain countdown from hourly data. Its [geocoding API](https://open-meteo.com/en/docs/geocoding-api) supports manual place search and returns coordinates and timezone.

Open-Meteo's [published terms](https://open-meteo.com/en/terms) limit the free endpoint to non-commercial use and require attribution. They also disclose logging that can include coordinates. Distribution must retain attribution and review the intended service use. “No API key” does not mean “no network or privacy implications.”

[MET Norway](https://api.met.no/doc/TermsOfService) is an alternative with explicit identification, attribution, caching, and traffic requirements. The installed [weather panel](/usr/share/omarchy/shell/plugins/panels/weather/Panel.qml:165) already uses Open-Meteo for coordinate-based current conditions and daily forecasts. That makes it the leading provider candidate for native consistency. A separate Island fetcher could duplicate requests while the existing weather widget is mounted, so cache ownership and refresh frequency need a design decision. No custom cloud backend has been authorized.

## Agent integration options and limits

There are three distinct candidates. They should not be mixed into one unexplained status.

| Source | What it can establish | Limitation |
| --- | --- | --- |
| Herdr adapter | Existing pane and workspace status with a route back to the owning terminal | Codex status is screen-detected, not an authoritative completion guarantee |
| Codex lifecycle hooks | Explicit events for submissions, tool activity, approval requests, stops, interruptions, and subagents | Requires opt-in installation and version testing; events do not automatically provide a complete current-state snapshot |
| Codex app-server adapter | Runtime thread status and turn lifecycle on a supported connection | Passive observation, subscription ownership, and compatibility with existing sessions must be proven |

Herdr's [agent documentation](https://herdr.dev/docs/agents/) explicitly separates session identity from status authority. Codex currently uses screen manifests. Some unrecognized UI states can fall back to idle. The Island could consume herdr's public status without reading terminal buffers itself, but should label inferred status and never treat idle as verified success.

Current official [Codex hooks documentation](https://learn.chatgpt.com/docs/hooks) includes PermissionRequest, Stop, Interrupt, and subagent events. Hooks can affect execution, so an observer must never return approval, blocking, or continuation decisions. Hook inputs can include prompts, tool arguments, and transcript paths. The proposed adapter discards those fields and forwards only an allowlisted status record. A Stop callback can precede another hook's continuation, so it is not proof that the user's task is complete.

The official [app-server documentation](https://learn.chatgpt.com/docs/app-server) describes runtime status notifications, waiting-on-approval state, and turn completion. It also offers thread summaries without resuming them. The installed CLI is 0.153.1 and advertises a shared-daemon agent browser. Only command help was inspected. No session data was read. A monitoring adapter must not resume a thread merely to subscribe to events, take approval ownership, or claim visibility into every Codex frontend.

The display should distinguish working, approval requested, input requested when supported, idle, turn ended, failed, interrupted, and disconnected. “Task complete” needs stronger evidence than “turn ended.” Unknown state is valid. No percentage, ETA, or success tick should be invented from time spent running.

## Daily-use scenes that decide the design

1. Music is playing while two Codex agents run. The track remains recognizable. One agent asks for approval and gets a persistent attention cue without opening a panel or changing focus.
2. The user checks weather, then closes it. Playback continues. The island returns to the chosen compact activity rather than whichever source refreshed last.
3. The user captures a note while an agent finishes a turn. The draft keeps focus and saves. The agent cue waits without replacing the editor.
4. The browser replaces its media session. A seek or pause aimed at the old session never reaches the new one.
5. Weather is offline and herdr disconnects. Last-known weather has an age label. Agent status becomes disconnected. Neither disappears in a way that implies success.
6. A fullscreen game opens. The Island stays underneath it. Nothing is summoned automatically when a timer or agent event arrives.
7. No media or agents are active. Weather and Notes remain discoverable from the center entry point.

## Proposed gates before implementation resumes

The next decision is visual and behavioral approval, not a code architecture vote. Research supports comparing A and B across all four required domains. A storyboard set should include collapsed, split, expanded, idle, waiting, offline, and interrupted transitions. Any illustrative data must be labeled as a mockup.

Only after that review should a bounded prototype prove shared-element motion, selection policy, and native focus behavior. A prototype is not permission to deploy the plugin or install agent hooks. Each real integration then needs its own data, privacy, control, failure, and runtime checks. Hardware-dependent features stay unavailable until supported hardware can prove them.

The main open choices are strict two-minimal Apple organization versus a readable desktop primary pill, the preferred idle content, note-preview privacy, and whether the first agent integration targets herdr, direct Codex hooks, or both. These are product choices, not missing facts to hide behind implementation.

## Evidence limits and current work state

This investigation used primary product documentation, public repository descriptions, installed host source, the current plugin source, and harmless CLI help. It did not run the macOS reference apps, query location, inspect private agent transcripts, install hooks, or validate a live agent adapter. Reference-app feature lists are not runtime proof.

The previous title draft remains frozen on `feature/quattro-integration`. No source fixes were made after the research-first instruction. The installed media QA4 plugin was not reloaded. No commit, push, merge, or host patch occurred in this phase. The existing working tree contains earlier media and motion work and must be preserved.

The machine rebooted before the final research handoff. The installed manifest still points to media QA4, and the new shell process runs the standard Omarchy entry point. Temporary research notes and earlier captures did not survive the reboot and are not included in this repository. The cited public sources and this report remain available. Earlier motion measurements are recorded findings, not replayable acceptance evidence; fresh captures are required before any visual acceptance claim.

Research coverage includes Apple presentations, both requested reference repositories, the four required domains, provider and agent alternatives, host placement, privacy, and failure behavior. Local document links and whitespace checks passed. The Apple and native-integration research lanes completed before the reboot. The final independent report-review agent did not initialize afterward and was stopped. This handoff does not claim that final review passed. Further searches are deferred because the remaining consequential questions require product choices or runtime prototypes, not more feature-list sources.

Experience First changed the scope from a music card to the user's daily-use hub. Redesign from First Principles keeps the four domains in the design before choosing a renderer. Model the Domain separates live activity, persisted content, selection, and freshness. Boundary Discipline distinguishes documented status from inferred status and limits personal data. Prove It Works keeps research, draft code, rendered proof, and user approval separate.
