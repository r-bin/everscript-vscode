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
- `svg-builder.js` — `buildRoomSvgSection()` → `{html, zoomState, ...}`
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
