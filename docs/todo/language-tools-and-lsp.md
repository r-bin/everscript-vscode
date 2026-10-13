# Language Tools & LSP — Open Tasks & Roadmap

> Domain: Everscript Language Support (`src/language/`, `syntaxes/`, `themes/`, LSP)
> Status key: 🔴 bug · 🟡 feature gap · 🟢 designed, not yet built

---

## 1. Language Server Protocol (LSP) Architecture

A Language Server Protocol server (wrapping the Python Everscript compiler or providing a native TypeScript AST parser) unlocks rich IDE features for `.evs` scripts.

- **Architecture:** `vscode-languageclient` → stdio → `python everscript_lsp.py` (or bundled worker).
- **Core Compiler Integration:** The compiler already parses `.evs` into an AST — an LSP server bridges this representation to VS Code language features.

---

## 2. Editor Intelligence Features

### 2.1 Hover Documentation
| Target | Content to Show | Implementation Notes |
|---|---|---|
| Built-in functions (`transition`, `damage`) | Signature + docstring | Static JSON table |
| User `fun foo(...)` | Docstring from declaration site | Requires AST extraction |
| Enum types (`DIRECTION`) | All members with values | Medium — parse enums |
| Enum members (`DIRECTION.NORTH`) | Value + parent enum | Low |
| Map names (`MAP.GRAVEYARD`) | Map ID, act, object/trigger counts, enter script | High — link to room doc data |
| Special identifiers (`LAST_ENTITY`, `BOY`) | Description and underlying constant | Low — static table |
| Ingredients/items (`ASH`, `WAX`, `WEED`) | Alchemy recipes and uses | Static table |
| Memory addresses (`<0x1f20>`) | Label & struct field from `.github/memory-map.md` | Parse memory map |
| Tag names (`<boy.hp>`) | Tag summary + link to `soe://tags/boy/hp.md` | See §4 |

### 2.2 Autocompletion
- Snippets for `fun`, `map`, `area`, `enum` blocks.
- Member completion after `DIRECTION.`, `MAP.`, `ITEM.`.
- Function parameter name and type hints at position `N`.
- Annotation suggestions after `@` (`install`, `inject`, `async`, `weak`, `count_limit`).
- Preprocessor directives after `#` (`memory`, `include`, `patch`, `if`, `endif`).
- Map object indices after `object[`.

### 2.3 Diagnostics (Lints & Errors)
- Undeclared function calls.
- Argument count mismatches (static arity check for native functions; AST check for user functions).
- `stepon_triggers` / `b_triggers` count vs implementation mismatch in map definitions.
- Memory address bounds check (flag `<0xXXXX>` outside legal SNES WRAM `$7E0000..$7FFFFF`).
- `#include` file resolution failure.
- Duplicate symbols in scope.
- Unreachable code after `return` or unconditional `goto`.

### 2.4 Navigation & Refactoring
- **Go-to Definition / Find All References:** Jump from `fun foo()` call to definition; resolve enum members; open `#include` target files. Support function overload candidate list.
- **Rename Symbol (`F2`):** Rename `fun` names and local variables across all workspace call sites.
- **Signature Help & Inlay Hints:** Inline parameter names and types during active typing.
- **Code Folding:** Explicit folding regions for `map {}`, `fun {}`, `enum {}`, `area {}`, `group {}`.
- **Semantic Highlighting:** Distinct post-tokenization colors for user functions vs built-ins, parameter vs local variables, and memory reads vs writes.
- **Symbols Outline & Workspace Search (`Cmd+T`):** Document outline breadcrumbs and workspace-wide symbol search.

---

## 3. Tooling & Build Integration

### 3.1 Compiler Problem Matcher
- Register a VS Code problem matcher regex capturing `everscript.py` stdout errors with clickable `file:line:col` links directly in the Problems pane.

### 3.2 Build ROM Tasks
- Register standard VS Code tasks (`workbench.action.tasks.runTask`) to execute `python everscript.py ...` with workspace configurations.

---

## 4. Script Syntax Extensions: Tag Names in Scripts (`<boy.hp>`)

- **Concept:** Allow referencing canonical tags directly inside memory brackets instead of magic addresses:
  ```everscript
  // current
  <0x4EB3> = 0d01;
  MEMORY.BOY_CURRENT_HP = 0d01;
  <BOY>[ATTRIBUTE.HP] = 0d01;

  // with tag names
  <boy.hp> = 0d01;
  <dog.max_hp>
  ```
- **Requirements & Pitfalls:**
  - Lexer & TextMate grammar adjustment for dotted lowercase identifiers within `<...>`.
  - Type width inference (defaulting to word vs explicit byte/word).
  - Ambiguity resolution (e.g. `boy.max_hp` in entity record `$4E98` vs stats block `$0A35`).
  - Integration with `core.evs` bundled in the compiler.
