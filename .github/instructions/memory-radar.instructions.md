---
name: memory-radar
description: Use when touching the Memory Radar webview panel in everscript-vscode — its Memory tab (WRAM grid, address lifecycle, arg tracking, pools) or its Rooms tab (map browser, room tree, SVG grid). Source lives under src/memory/, src/rooms/, src/docs/render-docs-tab.js, and src/shared/radar-utils.js.
applyTo: "src/memory/**,src/rooms/**,src/shared/radar-utils.js,src/docs/render-docs-tab.js,src/extension.js"
---

# Skill: Memory Radar & Rooms Tab

Use this skill when touching the Memory Radar webview panel (`everscript.openMemoryRadar`
command), its Memory tab (WRAM grid), or its Rooms tab (map browser).

Current source locations (post v0.6.0 `src/` refactor):
- `src/memory/render-radar.js`, `src/memory/render-memory-tab.js`, `src/memory/webview/`
- `src/rooms/index.js`, `src/rooms/parsing/`, `src/rooms/rendering/`, `src/rooms/data/`,
  `src/rooms/webview/`
- `src/docs/render-docs-tab.js` (docs/RNG tab, rendered in the same panel)
- `src/shared/radar-utils.js` (pure functions shared by memory/rooms)
- Panel lifecycle and command registration: `src/extension.js`

**Boundary note:** this skill covers the Rooms tab's *browsing* of already-parsed
`.evs` source (`src/rooms/parsing/`, tree building, entity rendering) — that's
author-side `.evs` text, unaffected by ROM format work. Decoding ROM map/room *bytes*
(tile grids, collision, compression) is `src/maps/`'s job and is a separate, larger
concern — see the `map-format` skill before touching that side, especially before
assuming `src/maps/` can answer a question the Rooms tab needs (it currently can't for
several rooms; `findRoomImage` falls back to a static image lookup rather than a ROM
render for that reason).

---

## Radar data sources

- `.github/memory-map.md` in the **open workspace folder** (the user's Everscript
  project, not this extension repo) — ground-truth WRAM address names and lifecycle.
- Active `.evs` document — scope-parsed for `memory(0xADDR)`, `<0xADDR>`, and
  bit-allocator helpers.

## Address convention

- All addresses in `memory()` and `<>` are treated as **absolute 16-bit WRAM** addresses
  (bank `$7E` implied).
- No offset arithmetic. `memory(0x22d8)` = WRAM byte at `$7E22D8`.
- Do not invent an offset or base; the parser reads hex literals as-is.

## Lifecycle classification (`radarLifecycle`) — address check takes priority

- `temp`    — addr in `0x2834–0x28FF` (compiler TEMP RAM, cleared on room load).
  **Overrides `[SRAM]` tag.**
- `session` — addr in `0x2200–0x27FF` (cross-room persistent vars, SRAM range).
  **Overrides `[SRAM]` tag.**
- `sram`    — entry notes/type contains `[SRAM]` or the word `sram` (case-insensitive).
  Only when not in temp/session range.
- `system`  — everything else (engine/HW addresses, 0x0000–0x21FF and 0x2900+).

## `_loot_chest`, `_loot`, `loot`, `retained_object`

These are dynamically allocated from the compiler memory pool. The address is NOT the
first call argument — it is computed at link time based on how much pool has been
consumed. Do NOT attempt to infer addresses from call sites.

## Read/write detection (`radarAnalyzeScope`)

- Returns `{ refs, pools, argRefs }`.
- A reference is a **write** if immediately followed by `=` (but not `==`, `!=`, `<=`,
  `>=`). Matches both `<0xADDR> = value` and `memory(0xADDR) = value`.
- All other references are **reads**.
- Grid cell gets class `.crw` (amber) if both reads and writes are found, `.cw` (red) if
  write-only.

## `arg[N]` tracking

- `arg[0xNN]` / `arg[NN]` references tracked separately in
  `argRefs: Map<idx, {reads, writes}>`.
- `arg[N]` is VM-local (opcode 0x13); it does NOT map to a fixed WRAM address.
- Rendered below the WRAM grid in a separate grid labeled `arg[]`.
- Filter button `btn-hideargs` (default ON) hides `arg-row-empty` rows via
  `body.hideargs`.

## Multi-byte entries

