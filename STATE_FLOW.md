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
| vanilla mode | `tab-init.js` (webview) | `_vanillaMode` | Client-side only |
| byte script focus | `bootstrap.js` (webview) | `_currentByteScriptFocus` | Updated via message |
| emulator ROM state | `debugger/emulator/panel.js` | local | Per-panel |
| map editor active tab | `map-editor-tabs.js` (webview) | `_editActiveTab` | `'tile'\|'special'\|'trigger'\|'info'`; gates what `map-editor-panels.js`'s `renderEditPanels()` builds into `#rg-panels`. Other map-editor dock state (`_panelOpen`, `_editOrigin`, `_editCompose`, …) predates this table — see `src/rooms/README.md`'s client-side file list, not this doc, for the full inventory |
| `_edit.currentSpecialId` | `map-editor.js` (webview), field on `_edit` | string\|null | The Special tab's armed pick (e.g. `'gate-dog'`); set directly by `map-editor-special.js`'s click handler in `map-editor-input.js`, the same way `_edit.tool`/`_edit.phase`/`_edit.brush` already are |
| `_edit.specialCells` | `map-editor.js` (webview), field on `_edit` | `{"x,y": specialId}` | The Special tab's glyph overlay, written only through `editApply()`'s `specialWrites` param so it shares `_edit.undo`/`_edit.redo` with the tile grid — see `map-editor-special.js`. Gate/drift's *real* collision effect is not stored here: it lands in `_edit.cells` as an ordinary (possibly newly composed) stamp, exactly like a tile paint. This field is UI-only and is never read by `editExport()` |
| `_edit.selectedTriggerRef` | `map-editor.js` (webview), field on `_edit` | `{kind: 'step'\|'b', id: string}\|null` | Which trigger the Select tool has selected — `id` is `'base:'+i` (into `_mtPalette.attachments`) or `'placed:'+uid` (into `_edit.placed`). Set only by `map-editor-trigger-select.js`'s `triggerSelect()` (also the only place that flips `_editActiveTab` to `'trigger'` as a side effect of selecting); cleared when the tool changes away from `'select'` (`map-editor-input.js`'s `data-edit-tool` handler) and self-heals to `null` after an `editUndo`/`editRedo` that removed the thing it pointed at (`editDropStaleTriggerSelection()` in `map-editor.js`) |
| `_edit.removedTriggers` | `map-editor.js` (webview), field on `_edit` | `[{kind, index}]` | Base-room triggers (from `_mtPalette.attachments`, read-only) this draft has hidden — deleted outright, or hidden by a move that added the new position to `_edit.placed` instead. Never touches `_mtPalette.attachments` itself. Written only by `map-editor-trigger-select.js`, through `editApplyTriggerOp()`'s before/after snapshot so it shares the undo stack |
| `_edit.placed[].uid` | `map-editor.js`'s `editNextPlacedUid()` (webview) | number | Stable identity for a `_edit.placed` entry across re-renders, so a `selectedTriggerRef` of `'placed:'+uid` keeps pointing at the same trigger even as others are added/removed. Assigned once, at creation, by `editStampedConstruct()` (map-editor-constructs.js, for a stamped gourd's trigger) or by `map-editor-trigger-select.js` (a paste, or a base-trigger move) |
| `_triggerDrag` | `map-editor-trigger-select.js` (webview), module-local | `{ref, w, h, grabDx, grabDy, x, y}\|null` | The Select tool's in-progress drag, live-updated by pointer move and read by `map-editor-paint.js`'s `renderEditLayer` for the preview outline. Not part of `_edit`: a drag that never commits is not a draft change, so it is not in the undo history |
| `_triggerClipboard` | `map-editor-trigger-select.js` (webview), module-local | `{kind, x1, y1, w, h, scriptId}\|null` | The last copied trigger. An instance field, not reactive state and not part of `_edit` — Cmd/Ctrl+V still works after Escape clears the selection that filled it, and neither copy nor its later paste is itself undoable (only the paste's resulting `_edit.placed` mutation is, via `editApplyTriggerOp`) |

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
