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
    vanilla-index.js          — the vanilla index + room budget, cached per ROM, packaged for the tab
    room-draft.js             — blank rooms, family sheets, the family catalogue and its preview strips
    deco-catalogue.js         — the deco library: vanilla's Section 3 objects as portable, floor-free entries
    deco-preview.js           — one entry rendered on nothing, so the thumbnail is the thing not the place
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
- `map-editor-phases.js` — what a room stroke, a deco stroke and the eraser each
  write; no state of its own
- `map-editor-constructs.js` — saving and stamping a rectangle, in the portable
  `{graphic, family, flags}` form a word cannot travel in; no state of its own
- `map-editor-families.js` — the seven palette slots, the family catalogue and
  picking a tile out of one; owns `_famCatalogue` / `_famSheets` / `_brushTile`
- `map-editor-chips.js` — the family chips (art first, id second) and the
  relationship lookup; owns `_chipSel` / `_chipPreviews` / `_related`
- `map-editor-tiles.js` — the tile browser: grouped by family, ranked by what
  vanilla draws beside what, badged with the layer it belongs on
- `map-editor-deco.js` — the deco picker; owns `_deco` / `_decoFilter` /
  `_decoPage` / `_decoPreviews` / `_decoPick`
- `map-editor-special.js` — the Special tab (Stairs & Drift / Gate /
  Entrance): the catalog, the collision-word bit math for gate and drift
  (docs/map-format/map_collision_mechanics.md §4, §6 — stairs and entrance
  are UI-only, see that file's header), the tab's markup, and the filter
  bar's "special" chip + dropdown. State (`currentSpecialId`,
  `specialCells`) lives in map-editor.js's `_edit`; this file only reads and
  writes it through `editDraft()`/`editApply()`
- `map-editor-actions.js` — the toolbar's verbs, split out of the input handler
- `map-editor-paint.js` — drawing the draft on the map from the palette atlas,
  and the region maths; owns `_editSel` / `_editClip`
- `map-editor-ui.js` — tool bar (phases, tools), the docked sidebar, the metatile
  composer and the construct library; owns `_editOrigin` / `_editComposed` /
  `_editCompose` / `_editConstruct`
- `map-editor-tabs.js` — which of the dock's four tabs (Tile / Special /
  Trigger / Info) is showing, and the tab strip that switches between them;
  owns `_editActiveTab`. Renders nothing but the strip itself — see
  `map-editor-panels.js` for what each tab holds (Special's own content is
  `map-editor-special.js`'s `specialTabHtml`)
- `map-editor-panels.js` — the metrics, the checks, the needed-metatile
  read-out, and the panel column itself, filed under the active tab
  (`tileTabHtml`/`infoTabHtml`/`triggerTabHtml`); owns `_panelOpen`. The
  Trigger tab is a placeholder for this phase: it mirrors
  `tables-builder.js`'s `buildEntityTablesHtml` output rather than owning its
  own trigger-editing state — see `docs/map-editor-redesign-plan.md` Phase 4
- `map-editor-gestures.js` — capture-phase pointer and key gestures on the map,
  so nothing is intercepted while edit mode is off; owns `_editDrag`
- `map-editor-input.js` — clicks on the *chrome*, routed to what they mean, plus
  the status line and the edit toggle; owns `_editPendingNote` / `_editPanelRoom`.
  Bound **once per panel node**: `#room-detail` outlives a re-render, and a second
  handler made every toggle fire twice and cancel itself out
- `map-editor-newroom.js` — the blank-room round trip, `> everscript new map`,
  and the canvas resize grip; owns `_newRoomOpen` / `_resizing` / `_resizeKeep`
- `tables-builder.js` — entity tables, ROM script cards. `buildEntityTablesHtml`
  is called twice: once unconditionally by `detail-renderer.js` (always
  visible, browsing or editing), and once by `map-editor-panels.js`'s Trigger
  tab while editing (a placeholder mirror — see that file's note)
- `rom-header.js` — ROM header display
- `interactions.js` — zoom/pan, mouse events, click handlers
- `rom-overlay.js` — ROM view top bar; owns `_currentLayer` / `_currentOverlay`
  and renders the summary, legend and ROM data tables
- `detail-renderer.js` — `renderRoomDetail(room)` orchestrator; owns
  `_pendingTileRoom` / `_pendingTileOrigin` and the roomTiles request cycle.
  Builds the per-room filter bar (`filtersHtml`) here — it needs the header's
  own data (`hasCoordData`, `roomVanillaIdNum`, `hasIngr`) — but hands it to
  `buildRoomSvgSection` (`svg-builder.js`) to place below the canvas card,
  rather than rendering it itself under `.rd-head`
- `tab-init.js` — tab switching, area collapse, mode toggle
- `map-editor-theme.css` — the map editor's design tokens (oklch palette
  ported from `docs/map-editor-redesign-plan.md`'s design mock) plus the
  chrome for the floating tool pill (`#rg-edit-bar`), the docked filter bar
  (`#rg-outer > .rd-filters`), and the panel column's tab strip
  (`#rg-tabstrip` / `.rg-tab`). Scoped entirely under `.rg-theme`, the class
  `renderRoomDetail` puts on `#room-detail` — never touches `shared.css`, so
  the memory/scaling/docs/route tabs render unchanged. Concatenated onto
  `shared.css` in `src/memory/webview/index.js`'s `css` export, not part of
  the `ROOMS_JS_FILES` bundle (it is CSS, not JS)

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
