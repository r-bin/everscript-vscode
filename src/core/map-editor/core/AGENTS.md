# src/core/map-editor/core — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2), part of `src/shared`. What it does: [README.md](README.md).

## Owns
- What every map editor needs whatever the game and that is not page chrome: undo/redo history,
  per-map sessions, the "not saved" notice, the tool and history key bindings. Page chrome is the
  sibling `map-editor-shell`.

## Dependencies
- Nothing: no imports from `src/` outside this folder (`.depcruise.js` `map-editor-core-is-game-neutral`).

## Invariants
- No game's words here: no tile families, metatiles, collision bits, ROM, rooms. If a piece needs
  one, it belongs in that game's adapter. A piece moves in here only when both games need it with
  the same meaning.
- `edit-history.js`: `record` stores a change, it never applies it — the caller already did, and
  `apply` is only used for undo/redo.
- Nothing is persisted here. Whether an editor saves anything is the adapter's rule.
- Plain scripts: top-level `function`/`var` globals, no modules, no `vscode`, no DOM in
  `edit-history.js` / `edit-session.js` (they are unit-tested under Node).

## Tests
- `tests/mana/mana-editor-core.test.js` (unit); `tests/mana/mana-map-editor-dom.test.js` (the pieces in
  a real page, headless Chromium); `tests/memory/map-editor-dom.test.js` loads `edit-session.js` with the Rooms bundle.
