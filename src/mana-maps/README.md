# src/mana-maps — Secret of Mana Maps panel

Rules for agents: [AGENTS.md](AGENTS.md). Opened by **Everscript: Secret of Mana: Open Maps**
(`everscript.openManaMaps`), or by **Open Memory Radar** when `everscript.romPath` is a Mana ROM.

The page is the Evermore Rooms editor's, built from the same shared shell (`src/shared/webview/map-editor-shell/`):
left, the rail of areas and their maps (search, collapse); middle, the map on a card with the floating pill
(Select, Pencil, Erase, Pick, Undo, Redo) over its top edge, the zoom chip, the filter bar over its bottom edge
(BG1 | BG2 | Collision, Animate, Specials, Objects, Triggers, Grid) and the status bar; right, the dock with
Tile (the metatile picker, collision of the picked one), Object, Trigger and Info tabs. Zoom, pan, the resizable
rail and dock and the compact narrow-window mode are the shell's.

Like the Evermore pencil, the open tab decides what Pencil, Erase and Pick work on: a metatile (Tile; its
collision comes with it), an object (Object: place, move, delete; kind and position editable, the other bytes
kept) or a step event (Trigger: add, move, delete, set the number). **Nothing is saved**: the pill carries a
notice, and the edits last until the panel is closed (they survive opening another map).
Details and the reasons: [docs/architecture/one-map-editor.md](../../docs/architecture/one-map-editor.md).

| File | Role |
|---|---|
| `index.js` | creates the panel, reads `som://rom/{info,maps/index,areas/index}.json`, answers the page's `som://` reads |
| `page.js` | the one list of stylesheets and scripts the page loads (host and tests), and filling `webview/index.html` |
| `webview/main.js` | the data, the rail, opening a map, the view prefs |
| `webview/editor.js` | one map's sessions and page, assembled from the shell |
| `webview/editor-stage.js` | what is on the map: picture, animation, changed cells, grid, overlays |
| `webview/editor-tools.js` | the pill, strokes (paint, erase, pick, move), keys |
| `webview/editor-dock.js` | the dock's four tabs |
| `webview/editor-model.js` | the map being edited as plain data and its changes (no DOM; unit-tested) |
| `webview/map-svg.js` | collision and special overlays, the animation |
| `webview/style.css` | what the shell does not cover (collision colours, picker, info rows) |
