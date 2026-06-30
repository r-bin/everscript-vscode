# code_highlighter/ — Subsystem README

## Ownership

Owns: TextMate grammar, color theme, language configuration, snippets, hover providers, completion providers, definition providers, diagnostics, symbol providers.

Does NOT own: ROM byte reading, radar panel, emulator state, debugger protocol.

---

## Directory Map

```
code_highlighter/
  language-providers.js    — All VS Code language features (559 LOC — split candidate)
  language-configuration.json — Bracket matching, comment toggle, word pattern
  syntaxes/
    everscript.tmLanguage.json — TextMate grammar (source of truth for token scopes)
  themes/
    everscript-dark.json   — Bundled theme with P1–P9 color palette
  snippets/
    everscript.json        — Code snippets and abbreviations
  tests/
    highlight.test.evs     — Grammar unit test assertions
    (grammar test runner)
  data/
    (static lookup tables for hover data)
```

---

## State Owned

| State | Location | Notes |
|---|---|---|
| Workspace symbol index | `language-providers.js` | Rebuilt on file change |
| Index dirty flag | `language-providers.js` | Triggers rebuild |

---

## Allowed Dependencies

```
language-providers.js → vscode, fs, path, radar-utils.js (memory map hover)
```

**Forbidden:**
- `code_highlighter/` → `debugger/`
- `code_highlighter/` → `memory_radar/webview/`
- `code_highlighter/` → any model files

---

## Language Provider Features

Implemented in `language-providers.js`:
- Hover: memory address names, function signatures, hex literal lookup
- Completions: keyword, function name completions
- Go-to-Definition: function definitions, memory addresses
- Document Symbols: outline of functions/rooms
- Diagnostics: basic syntax checking

---

## Key Invariants

1. Grammar pattern order matters — first match wins in `tmLanguage.json`.
2. All JSON in grammar must be ASCII-only (no em-dashes, curly quotes).
3. Every new grammar rule needs a test assertion in `tests/highlight.test.evs`.
4. Theme colors follow P1–P9 priority system from `docs/vscode-highlighter-spec.md`.

---

## Entropy Hotspots

- `language-providers.js` (559 LOC) — all features in one file. Split target:
  - `hover-provider.js`
  - `completion-provider.js`
  - `definition-provider.js`
  - `symbol-provider.js`
  - `diagnostics-provider.js`
  - `workspace-index.js` (shared index state)

---

## Testing

Grammar tests run via vscode-tmgrammar-test 0.1.3:
```bash
/opt/homebrew/bin/npm test
```
```bash
vscode-tmgrammar-test -g code_highlighter/syntaxes/everscript.tmLanguage.json 'code_highlighter/tests/**/*.test.evs'
```

Each test assertion in `tests/highlight.test.evs` verifies that syntax tokens are scoped correctly.

## Grammar Rules

All patterns are in `syntaxes/everscript.tmLanguage.json` under the `patterns` array. First match wins. Add test assertions in `tests/highlight.test.evs` whenever a new rule is added.
