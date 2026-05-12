# Changelog

## [0.2.19] — 2026-05-12

### Fixed
- **ROM stat reader used the evade slot as magic defense** — `readRomCharacters()` now parses `evade` from `+0x1d` and `magic_defense` from `+0x1f`, which fixes live Scaling alchemy targets such as Hard Ball L0 vs Purple Flower/Wimpy Flower.

### Added
- **Parser regression coverage** — `test/scaling-rom.test.js` now feeds a synthetic ROM record through the real `readRomCharacters()` path and asserts that the parsed target produces the grounded Hard Ball L0 `6–10` range.

## [0.2.18] — 2026-05-12

### Fixed
- **Scaling alchemy target mdef lookup** — the Scaling tab now accepts both `magic_defense` and `magicDefense` on target records instead of silently falling back to `0`, which was producing bogus alchemy ranges like Hard Ball L0 `0–1` vs Wimpy Flower.

### Added
- **Hard Ball purple-flower regression test** — `test/ui.test.js` now asserts that Scaling alchemy mode shows Hard Ball L0 vs Wimpy Flower as `6–10`, matching the grounded level-0 model.

## [0.2.17] — 2026-05-12

### Fixed
- **Scaling tab damage-type selector restored to the right place** — the Physical / Offensive Alchemy selector now lives in Scaling, not Docs, and the matching field rows have the IDs that the existing mode-switching JS expects.
- **Scaling tab render crash** — switching or initializing Scaling no longer fails because `updateLevelFields()` can now find `sc-src-field`, `sc-charge-field`, `sc-scale-field`, and `sc-atlas-field`.
- **Docs alchemy entry restored** — Docs again exposes Offensive Alchemy as its own subtab instead of hiding it behind a misplaced dropdown.

### Added
- **Scaling-focused UI tests** — `test/ui.test.js` now validates the Scaling selector, physical/alchemy field visibility changes, note text updates, and the restored Docs alchemy entry.

## [0.2.16] — 2026-05-12

### Added
- **`test/ui.test.js`** — 18 new UI tests covering Docs tab structure and JS behaviour: dropdown element exists, physical/alchemy content visibility in HTML, no stray subnav button, dropdown change toggles both sections, both charts populate at init.
- **`test/smoke.test.js`** now included in `npm test`; fake DOM fixed to support `document.createElement` and persistent element identity so webview JS execution tests pass.

### Fixed
- **`bindLinks(null)` crash** — `bindLinks` in the webview JS now guards against a null root argument; this prevented webview JS from executing cleanly in test sandboxes.

## [0.2.15] — 2026-05-12

### Changed
- **Docs > Damage section** — replaced the separate "Offensive Alchemy" subnav button with a **Damage type** dropdown inside the Damage section (Physical / Offensive Alchemy). Physical is the default; selecting Offensive Alchemy switches to the spell-might + magic-defense interactive graph.

## [0.2.14] — 2026-05-12

### Added
- **Map-loading header tables** — expanded the room-loader docs with a byte-by-byte header table, a blob-region table, and a clearer separation between known fields and unknown header bytes.
- **Reverse-engineering next-step guidance** — added a concrete trace checklist for progressing the room-loader work, with emphasis on capturing the first 13 bytes and the first payload writes.

### Changed
- **Trigger-record caveat clarified** — the docs now state that the 6-byte step-on/B-trigger record layout matches the current in-repo model, while also being explicit that the external SoE tiles viewer C++ source was not freshly re-verified in this workspace.
- **Repo cleanup ignores generated artifacts** — `tmp/`, Python bytecode, and `tools/__pycache__/` are now ignored so slice outputs and cache files stop showing up as pending changes.

## [0.2.13] — 2026-05-12

### Added
- **Docs tab map-loading section** — added a grounded map-loading explainer covering the room-blob layout, the `LDA [$8B],Y` stream-read breakpoint, and the truncation evidence for how the payload turns into the final room picture.
- **Map-loading markdown doc** — added a dedicated docs file that records the current room-loader model and the confirmed Strong Heart exterior example.

### Changed
- **Room-data docs clarified** — the room data-block note now explicitly says that the bytes after the trigger tables are still-observed room payload, even though the exact codec is not fully decoded yet.

## [0.2.12] — 2026-05-12

