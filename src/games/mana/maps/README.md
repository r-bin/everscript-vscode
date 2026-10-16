# src/games/mana/maps — Secret of Mana Maps panel

Rules for agents: [AGENTS.md](AGENTS.md). Opened by **Everscript: Secret of Mana: Open Maps**
by **Open Memory Radar** when the ROM chosen with **Switch ROM** is a Mana ROM (one command for every game).

The page is the Evermore Rooms editor's, built from the same shared shell (`src/shared/webview/map-editor-shell/`):
left, the rail of areas and their maps (search, collapse); middle, the map on a card with the floating pill
(Select, Pencil, Erase, Pick, Undo, Redo) over its top edge, the zoom chip, the filter bar over its bottom edge
(BG1 | BG2 | Collision, Animate, Cuttable, Specials, Objects, Characters, Triggers, Grid) and the status bar; right, the dock with
Tile (sub-tabs Tiles — the metatile picker — and Collision), Special, Trigger (Step on, Walk into, Exits · hit, Enter), Object (Characters and Map changes) and Info
tabs, in the Evermore editor's order.
A tab keeps the chip of what it edits on and locked (Tile › Collision → Collision, Special → Specials, Trigger → Triggers,
Object › Characters → Characters, Object › Map changes → Objects); every other chip shows or hides its overlay. Zoom, pan, the resizable
rail and dock and the compact narrow-window mode are the shell's.

Like the Evermore pencil, the open tab decides what Pencil, Erase and Pick work on: a metatile (Tile › Tiles; its
collision comes with it), the collision wanted on a cell (Tile › Collision: the Evermore Collision tab's swatch cards — open, solid, four half walls — a floor level, or
the 8 px pen — right button carves), stairs / push / layer switch (Special), a character record (Object › Characters: place, move, delete; kind and position
editable, the other bytes kept) or a trigger (Trigger: the open kind — step on or walk into — is what the pencil places; move, delete, set the number, switch the kind; exits and on-hit cells and the entry event are listed on their own sub-tabs).
**What a cell is** (collision, specials, how a trigger fires) is drawn as a wish, never as bytes: `editor-props.js`
gives each wished cell a metatile with its picture and those properties — one that already fits, else a copy in a
slot the map does not use — and marks “?” where none can (8 px squares with no Mana shape, no free slot, a
step-event metatile). **Cuttable** on outlines the cells a weapon cuts; off draws them cut. **Nothing is saved**: the pill carries a
notice, and the edits last until the panel is closed (they survive opening another map).
**Map changes** are the event-flag pieces, drawn like Evermore objects (dashed area box, where each state draws,
the open state's frame) with state chips; a chip shows the map with that state (read-only). The rail has one row per room; a **variant bar** on the
card's right edge opens every map that draws the same picture (in id order), wherever the catalog lists it. Details and the reasons: [docs/architecture/multi-game.md](../../../../docs/architecture/multi-game.md).

| File | Role |
|---|---|
| `index.js` | creates the panel, reads `som://rom/{info,maps/index,areas/index}.json`, answers the page's `som://` reads |
| `page.js` | the one list of stylesheets and scripts the page loads (host and tests), and filling `webview/index.html` |
| `webview/main.js` | the data, the rail, opening a map, the view prefs |
| `webview/editor.js` | one map's sessions and page, assembled from the shell |
| `webview/editor-stage.js` | what is on the map: picture, animation, changed cells, grid, characters, object marks |
| `webview/editor-overlays.js` | the overlays that read cell properties: collision (+ drawn squares, “?”), specials, triggers, cuttable |
| `webview/editor-tools.js` | the pill, strokes (paint, erase, pick, move, carve), keys — 299 lines: one stroke dispatcher, kept whole |
| `webview/editor-dock.js` | the dock frame, Tile › Tiles, Object, Info — 266 lines: the Map changes cards are the next thing to move out |
| `webview/editor-dock-cells.js` | Tile › Collision, Special, Trigger |
| `webview/editor-model.js` | the map being edited as plain data and its changes (no DOM; unit-tested) |
| `webview/editor-props.js` | what a cell's bytes mean, the wishes and the solver (no DOM; unit-tested) |
| `webview/map-svg.js` | the collision overlay, the animation |
| `webview/style.css` | what the shell does not cover (collision colours, picker, info rows) |
