# Omarchy Island

Live activities in your Omarchy quickbar. Music, agent status, notifications, weather, Codex usage, and system pressure share one place that changes with what's happening.

Inspired by Apple's Dynamic Island, built as an independent Quattro user plugin. Island uses your system font and bar colors, runs inside the existing Quickshell process, and requires no Omarchy fork or host patches.

**Development preview.** The renderer and live publishers remain unfinished. This branch is usable for testing, not a claim of complete Apple visual or motion parity.

## What it does

| Activity | What you get |
| --- | --- |
| Music | Artwork, playback status, transport controls, and seeking through Quattro's media service. |
| Agents | Working and attention states from an existing Herdr widget or opt-in Codex hooks. |
| Notifications | Short live peeks, recent history, and provider-backed actions. Optional Omapager popup handoff avoids duplicate banners. |
| Codex usage | Available weekly and five-hour allowances, pace, resets, and low-allowance peeks from `lu.codex-usage`. |
| Weather | Current conditions and forecasts after you choose a city or opt into automatic location. |
| System | Sustained CPU, memory, GPU, and resource-pressure observations. No process control or zombie-process alerts. |

The compact Island follows current activity rather than a pinned tab. Click it for details, or use the ellipsis to choose another activity. Closing the detail returns to automatic selection. Longer lists use pages instead of scrolling inside the Island.

Important changes use a short live peek without opening the full detail view. If details are already open, the peek appears separately beneath them. Peeks follow each monitor's presenter availability and fullscreen policy.

Peek width follows the longer text line plus its icon and padding, capped to the screen. Closing surfaces narrow into a rounded tip at the bar. Text and hit targets disappear before that narrowing can clip them.

## Install

Requires Omarchy with the Quattro user-plugin API. Git and Node.js are needed for the checkout and verification commands below. Weather uses `curl`; the notification-history and system helpers use Node.js.

Plugins run inside your shell process. Review code before enabling it. Install from the default `main` branch with Omarchy's plugin manager:

```bash
omarchy plugin add https://github.com/luinbytes/omarchy-dynamic-island.git
omarchy plugin enable luinbytes.island --section center
```

The plugin ID is `luinbytes.island`. Its manifest lives at the repository root. Nothing belongs in `/usr/share/omarchy`.

An existing installation with this ID must be updated rather than installed again. Optional providers are not installed or patched by Island.

### Disable or remove

To disable Island:

```bash
omarchy plugin disable luinbytes.island
```

If you installed Codex hooks, remove them before moving or deleting the plugin directory:

```bash
node "$HOME/.config/omarchy/plugins/luinbytes.island/scripts/codex-island-hook.cjs" --remove
```

After removing any installed hooks, remove the plugin through Omarchy:

```bash
omarchy plugin remove luinbytes.island
```

Back up local plugin edits before removal. Island does not uninstall your notification, media, or agent providers.

### Update an existing checkout

Check for local changes first, especially if an agent installed a custom QA build. Do not overwrite those builds with the commands below.

For a clean Git checkout already on `main`:

```bash
cd "$HOME/.config/omarchy/plugins/luinbytes.island"
git status --short
git branch --show-current
```

Stop if the checkout is dirty or on another branch. Preserve custom builds and migrate them separately rather than switching branches over local edits. Otherwise:

```bash
git pull --ff-only origin main
node scripts/verify-scaffold.mjs
omarchy plugin validate .
omarchy-shell shell rescanPlugins
```

## Connect your activities

### Music

Island consumes Quattro's active MPRIS player. It does not run a second player-discovery service. Browsers must expose desktop media sessions; mpv needs an MPRIS bridge such as `mpv-mpris`. Unsupported seek or transport actions stay disabled.

### Agents

An existing Herdr widget can supply status. You can also install status-only Codex hooks from the Agents setup view, or inspect and install them with:

```bash
node "$HOME/.config/omarchy/plugins/luinbytes.island/scripts/codex-island-hook.cjs" --print-config
node "$HOME/.config/omarchy/plugins/luinbytes.island/scripts/codex-island-hook.cjs" --install
```

Installation preserves other hook handlers and backs up the existing configuration. Review and enable the hooks in Codex. Island reports observed activity, not proof that an agent's work succeeded. It does not read prompts or transcripts for this integration.

### Codex usage

Add the existing `lu.codex-usage` plugin to your bar. Island reads its public usage payload without another poller or credential reader. Missing usage windows stay hidden instead of showing invented values.

Each available window can produce a five-second peek after a cumulative ten-percentage-point drop, below 25%, 10%, or 5% remaining, or when its numeric reset timestamp advances. Startup and data recovery establish a silent baseline. Repeated samples do not repeat warnings.

Reset peeks require the provider's optional `weekly_reset_at` and `session_reset_at` fields. Providers without those fields still support usage-drop alerts. The local provider extension is separate from this repository.

### Notifications and Omapager

Island uses the installed notification backend. With Omapager, it reads admitted live rows and bounded history, and revalidates notification keys before actions. Restored history does not become a new alert.

Omapager's optional `automaticDisplayClaims` hook lets Island replace automatic popups on eligible monitors. Omapager still owns delivery, expiry, history, and actions. Explicit Omapager history and reply views remain accessible. Disabling Island restores Omapager's presentation.

That hook is a separate Omapager-side integration, not a Quattro patch. An Omapager version without it retains its own banners. Island respects DND and global snooze; Omapager retains its critical-notification and verification-code exceptions.

The tested popup handoff and fullscreen-hover fix currently depend on a local Omapager extension that is not distributed here. On stock Omapager, expect its banners alongside Island peeks. Do not disable your notification backend to suppress duplicates; it owns notification delivery. Public release of the extension is tracked as an outstanding integration gate.

### Weather and system activity

Choose a location in Weather, or explicitly enable automatic location. Weather requests go to external weather services; automatic location uses your public IP. There is no silent location lookup before your choice.

System observations are read-only. High utilization is not a crash, a sleeping process is not a stalled process, and Island never kills or restarts applications.

## Verify and troubleshoot

```bash
cd "$HOME/.config/omarchy/plugins/luinbytes.island"
node scripts/verify-scaffold.mjs
omarchy plugin validate .
omarchy-shell shell ping
omarchy-shell luinbytes.island status
```

The status output can contain activity metadata. Redact it before sharing publicly.

Portable tests check models and package contracts. They do not prove QML startup, rendered motion, input behavior, or visual parity. Native QA must inspect the running shell. Some dynamic QML types produce static lint warnings, and startup visibility warnings remain under investigation.

Fixtures are for disposable sessions, not your normal desktop. Native checks must cover notification arrival and expiry, playback changes, opening and closing details, multiple monitors, and fullscreen transitions.

## Development

`Service.qml` owns the plugin's activity state. Pure JavaScript models handle selection and presentation. QML components draw and interact with those models. External integrations stay behind their provider boundaries.

## License and release status

Original plugin code is available under the [MIT license](LICENSE). Apple names identify design inspiration, not affiliation or endorsement. Runtime media artwork belongs to its respective owners and is not bundled with this plugin.

Stock-session installation and removal QA, public preview imagery, and publication of the optional provider extensions remain outstanding. A passing CI run is not native UI acceptance.
