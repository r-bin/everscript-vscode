# src/games/terra/maps — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). The Terranigma Maps panel. What it does: [README.md](README.md).

## Owns
- The panel lifecycle (`index.ts`, one panel at a time) and its page (`webview/`).
- Webview state: the open room and the view prefs (`page.dom.ts`, `vscode.setState`).

## Dependencies
- Reads Terranigma data only through `terra://` (`vscode.workspace.fs`; pictures via `asWebviewUri`, JSON via the
  page's `read` message). Never imports the decoder or `resources/` (rule `terra-maps-reads-terra-only`).
- The page loads the shared shell (`src/core/map-editor/shell/`, `view/view-chips.js`) and `src/core/webview/` CSS
  by file path — the same files the other games' editors run on. Do not rebuild a shell piece here: parametrise it
  in the shell, or leave the feature out until it can be shared.

## Invariants
- Page code is TypeScript: DOM files are `*.dom.ts` (type-checked by `tsconfig.webview.json`, excluded from the host
  build, bundled by `tools/bundle-pages.mts`); pure logic is `model.ts` (host build, unit-tested).
- `#room-detail` outlives every room: the pill / filter-bar click handler is removed in the editor's `close()`, the
  dock's is bound once per dock node (`webview-dom-safety` §1).
- Pictures are SVG `<image>`s sized by the shell (one svg unit = 8 px; pixel content in `#rg-px`, scaled 1/8);
  never scale them with CSS.
- The page says what is a guess: a room drawn after the rooms before it (Info › ROOM), what is not drawn (Info), what
  the cell types mean (not decoded).
- Read-only: nothing changes a room. Editing would follow the Mana panel's model (`edit-history`, sessions, "not saved").

## Tests
- `tests/terra/terra-maps-model.test.mts` (unit), `tests/terra/terra-maps-dom.test.mts` (dom: the real page with the ROM).
