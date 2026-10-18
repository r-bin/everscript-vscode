# src/games/evermore/language — agent rules

Kind: **platform** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- TextMate grammars, color theme, language configuration, snippets, and the hover,
  completion, definition, symbol and dead-branch providers with their workspace index; Build and Run
  (`build-and-run.js`: the compiler call and loading its ROM into the emulator); the compiler settings
  model (`config.ts`).
- Does NOT own: ROM byte reading, radar panel, emulator state, debugger protocol.

## Dependencies
- Providers → `vscode`, `fs`, `path`, and files in this folder (`data/index.json`).
- Forbidden: `debugger/`, `emulator/`, `memory/` rendering (`render-*`, `webview/`).
  `.depcruise.js` rules `no-language-to-debugger`, `no-language-to-emulator`,
  `no-language-to-memory-ui`.
- Existing exceptions: none (no `require('../…')` in this folder).

## State owned

| State | Location | Notes |
|---|---|---|
| Static hover/completion index (`data/index.json`) | `workspace-index.ts` | Loaded once |
| Workspace declaration index | `workspace-index.ts` | Replaced whole by `buildWorkspaceIndex()` |

## Invariants
1. Grammar pattern order matters — first match wins in `tmLanguage.json`.
2. All JSON in grammar must be ASCII-only (no em-dashes, curly quotes).
3. Every new grammar rule needs a test assertion in `src/games/evermore/language/tests/highlight.test.evs`.
4. Theme colors follow P1–P9 priority system from `docs/vscode-highlighter-spec.md`.

## Tests
- Grammar: `src/games/evermore/language/tests/highlight.test.evs` via vscode-tmgrammar-test, run first
  in `npm test` (unit):
  `vscode-tmgrammar-test -g src/games/evermore/language/syntaxes/everscript.tmLanguage.json 'src/games/evermore/language/tests/**/*.test.evs'`
- `tests/memory/activation.test.js` — loads `language-providers` (unit).
