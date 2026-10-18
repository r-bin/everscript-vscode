# language/ — Subsystem README

## Directory Map

```
language/
  language-providers.js    — registers all VS Code language features (wires the files below)
  workspace-index.ts       — static JSON index + live workspace declaration index
  hover-provider.js        — hover
  completion-provider.js   — completions
  definition-provider.js   — go-to-definition
  symbol-provider.ts       — document symbols
  dead-branch.ts           — fades statically dead if-branches
  language-configuration.json       — Bracket matching, comment toggle, word pattern
  trace-language-configuration.json — Same, for the trace language
  syntaxes/
    everscript.tmLanguage.json       — TextMate grammar (source of truth for token scopes)
    everscript-trace.tmLanguage.json — Trace grammar
  themes/
    everscript-dark.json   — Bundled theme with P1–P9 color palette
  snippets/
    everscript.json        — Code snippets and abbreviations
  tests/
    highlight.test.evs     — Grammar unit test assertions
  data/
    index.json             — static lookup tables for hover data
```

---

## Language Provider Features

Registered by `language-providers.js`:
- Hover: memory address names, function signatures, hex literal lookup
- Completions: keyword, function name completions
- Go-to-Definition: function definitions, memory addresses
- Document Symbols: outline of functions/rooms
- Dead branches: statically dead `if` branches are faded (decorations; there are no diagnostics)

---

## Testing

Grammar tests run via vscode-tmgrammar-test 0.1.3 as part of `npm test`. Each test
assertion in `tests/highlight.test.evs` verifies that syntax tokens are scoped correctly.

## Grammar Rules

All patterns are in `syntaxes/everscript.tmLanguage.json` under the `patterns` array. First match wins. Add test assertions in `tests/highlight.test.evs` whenever a new rule is added.

## Rules for changing this folder

Dependencies, invariants and tests: [AGENTS.md](AGENTS.md).
