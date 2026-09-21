# rooms/ — Rooms Tab Subsystem README

## Ownership

Owns: all rooms tab server-side logic — room tree building, room content parsing, vanilla data, lua-watcher POIs, server-side HTML/JSON rendering.

Does NOT own: client-side room interactions, SVG rendering (those live in `webview/`), ROM map decoding (that is `../maps/`, a pure model), emulator state, memory-map state.

---

## Directory Map

```
rooms/
  index.js                    — Public API + backwards-compat adapters
  parsing/
    content-parser.js         — parseRoomContent(filePath, startLine, endLine) → room data object
    file-scanner.js           — buildRoomTree, collectRoomsFromDir, findRoomImage, setRoomImageUris
  rendering/
    tree-renderer.js          — renderVanillaTree(rooms), renderRoomsTree(nodes), buildRoomsJson(tree)
    tile-overlay.js           — buildRoomTileOverlay: the map raster, the canopy, and the canopy overlay
    object-previews.js        — Section 3 objects: states, thumbnails, the selection wire form
    rom-fingerprint.js        — romFingerprint(rom): the cache key every render cache shares
    metatile-palette.js       — buildRoomMetatilePalette: the dictionary atlas + one packed row per stamp
  data/
    vanilla-data.js           — VANILLA_ROOMS catalogue + buildVanillaRoomContent/Details + ROM backing
    lua-watchers.js           — getMapEnum, readLuaWatchers, readScriptAllTriggers + caches
```

---

## Public API (via index.js)

Always import rooms functionality through `rooms/index.js`, never bypass to internal files.

```js
const {
  parseRoomContent,
  findRoomImage,
  collectRoomsFromDir,
  buildRoomTree,        // adapted: injects deps automatically
  setRoomImageUris,
  renderVanillaTree,    // adapted: injects VANILLA_ROOMS automatically
  renderRoomsTree,
  buildRoomsJson,
  VANILLA_ROOMS,
  getMapEnum,
  readLuaWatchers,
  readScriptAllTriggers,
  buildVanillaRoomContent,
  buildVanillaRoomDetails,
  invalidateRoomDataCaches
} = require('./rooms');
```

---

## State Owned (module-local)

| State | File | Notes |
|---|---|---|
| Lua watcher POI cache | `lua-watchers.js` | Invalidated by `invalidateLuaWatcherCaches()` |
| Vanilla data cache | `vanilla-data.js` | Invalidated by `invalidateVanillaDataCaches()` |
| Room tree cache | `extension.js._radarRoomTree` | Rooms module is STATELESS; cache owned by caller |

---

## Dependency Rules

```
content-parser.js  → fs, parseEvsNum (radar-utils)
file-scanner.js    → fs, path, readPngDimensions (rom-readers), content-parser.js
                    receives deps: {getMapEnum, readScriptAllTriggers, readLuaWatchers, readRomMapHeader}
tree-renderer.js   → radarEsc (radar-utils), buildRoomsJson pure transform
lua-watchers.js    → fs, path, rom-readers.js
vanilla-data.js    → fs, path, rom-readers.js
index.js           → all of above + injects deps
```

**Forbidden:**
- `rooms/` → `extension.js` (no upward call)
- `rooms/` → `debugger/`
- `rooms/` → `code_highlighter/`
- `rooms/` → `vscode` (pure server-side logic)

---

## Data Flow

```
buildRoomTree(doc, wsRoot, extCfg, deps)
  ↓ collectRoomsFromDir(dir, wsRoot, depth)
      → parseRoomContent(filePath, startLine, endLine)  [per .evs file]
      → readRomMapHeader(wsRoot, mapId)                 [per map]
      → readScriptAllTriggers(wsRoot, mapName)          [per map]
      → readLuaWatchers(wsRoot, mapName)                [per map]
  ↓ setRoomImageUris(nodes, webview)                    [after panel created]
  ↓ renderRoomsTree(nodes)                              → HTML string
  ↓ buildRoomsJson(tree)                                → JSON object
```

---

## Key Invariants

