# Everscript Language Features & Editor Tooling

> Comprehensive guide to Everscript language support and developer features in VS Code.
> Code lives in `src/games/evermore/language/` and extension configuration in `package.json`.

---

## 1. Syntax Highlighting & Themes

- **TextMate Grammar:** Defined in `src/games/evermore/language/syntaxes/everscript.tmLanguage.json`.
  - Supports keywords (`fun`, `map`, `area`, `enum`, `if`, `else`, `while`, `return`, `goto`).
  - Distinguishes built-in functions, variables, strings, hex/decimal/binary numbers, annotations (`@install`, `@inject`), and preprocessor directives (`#memory`, `#include`).
  - Unit tests via `vscode-tmgrammar-test` in `src/games/evermore/language/tests/highlight.test.evs`.
- **Bundled Theme:** `Everscript Dark` (`src/games/evermore/language/themes/everscript-dark.json`) implements the P1–P9 palette priority designed specifically for Everscript readability.
- **Language Configuration:** `src/games/evermore/language/language-configuration.json` provides bracket matching (`{}`, `[]`, `()`), comment toggling (`//`, `/* */`), and word boundaries.

---

## 2. Editor Intelligence Providers

Language features are registered natively in JavaScript via `src/games/evermore/language/language-providers.js`:

### 2.1 Hover Documentation (`src/games/evermore/language/hover-provider.js`)
Hovering symbols in `.evs` files provides instant context:
- **Built-in Functions:** Displays signature and docstrings (e.g. `transition`, `damage`, `teleport`).
- **Memory Addresses:** Hovering addresses (e.g. `<0x2258>`) looks up canonical RAM labels from `.github/memory-map.md` and `src/games/evermore/language/data/index.json`.
- **Hex & Numeric Literals:** Displays decimal, hexadecimal, and binary conversions.
- **Enums & Constants:** Shows underlying integer values.

### 2.2 Autocompletion (`src/games/evermore/language/completion-provider.ts`)
Context-aware code completion:
- **Keywords & Declarations:** Suggests keywords (`fun`, `map`, `area`, `enum`, `val`, `var`).
- **Function Names:** Completes built-in API calls and workspace-declared functions.
- **Enum Members:** Completes enum identifiers after dot syntax (`DIRECTION.NORTH`, `ITEM.JAGUAR_RING`).

### 2.3 Go-to-Definition & Symbol References (`src/games/evermore/language/definition-provider.ts`)
- `Cmd+Click` or `F12` on a function call jumps directly to its `fun` declaration across any file in the workspace.
- Resolves memory address declarations and constants indexed by `src/games/evermore/language/workspace-index.ts`.

### 2.4 Document Symbols & Breadcrumbs (`src/games/evermore/language/symbol-provider.ts`)
- Populates the VS Code Outline pane and navigation breadcrumbs with structured hierarchy (`map` → triggers, `fun`, `enum`).

### 2.5 Dead Branch Fading (`src/games/evermore/language/dead-branch.ts`)
- Identifies compile-time static constants in `if` conditions and fades unreachable code blocks using editor decorations.

### 2.6 Code Snippets (`src/games/evermore/language/snippets/everscript.json`)
- Scaffold templates for quick code authoring:
  - `fun` — Function block template.
  - `map` — Map definition scaffold with triggers.
  - `area` / `enum` — Data structures.

---

## 3. Build & Diagnostics Tooling

### 3.1 Compiler Problem Matcher
Registered in `package.json` under problem matcher `everscript`:
```json
"pattern": {
  "regexp": "^(.+):(\\d+):\\s+(error|warning|note):\\s+(.+)$",
  "file": 1,
  "line": 2,
  "severity": 3,
  "message": 4
}
```
Errors from `everscript.py` during compilation are parsed and populated into the VS Code Problems tab with clickable file, line, and column links.

### 3.2 Build ROM Task Definition
Registered in `package.json` under task type `everscript`:
- Allows defining standard `.vscode/tasks.json` tasks to invoke the Everscript compiler on the active file.

---

## 4. Open Work & Roadmap

For planned additions (live diagnostics/linter, symbol rename `F2`, signature help, and script tag names `<boy.hp>`), see [`docs/todo/language-tools-and-lsp.md`](todo/language-tools-and-lsp.md).

