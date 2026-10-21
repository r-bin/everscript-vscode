# src/games/terra/maps — Terranigma Maps panel

Rules for agents: [AGENTS.md](AGENTS.md). Opened by **Open Memory Radar** when the ROM chosen with **Switch ROM** is a
Terranigma ROM (the game's main view, `core/game-views.ts`; the command behind it is `everscript.openTerraMaps`).

The page is built from the shared editor shell (`src/core/map-editor/shell/`), like the Evermore Rooms tab and the
Secret of Mana Maps panel: left, the rail of rooms in groups of 64 ids, one row per picture (search by any room id);
middle, the map on the card with the pill (Select, Pick), the zoom chip, the filter bar (BG1 | BG2, Cell types,
Collision, Objects, Triggers, Grid) and the status bar (cell, metatile, type, the exit, chest or map change under the
pointer); a variant bar on the
card's edge when several rooms show the same map; right, the dock with **Tile** (the layer, the metatile picker, the
picked metatile's four tile words and where it is used, the selected cell's map words), **Collision** (the room's cell
types as swatches, what one does to a move in each direction, the selected cell's type), **Object** (the room's map
changes; the picked one is shown applied — the picture `<hex>.c<k>.png` and the cells the overlays read), **Trigger**
(Exits: the selected one's rectangle and targets with a button to open each; Chests: cell, contents, opened flag) and
**Info** (the room, what its load ran, its display registers, the rooms that show the same picture). The Collision,
Object and Trigger tabs turn their chip on while open; a click on an exit, a chest or a map change's cells selects it.
Leaving the Object tab shows the room as it loads again. Nothing is editable yet.

| File | Role |
|---|---|
| `index.ts` | creates the panel, reads `terra://rom/{info,rooms/index,groups/index,cell-types}.json`, answers the page's `terra://` reads |
| `page.ts` | the one list of stylesheets and scripts the page loads (host and tests), and filling `webview/index.html` |
| `webview/page.dom.ts` | the data, the rail, opening a room (bundled as `dist/webview/terra-maps.js`) |
| `webview/editor.dom.ts` | one room on the shell: the canvas, the picture (with a map change applied), the pill, the filter bar, the pointer |
| `webview/overlays.dom.ts` | what is drawn over the picture (cell types, collision, map changes, exits and chests, grid) and which chip shows it |
| `webview/dock.dom.ts` | the dock: Tile, Collision, Object, Trigger and Info |
| `webview/model.ts` | the room as plain data: map and tile words, metatile use, the rail, variants, the overlays, cell types, exits, chests and map changes in words, a room with a change applied (no DOM; unit-tested) |
| `webview/shell.dom.d.ts` | the shell's globals the page calls |
| `webview/style.css` | what the shell does not cover: the overlays, the picker, the dock rows |
