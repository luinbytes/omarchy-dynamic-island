# Omarchy Island

This repository ships an independent Omarchy Quattro user plugin with ID `luinbytes.island`.

- Keep source, tests, documentation, commits, and pushes in `luinbytes/omarchy-dynamic-island` on the current task branch.
- Keep `manifest.json` at the repository root for the standard plugin installer.
- Own the broker and activity state inside the plugin. Do not require custom host properties.
- Treat any Omarchy checkout as a read-only compatibility reference. Do not fork Omarchy, patch its source, or push plugin work into an Omarchy repository.
- The research document's first-party integration proposal is historical and superseded by the plugin delivery plan.
- Run `node scripts/verify-scaffold.mjs` after source changes. Use `.codex/skills/verify-omarchy-island/SKILL.md` for optional runtime QA.
- State plainly that the renderer and live publishers remain unfinished. Do not treat portable tests as QML runtime proof.
