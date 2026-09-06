# Live hub implementation

This record describes the preceding hub revision on `feature/quattro-integration`. Its collapsed Pin design is superseded by [automatic activity selection](live-activity-lifecycle.md). The initial no-deployment statements below describe that implementation run. A subsequent local install verified the compact rendering, but did not establish full visual acceptance.

## Presentation and ownership

The selected design uses one compact activity or two minimal bodies. Four tool buttons appear inside the existing expanded window. A persistent idle entry keeps utilities accessible without a player. The bar background, system font, native popout coordination, and `WlrLayer.Top` remain unchanged.

`HubModel.js` separates the expanded tool from the pinned compact tool. Checking Weather and closing the hub returns to pinned Music. Source updates cannot select a tool or take focus. Notes and forecasts do not depend on broker expiry.

The pinned tool is currently session-local. Notes and weather preferences persist across shell restarts. Pin persistence remains unfinished.

The architecture comparison converged on separate domain stores. Candidate A's single pure hub model was selected over Candidate B's additional coordinator and projection layers. Candidate B's distinction between navigation and compact selection was retained. The existing media publisher and motion controller remain their respective owners.

## Domain boundaries

- Music controls recheck the displayed track token and exact player object. Choosing a player does not transfer playback.
- Notes uses one versioned document at `$XDG_DATA_HOME/omarchy-island/notes.json`, with `~/.local/share` as the fallback. Atomic save completion controls the Saved label. Invalid or unreadable files block writes. Trash retains note content.
- Weather has separate preferences and cache under XDG state and cache directories. It offers the existing Omarchy location as a candidate without changing the host setting. Automatic location uses IP-based lookup only after consent. Manual search sends the entered place name to the geocoder.
- Agents stores only bounded session IDs, parent IDs, event names, and observation times in memory. It does not read transcripts, terminal contents, prompts, or tool arguments into the plugin. A stale status is last known, not completion. Hook observation is off after shell startup.

## Codex hook setup

The Agents page provides Install hooks and Remove controls. Installation adds this plugin's handlers to Codex's `hooks.json` while preserving other handlers. Existing configuration is backed up before replacement. Installation does not grant trust. Codex requires explicit review in `/hooks`, as described in the [official hook documentation](https://learn.chatgpt.com/docs/hooks).

Approval attention means that a request was observed. Another parallel tool finishing does not clear it. The cue clears on a new prompt, turn end, interruption, or session end. Hooks do not establish whether a prompt remains on screen or another hook handled the request.

The equivalent commands are:

```bash
node scripts/codex-island-hook.cjs --print-config
node scripts/codex-island-hook.cjs --install
node scripts/codex-island-hook.cjs --remove
```

Remove these hooks before removing or moving the plugin directory. Existing Codex sessions may require a hook reload or a new session. This integration observes only sessions where the configured hooks run. It does not provide an app-server-wide or Herdr-wide session feed.

## Outcome-based acceptance

Native QA must demonstrate all of these workflows after the last visual change:

1. Open and close Music, reverse the transition halfway, and inspect title alignment at both endpoints and during motion.
2. Check Weather, then close it and return to the pinned activity without changing playback.
3. Edit a long note while an agent event arrives. Preserve focus and content through tool switches, collapse, and restart.
4. Switch between an owned mpv player and another owned MPRIS source. Reject controls from an outdated player or track.
5. Show two meaningful minimal bodies when Music and agent attention coexist. Do not open the hub automatically.
6. Preserve last-good weather with a visible age after an offline refresh. Test manual override and declined automatic location.
7. Keep the Island below fullscreen applications and confine expansion to its owning monitor.
8. Check idle discovery, keyboard navigation, long non-English labels, missing artwork, reduced motion, light themes, and constrained display sizes.

Portable checks protect individual contracts. They do not approve the result of these workflows. Apple parity needs fresh native recordings and visual comparison, followed by the user's subjective acceptance.

## Current evidence boundary

The active desktop had a fullscreen game during implementation. No shell restart, plugin reload, summon, media control, hook installation, personal location query, or synthetic input was performed. The installed QA4 plugin remains separate from this source revision. Native rendered and interactive acceptance is outstanding.
