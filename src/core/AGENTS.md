# src/core — agent rules

Kind: **core** — game-neutral features and UI shells (docs/architecture/multi-game.md §2).

## Owns
- `roms/`: the ROM library inside VS Code — status bar item, Everscript: Switch ROM, the ROM panel
  (`roms/webview/`), asking for a ROM when there is none, `onDidChangeRoms` for everyone else.

## Dependencies
- `platform/` only (through `dist/platform`) and `vscode`. Never a game (rule `core-knows-no-game`):
  games are registered by `extension.js` before `activateRoms()`.

## Invariants
- No game named in code or text; game names, docs and capabilities come from the registry.
- The webview page is real files (`roms/webview/*.js|css`), never code in template strings.