### Added
- **Level-0 offensive alchemy preview** — the Scaling tab can now switch from physical attacks to offensive alchemy, plotting spell might against enemy `magic_defense` with the current `effective_mdef` model.
- **Docs tab alchemy section** — added an offensive alchemy explainer and interactive preview so the spell-might table and `magic_defense` subtraction are visible inside the extension.
- **Alchemy markdown doc** — added a dedicated docs file for the grounded offensive alchemy model, including the spell might table and the current level-0 range assumptions.

### Changed
- **Scaling and Docs wiring fixed** — restored the alchemy docs button to the Docs tab and removed duplicate hidden Scaling controls that were hijacking the chart bindings.
- **Alchemy placeholders narrowed** — route-planner copy now points at the remaining gap more honestly: route-grade spell-level / 8-cast modeling is still missing, but the per-cast level-0 preview exists.

## [0.2.11] — 2026-05-12

### Changed
- **Document alchemy damage inputs** — the scaling docs now describe the confirmed offensive alchemy inputs: enemy `magic_defense`, the `effective_mdef = max(0, 0x40 - magic_defense)` term, and the base-might table at ROM offset `0x45E6B`.
- **List vanilla alchemy might values** — added the per-spell might table to the docs, including the current caveat that exact charge / level scaling is still not fully traced.

## [0.2.3] — 2026-05-09

