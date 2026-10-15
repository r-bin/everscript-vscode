# src/shared/webview/map-editor-shell — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2), part of `src/shared`. What it does: [README.md](README.md).

## Owns
- The editor page chrome both games share: frame, rail, name line, canvas column, pill, status bar, dock,
  tab strip, layout, zoom and pan, and their stylesheets. A look or a behaviour of the page lives here once.

## Dependencies
- Nothing: no imports from `src/` outside this folder (`.depcruise.js` `map-editor-shell-is-game-neutral`).
  `frame.js` is also `require`d by the Rooms host (`rooms/rendering/tree-renderer.js`, `memory/render-radar.js`).

## Invariants
- No game's words here: no rooms, families, metatiles, collision bits, ROM. A page passes content in; a hook
  (`shellPrefSaver`, `railExtraHaystack`, `describe`, `onSelect`, a unit of 8 px) carries anything game-shaped.
- The Evermore editor must run on every piece here (its tests prove it): do not fork a piece for one game —
  parametrise it, or leave the feature out of the other page until it can be shared.
- Classes before ids in stylesheets (`.rg-edit-bar`, not `#rg-edit-bar`); the ids stay in the markup for scripts.
- A page's own look goes in its own stylesheet and uses the tokens; do not restyle a shell class per game.
- `frame.js` builders return strings and touch no DOM (they run under Node); only `shellDockMount` /
  `shellDockUnmount` use `document`.

## Tests
- `tests/memory/map-editor-dom.test.js`, `rooms-rail-dom.test.js`, `rooms-layout.test.js`, `map-editor.test.js`
  (the Evermore editor on these files); `tests/mana/mana-panel-dom.test.js`, `mana-map-editor-dom.test.js` (the
  Mana page); `tests/mana/mana-editor-dom.test.js` (converted rooms in the Rooms tab).
