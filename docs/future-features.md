# Everscript VS Code Extension — Future Features

This document tracks ideas for extending the plugin beyond syntax highlighting.
Items are grouped by VS Code extension API surface and rough complexity.

---

## Currently Working

- TextMate grammar (syntax highlighting)
- Language configuration (bracket matching, comment toggle)
- Bundled Everscript Dark theme
- Grammar unit tests via `vscode-tmgrammar-test`

---

## Near-term: Language Client (LSP)

A Language Server Protocol server (Python subprocess wrapping the existing Everscript
compiler/parser) unlocks most of the high-value features below. The compiler already
parses `.evs` files into an AST — the LSP server can reuse that work.

Architecture: `vscode-languageclient` → stdio → `python everscript_lsp.py`

---

## Feature Ideas

### 1. Hover documentation

| Hover target | What to show | Effort |
|---|---|---|
| Built-in function (`transition`, `damage`, etc.) | Signature + one-line description from core comments | Low — static JSON table |
| Core `fun foo(...)` | Docstring from declaration site | Medium — needs AST |
| Enum type (e.g. hover `DIRECTION`) | All members with values | Medium |
| Enum member (e.g. hover `DIRECTION.NORTH`) | Value + parent enum | Low |
| `MAP.GRAVEYARD` | Everything known: map ID, act, object count, stepon_trigger count, enter script | High — needs room doc data |
| Special identifier (`LAST_ENTITY`, `BOY`, etc.) | Description of what it refers to | Low — static table |
| Ingredient/item name (`ASH`, `WAX`, `WEED`) | Full ingredient data: alchemy uses, recipes | Medium — static table |
| `object[N]` | Object slot description for current map, if known | High — needs map data |
| Memory address `<0x1f20>` | RAM label from memory-map.md, if catalogued | Medium — parse memory-map |

### 2. Auto-completion

| Context | Suggestion | Effort |
|---|---|---|
| `fun`, `map`, `area`, `enum` keyword | Snippet with block scaffold | Low |
| After `DIRECTION.` | All members of that enum | Medium — needs enum index |
| After `MAP.` | All known map names | Low — static list |
| Function argument position N | Param name + type hint from declaration | High — needs param inference |
| `@` | All annotation names (`install`, `inject`, `async`, `weak`, `count_limit`) | Low |
| `#` | `memory`, `include`, `patch`, `if`, `endif` | Low |
| After `object[` | Object index suggestions for current map | High |

### 3. Diagnostics (errors / warnings)

| Check | Severity | Notes |
|---|---|---|
| Call to undeclared `fun` | Error | Cross-file resolution needed |
| Wrong argument count for `fun` | Error | Needs param count from AST |
| Wrong argument count for native functions | Warning | Static arity table |
| `stepon_triggers` declared but not overridden in map body | Warning | Needs map schema |
| Trigger count mismatch (e.g. declared 3, only 2 defined) | Warning | Needs map schema |
| `memory(<0xXXXX>)` address out of known RAM range | Warning | Needs memory map bounds |
| `#include` path not found | Error | File resolution |
| Duplicate `fun` or `enum` name in scope | Warning | Scope analysis |
| Unreachable code after `return` / unconditional `goto` | Hint | Control flow |

### 4. Go-to Definition / Find References

| Action | Target |
|---|---|
| `cmd+click` on `fun foo` call | Jump to `fun foo(...)` declaration |
| `cmd+click` on `enum DIRECTION` member | Jump to enum definition |
| `cmd+click` on `#include(path)` | Open included file |
| Find All References on a `fun` name | All call sites across workspace |
| Find All References on an enum member | All uses |

Complexity note: functions can be overloaded by override — go-to should list all candidates if ambiguous.

### 5. Signature Help

While typing a function call, show the active parameter name and type inline.
Example: `damage(target, amount)` — highlight `amount` when cursor is past the first comma.

Effort: Medium — requires param metadata at call site.

### 6. Rename Symbol

`F2` on a `fun` name or local variable renames across all call sites within the workspace.
Out of scope: enum members that map to ROM constants (renaming those is cosmetic only).

### 7. Code Folding

Fold `map { }`, `fun { }`, `enum { }`, `area { }`, `group { }` blocks.
Already partially handled by VS Code's indent-based folding, but explicit TextMate fold markers
(`// #region` / `// #endregion`) would make it controllable.

### 8. Semantic Highlighting

Post-tokenisation colouring via the Semantic Tokens API:
- User-defined `fun` calls in a distinct colour from built-in calls
- Parameters vs local `var`/`val` bindings
- Write vs read of a memory address

### 9. Inlay Hints

Show parameter names beside positional arguments:
```
damage(/* target: */ LAST_ENTITY, /* amount: */ 0d10)
```
Effort: High — requires full param name extraction.

### 10. Code Actions / Quick Fixes

| Trigger | Fix offered |
|---|---|
| Unknown identifier | "Add `val NAME = …` declaration" |
| Wrong argument count | "Add missing argument" / "Remove extra argument" |
| `#include` not found | "Create file at path" |

### 11. Document Symbols / Breadcrumbs

Show the outline of the current `.evs` file in the Outline panel and breadcrumbs bar:
- All `map`, `area`, `group`, `fun`, `enum` declarations as symbols
- Nested structure (map → triggers, functions inside map)

Low–Medium effort: walk the grammar tokens; no LSP needed for basic outline.

### 12. Workspace Symbols

`cmd+T` to search across all `.evs` files for a `fun`, `map`, or `enum` by name.

### 13. Embedded Rich Content (webview / CodeLens)

Lower priority, high complexity:
- **CodeLens above `map ROOM_NAME`**: "Act N · M objects · K stepon triggers" pulled from room doc data
- **CodeLens above `fun`**: "Called N times"
- **Hover webview for MAP**: Render the full room doc summary inline

### 14. Problem Matcher for Compiler Output

Register a problem matcher so that `everscript.py` compile errors appear in the Problems
panel with clickable file/line links instead of raw terminal output.

Effort: Low — just regex on compiler stdout format.

### 15. Tasks / Build Support

Register a VS Code task ("Build ROM") that runs `python everscript.py ...` with the correct
args, feeding into the problem matcher above.

---

## Data Requirements

Many hover/completion features require machine-readable data that doesn't exist yet:

| Data | Where it could live | Owner |
|---|---|---|
| Function signatures + descriptions | `docs/function-reference.json` | Plugin |
| Enum definitions (all members + values) | Already in `in/core/*.evs` — needs extraction | Compiler |
| Map/room metadata (act, triggers, objects) | `docs/rooms/` + memory-map.md | Main repo |
| Memory address labels | `.github/memory-map.md` | Main repo |
| Ingredient / item data | To be documented | Main repo |

---

## Priority Stack (suggested order)

1. **Problem matcher** — low effort, immediate value during development
2. **Hover: built-in functions** — static table, no LSP needed, high visibility
3. **Hover: enum members** — parse `in/core/*.evs` at startup, medium effort
4. **Document symbols / Outline** — grammar-based, no LSP needed
5. **Diagnostics: arg count** — static arity table for native functions
6. **LSP server skeleton** — unlocks all dynamic features
7. **Go-to definition** — first big LSP feature
8. **Completion: enum members** — second big LSP feature
9. **Hover: MAP.* + room docs** — requires room doc data pipeline
10. **Inlay hints / Signature help** — polish tier
