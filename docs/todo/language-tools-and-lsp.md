# Language Tools & LSP — Open Tasks & Roadmap

> Domain: Everscript Language Support (`src/language/`, `syntaxes/`, `themes/`)
> Shipped features reference: [`docs/language-features.md`](../language-features.md)
> Status key: 🔴 bug · 🟡 feature gap · 🟢 designed, not yet built

---

## 1. Active Open Tasks

### 1.1 Rich Diagnostics / Linter
- **Status: 🟡 feature gap**
- While problem matchers capture compile-time errors from `everscript.py`, live editor diagnostics while typing are not yet provided:
  - Argument count checks for native and user functions.
  - Undeclared function usage.
  - Trigger count mismatches (e.g. declared 3 step-on triggers, defined 2).
  - Out-of-bounds RAM addresses (`<0xXXXX>` outside `$7E0000..$7FFFFF`).

### 1.2 Rename Symbol (`F2`)
- **Status: 🟡 feature gap**
- Support symbol rename across all workspace files for user `fun` declarations and local variables.

### 1.3 Signature Help & Inlay Hints
- **Status: 🟡 feature gap**
- Inline parameter names and types during function call editing (`damage(/* target: */ LAST_ENTITY, /* amount: */ 0d10)`).

### 1.4 Tag Names in Scripts (`<boy.hp>`)
- **Status: 🟢 idea / proposal**
- Support dotted tag identifiers within memory brackets in Everscript:
  ```everscript
  <boy.hp> = 0d01;
  <dog.max_hp>
  ```
- Requires compiler lexer integration and bundling `core.evs` (see [resource-tags-system.md](resource-tags-system.md)).

### 1.5 Standalone LSP Server Daemon (Python)
- **Status: 🟢 architecture consideration**
- The current implementation delivers hover, completion, definitions, and symbols via custom JavaScript providers. If deeper AST sharing with Python compiler is desired, bridge via `vscode-languageclient` → stdio → `python everscript_lsp.py`.