### Changed
- **Correct temp region boundary** — temp region is now `0x2834–0x28FF` (matching the linker's TEMP RAM definition in `main.evs`). Was incorrectly `0x2800–0x28FF`.
- **Remove static loot-function address extraction** — `_loot_chest`, `_loot`, `loot`, `retained_object` are dynamically allocated from the compiler memory pool; their call-site arguments do not indicate a fixed address. Removed the spurious write annotations.

### Added
- **T-shape layout** — sticky header (title, filters, region bars), left panel (grid, independent scroll), right panel (detail table, independent scroll). Clicking a grid cell scrolls both.
- **Multi-byte cursor selection** — clicking any cell now highlights ALL cells belonging to the same entry (e.g. all 35 bytes of `BOY_NAME`). Previously only the clicked cell got the cursor outline.
- **Word byte extension** — `Word`-typed entries with a single address in the memory map now automatically cover both bytes (`addr` and `addr+1`). Previously the second byte appeared as an undocumented gap.
- **Group color stripes** — cells belonging to the same multi-byte entry share a colored bottom-border stripe (10-color rotating palette), visually connecting bytes of the same entry across grid rows.

## [0.2.2] — 2025-05-09

### Added
- **Radar auto-update** — when you move the cursor to a different scope or switch to another `.evs` file, the open radar re-renders automatically. The `pin` button stops auto-update.
- **Cursor highlight in grid** — last-clicked cell gets a persistent white border (`.cursor`), separate from the hover highlight.
- **Multi-byte hover highlight** — hovering any cell in a multi-byte entry (e.g. `BOY_NAME` ×35, `FRAME_COUNTER_1` word) highlights all bytes in the entry, not just addr+1.
- **Emoji in cells** — `emoji` button overlays the entry’s first emoji (from name/notes) onto each 9×9 cell. Based on the memory-map emoji legend.
- **Emoji in popup/detail** — emoji shown alongside address in popup header and detail table addr column.
- **Boring row filter** — `boring` button hides rows where no cells are used in the current scope.
- **Follow mode** — `follow` button makes the detail table auto-scroll to the entry when a grid cell is selected.
- **Pin button** — `pin` button locks the radar to the current scope, stopping editor-driven auto-updates.
- **Detail table layout** — columns are now Addr / Name / T / Rgn / Notes / Lines. Line references in the last column jump to the editor. Clicking a row selects the grid cell (no jump to table by default; use `follow` mode).
- **Memory-map hover** — hovering a hex literal (e.g. `0x22d8`) in `.evs` code now shows the memory-map name, lifecycle, and an “Open Memory Radar” command link if the address is documented.
- **Lifecycle priority fix** — temp (0x2800–0x28FF) and session (0x2200–0x27FF) address ranges now take priority over the `[SRAM]` tag, so temp RAM documented as SRAM is correctly shown as temp.
- **Memory-map cache** — `memory-map.md` is parsed once and cached; cache is invalidated when the file changes.
- **Reuse panel** — `openMemoryRadar` reuses the existing panel instead of creating a new one each time.

## [0.2.1] — 2025-05-09

### Fixed
- **Lifecycle regions corrected** — `temp` is now `0x2800–0x28FF`, `session` is `0x2200–0x27FF`, `system` covers everything else (was using wrong threshold `addr < 0x2000`).
- **Radar HTML tags in tooltips** — memory-map notes that contain `<br>` or other HTML are now stripped before display.

### Added
- **System filter button** — new fifth filter to hide/show system-region addresses.
- **Click-to-popup detail panel** — click any lit cell to see structured Vanilla notes, Writes (destructive, red), and Reads (non-destructive, blue). Replaces tooltip-on-hover.
- **Read / write cell coloring** — cells used only as write targets render with a red inset shadow; cells used for both reads and writes render amber.
- **Word-byte pair highlighting** — hovering a `word`-type cell highlights the adjacent +1 byte cell.
- **`tools/snes9x_wram.py`** — macOS Mach VM prototype for reading live Snes9x WRAM. Use `--addr`, `--watch`, `--json` flags. See file header for usage and VS Code integration plan.
- **Filter hides empty rows** — `recomputeRows()` hides entire grid rows when all their cells are filtered out.

## [0.2.0] — 2026-05-09

### Added
- **Memory Radar merged in** — the standalone `everscript-memory-radar` extension is
  discontinued; its visualizer now lives in this extension.
- **`Everscript: Open Memory Radar` command** — opens a compact, sidebar-friendly WRAM
  visualizer beside the active `.evs` file. Accessible via right-click context menu or
  the `◉ Memory Radar` CodeLens shown above every `fun`/`map`/`area`/`group` declaration.
- **CodeLens** — `◉ Memory Radar` appears above each scope declaration for one-click access.
- **WRAM heatmap grid** — 9×9 px cells, 16 per row, covering the full documented address
  range. Color indicates lifecycle: blue = temp (`<0x2000`), amber = session, green = sram.
  Bright = used in current scope, dim = documented but unused, near-invisible = rest
  (undocumented). Hover tooltip shows address, name, type, and usage lines.
- **Region usage bars** — temp/session/sram each show `used/total (%)`.
- **Filter buttons** — toggle temp/session/sram/rest visibility independently. Rest is
  off by default (collapses entirely-undocumented rows).
- **Detail table** — lists every known address with addr, name, type, lifecycle chip, and
  clickable line numbers that navigate back to the usage site in the editor.
- **Bidirectional navigation** — click a grid cell to jump to its detail table row; click
  a line number in the table to reveal that line in the source editor.
- Reads `.github/memory-map.md` from the workspace root for ground-truth address data.

### Notes on WRAM addresses
Addresses in `memory(0xADDR)` and `<0xADDR>` are treated as absolute 16-bit WRAM
addresses (bank `$7E` implied). No offset arithmetic is applied by the parser.

### Snes9x live-memory feasibility
Theoretically possible on macOS via `task_for_pid()` + `mach_vm_read()` (Mach kernel
API), the same mechanism Cheat Engine uses. Requires a native Node.js C++ addon and
appropriate process entitlements — not implementable in pure JS from a VS Code extension.
A future milestone could ship a small helper binary for this.

## [0.1.5] — 2026-05-08

### Changed
- **Annotations redesigned to P5 amber bold** — `@install`, `@inject`, `@async` etc.
  are now rendered in bold amber (`#FF9900`) instead of lilac. Rationale: they are
  ROM linker directives that specify the exact byte offset where code is placed;
  semantically equivalent to `<0x1234>` address literals.
- **`<NAME>` entity refs are now all-amber** — the identifier inside `<BOY>` was
  previously teal (P2); now amber (P5) so the whole `<BOY>` construct reads as one
  cohesive hardware-access token.
- **`object[n]` / `arg[n]` brackets now amber** — `[` and `]` get scope
  `punctuation.section.accessor.evs` → amber, completing the accessor construct.
- **P6 is now preprocessor-only** — `#memory`, `#include`, `#patch` remain lilac.
  Annotations are no longer grouped with preprocessor.
- **Theme structural corruption fixed** — a duplicate orphaned `tokenColors` section
  that existed outside the valid JSON root has been removed. Several scopes (labels,
  `variable.language.evs` italic) were previously dead code in that section.

### Added
- **Binary number highlighting** — `0b1010` tokens now get scope
  `constant.numeric.binary.evs` → light green (P8), matching hex and decimal.
- **Annotation argument coloring** — `@install(0x99aac0)` now colors the `(` and `)`
  amber too; address/number/enum arguments inside are tokenised correctly.

## [0.1.4] — 2026-05-08

### Added
- **Number hover** — hovering `0xFF`, `0d99`, or `0b1010` shows the value in hex,
  decimal, and binary plus the byte size inferred from the digit count.
- **Unqualified enum member hover** — hovering a bare `SOUTH`, `ACT4_DOOR_OPENING`,
  etc. now shows the parent enum name, value, and (when unambiguous) the full
  enum listing with the matched member highlighted.
- **Dead branch dimming** — `if(False)`, `if!(True)`, and `if(ENUM.MEMBER)` / 
  `if!(ENUM.MEMBER)` where the member value is 0 or non-zero respectively are
  detected at document open/edit and the unreachable block is rendered at 35% opacity.

### Fixed
- **Declaration name hover conflict** — hovering the name in `enum entrance {` or
  `fun entrance(...)` no longer shows the `entrance()` function tooltip.
- **Accessor hover conflict** — hovering `object` in `object[door_id]` no longer
  shows the `object()` function tooltip; same for `arg`, `script`, and `time`.
- **Unqualified SOUND members** — enum members used without their prefix (e.g.
  `ACT4_DOOR_OPENING`) now show a tooltip via the reverse member lookup.

## [0.1.3] — 2026-05-08

### Added
- **Go-to definition** (`F12` / cmd+click) — jumps to the `fun`, `map`, `area`,
  `group`, `enum`, or `val` declaration for any identifier in the workspace.
  Also resolves `#include("path")` to the included file.
- **Find all references** (`Shift+F12`) — finds every occurrence of a function
  or variable name across all `.evs` files in the workspace.
- **Workspace index** — all `.evs` declarations are indexed on activation and
  kept live via a file watcher (creates/changes/deletes).
- **Function name completions** — typing any identifier now offers all 521 core
  and native functions as completions with full parameter snippets.
  e.g. `transition` expands to `transition(${1:map}, ${2:x}, ${3:y}, ...)`.
  User-defined workspace functions are also included.
- **Enum name completions** — all 111 enum types appear in the completion list.

---

## [0.1.2] — 2026-05-08

### Added
- **Hover documentation** — hover over any function name to see its full signature
  and whether it is a native (compiler built-in) or core library function.
  Hover over an enum name to see all its members with values and comments.
  Hover over `ENUM.MEMBER` to see the specific member value.
  Hover over special identifiers (`BOY`, `LAST_ENTITY`, `NORTH`, `True`, …)
  to see a plain-English description.
- **Enum member completion** — typing `DIRECTION.` or any `ENUM.` triggers a
  completion list of all members with values. Typing `@` suggests annotation names.
- **Document symbols (Outline panel)** — `fun`, `map`, `area`, `group`, `enum`,
  and `val` declarations appear in the Outline panel and breadcrumbs.
- **Snippets** — `fun`, `map`, `area`, `group`, `enum`, `if`, `if!`, `ife`,
  `while`, `while!`, `for`, `val`, `var`, `#memory`, `#include`, `@install`,
  `@inject`, `@async`, `transition`, `sleep`, `conversation`, `add_enemy`.
- **Problem matcher** (`everscript`) — register in a `.vscode/tasks.json` task to
  get compiler errors in the Problems panel with clickable file/line links.
- **Task definition** (`everscript`) — task type for future build task support.
- `data/index.json` — 521 function signatures and 111 enum definitions extracted
  from the core library (regenerate with `python3 tools/generate_data.py`).
- `tools/generate_data.py` — data extraction script for dev use.

---

## [0.1.1] — 2026-05-08

### Added
- `.github/copilot-instructions.md` — global agent rules for the plugin repo
  (version bump ritual, file map, test format reference, colour theme policy)
- `docs/future-features.md` — full roadmap: hover docs, auto-completion, diagnostics,
  go-to-definition, signature help, LSP server plan, priority stack

---

## [0.1.0] — 2026-05-08

### Added
- Initial release
- TextMate grammar for `.evs` files (`source.evs`)
- Language configuration (bracket matching, comment toggle, word pattern)
- Bundled Everscript Dark colour theme
- Highlights: keywords, declarations, types, booleans, numbers (hex + 0d-decimal),
  memory addresses, memory ranges, enum access, annotations, preprocessor directives,
  built-in functions, core library functions, user function calls, special identifiers,
  label destinations, operators, strings with in-string placeholders
