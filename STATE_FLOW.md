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
renderRadarHtml(scope, refs, pools, argRefs, mapByAddr, roomTree, activeTab, selectedMap)
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
extension.js::renderRadarHtml
  ↓
radarReadMemoryMap(wsRoot)        → Map<addr, entry>
radarAnalyzeScope(doc, scope)     → { refs, pools, argRefs }
radarReadEnums(wsRoot)            → Map<addr, [{cls,name}]>
  ↓
renderRadarHtml assembles HTML grid inline (currently in extension.js)
  ↓
webview receives HTML
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
code_highlighter/language-providers.js::provideHover(doc, pos)
  ↓
buildWorkspaceIndex / loadIndex (cached)
  → scans *.evs for function defs, memory() calls, enum defs
  ↓
provideHover returns MarkdownString
  ↓ (hex literal hover)
radarReadMemoryMap(wsRoot)    [calls into memory_radar/radar-utils.js]
  → returns entry with name + lifecycle
```

**State owned by language-providers.js:**
- Workspace index (function defs, memory addresses)
- Index validity (dirty flag)

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
           └── reads: debugger/emulator/room-script-model.js

debugger/
  ├── adapter.js → mock-runtime.js
  └── emulator/panel.js → room-script-model.js, snes-rom-header-model.js

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
