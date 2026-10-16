# src/games/evermore/docs-tab — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).
Related skills: `alchemy-spell-mechanics` (`.agents/skills/`).

## Owns
- The radar panel's **Docs** and **RNG** tabs: `render-docs-tab.js` (host-side HTML,
  `buildDocsTabHtml`, `buildRngTabHtml`), `docs-tab.js` and `rng-tab.js` (page scripts).

## Dependencies
- No imports from other `src/` domains (pure rendering functions).
- Webview assets (`docs-tab.js`, `rng-tab.js`) are browser-side; excluded from typecheck/knip.

Existing exceptions (do not add more):
- `docs-tab.js` calls the Rooms tab's page global `escH` (`src/games/evermore/rooms/webview/utils.js`).
- `docs-tab.js` calls the Scaling tab's `alchemy-math.js` globals
  (`alchemyDamageFromPower`, `alchemyDamageSamples`, `alchemyRangeAtLevel`,
  `alchemySpellBonusBaseAtLevel`, `alchemySpellPowerAtLevel`, `effectiveMdef`).

## Invariants
- `render-docs-tab.js` builds HTML by string concatenation, a §3.5 legacy form; do not add
  to it.

## Tests
- `tests/memory/ui.test.js` — dom (Docs HTML structure and calculators, RNG tab pane).