- `radarReadMemoryMap` stores `addrStart`/`addrEnd` on every entry.
- `Word`-typed entries with a single address auto-extend to cover both bytes.
- Hovering/clicking any cell in a multi-byte entry highlights/selects the whole range
  (`.chi` class; polygon outline via per-cell box-shadow).
- Adjacent same-group cells joined visually via `grj-r`/`grj-l` classes.

## Pool declarations

- `pools` is `{ start, end, line, lc }[]` for each `<0xS>..<0xE>` range declaration in
  scope. Pool lines are skipped from individual ref tracking.
- Pool rows appear at the top of the detail table (italic, faint blue tint).
- Addresses referenced but not in the memory map appear as `(untracked)` /
  `(pool alloc)` rows with a badge.

## Interaction model

- No popup. Click grid cell → polygon cursor on all bytes in group + scroll right panel
  to detail row. Click detail row → same, reversed. Always bidirectional.
- Line links in the Lines column show a tooltip with the source line text.

## Layout (T-shape)

- Sticky header: title, scope, filters, region usage bars.
- `.left-panel`: WRAM grid, scrolls independently.
- `.right-panel`: detail table, scrolls independently.

## UI features

- Filter buttons `temp / session / sram / system / rest` hide grid rows where every
  cell is filtered (`body.hXX` classes + `recomputeRows()`). `rest` hidden by default.
- `boring` — hide rows unused in current scope.
- `emoji` — overlay first emoji from entry name/notes onto each cell.
- `pin` — freezes radar to current scope, ignoring editor/scope changes.
- Detail columns: Addr | Name | T | Rgn | Notes | Lines.

## Enum cross-reference

- `radarReadEnums(wsFolder)` scans `.evs` files under the **workspace's** `in/core/`
  (recursively) for `enum CLASSNAME { NAME = ... <0xNNNN> }`.
- Returns `Map<addr, [{cls, name}]>`. Pure core lives in `radar-utils.js` /
  `src/shared/radar-utils.js`; cached via `getRadarEnums()` /
  `invalidateRadarEnums()`, invalidated by a watcher on `**/in/core/**/*.evs`.
- Detail table shows matching addresses with `<span class="enum-tag">CLASSNAME.NAME</span>`.

## `alloc` filter

- All `<tr class="dr">` rows carry `data-hasdoc="1"` or `data-hasdoc="0"`.
- `recomputeRows()` filters `tr.dr` rows too when `hideAlloc` is on, not just cells.

## Auto-update

- Re-renders on active editor change or cursor moving to a different scope (debounced
  400ms/600ms).
- `_radarPanel` is a module-level singleton reused if already open.
- Memory-map cache invalidated by a watcher on `**/.github/memory-map.md`.
- Enum cache invalidated by a watcher on `**/in/core/**/*.evs`.

## Snes9x live memory prototype

- `tools/snes9x_wram.py` — macOS Mach VM reader (`task_for_pid` + `mach_vm_read`) for
  the running Snes9x process's 128 KB WRAM buffer.
- `--addr 0xNNNN` reads one address; `--watch` polls every 0.5s; `--json` emits JSON
  lines for VS Code integration. Requires `sudo` or `get-task-allow` entitlement.

No overlap is expected between WRAM entries — the address space is memory-mapped, so two
scripts should never legitimately share an address. Do not add overlap-warning UI.

---

## Rooms tab

Six tabs share one webview — **Memory**, **Rooms**, **Scaling**, **Route**, **Docs**,
**RNG** — and tab switching is client-side only (`tab-init.js`). This section covers
Rooms. **The map editor that lives inside the Rooms tab has its own rules** — the seven
tile-family slots, the word layouts, what a stroke writes — in the `map-editor-rules`
skill; read that before touching any `map-editor*` file.

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

---

## Tab ownership

Radar tabs are first-class ownership domains — each tab increasingly owns its own
rendering, state, IPC, parsing, interactions, and tests:
- `src/scaling/webview/` — scaling tab
- `src/rooms/webview/`, `src/rooms/rendering/`, `src/rooms/parsing/`, `src/rooms/data/` — rooms tab
- `src/memory/render-memory-tab.js` — memory tab rendering
- `src/docs/render-docs-tab.js` — docs/RNG tab rendering

Rules:
- Future work on a tab should reason only inside that tab's own directory.
- Cross-tab shared code must be minimal, generic, ownership-neutral — prefer slight
  duplication over a giant shared abstraction.
- New tab logic goes in the tab's own directory, never in `src/extension.js` or
  `src/memory/render-radar.js`.
