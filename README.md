# Omarchy Island

Omarchy Island is an independent Quattro shell plugin for live activities in the Omarchy quickbar. Its plugin ID is `luinbytes.island`. It runs inside the existing shell process and requires no Omarchy source patches or fork.

## Current status

The activity foundation is implemented. It includes deterministic activity selection, interruption, expiry, screen targeting, symbolic actions, and a plugin-owned broker and service. The bar widget is currently hidden and reserves no space.

The visible renderer, animations, and live activity publishers are not implemented yet. Installing this development version will not display a Dynamic Island. Linux runtime and visual QA remain outstanding.

## Try the development branch

Use an Omarchy Quattro installation that supports shell plugins. The compatibility reference is commit `f99d33a8ddee7b36509a71a6d20d5d23355ce8b1`; older Omarchy versions without this plugin API are unsupported.

Clone this branch into a new directory under Omarchy's user plugin directory:

```bash
git clone --branch feature/quattro-integration --single-branch \
  https://github.com/luinbytes/omarchy-dynamic-island.git \
  "$HOME/.config/omarchy/plugins/luinbytes.island"
cd "$HOME/.config/omarchy/plugins/luinbytes.island"
node scripts/verify-scaffold.mjs
omarchy plugin validate .
omarchy-shell shell rescanPlugins
omarchy plugin enable luinbytes.island
```

Use a disposable Omarchy session for development QA. If the destination already exists, inspect its branch and local changes before updating it. The manifest belongs at this repository's root; do not copy files into `/usr/share/omarchy` or patch `shell.qml`.

To disable the plugin:

```bash
omarchy plugin disable luinbytes.island
```

The normal `omarchy plugin add` command clones the repository's default branch. Use the explicit branch clone above until this development branch is merged.

## Verify

Run the portable checks from this repository:

```bash
node scripts/verify-scaffold.mjs
```

The [verification guide](.codex/skills/verify-omarchy-island/SKILL.md) describes optional QML checks and disposable-session QA. Portable tests do not prove shell startup or rendering.

## Development scope

All plugin source, tests, documentation, and delivery belong in this repository on `feature/quattro-integration`. Upstream Omarchy checkouts are read-only compatibility references. The earlier upstream integration proposal is superseded.

- [Architecture](docs/scaffold-architecture.md)
- [Plugin delivery plan](docs/omarchy-island-delivery-plan.md)
- [Historical design research](docs/omarchy-island-research-and-implementation-plan.md)
