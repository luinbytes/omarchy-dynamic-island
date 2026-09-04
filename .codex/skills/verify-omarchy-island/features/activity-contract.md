# Activity contract

The pure reducer handles publication, revision replacement, primary and secondary selection, screen targeting, transient restoration, expiry, expansion, collapse, removal, and symbolic invocation.

Run `node test/island/run-activity-model.js` for portable cases and `node scripts/verify-scaffold.mjs` for the package gate.

The plugin service owns state and time. Its local broker owns neither. The reducer never reads clocks or runtime objects.

For runtime proof, use the opt-in fixture in a disposable session as described in [the verification guide](../SKILL.md). Portable success does not prove QML loading or timer behavior.
