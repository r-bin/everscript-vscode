# src/games/evermore/code-tab — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- The radar panel's **Code** tab: the `code*` requests (`host.ts`), the pane scaffold and `webview/`.
  Not the data: routines, listings, C and callers are `soe://rom/code/` (`resources/code-*.ts`,
  skill `code-vfs`).

## Dependencies
- Nothing in `src/`: `radar-open.ts` injects `read` (a soe:// file as text through
  `vscode.workspace.fs`) and `open`. Something the tab needs that the VFS lacks is added to
  `soe://rom/code/` (as `routine.json` was), so agents get it too. `.depcruise.js` rule `code-tab-no-imports`.

## State owned
- `webview/code-tab.dom.ts`: `st` (index, filter, deep search, selection, history, routine and text caches).

## Invariants
- A version's text is requested only when shown; the page never sends a path, only a routine
  name (checked against `[A-Za-z0-9_]`) and `asm` / `c` / `pseudo`.
- Show what the VFS says, never a guess: a missing version is disabled, a call without an entry
  shows its address, a routine not found in this ROM says so.
- Page files stay ≤ 250 lines each; commands start with `code`.

## Tests
- `tests/memory/code-tab.test.mts` (dom tier) — unit (scaffold, host on a stub reader), ROM
  (`routine.json`, `.pseudo.c`) and DOM (rail, filter, links, versions, back, branch jump, deep
  search; skips without the ROM or playwright). `CODE_TAB_SHOT=<dir>` saves screenshots.
