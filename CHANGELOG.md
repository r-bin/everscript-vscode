# Changelog

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
