# Code Highlighter

Syntax highlighting, language configuration, code snippets, and IDE language services for Everscript.

## Structure

- `syntaxes/` — TextMate grammar rules (`everscript.tmLanguage.json`)
- `themes/` — VS Code dark theme with P1–P9 color palette (`everscript-dark.json`)
- `snippets/` — Code templates and abbreviations (`everscript.json`)
- `language-configuration.json` — Bracket matching, comment toggling, word boundaries
- `tests/` — Grammar unit tests (vscode-tmgrammar-test)

## Testing

Run grammar tests:
```bash
vscode-tmgrammar-test -g code_highlighter/syntaxes/everscript.tmLanguage.json 'code_highlighter/tests/**/*.test.evs'
```

Each test assertion in `tests/highlight.test.evs` verifies that syntax tokens are scoped correctly.

## Grammar Rules

All patterns are in `syntaxes/everscript.tmLanguage.json` under the `patterns` array. First match wins. Add test assertions in `tests/highlight.test.evs` whenever a new rule is added.
