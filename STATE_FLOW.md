# State Flow Map — Everscript VS Code Extension

> Authoritative reference for state ownership and data flow.
> When you're unsure who owns a piece of state — check here first.

---

## 1. State Ownership Table

| State | Owner File | Type | Notes |
|---|---|---|---|
| `_radarPanel` | `extension.js` | VS Code WebviewPanel | Single singleton |
| `_radarPinned` | `extension.js` | bool | Panel pin state |
| `_radarDoc` | `extension.js` | VS Code TextDocument | Last rendered doc |
| `_radarCurrentScope` | `extension.js` | string | Last scope name |
| `_radarMapCache` | `extension.js` | object | Parsed `.github/memory-map.md` |
| `_radarEnumCache` | `extension.js` | Map | addr → [{cls,name}] |
| `_radarUpdateTimer` | `extension.js` | timer | Debounce (400/600ms) |
| `_radarRoomTree` | `extension.js` | array | Built per-document |
| `_radarActiveTab` | `extension.js` | string | 'radar'/'rooms'/etc. |
| `_scalingChars` | `extension.js` | array | 142 character stat entries |
| `_hitLookup` | `extension.js` | object | Precomputed hit% table |
| `_scaleActive` | `extension.js` | bool | scale_enemies in workspace |
| `_ingrBaseUri` | `extension.js` | string | Webview URI for ingredient images |
| `_radarByteScriptFocus` | `extension.js` | string | Emulator→Radar focus |
| zoom/pan | `detail-renderer.js` (webview) | local | Per-render, not persisted |
| selection | `interactions.js` (webview) | local | Per-render, not persisted |
| filter toggles | `interactions.js` (webview) | local | DOM class toggles |
| room rail search | `rooms-rail.js` (webview) | `_railQuery` | Client-side only. Replaced `tab-init.js`'s `_vanillaMode` in Phase 7b: the rail is one list with two collapsible groups now, not two trees swapped by a mode button, so "which tree" is no longer state — a row says which it came from (`data-vid` vs `data-map`). Group/area expansion is not mirrored into JS either: it lives in the DOM (`[hidden]` on a group body, `.collapsed` on an area), and a search never writes it — `.rm-searching` force-reveals through CSS for the duration instead, so clearing the field restores what the user had open |
| byte script focus | `bootstrap.js` (webview) | `_currentByteScriptFocus` | Updated via message |
| emulator ROM state | `debugger/emulator/panel.js` | local | Per-panel |
| map editor active tab | `map-editor-tabs.js` (webview) | `_editActiveTab` | `'tile'\|'special'\|'trigger'\|'widgets'\|'info'` (the design mock's own order; Phase 5 shipped Widgets last by mistake, Phase 7a corrected it); gates what `map-editor-panels.js`'s `renderEditPanels()` builds into `#rg-panels` (Widgets routes to `map-editor-deco.js`'s `widgetsTabHtml`, Phase 5). The rest of the map-editor's dock/gesture/palette state (`_panelOpen`, `_editOrigin`, `_editCompose`, `_mtPalette`, …) predated this table until Phase 6 — see the backfill block below the ownership table |
| Widgets tab "Ready only" toggle | `map-editor-deco.js` (webview) | `_decoFlags.works` | Not new state — the Widgets tab's toggle and the picker's own "works" filter chip read/write the same boolean (`d.scriptId !== null`) through the same `data-deco-flag="works"` click key, so the two controls cannot disagree. Category grouping (Foreground/Background/Misc) reads `d.front`/`d.back`, computed server-side by `deco-catalogue.js`'s `decoIndex` — no client state of its own |
| `_edit.currentSpecialId` | `map-editor.js` (webview), field on `_edit` | string\|null | The Special tab's armed pick (e.g. `'gate-dog'`); set directly by `map-editor-special.js`'s click handler in `map-editor-input.js`, the same way `_edit.tool`/`_edit.phase`/`_edit.brush` already are |
| `_edit.specialCells` | `map-editor.js` (webview), field on `_edit` | `{"x,y": specialId}` | The Special tab's glyph overlay, written only through `editApply()`'s `specialWrites` param so it shares `_edit.undo`/`_edit.redo` with the tile grid — see `map-editor-special.js`. Gate/drift's *real* collision effect is not stored here: it lands in `_edit.cells` as an ordinary (possibly newly composed) stamp, exactly like a tile paint. This field is UI-only and is never read by `editExport()` |
| `_edit.selectedTriggerRef` | `map-editor.js` (webview), field on `_edit` | `{kind: 'step'\|'b', id: string}\|null` | Which trigger the Select tool has selected — `id` is `'base:'+i` (into `_mtPalette.attachments`) or `'placed:'+uid` (into `_edit.placed`). Set only by `map-editor-trigger-select.js`'s `triggerSelect()` (also the only place that flips `_editActiveTab` to `'trigger'` as a side effect of selecting); cleared when the tool changes away from `'select'` (`map-editor-input.js`'s `data-edit-tool` handler) and self-heals to `null` after an `editUndo`/`editRedo` that removed the thing it pointed at (`editDropStaleTriggerSelection()` in `map-editor.js`) |
| `_edit.removedTriggers` | `map-editor.js` (webview), field on `_edit` | `[{kind, index}]` | Base-room triggers (from `_mtPalette.attachments`, read-only) this draft has hidden — deleted outright, or hidden by a move that added the new position to `_edit.placed` instead. Never touches `_mtPalette.attachments` itself. Written only by `map-editor-trigger-select.js`, through `editApplyTriggerOp()`'s before/after snapshot so it shares the undo stack |
| `_edit.placed[].uid` | `map-editor.js`'s `editNextPlacedUid()` (webview) | number | Stable identity for a `_edit.placed` entry across re-renders, so a `selectedTriggerRef` of `'placed:'+uid` keeps pointing at the same trigger even as others are added/removed. Assigned once, at creation, by `editStampedConstruct()` (map-editor-constructs.js, for a stamped gourd's trigger) or by `map-editor-trigger-select.js` (a paste, or a base-trigger move) |
| `_triggerDrag` | `map-editor-trigger-select.js` (webview), module-local | `{ref, w, h, grabDx, grabDy, x, y}\|null` | The Select tool's in-progress drag, live-updated by pointer move and read by `map-editor-paint.js`'s `renderEditLayer` for the preview outline. Not part of `_edit`: a drag that never commits is not a draft change, so it is not in the undo history |
| `_triggerClipboard` | `map-editor-trigger-select.js` (webview), module-local | `{kind, x1, y1, w, h, scriptId}\|null` | The last copied trigger. An instance field, not reactive state and not part of `_edit` — Cmd/Ctrl+V still works after Escape clears the selection that filled it, and neither copy nor its later paste is itself undoable (only the paste's resulting `_edit.placed` mutation is, via `editApplyTriggerOp`) |

**Map-editor state that predates this table (Phase 6 backfill — see `src/rooms/README.md`'s client-side file list for the fuller narrative each of these files carries):**

| State | Owner File | Type | Notes |
|---|---|---|---|
| `_edit` | `map-editor.js` (webview) | object\|null | The draft for the room on screen — cells, added stamps, undo/redo, tool/phase/brush. Only this file assigns to it; every other map-editor file reads/writes fields through `editDraft()` |
| `_panelOpen` | `map-editor-panels.js` (webview) | `{families,tiles,needed,errors,compose}` | Which Tile-tab panels are expanded, toggled by a `data-panel` click |
| `_editOrigin` | `map-editor-ui.js` (webview) | `{x,y}` | The map's own top-left in viewBox units, set once per render from `buildRoomSvgSection`'s result |
| `_editCompose` | `map-editor-ui.js` (webview) | `{layer1,layer2,collision,pick,armed?}` | The hand-composer's in-progress stamp and which of its three slots the next click fills |
| `_editComposed` | `map-editor-ui.js` (webview) | object\|null | The host's rendered preview of `_editCompose`, once requested |
| `_editConstruct` | `map-editor-ui.js` (webview) | number | Which saved construct (map-editor-constructs.js) the Stamp tool places; `-1` when none is armed |
| `_editSel` | `map-editor-paint.js` (webview) | `{x1,y1,x2,y2}`\|null | The box-select tool's in-progress or committed rectangle |
| `_editClip` | `map-editor-paint.js` (webview) | object\|null | The box-select tool's own copied region — distinct from `_triggerClipboard`, the Select tool's |
| `_chipSel` | `map-editor-chips.js` (webview) | `{[familyId]: true}` | Which family chips are toggled on, narrowing the tile browser |
| `_chipFilter` | `map-editor-chips.js` (webview) | string | The chip search box's text |
| `_chipPreviews` | `map-editor-chips.js` (webview) | object\|null | Host-rendered chip art, keyed by family id |
| `_related` | `map-editor-chips.js` (webview) | `{[graphic]: count}` | Placement-adjacency counts for the armed brush, sorting a family's own tile strip |
| `_famCatalogue` | `map-editor-families.js` (webview) | object\|null | The full family catalogue (tile/room counts, areas, names), fetched once |
| `_famSheets` | `map-editor-families.js` (webview) | `{[familyId]: sheet}` | Per-family tile sheets, fetched as a family is adopted or browsed |
| `_brushTile` | `map-editor-families.js` (webview) | number\|null | The room's own sheet's selection ring, cleared when a family-tile brush is armed instead |
| `_deco` | `map-editor-deco.js` (webview) | array\|null | The deco/widget catalogue, fetched once |
| `_decoFilter` | `map-editor-deco.js` (webview) | string | The Widgets tab's search box text |
| `_decoPage` | `map-editor-deco.js` (webview) | number | Pagination offset into the filtered deco list |
| `_decoPreviews` | `map-editor-deco.js` (webview) | object\|null | Host-rendered deco thumbnails |
| `_decoPick` | `map-editor-deco.js` (webview) | number | The entry whose cells are being requested from the host; `-1` when none |
| `_decoFlags` | `map-editor-deco.js` (webview) | `{fits,works,front,open}` | The Widgets tab's filter chips — `works` is also the "Ready only" toggle's own boolean (one owner, see the row above) |
| `_mtPalette` | `metatile-palette.js` (webview) | object\|null | The room's own decoded palette (dictionary atlas, grid, budget, attachments) — read-only room data every map-editor file reads through |
| `_mtLayer` | `metatile-palette.js` (webview) | string | Which layer the Tile palette section renders (`'composite'`/`'layer1'`/`'layer2'`/`'collision'`) |
| `_mtFilter` | `metatile-palette.js` (webview) | string | The Tile palette's own family filter |
| `_mtSelected` | `metatile-palette.js` (webview) | number | The selected stamp index in the browsing (non-edit) Tile palette |
| `_editDrag` | `map-editor-gestures.js` (webview) | `{x1,y1}`\|null | The box-select tool's in-progress pointer drag — distinct from the Select tool's own `_triggerDrag` |
| `_newRoomOpen` | `map-editor-newroom.js` (webview) | bool | Whether the "new room" inline form is open |
| `_resizing` | `map-editor-newroom.js` (webview) | `{x,y,w0,h0,w,h}`\|null | The canvas resize grip's in-progress drag, in tiles |
| `_resizeKeep` | `map-editor-newroom.js` (webview) | bool | Whether the next blank-room reply should keep the cells that still fit — set only by a resize, not a fresh "new room" |
| `_editPendingNote` | `map-editor-input.js` (webview) | string | The last explanatory message written to the status slot, overwritten by the next render's summary |
| `_currentLayer` | `rom-overlay.js` (webview) | `'composite'\|'layer1'\|'layer2'` | Which render the host bakes. **One owner, two views**: the filter bar's `Background`/`Foreground` segments are `romLayerVis('bg'/'fg')` derived from it (`composite` = both on), and the `More ▾` drawer's `composite` chip is a third. Nothing mirrors it into a `layerVis` object — the host renders one layer choice per request, so a pair of independent booleans would have no state to map onto (Phase 7a) |
| `_currentOverlay` | `rom-overlay.js` (webview) | flag string | Which baked feature overlays are on (`c` collision, `d` drift, …). The filter bar's `Collision` segment is the `c` flag; the rest sit in the `Triggers`/`Objects`/`More` dropdowns. Rebuilt from `ALL_OVERLAY_FLAGS`'s canonical order on every toggle so the host's cache key does not depend on click order |
| `_editPanelRoom` | `map-editor-input.js` (webview) | object\|null | The room the delegated panel click handler currently acts on, re-pointed every render since the handler's closure is bound once |

---

## 2. Radar Tab — State Flow

```
VS Code editor cursor moves
  ↓ (debounced 400ms)
extension.js::refreshRadar(editor)
  ↓
radarDetectScope(doc, pos) → scope string
radarAnalyzeScope(doc, scopeStr) → { refs, pools, argRefs }
radarReadMemoryMap(wsRoot) → mapByAddr [cached _radarMapCache]
radarReadEnums(wsRoot) → enumMap [cached _radarEnumCache]
buildRoomTree(doc, wsRoot, extCfg) → roomTree [cached _radarRoomTree]
  ↓
renderRadarHtml(...)               [memory_radar/render-radar.js]
  ↓
buildMemoryTabHtml(...)            [memory_radar/render-memory-tab.js]
buildDocsTabHtml()                 [memory_radar/render-docs-tab.js]
buildRngTabHtml()                  [memory_radar/render-docs-tab.js]
  → large HTML string
  ↓
_radarPanel.webview.html = html
  ↓ (webview renders)
webview JS → DOM built → tab shows
```

**Cache invalidation:**
- `_radarMapCache` → FileSystemWatcher on `**/.github/memory-map.md`
- `_radarEnumCache` → FileSystemWatcher on `**/in/core/**/*.evs`
- `_radarRoomTree` → rebuilt when active document path changes

---

## 3. Rooms Tab — State Flow

```
User clicks room in tree (webview)
  ↓ (client-side)
renderRoomDetail(room)            [detail-renderer.js]
  ↓
buildRoomSvgSection(opts)         [svg-builder.js]
buildEntityTablesHtml(c, trigOff) [tables-builder.js]
buildRomScriptsHtml(c, trigOff)   [tables-builder.js]
buildRomHeaderHtml(rh)            [rom-header.js]
  ↓
panel.innerHTML = combined HTML
  ↓
setupZoomPan(...)                 [interactions.js]
setupMouseEvents(...)             [interactions.js]
setupHoverHighlights(...)         [interactions.js]
setupClickHandlers(...)           [interactions.js]
```

**Server-side data flow (when radar re-renders):**
```
extension.js::renderRadarHtml
  ↓
buildRoomTree(doc, wsRoot, extCfg) [room-tree.js → rooms/index.js]
  → collectRoomsFromDir(...)       [rooms/parsing/file-scanner.js]
  → parseRoomContent(...)         [rooms/parsing/content-parser.js]
  → readScriptAllTriggers(...)    [rooms/data/lua-watchers.js]
  → readRomMapHeader(...)         [memory_radar/rom-readers.js]
  ↓
renderRoomsTree(tree)             [rooms/rendering/tree-renderer.js]
renderVanillaTree(VANILLA_ROOMS)  [rooms/rendering/tree-renderer.js]
  ↓
buildRoomRailHtml(live, vanilla)  [rooms/rendering/tree-renderer.js]
  the rail shell: search, the two collapsible groups, the + New Map footer
  ↓
buildRoomsJson(tree)              [rooms/rendering/tree-renderer.js]
  ↓
injected into webview as ROOMS, VANILLA_ROOM_DETAILS JS globals
```

---

## 4. Memory (Radar Grid) Tab — State Flow

```
extension.js::refreshRadar
  ↓
radarReadMemoryMap(wsRoot)        → Map<addr, entry>
radarAnalyzeScope(doc, scope)     → { refs, pools, argRefs }
radarReadEnums(wsRoot)            → Map<addr, [{cls,name}]>
  ↓
buildMemoryTabHtml(...)           [render-memory-tab.js]
  → { html, cellData }
  ↓
injected into webview via render-radar.js orchestrator
  ↓
Client JS: cell clicks, filter buttons (body class toggles), tooltip hover
  → all client-side only, no IPC for grid interactions
```

**IPC for grid:**
- Cell line links → `{command: 'goToLine', line: N}` → extension.js reveals editor position
- Pin button → `{command: 'pin'/'unpin'}` → `_radarPinned = true/false`

---

## 5. Emulator / Debugger Flow

```
User launches debugger (F5)
  ↓
debugger/adapter.js (DAP adapter)
  ↓
debugger/mock-runtime.js (script execution orchestrator)
  ↓
debugger/emulator/panel.js (webview panel lifecycle + IPC bridge)
  ↓  (postMessage to webview)
emulator webview JS
  ↓  (loads WASM)
snes9x2005-wasm core
  ↓  (breakpoint hit)
debugger/adapter.js → DAP stopped event → VS Code UI
```

**State owned by debugger/emulator/panel.js:**
- Webview panel reference
- Current ROM path
- Core selection (vanilla / custom)
- WASM module reference
- `radarByteScriptFocus` dispatch (sends to `extension.js` which relays to radar panel)

**Cross-subsystem IPC (debugger → radar):**
```
emulator webview → {command:'byteScriptFocus', address:'0x94E5FB'}
  ↓
panel.js → extension.js._radarByteScriptFocus = address
  ↓
extension.js → radarPanel.webview.postMessage({command:'byteScriptFocus', address})
  ↓
radar webview bootstrap.js → _currentByteScriptFocus = address
  ↓
_applyByteScriptFocus() → highlights matching instruction rows
```

---

## 6. Language Providers Flow

```
VS Code hover event
  ↓
code_highlighter/language-providers.js::provideHover(doc, pos)  [facade]
  ↓
hover-provider.js::provideHover(doc, pos, idx, radarMap)
  ↓
workspace-index.js::getIndex() / getWorkspaceIndex()  [cached]
  → scans *.evs for function defs, memory() calls, enum defs
  ↓
provideHover returns MarkdownString
  ↓ (hex literal hover)
radarReadMemoryMap(wsRoot)    [calls into memory_radar/radar-utils.js]
  → returns entry with name + lifecycle
```

**State owned by code_highlighter/workspace-index.js:**
- `_index` (static JSON from `data/index.json`)
- `_workspaceIndex` (Map of workspace declarations)

**Decomposed modules (v0.5.0):**
- `workspace-index.js` — index state + load/build
- `hover-provider.js` — all hover tooltip logic
- `completion-provider.js` — completion items
- `symbol-provider.js` — document symbols
- `dead-branch.js` — dead code decorations
- `definition-provider.js` — go-to-definition + find-references
- `language-providers.js` — 39-line facade (backward compat)

---

## 7. ROM Readers — Data Flow

```
rom-readers.js (memory_radar/)
  ↓ (reads bytes from ROM file path)
readRomMapHeader(wsRoot, mapId)   → 13-byte header + derived geometry
readRomTriggerOffsets(wsRoot, mapId) → {offX, offY}
readRomMapHeader → used by: rooms/data/vanilla-data.js, rooms/data/lua-watchers.js
readRomCharacters → used by: extension.js (scaling tab)
readRomHitLookup → used by: extension.js (scaling tab)
readPngDimensions → used by: rooms/parsing/file-scanner.js
```

**ROM readers have ZERO VS Code dependencies.**
**ROM readers are pure I/O: take path, return data.**

---

## 8. Subsystem Communication Summary

```
extension.js
  ├── reads: radar-utils.js (pure)
  ├── reads: room-data.js / room-tree.js (shims → rooms/)
  ├── reads: rom-readers.js
  ├── reads: language-providers.js (registers providers)
  ├── reads: settings-model.js
  └── creates: debugger/emulator/panel.js (on demand)
           └── reads: rooms/data/room-scripts.js → script/ (ported decoder)

debugger/
  ├── adapter.js → mock-runtime.js
  └── emulator/panel.js → snes-rom-header-model.js

memory_radar/
  ├── radar-utils.js (pure — no upward deps)
  ├── rom-readers.js (pure I/O — no upward deps)
  ├── rooms/ → rom-readers.js, radar-utils.js
  └── webview/ → concatenated JS assets (no Node deps)

code_highlighter/
  └── language-providers.js → radar-utils.js (memory map parsing)
```

---

## 9. Forbidden Dependency Directions

| From | To | Why |
|---|---|---|
| `rom-readers.js` | `extension.js` | ROM is pure I/O |
| `rom-readers.js` | `vscode` | ROM has no VS Code dep |
| `radar/webview` JS | `require()` anything | Webview is concatenated globals |
| `language-providers.js` | `debugger/` | Separate subsystems |
| `debugger/` | `memory_radar/` rendering | Separate subsystems |
