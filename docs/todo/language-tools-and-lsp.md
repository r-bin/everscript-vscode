# Language Tools & LSP — Open Tasks & Roadmap

> Domain: Everscript Language Support (`src/language/`, `syntaxes/`, `themes/`)
> Status key: 🔴 bug · 🟡 feature gap · 🟢 designed, not yet built · ✅ completed

---

## 1. Verified Completed Features (Removed from Open Backlog)

Most core developer tools originally proposed in `future-features.md` are **already implemented natively in JavaScript** inside `src/language/`:

- ✅ **Hover Documentation**:
  - *Implemented in:* [`src/language/hover-provider.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/language/hover-provider.js) and [`workspace-index.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/language/workspace-index.js)
  - Hovers show built-in function signatures, docstrings, hex literals, and memory address names parsed from declarations and `.github/memory-map.md`.
- ✅ **Auto-completion**:
  - *Implemented in:* [`src/language/completion-provider.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/language/completion-provider.js)
  - Keyword completions, function name completions, and enum member completions.
- ✅ **Go-to-Definition & Find References**:
  - *Implemented in:* [`src/language/definition-provider.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/language/definition-provider.js)
  - Jumps from function calls to `fun foo()` declarations and memory address symbols across the workspace.
- ✅ **Document Symbols / Outline**:
  - *Implemented in:* [`src/language/symbol-provider.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/language/symbol-provider.js)
  - Generates outline breadcrumbs and document symbols for functions and rooms.
- ✅ **Compiler Problem Matcher**:
  - *Implemented in:* [`package.json:266`](file:///Users/v/Documents/GitHub/everscript-vscode/package.json#L266)
  - Problem matcher regex captures compiler errors/warnings with clickable `file:line:col` navigation directly in the VS Code Problems pane.
- ✅ **VS Code Task Provider ("Build ROM")**:
  - *Implemented in:* [`package.json:283`](file:///Users/v/Documents/GitHub/everscript-vscode/package.json#L283)
  - Task definition type `everscript` registered for building root `.evs` files.
- ✅ **Dead Branch Highlighting**:
  - *Implemented in:* [`src/language/dead-branch.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/language/dead-branch.js)
  - Fades statically dead `if` branches using editor text decorations.
- ✅ **Code Snippets**:
  - *Implemented in:* [`src/language/snippets/everscript.json`](file:///Users/v/Documents/GitHub/everscript-vscode/src/language/snippets/everscript.json)
  - Block scaffolds for `fun`, `map`, `area`, `enum`.

---

## 2. Active Open Tasks

### 2.1 Rich Diagnostics / Linter
- **Status: 🟡 feature gap**
- While problem matchers capture compile-time errors from `everscript.py`, live editor diagnostics while typing are not yet provided:
  - Argument count checks for native and user functions.
  - Undeclared function usage.
  - Trigger count mismatches (e.g. declared 3 step-on triggers, defined 2).
  - Out-of-bounds RAM addresses (`<0xXXXX>` outside `$7E0000..$7FFFFF`).

### 2.2 Rename Symbol (`F2`)
- **Status: 🟡 feature gap**
- Support symbol rename across all workspace files for user `fun` declarations and local variables.

### 2.3 Signature Help & Inlay Hints
- **Status: 🟡 feature gap**
- Inline parameter names and types during function call editing (`damage(/* target: */ LAST_ENTITY, /* amount: */ 0d10)`).

### 2.4 Tag Names in Scripts (`<boy.hp>`)
- **Status: 🟢 idea / proposal**
- Support dotted tag identifiers within memory brackets in Everscript:
  ```everscript
  <boy.hp> = 0d01;
  <dog.max_hp>
  ```
- Requires compiler lexer integration and bundling `core.evs` (see [resource-tags-system.md](resource-tags-system.md)).

### 2.5 Standalone LSP Server Daemon (Python)
- **Status: 🟢 architecture consideration**
- The current implementation delivers hover, completion, definitions, and symbols via custom JavaScript providers. If deeper AST sharing with Python compiler is desired, bridge via `vscode-languageclient` → stdio → `python everscript_lsp.py`.
