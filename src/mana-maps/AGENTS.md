# src/mana-maps — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). The Secret of Mana Maps panel.
What the folder does: [README.md](README.md).

## Owns
- The panel lifecycle (`index.js`, one panel at a time) and its page (`webview/`).
- Webview state: selected area/map, zoom and view toggles (`webview/main.js`, `vscode.setState`).

## Dependencies
- Reads Mana data only through `som://` (`vscode.workspace.fs`; pictures via
  `asWebviewUri`, JSON via the page's `read` message). Never `require`s `mana/`,
  `mana-resources/` or any Evermore domain (`.depcruise.js` `mana-maps-reads-som-only`).
- The page loads the shared map-view pieces from `src/shared/webview/map-view/` (chips,
  their CSS, the tile-animation player) — the same files the Evermore Rooms tab uses.

## Invariants
- Two views. The overview: area list on the left, pictures in the middle, a filter bar of view
  toggles (BG1 | BG2 | Collision, Animate, Specials, Objects, zoom). The editor, opened by a map's
  Edit button (`editor.js`): tools Paint / Erase / Pick / Objects / Triggers, undo/redo, a metatile
  picker and an inspector. A view feature Evermore has and Mana supports uses the shared piece;
  one Mana lacks (cuttable tiles) is not shown.
- **Nothing the editor changes is saved or written anywhere**; the page says so while a map has
  changes. Edits live in `manaEdSessions` (one per map) until the page closes. Write-back and
  "play my edited map" need Mana's map re-encoded and are deliberately not built
  ([docs/architecture/one-map-editor.md](../../docs/architecture/one-map-editor.md)).
- Collision is per metatile in Mana, never per cell: painting a metatile changes picture and
  collision together; there is no free collision brush (it would invent data the game does not
  have). Step events and objects are edited as lists; only the fields documented in
  `docs/mana/README.md` are editable, every other byte is kept as read.
- The editor is built on the game-neutral core `src/shared/webview/map-editor-core/` and holds no
  history/session logic of its own. Changed cells are drawn from the metatile sheets (no BG
  priority, no colour math) over the real picture.
- Maps are SVGs sized by width/height attributes; never scale map pictures with CSS
  (VS Code's default `img { max-width:100% }` squashed them).
- A figure loads its picture, overlays and animation only when scrolled into view.
- Page code lives in `webview/*.{html,js,css}` (`main.js` overview and state, `map-svg.js` one
  map's SVG and overlays, `editor-model.js` the editable data (no DOM, unit-tested),
  `editor.js` the editor page); the host fills only URIs, the CSP
  nonce and the `#init` JSON data block.
- `everscript.openMemoryRadar` opens this panel instead of the radar when
  `everscript.romPath` is a Secret of Mana ROM (wired in `extension.js`).

## Tests
- `tests/mana/mana-panel-dom.test.js` — the overview page in headless Chromium with a stub host
  (unit tier; skips without playwright).
- `tests/mana/mana-map-editor-dom.test.js` — the editor page, same harness (`tests/mana/panel-page.js`):
  paint, drag, undo/redo, objects, triggers, the session, the notice.
- `tests/mana/mana-editor-core.test.js` — the core and `editor-model.js` (unit).
- `tests/mana/mana-rom.test.js` — `edit.json` and the sheets against the library (needs the ROM).
