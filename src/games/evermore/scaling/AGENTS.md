# src/games/evermore/scaling — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).
Related skills: `alchemy-spell-mechanics` (`.agents/skills/`).

## Owns
- The radar panel's **Scaling / Alchemy** tab: damage scaling calculator and alchemy chart,
  all in `webview/` (browser-side only).

## Dependencies
- Webview assets are browser-side concatenated; no `require()`. They are excluded from all
  Node.js tooling.
- No server-side Node files in this domain (pure client-side tab).

Existing exceptions (do not add more):
- `webview/helpers.js` reads the page global `ITEM_ICONS.alchemy`, built from
  `src/games/evermore/rooms/data/item-icons.ts` and injected by `src/games/evermore/memory/render-radar.js`.
- The tab's ROM data (`readRomCharacters`) is read in `src/games/evermore/extension.js`, not here.
- `webview/alchemy-math.js` is loaded in the page's outer scope and its functions are
  called by the Docs tab (`src/games/evermore/docs-tab/docs-tab.js`).

## Invariants
- Load order is `SCALING_JS_FILES` in `src/games/evermore/memory/webview/index.js`: `alchemy-math.js` in
  the outer scope, `state.js` first, `tab-init.js` last.

## Tests
- `tests/memory/ui.test.js` — dom (vm-run page JS with scaling fixture data).
- `tests/memory/scaling-rom.test.js` — unit (synthetic ROM through `readRomCharacters`).
