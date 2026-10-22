---
name: memory-radar
description: Use when touching the Memory Radar panel and its Memory tab: WRAM grid, address lifecycles, read/write detection, arg tracking, pools, enum cross-reference, auto-update (games/evermore/memory).
applyTo: "src/games/evermore/memory/**,src/games/evermore/radar-utils.ts,src/games/evermore/extension.js"
---

# Memory Radar and its Memory tab

The radar is one webview panel (`everscript.openMemoryRadar`, Evermore's main view in
`core/game-views.ts`) with tabs: Memory, Maps (the Rooms tab, `data-tab="rooms"`; `rooms-tab` skill),
Characters (`games/evermore/sprites/`), Scaling, Docs/RNG, Music, Scripts, Data. Memory has its own
bar, **Bus | WRAM | ROM** (`memory/webview/wram-view.dom.ts`): WRAM is this skill's grid; Bus and ROM
are the ROM feature's views (`games/evermore/rom/`, switched through `romShow`). A saved
`activeTab` of `rom` opens Memory › ROM. The panel is
`games/evermore/extension.js`; rendering `memory/render-radar.js`, `memory/render-memory-tab.ts`,
`memory/webview/`; scope analysis `memory/scope-analysis.ts`; pure helpers `radar-utils.ts`.

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
- `cdl` (default ON) — what the CDL library saw (`wramCdlRequest`, answered by `rom/host.ts`):
  a 2px bar per byte (read blue, written red, both amber, run purple) and **word starts** joined
  to their high byte (`wd0`/`wd1`), named or not. Word starts come from 16-bit xrefs, not
  `wram.flags` (which sets WORD on both bytes, so `$10-11` and `$11-12` look alike); overlapping
  starts chain into longer joins. A rest row with coverage (`gcdl`) shows with `rest` hidden.
- Search box (top right of the Bus | WRAM | ROM bar; Bus and ROM use `#rom-search` there) — a hex address (`2258`, `$7E2258`) selects it; other text marks matching cells
  (`.cq`) and hides non-matching detail rows.
- Detail columns: Addr | Name | T | Rgn | Notes | Lines.

## Enum cross-reference

- `radarReadEnums(wsFolder)` scans `.evs` files under the **workspace's** `in/core/`
  (recursively) for `enum CLASSNAME { NAME = ... <0xNNNN> }`.
- Returns `Map<addr, [{cls, name}]>`. Pure core lives in `radar-utils.ts` /
  `src/games/evermore/radar-utils.ts`; cached via `getRadarEnums()` /
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

No overlap is expected between WRAM entries — the address space is memory-mapped, so two
scripts should never legitimately share an address. Do not add overlap-warning UI.

---

## Tab ownership

Radar tabs are first-class ownership domains — each tab increasingly owns its own
rendering, state, IPC, parsing, interactions, and tests:
- `src/games/evermore/scaling/webview/` — scaling tab
- `src/games/evermore/rooms/webview/`, `src/games/evermore/rooms/rendering/`, `src/games/evermore/rooms/parsing/`, `src/games/evermore/rooms/data/` — rooms tab
- `src/games/evermore/sprites/` — Characters tab (characters and their animations)
- `src/games/evermore/memory/render-memory-tab.ts` — memory tab rendering
- `src/games/evermore/docs-tab/render-docs-tab.ts` — docs/RNG tab rendering

Rules:
- Future work on a tab should reason only inside that tab's own directory.
- Cross-tab shared code must be minimal, generic, ownership-neutral — prefer slight
  duplication over a giant shared abstraction.
- New tab logic goes in the tab's own directory, never in `src/games/evermore/extension.js` or
  `src/games/evermore/memory/render-radar.js`.
