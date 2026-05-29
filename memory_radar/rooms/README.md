# rooms/ — Rooms Tab Subsystem README

## Ownership

Owns: all rooms tab server-side logic — room tree building, room content parsing, vanilla data, lua-watcher POIs, server-side HTML/JSON rendering.

Does NOT own: client-side room interactions, SVG rendering (those live in `../webview/assets/rooms/`), emulator state, memory-map state.

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

The client-side room interactions live in `../webview/assets/rooms/`:
- `bootstrap.js` — message listener, byte-script focus
- `utils.js` — escH, hexNum, tsvg, helpers
- `svg-builder.js` — `buildRoomSvgSection()` → `{html, zoomState, ...}`
- `tables-builder.js` — entity tables, ROM script cards
- `rom-header.js` — ROM header display
- `interactions.js` — zoom/pan, mouse events, click handlers
- `detail-renderer.js` — `renderRoomDetail(room)` orchestrator
- `tab-init.js` — tab switching, area collapse, mode toggle
