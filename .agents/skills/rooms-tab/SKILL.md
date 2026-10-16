---
name: rooms-tab
description: Use when touching the Rooms tab's browsing side: the room tree, data flow from .evs and the ROM, the SVG grid and coordinates, entity filters, webview layout and caches (games/evermore/rooms).
applyTo: "src/games/evermore/rooms/**"
---

# Rooms tab

The map editor inside the tab has its own rules (`map-editor-rules` skill); the room format is the
`map-format` skill. The radar panel that hosts this tab: `memory-radar` skill.

### Data flow

1. `buildRoomTree(document, wsRoot)` — builds the tree from the active document + any
   `#import`-ed `[area]` directories.
2. `collectRoomsFromDir(dir, wsRoot, depth)` — recursive; `[area]` subdirs → area nodes,
   `.evs` files → map nodes.
3. `parseRoomContent(filePath, startLine, endLine)` — extracts `initMap`, `entrances`,
   `enemies`, `objects`, `transitions` from a map block.
4. `findRoomImage(wsRoot, mapName, vanillaId)` — looks for
   `docs/rooms/images/{name}.{ext}` (then `docs/rooms/{name}.{ext}`) **in the
   workspace**.
5. `setRoomImageUris(nodes, webview)` — converts filesystem `imagePath` →
   webview-safe `imageUri` in-place after the panel is created.
6. `renderRoomsTree(nodes)` — server-side collapsible tree HTML.
7. `buildRoomsJson(tree)` — flattens map nodes into the client-side `ROOMS` JSON object.

### Tree structure

```
[{name, kind:'area', children:[...]},
 {name, vanillaId, kind:'map', filePath, relPath, startLine, endLine, content, imagePath, imageUri?}]
```

Folders named `[area] 13_town/` → area node `13_town` (strips `[area]` prefix and
leading `NN_`).

### Coordinate system

All entity coordinates in `.evs` files are **tile-based**, absolute (not relative to
camera bounds):
- `init_map(x1, y1, x2, y2)` — camera scroll bounds in tiles (sets SVG viewBox).
- `entrance(x, y, DIR)` — entrance spawn tile.
- `add_enemy(TYPE, x, y, ...)` / `add_basic_souls_enemy(TYPE, x, y)` — enemy tile
  position.

`parseEvsNum(s)` handles `0xNN` (hex), `0dNN` (decimal-explicit), and plain integers;
returns `NaN` for null/empty/unparseable. Pure, tested in `tests/memory/radar.test.js`
(or the domain's own test dir — check `tests/memory/` first).

### Webview layout

```
<div class="tab-pane" data-tab="rooms">
  <div class="rm-panels">
    <div class="rm-left rg-rail">  <!-- the rail: search, two groups, + New Map footer -->
    <div class="rm-right">         <!-- room detail: header + SVG grid + sections -->
      <div id="room-detail" class="rg-theme">
```

**The rail (Phase 7b, `rooms-rail.js` + `rooms-rail.css`)** is one list with two
collapsible groups — `VANILLA ROOMS` (the ROM catalogue, grouped by **area**, which is
the game's own structure) and `CUSTOM ROOMS` (the maps made with `+ New Map`, then the
rooms declared in the active `.evs`). There is **no Live/Vanilla mode toggle any more** and
no `_vanillaMode`: a row carries its own provenance (`data-vid` = catalogue, `data-map` +
`data-line` = source, `data-custom` = a custom map, owned by `map-editor-custom.js`), so
"which tree" is not state. **Only a ROM room is ever selected in the Vanilla group.** A
custom map borrows a donor room's graphics through its draft (`_edit.roomId`), never by
selecting that room's row. Group/area expansion lives in the DOM (`[hidden]`, `.collapsed`), not in
JS. Its only JS state is `_railQuery`. Anything that navigates to a room — the exit links
in particular — goes through `gotoVanillaRoom`, which clears the search and opens the
Vanilla group first, because a `display:none` row cannot be clicked into view.

The rail sits outside `#room-detail`, so it is outside `.rg-theme`; it carries its own
`.rg-rail` hook, which `map-editor-theme.css` declares the same tokens on.

Sections: **Entrances**, **Enemies**, **Objects**, **Transitions**. Each entity row is
`<a class="ll" data-line="N">`, posting `{command:'goToLine', line:N}` to the host.

### SVG grid

Rendered client-side in `renderRoomDetail()`:
- ViewBox `0 0 W H`: from `initMap` bounds, expanded to fit any entity outside them
  (`x2 = max(im.x2, max(entity.x+16))`, same for y). Fallback `256×256` with no data.
- Grid lines every `max(8, ceil(W/24))` tiles, `rgba(0,0,0,0.1)` stroke.
- Camera-bounds rect: `#1a6` dashed (only if `initMap` present).
- Enemies: filled circles, class `svge-enemy` — `#cc0000` static, `#cc7700` dynamic.
- Entrances: hollow circles + text label, class `svge-entrance`.
- Room image (if `imageUri` set) rendered behind the SVG via `<img class="room-img">`.

### Entity filter buttons

The mechanism is unchanged: a `<button class="rdf on" data-hide="hide-XXX">` toggles
`.on` on itself and `hide-XXX` on `#room-detail`. **The layout is not** — since Phase 7a
the ~25 toggles are not a flat wall of chips. `map-editor-filterbar.js` arranges them
as the design mock's single row: a segmented `Background | Foreground | Collision`
group, then `Triggers ▾`, `Objects ▾`, `Special ▾` and `More ▾` dropdowns, with
`edit`/`locked` kept apart as actions. Every `data-hide` key is still reachable and a
DOM test enumerates them by name, so adding a toggle means adding it to a group, not
appending a chip:
```
.hide-ent   .svge-entrance, .hide-ent   .rs-entrance   { display:none }
.hide-enem  .svge-enemy,   .hide-enem  .rs-enemies    { display:none }
.hide-obj   .rs-objects                                { display:none }
.hide-trans .rs-transitions                             { display:none }
```

### `localResourceRoots`

Webview is created with `localResourceRoots: [wsRootUri]` to load workspace images via
`webview.asWebviewUri(vscode.Uri.file(imgPath))`.

### Cache

`_radarRoomTree` / `_radarRoomDocPath` cache the tree, rebuilt only when the active
document changes; cleared in `_radarPanel.onDidDispose`.