1. `content-parser.js` is pure: takes file path + line range, returns data — no side effects.
2. `file-scanner.js` uses explicit deps injection — no direct requires of rom-readers/lua-watchers.
3. `buildRoomsJson` flattens the tree to `{ mapName: { content, romHeader, ... } }`.
4. `renderVanillaTree` and `renderRoomsTree` return HTML strings — no DOM operations.
5. `index.js` bridges old no-arg API (used by `extension.js`) to new dep-injected API.

---

## Client-Side Counterpart

The client-side room interactions live in `webview/`, concatenated into one
script by `memory/webview/index.js` (`ROOMS_JS_FILES` fixes the order):
- `bootstrap.js` — message listener, byte-script focus
- `utils.js` — escH, hexNum, tsvg, helpers
- `svg-spawns.js` — `buildSpawnLayers()` → `{behind, front, marks}`: the NPCs
  a room can place, split by whether the game draws them over the foreground
- `svg-builder.js` — `buildRoomSvgSection()` → `{html, zoomState, ...}`; stacks
  map → spawns behind → canopy → spawns in front → canopy overlay → annotation
- `metatile-palette.js` — the Tile palette section; owns `_mtPalette` / `_mtLayer` /
  `_mtFilter` / `_mtSelected` and the `requestRoomMetatiles` cycle
- `map-editor.js` — the edit draft, undo stack and export shape; owns `_edit`.
  Deliberately DOM-free, which is what makes `tests/memory/map-editor.test.js`
  possible
- `map-editor-paint.js` — drawing the draft on the map from the palette atlas,
  and the region maths; owns `_editSel` / `_editClip`
- `map-editor-ui.js` — tool bar (phases, tools), the docked sidebar, the metatile
  composer and the construct library; owns `_editOrigin` / `_editComposed` /
  `_editCompose` / `_editConstruct`
- `map-editor-panels.js` — the metrics, checks, family slots, grouped tile list
  and needed-metatile read-outs; owns `_famOpen` / `_famSheet` / `_panelOpen`
- `map-editor-input.js` — capture-phase pointer and key gestures, so nothing is
  intercepted while edit mode is off
- `map-editor-newroom.js` — the blank-room round trip, split out to keep
  `map-editor-input.js` under the size limit
- `tables-builder.js` — entity tables, ROM script cards
- `rom-header.js` — ROM header display
- `interactions.js` — zoom/pan, mouse events, click handlers
- `rom-overlay.js` — ROM view top bar; owns `_currentLayer` / `_currentOverlay`
  and renders the summary, legend and ROM data tables
- `detail-renderer.js` — `renderRoomDetail(room)` orchestrator; owns
  `_pendingTileRoom` / `_pendingTileOrigin` and the roomTiles request cycle
- `tab-init.js` — tab switching, area collapse, mode toggle

Because the files share one scope, a global belongs to exactly one of them.
`rom-overlay.js` owns the view state; `detail-renderer.js` owns the request
state. Do not mirror either into the other.

## Loot icons

A B-trigger's ingredient icon is looked up by name. Live rooms name their
triggers in the source; vanilla rooms have no names, so the name comes from
the reward `src/script/` read out of the ROM script. `trigIngrName()` in
`webview/utils.js` owns that choice — source name first, decoded reward
second — so both paths go through one renderer.

The icon map names more ingredients than the assets folder ships, so the host
passes the directory listing as `INGR_FILES` and a missing file falls back to
its emoji rather than drawing an empty box.

## Exits

`src/script/` reads a script's `CHANGE MAP` destinations, so a door trigger
shows where it leads. The link navigates by pressing the Vanilla mode button
and clicking that room's tree entry, rather than duplicating the selection
logic — one place owns highlight, mode and render. All 605 exits in the ROM
land on a room the catalogue lists, so no link is dead.

## Clicking the map

A plain left click selects: it highlights the shape and the matching row.
**Cmd/ctrl-click also jumps** — scrolls that row or script card into view.
Browser rules, and it keeps the panel from lurching every time you point at
something. Cmd-click on a live entity with a source line still goes to the
code; that handler stops propagation, so the two never both fire.
