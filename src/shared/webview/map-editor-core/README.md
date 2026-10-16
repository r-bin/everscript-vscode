# src/shared/webview/map-editor-core — the game-neutral editor core

Rules for agents: [AGENTS.md](AGENTS.md). Plan: [docs/architecture/multi-game.md](../../../../docs/architecture/multi-game.md).
The page around it (frame, rail, canvas card, pill, dock, layout, zoom/pan) is the sibling
[map-editor-shell](../map-editor-shell/README.md).

Plain browser scripts (globals; also `module.exports` under Node for the unit test). They know no
game: an adapter (a game's editor page) says what a cell is, what a tool does and what a change means.

| File | Role |
|---|---|
| `edit-history.js` | `editHistoryCreate(apply, onChange)`: gestures as undo steps (`begin` / `record` / `end`), `undo`, `redo`, `dirty`. A change is whatever the adapter's `apply(change, 'before' \| 'after')` understands; recording does not apply it |
| `edit-session.js` | `editSessionStore(make)`: one `{model, history, ...}` per map while the page lives, `dirtyKeys`; `editNotSavedHtml(what)`: the "changes are not saved" notice both games' editors show |
| `edit-tools.js` | `editToolForKey(tools, ev)`, `editHistoryForKey(ev)`: which tool a letter selects, Ctrl+Z / Ctrl+Shift+Z |
| `map-editor-core.css` | the look of the notice, from VS Code theme tokens |

Used by the Secret of Mana editor (`src/games/mana/maps/webview/`, loaded as files) and, for the notice only
so far, by the Evermore Rooms editor (bundled by `src/memory/webview/index.js`). The Evermore editor's own
history lives in its draft (`map-editor.js`, `map-editor-history.js`) and moves onto this core later.
