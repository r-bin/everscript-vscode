---
name: architecture
description: Use before adding, moving, splitting or deleting a module under src/, fixing a dependency rule, untangling duplicated state, or porting JS to TS. Layers, rules, procedures, traps of moving files.
applyTo: "src/**,.depcruise.js,tsconfig*.json"
---

# Architecture

The layout and its reasons: `docs/architecture/multi-game.md`. The laws: `AI_ARCHITECTURE_GUIDE.md`.
What is still being moved: `docs/cleanup.md`. This skill is how to work inside them.

## Layers (enforced by `npm run check:deps`, `.depcruise.js`)

| Layer | Holds | May import |
|---|---|---|
| `src/platform/` | SNES facts, ROM library and identification, CDL engine, TAS format, PNG/CRC/zip | itself only (`platform-stands-alone`), no `vscode` |
| `src/core/` | game-neutral VS Code features: ROM panel, game views, map-editor shell, MCP | `platform/`, `vscode`; never a game |
| `src/games/<game>/` | everything about one game; `extension.js` registers it | `platform/`, `core/`; never another game except `games/<game>/imports/<other>/` |
| `src/emulator/` | the emulator panel (moving to `core/` with cleanup 5.3) | `platform/`; no game (`emulator-knows-no-game`) |
| `src/extension.js` | composition root: ROM library, the list of games, game views, MCP | everything, but owns no logic |

Inside a game, a **library** (pure: `maps/`, `script/`, `localizations/`) never imports a
**feature** (a tab or panel), and a feature never imports another feature. What two features
need moves down into a library or `soe://`; a capability one feature needs from another is
**injected** by the game's `extension.js` (see how `handleRomMessage` gets `loadCdl`). Facts
never cross games (root AGENTS.md §0.4).

## Before writing code

- A decoder or format: look it up first (`game-knowledge` skill, `docs/`), and check the sibling
  `everscript` repo (`compiler/`, `tools/`) — this repo shipped weaker second copies twice.
- A helper: search `src/platform/` (HiROM reads, CRC, PNG, header, opcode matrix). Never a third copy.
- A new folder: give it an `AGENTS.md` (kind, owns, dependencies, invariants, tests) and a depcruise
  rule the same day if it must stay apart.

## Splitting a file

Over 400 lines must split, 250–400 needs a reason. Name files after what they **own**
(`editor-host.js`, `scope-analysis.js`), never `utils`/`helpers`. Order: pure functions, then
readers, then renderers; the original keeps only orchestration (requires, `registerCommand`,
watchers, thin calls). A panel's message switch becomes `handlesXMessage(cmd)` /
`handleXMessage(msg, ctx)` in the owning folder, with `ctx` holding what the panel owns
(`post`, ROM loader, …) — see `games/evermore/rooms/editor-host.js`. Delete the original code;
no shims. No shared helper for one user, no base class for fewer than three.

## State

One owner per state: the file that creates it; others get it as a return value or parameter.
Derived state is computed, or computed once in one function. Webview state (zoom, selection,
toggles) stays in the webview. Caches live with their owner and expose a `clear()`.

## Moving files (the traps)

`git mv`, then fix every path, then `npm run test:all` and all checks. What a search-and-replace misses:
- paths built from variables: `path.join(SRC, 'shared', …)`, `path.join(__dirname, '..', 'src', 'rooms')`,
  CSS/JS lists in page loaders and DOM tests;
- `require()` of a single file without its extension; a bare `'../'` used as a building block;
- `dist/` twins: a TS file moves its compiled output (`dist/<same path>`); JS requires it from there;
  a TS file requiring JS needs the path from `dist/` (`src/games/evermore/script/names.ts`);
- `package.json` (grammar, theme, snippets, `main`), `.vscodeignore`, `knip.json`, `tsconfig.json`
  excludes, `tools/recorder/package-files.js`, shell scripts with relative paths;
- `.depcruise.js` lookaheads (`'^src/(?!foo/)'`) and alternations — a plain rename skips them;
- tests that read or patch source text (`smoke`, `ui`, `scaling-rom`, `emulator-health`);
- skills' `applyTo`, nested `AGENTS.md` and docs.

## TypeScript (cleanup D9)

New code is TypeScript (`strict`); JS converts when it is touched for real work, one file at a
time, local interfaces only, no giant shared types file. One build: `tsconfig.build.json` →
`dist/` mirroring `src/` (`npm run build:ts`); the root `tsconfig.json` is typecheck-only.
Webview files are browser-side and excluded until the esbuild step (cleanup 5.3).

## Scripted edits

A scripted `replace`/`sed` that matches nothing exits 0 and changes nothing. Assert every
substitution hit (`if new == old: sys.exit('MISS')`), or use the Edit tool.

## Dead code

`npm run check:dead` (knip) before committing. A file nothing requires and no manifest names is
deleted. When splitting, the original goes. Webview files are outside knip; check them by hand.

## After

The `release-ritual` skill: version bump, `npm run test:all`, every `check:*`, commit, `npm run deploy`.
