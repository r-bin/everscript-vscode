# src/games/terra/maps — Terranigma Maps panel

Rules for agents: [AGENTS.md](AGENTS.md). Opened by **Open Memory Radar** when the ROM chosen with **Switch ROM** is a
Terranigma ROM (the game's main view, `core/game-views.ts`; the command behind it is `everscript.openTerraMaps`).

The page is built from the shared editor shell (`src/core/map-editor/shell/`), like the Evermore Rooms tab and the
Secret of Mana Maps panel: left, the rail of rooms in groups of 64 ids, one row per picture (search by any room id);
middle, the map on the card with the pill (Select, Pick), the zoom chip, the filter bar (BG1 | BG2, Cell types, Grid)
and the status bar (cell, metatile, type); a variant bar on the card's edge when several rooms show the same map;
right, the dock with **Tile** (the layer, the metatile picker, the picked metatile's four tile words and where it is
used, the selected cell's map words) and **Info** (the room, what its load ran, its display registers, the rooms
that show the same picture). Nothing is editable yet.

| File | Role |
|---|---|
| `index.ts` | creates the panel, reads `terra://rom/{info,rooms/index,groups/index}.json`, answers the page's `terra://` reads |
| `page.ts` | the one list of stylesheets and scripts the page loads (host and tests), and filling `webview/index.html` |
| `webview/page.dom.ts` | the data, the rail, opening a room (bundled as `dist/webview/terra-maps.js`) |
| `webview/editor.dom.ts` | one room on the shell: the canvas, what is on the map, the pill, the filter bar, the pointer |
| `webview/dock.dom.ts` | the dock: Tile and Info |
| `webview/model.ts` | the room as plain data: map and tile words, metatile use, the rail, variants, the overlay (no DOM; unit-tested) |
| `webview/shell.dom.d.ts` | the shell's globals the page calls |
| `webview/style.css` | what the shell does not cover: the overlay, the picker, the dock rows |
