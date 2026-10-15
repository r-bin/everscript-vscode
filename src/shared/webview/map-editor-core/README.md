# src/shared/webview/map-editor-core — the game-neutral map editor core

Rules for agents: [AGENTS.md](AGENTS.md). Plan: [docs/architecture/one-map-editor.md](../../../../docs/architecture/one-map-editor.md).

Plain browser scripts (globals; also `module.exports` under Node for the unit test). They know no
game: an adapter (a game's editor page) says what a cell is, what a tool does and what a change means.

| File | Role |
|---|---|
| `edit-history.js` | `editHistoryCreate(apply, onChange)`: gestures as undo steps (`begin` / `record` / `end`), `undo`, `redo`, `dirty`. A change is whatever the adapter's `apply(change, 'before' \| 'after')` understands; recording does not apply it |
| `edit-session.js` | `editSessionStore(make)`: one `{model, history, ...}` per map while the page lives, `dirtyKeys`; `editNotSavedHtml(what)`: the "changes are not saved" notice both games' editors show |
| `edit-grid.js` | `editGridBind(el, {cell, scale, w, h, onDown, onMove, onUp, onHover})`: pointer strokes over square cells, with pointer capture; `editGridCell` is the pure point → cell part |
| `edit-tools.js` | `editToolsHtml(tools, active, history)`: the tool strip with Undo / Redo (needs `view-chips.js`); `editToolForKey`, `editHistoryForKey` |
| `map-editor-core.css` | the look of the notice and the history buttons, from VS Code theme tokens |

Used by the Secret of Mana map editor (`src/mana-maps/webview/editor.js`, loaded as files) and, for
the notice only so far, by the Evermore Rooms editor (bundled by `src/memory/webview/index.js`).
The Evermore editor's own history lives in its draft (`map-editor.js`, `map-editor-history.js`) and
moves onto this core one piece at a time.
