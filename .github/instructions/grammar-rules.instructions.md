---
name: grammar-rules
description: Use when editing the TextMate grammar (src/language/syntaxes/everscript.tmLanguage.json) or its tests (src/language/tests/*.test.evs) in everscript-vscode.
applyTo: "src/language/syntaxes/**,src/language/tests/**"
---

# Skill: Grammar Rules

Use this skill when editing the TextMate grammar
(`src/language/syntaxes/everscript.tmLanguage.json`) or its tests
(`src/language/tests/*.test.evs`).

- Pattern order matters: first match wins. See the `patterns` array in the grammar file.
- All JSON must be ASCII-only. No em-dashes (`—`), curly quotes, or box-drawing
  characters.
- Use named captures (`captures`) when a single `match` produces multiple token types.
- After adding a grammar rule, add at least one test assertion in
  `src/language/tests/highlight.test.evs` (grammar unit tests run via
  `vscode-tmgrammar-test`, part of `npm test`).

## Test assertion format

```
some_token_here
// <- scope.name.evs         ← tests col 0 (the leftmost char)
//  ^^^^^scope.name.evs      ← tests cols 2..7 (caret range, from/to are absolute in line)
```

`from = commentLength + startIdx`, `to = commentLength + lastCaretIdx + 1`.
Token overlap check: `from < t.endIndex && to > t.startIndex`.
Do **not** let carets extend past the last character of the target token.
