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
- The page loads the shared pieces from `src/shared/webview/` (`map-view/`, `map-editor-core/`,
  `map-editor-shell/`) by file path — the same files the Evermore Rooms tab uses.

## Invariants
- The page is the shared editor shell (`src/shared/webview/map-editor-shell/`), the same files the Evermore
  Rooms tab runs on: frame, rail, name line, canvas card with the floating pill, filter bar, status bar, dock
  with its tab strip, layout, zoom and pan. Do not rebuild a piece here: parametrise it in the shell, or leave
  the feature out until it can be shared. `style.css` holds only what the shell does not cover (collision
  colours, the picker, the info rows, overlay marks) and uses the shell's tokens.
- The rail lists one row per picture (a room) by area; clicking one opens the area's own map. The other maps that
  draw that picture are its variants (catalog `pictures`, any area): they have no row, a variant open keeps its room's
  row selected (`rowFor` in main.js). Dock tabs: Tile (sub-tabs **Tiles** — the
  metatile picker — and **Collision**), Special (stairs, push, layer switch), Object (sub-tabs **Characters** — the 8-byte records, enemies and people together — and **Map changes** — the
  event-flag pieces as Evermore-style cards with state chips), Trigger (step on / walk into; exits and on-hit cells), Info.
- Every filter chip shows or hides its overlay. A tab that edits an overlay keeps its chip on and locked
  (`manaForcedBy` in editor.js); nothing else may force a chip. The animation is played inside `#rg-px` (pixels),
  right after the picture — on the svg root it lands in the 8 px viewBox units, 8× too big (the v0.212 bug). A variant bar on the card's right
  edge (the shell's side bar, the level bar's twin) opens the maps that draw the same picture.
- Only characters are circles (one ring with a count per cell). Map objects are drawn with the Evermore object
  marks (`rg-obj-area`, `rg-obj-subframe`, `rg-obj-frame`, in the shell's CSS, in 8 px units: the stage's viewBox
  is in those units and the pixel-sized content is in a `scale(1/8)` group). Map changes are read-only: a state is
  a view (`pieceState` in the model), not an edit, and does not count as a change. Pill: Select, Pencil, Erase, Pick, Undo, Redo. Like the Evermore pencil, the open tab
  decides what Pencil / Erase / Pick work on (a metatile, an object, a step event).
- **Nothing the editor changes is saved or written anywhere**; the pill's notice says so while a map has
  changes. Edits live in `manaEdSessions` (one per map) until the page closes. Write-back and "play my edited
  map" need Mana's map re-encoded and are deliberately not built
  ([docs/architecture/one-map-editor.md](../../docs/architecture/one-map-editor.md)).
- Collision is per metatile in Mana, never per cell. The user draws what a cell should be (collision, specials,
  how its trigger fires) as a *wish*; `editor-props.js` solves wishes into metatiles: one with the same picture
  and bytes, else a copy (every byte kept, only the wished fields changed) in a slot the map does not use — never
  0, never a step-event metatile, never a cut result. Where nothing fits the cell keeps its own and is marked “?”:
  never round a drawing to a shape Mana does not have. On one byte (c2) the last wish drawn wins. Step events and
  objects are edited as lists; only the fields documented in `docs/mana/README.md` are editable, every other
  byte is kept as read.
- History, sessions and the "not saved" notice are the core's (`src/shared/webview/map-editor-core/`).
  Changed cells are drawn from the metatile sheets (no BG priority, no colour math) over the real picture, as
  SVG inside the one `#rg-svg` the shell zooms and pans.
- Maps are SVGs sized by the shell (zoom-pan.js); never scale map pictures with CSS (VS Code's default
  `img { max-width:100% }` squashed them).
- Page code lives in `webview/*.{html,js,css}`: `main.js` data, rail and opening a map; `editor.js` the sessions
  and the page; `editor-stage.js` what is on the map; `editor-tools.js` the pill, strokes and keys;
  `editor-dock.js` the tabs; `editor-model.js` the editable data (no DOM, unit-tested); `map-svg.js` collision /
  special overlays and the animation. `page.js` is the one list of files the page loads (host and tests share
  it); the host fills only URIs, the CSP nonce and the `#init` JSON data block.
- `everscript.openMemoryRadar` opens this panel instead of the radar when `everscript.romPath` is a Secret of
  Mana ROM (wired in `extension.js`).

## Tests
- `tests/mana/mana-panel-dom.test.js` — the page in headless Chromium with a stub host: the shell's frame,
  rail, pill, tabs, filter bar, overlays (unit tier; skips without playwright).
- `tests/mana/mana-map-editor-dom.test.js` — the editor page, same harness (`tests/mana/panel-page.js`):
  paint, drag, undo/redo, objects, triggers, the session, the notice.
- `tests/mana/mana-editor-core.test.js` — the core and `editor-model.js` (unit).
- `tests/mana/mana-editor-props.test.js` — cell properties and the solver (unit).
- `tests/mana/mana-editor-cells-dom.test.js` — every chip, the forced chips, Tile › Collision, Special, Trigger kinds.
- `tests/mana/mana-rom.test.js` — `edit.json` and the sheets against the library (needs the ROM).
