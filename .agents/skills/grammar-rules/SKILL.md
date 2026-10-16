---
name: grammar-rules
description: Use when editing the Everscript TextMate grammar, its tests or the bundled colour theme (src/games/evermore/language/syntaxes, themes, tests; docs/vscode-highlighter-spec.md).
applyTo: "src/games/evermore/language/syntaxes/**,src/games/evermore/language/tests/**,src/games/evermore/language/themes/**,docs/vscode-highlighter-spec.md"
---

# Grammar and colour theme

## Grammar (`src/games/evermore/language/syntaxes/everscript.tmLanguage.json`)

- Pattern order matters: first match wins (the `patterns` array).
- ASCII only in the JSON: no em-dashes, curly quotes or box-drawing characters.
- Named captures (`captures`) when one `match` yields several token types.
- Every new rule gets a test assertion in `src/games/evermore/language/tests/highlight.test.evs`
  (`vscode-tmgrammar-test`, the first thing `npm test` runs).
- It is a regex grammar on purpose: highlighting runs on every keystroke, so it does not reuse
  the compiler's parser (`docs/vscode-highlighter-spec.md` §Grammar Strategy).

Test assertion format:

```
some_token_here
// <- scope.name.evs         tests col 0 (the leftmost char)
//  ^^^^^scope.name.evs      tests cols 2..7 (caret range, absolute in the line)
```

`from = commentLength + startIdx`, `to = commentLength + lastCaretIdx + 1`; a token is hit when
`from < t.endIndex && to > t.startIndex`. Carets never extend past the target token's last char.

## Colour theme (`src/games/evermore/language/themes/everscript-dark.json`)

Colours follow the P1–P9 priority tiers of `docs/vscode-highlighter-spec.md` §Color Priority
Tiers. Moving a scope to another tier changes **both** the theme JSON and the spec table.
