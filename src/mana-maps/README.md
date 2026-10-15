# src/mana-maps — Secret of Mana Maps panel

Rules for agents: [AGENTS.md](AGENTS.md). Opened by **Everscript: Secret of Mana: Open Maps**
(`everscript.openManaMaps`), or by **Open Memory Radar** when `everscript.romPath` is a Mana ROM.

Left: the areas (Potos Falls, Potos, …, then "Other maps"), each expandable to its map ids.
Middle: the chosen area's pictures side by side (maps that draw the same picture are shown
once, captioned with all their ids), or one map. Filter bar (shared with the Rooms tab's):
BG1 | BG2 | Collision, Animate, Specials, Objects, and zoom. Objects rings each object
record's cell and labels it with its kind word. Collision tints walls and half walls
red, level-1 floors blue, floors of both levels amber and marks level switches; Specials
outlines special cells with their kind byte; Animate plays the game's own animation.

Each figure has an **Edit** button: it opens the map in the editor. Tools: Paint (the picked
metatile; collision comes with it), Erase (metatile 0), Pick, Objects (place, move, delete; kind and
position editable, the other bytes kept), Triggers (add, move, delete step events, set the event
number); Edit A / Edit B chooses the layer; Undo / Redo (Ctrl+Z / Ctrl+Shift+Z). **Nothing is saved**:
a notice says so, and the edits last until the panel is closed (they survive going back to the maps).
Details and the reasons: [docs/architecture/one-map-editor.md](../../docs/architecture/one-map-editor.md).

| File | Role |
|---|---|
| `index.js` | creates the panel, reads `som://rom/{info,maps/index,areas/index}.json`, hands the page the editor core's files |
| `webview/editor-model.js` | the map being edited as plain data: layers, objects, step events, the changes (no DOM; unit-tested) |
| `webview/editor.js` | the editor page: stage (picture, changed cells, overlays), tools, picker, inspector |
| `webview/index.html` | page shell (CSP, `#init` data) |
| `webview/main.js` | area list, filter bar, which maps show, lazy loading, persisted state |
| `webview/map-svg.js` | one map's SVG, collision and special overlays, starting its animation |
| `webview/style.css` | layout with VS Code theme colours |
