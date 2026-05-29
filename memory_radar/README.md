# memory_radar/ — Subsystem README

## Ownership

Owns: Memory Radar VS Code webview panel, all tab rendering (Memory, Rooms, Scaling, Docs/RNG/Route), memory-map parsing, enum cross-reference, rooms tree.

Does NOT own: extension activation, emulator state, language grammar, general ROM byte I/O.

---

## Directory Map

```
memory_radar/
  radar-utils.js       — Pure functions: scope parsing, memory analysis, enum parsing
  rom-readers.js       — Pure ROM I/O: map headers, character stats, hit lookup, PNG dims
  room-data.js         — Thin shim → rooms/index.js (backward compat only)
  room-tree.js         — Thin shim → rooms/index.js (backward compat only)
  rooms/               — Rooms tab subsystem (see rooms/README.md)
  models/              — Map pipeline and blob-evidence models
  tests/               — Unit tests
  webview/
    index.js           — Webview HTML assembly entry point
    assets/
      rooms/           — 8-file decomposed Rooms tab JS
      scaling-tab.js   — Scaling tab (638 LOC — split candidate)
      routing-tab.js   — Route planner tab
      rooms-tab.js     — DEAD CODE (superseded by rooms/ decomp — delete this)
```

---

## State Owned

State lives in `extension.js` (module-level lets). This subsystem provides pure functions and rendering output only.

| Function | Output consumed by |
|---|---|
| `radarReadMemoryMap(wsRoot)` | `extension.js._radarMapCache` |
| `radarReadEnums(wsRoot)` | `extension.js._radarEnumCache` |
| `buildRoomTree(doc, wsRoot, extCfg)` | `extension.js._radarRoomTree` |
| `radarAnalyzeScope(doc, scope)` | `extension.js` (inline, not cached) |

---

## Allowed Dependencies

```
radar-utils.js   → (pure — zero deps)
rom-readers.js   → fs, path (pure I/O)
rooms/           → radar-utils.js, rom-readers.js, fs, path
webview/         → (concatenated globals — no require() at runtime)
models/          → fs, path (pure I/O)
```

**Forbidden:**
- `radar-utils.js` → vscode
- `rom-readers.js` → vscode
- webview assets → `require()`
- `memory_radar/` → `code_highlighter/`
- `memory_radar/` → `debugger/`

---

## Key Invariants

1. `radar-utils.js` has ZERO imports — safest shared utility layer.
2. `rom-readers.js` has ZERO VS Code dependencies.
3. Rooms tab data flows through `rooms/index.js` only.
4. Webview JS files concatenated in order from `webview/index.js::ROOMS_JS_FILES`.
5. `room-data.js` and `room-tree.js` are thin shims — do not add logic to them.

---

## Entropy Hotspots

- `webview/assets/scaling-tab.js` (638 LOC) — split candidate → `scaling/` subdir
- `webview/assets/rooms-tab.js` (746 LOC) — **DEAD CODE, delete**
- `models/map-blob-evidence-model.js` (701 LOC) — acceptable (single-purpose)

---

## Testing

Run all radar+model tests:
```bash
npm test
```

Individual test files:
```bash
node memory_radar/tests/radar.test.js
node memory_radar/tests/damage.test.js
node memory_radar/tests/map-blob-evidence-model.test.js
node memory_radar/tests/render-script-model.test.js
node memory_radar/tests/smoke.test.js      # Webview JS execution
node memory_radar/tests/ui.test.js         # Scaling/Docs tab UI
node memory_radar/tests/scaling-rom.test.js # ROM character parsing
```

## Models

Only algorithms with trace or ROM evidence are here. Each model exports helper functions used by the webview and tested against real game data.
