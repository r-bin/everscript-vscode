# AI Architecture Guide — Everscript VS Code Extension

> The laws every change must follow. Read it before modifying any subsystem.
> Each law is marked **[now]** (enforced today) or **[target]** (the direction; new code
> must follow it, legacy code is migrated when touched).
> The backlog lives in `docs/cleanup.md`, the target structure in `docs/architecture/multi-game.md`, not here.

---

## 1. Mission

Make Everscript code more readable in VS Code, and make Secret of Evermore romhacking
tooling usable from inside the editor. Every change must serve one of:
- better token differentiation, hover, completion, diagnostics or navigation for `.evs`
- better insight into the ROM / running game (emulator, maps, sprites, music, memory)
- better developer tooling (build, debug, patch export, tests)

---

## 2. Layers and domain kinds

The layers (`docs/architecture/multi-game.md` §2, enforced by `.depcruise.js`):

| Layer | Holds | May depend on |
|---|---|---|
| `src/platform/` | SNES facts, ROM library and identification, CDL engine, TAS format, PNG/CRC/zip | itself only; no `vscode` |
| `src/core/` | game-neutral VS Code features: ROM panel, game views, map-editor shell, MCP | `platform/`, `vscode`; no game |
| `src/games/<game>/` | everything about one game | `platform/`, `core/`; no other game (one bridge: `games/evermore/imports/<game>/`) |
| `src/emulator/` | the emulator panel (to `core/` with cleanup 5.3) | `platform/`, `vscode`; no game |

Inside a game, every folder is one of two kinds:

| Kind | Examples (Evermore) | May depend on |
|---|---|---|
| **Library** (pure, no `vscode`, no UI) | `maps`, `script`, `simulation`, `localizations` | other libraries of the game, `platform/` |
| **Feature** (a tab, panel, file system or language service) | `memory`, `rooms`, `sprites`, `music`, `scripts-tab`, `rom`, `scaling`, `docs-tab`, `resources` (soe://), `language`, `debugger` | libraries, `core/`, read APIs (`soe://`) |

`src/extension.js` is the composition root: the ROM library, the one list of games, the game
views and MCP. Each game's `src/games/<game>/extension.js` registers that game's commands and
injects cross-feature capabilities (e.g. the emulator's `readMemory` into Evermore's `resources`).
They own no logic; Evermore's still holds radar state (cleanup 5.4). `src/recorder/extension.js` is the second one, for the second extension
built from this repo (SNES CDL Recorder): it may use only the emulator, and its package holds
only what it requires.

---

## 3. Laws

### 3.1 Features are independently removable **[now: rule · target: fully true]**
Deleting a feature domain may only break its own registration lines in its game's `extension.js`.
- A feature never `require`s another feature — not its host code, not its webview files,
  not its globals. Cross-feature capability flows **only** through injection in
  `extension.js` or through `soe://`.
- Anything two features need moves down into a library (`platform/`, a game's `maps/`, …), into
  `core/` when it is game-neutral and two games need it, or into `soe://`.
- Tabs that share one webview are given to the host as a plain list of
  `{ id, label, html, css, js, onMessage }` objects; a missing tab is skipped, not fatal.
  (A plain array is not a "registry" in the sense of §3.6.)
- Enforced by `.depcruise.js` (`npm run check:deps`). A new feature domain gets a
  no-feature-to-feature rule the same day.

### 3.2 Direction **[now]**
```
platform  ←  core  ←  game library  ←  game feature  ←  game extension.js  ←  src/extension.js
   (parser → model → renderer → UI inside each)
```
Forbidden: renderer → parser, UI mutating models except through explicit action files,
any library touching `vscode`, the DOM or extension state, host code importing a
`webview/` file.

### 3.3 One owner per state **[now]**
Every piece of state has exactly one owner file; no mirrored state, no implicit sync.
Viewport, zoom, selection, filters, emulator runtime state, panel lifecycle, room tree
cache, memory-map cache, enum cache and extension config each have a single owner listed
in the domain's `AGENTS.md`.

### 3.4 soe:// is the data plane **[target]**
Anything derived from the ROM or live RAM that more than one consumer needs (a tab, hover,
MCP, tests) is exposed under `soe://` first and consumed from there. Tabs fetch data from
`soe://` instead of from each other. Writes, when added, produce patch overlays, never
in-place ROM mutation.

### 3.5 Code lives in code files, not strings **[target — no new violations]**
- No JavaScript, CSS or HTML inside JS template literals or string concatenation. Webview
  code lives in real `.ts`/`.js`, `.css` and `.html` files under `src/<domain>/webview/`.
- Webviews load their code as files (`asWebviewUri`) or as an esbuild bundle — never by
  `readFileSync` + string splicing.
- Configuration reaches the webview as data (a `<script type="application/json">` block or
  an `init` message), never by interpolating `${…}` into code.
- Building DOM from data is fine; use the shared `escH` and keep it out of logic files.
- Legacy offenders (the `src/emulator/*-view.js` family, `panel-webview.js`,
  `menu/menu-view.js`, the radar concatenation in `memory/webview/index.js`) are converted
  when touched. Do not add to them.

### 3.6 Shared code: extract on the third copy **[now]**
- One user → keep it local. Two → duplication is acceptable. **Three or more → extract**
  into the right library as pure functions.
- Forbidden: grab-bag `utils.js`/`common.js`, helpers-of-helpers, DI containers, plugin
  registries with discovery or lifecycle.
- Known canonical homes: SNES addressing and byte reads, CRC-32, PNG, the 65816 opcode matrix,
  the cartridge header → `src/platform/`; Evermore graphics decode (BGR555, 2/4bpp, sprite
  blocks) → `games/evermore/maps/`; webview helpers (`escH`, hex format, tab strip, CSP shell,
  theme) → `src/core/webview/` (cleanup 5.1, 5.3).

### 3.7 Types **[target: strict everywhere]**
- New files are TypeScript with `strict: true`. Libraries and platform code are TS first.
- Existing JS is ratcheted: a file, once added to the strict list, may never fall out of
  it. `@types/vscode` is a dev dependency, so the VS Code API is typed, not `any`.
- Host↔webview messages are a typed union per panel; no stringly-typed `command` switch
  without a type.

### 3.8 Legal: data provenance and no game assets **[now — known violations in `docs/cleanup.md` steps 1–2, §4]**
- **No game assets in the repo — ever, including git history:** no ROM or ROM byte dumps, no
  graphics/icons/palettes/tiles extracted from the ROM (PNG, GIF, base64, pixel arrays), no
  music/SPC/BRR/WAV, no game text or script dumps, no map blobs, no screenshots. The extension
  decodes the user's own ROM at runtime; tests read it through `soe://` and skip without it.
  Goldens hold observed facts (offsets, lengths, counts, hashes), never ROM bytes.
- ROM facts (addresses, tables, layouts, formats) must come from the ROM itself, traces, or
  our own disassembly, written in our own words, and be checkable by a test against the ROM.
- Do not copy code, data tables, structure definitions or names from other projects
  (SoETilesViewer, SoEScriptDumper, …) and do not read their source while implementing the
  same thing. Legacy exceptions are being replaced (`docs/plans/script-decoder-from-game-code.md`).
  Names already in the repo stay for now and are rewritten in our own style (`docs/cleanup.md`
  D4); don't add more.
- No runtime or test path may point into another repository's checkout; the ROM comes only from
  the game's scheme (`soe://`, `som://`) through the resolver (`docs/architecture/multi-game.md` §5).
- Everything learned about the game is recorded as a knowledge entry (`game-knowledge` skill).

### 3.9 File size **[now]**

| Hand-written LOC | Status |
|---|---|
| ≤ 250 | fine |
| 250–400 | justify in the domain README |
| > 400 | must split before adding to it |

Generated files, JSON data and vendored code are exempt. A large template literal is not
"indivisible" — see §3.5.

### 3.10 Local reasoning **[now]**
Each `src/<domain>/` has two files, following the nested `AGENTS.md` convention:
- `AGENTS.md` — the contract agents load automatically when working in that folder: kind,
  ownership, allowed dependencies (plus existing exceptions not to extend), state owned,
  invariants, tests. Short (≤ 70 lines); rules live only here.
- `README.md` — descriptive docs for humans (file tables, how it works); it links to
  `AGENTS.md` and does not restate the rules.

A directory must be understandable from its own files; do not write "see extension.js for
details" — move the logic or document the invariant locally. A new domain gets both files
in the commit that creates it.

### 3.11 Performance **[now — roadmap in `docs/cleanup.md` §5]**
- The extension activates only on `.evs`, `soe://`, its commands, debug and MCP — never
  `onStartupFinished`. Heavy modules are `require`d lazily on first use.
- Emulator per-frame work runs only when its output is visible. No per-frame round trip to
  the extension host; batch to ≥ 100 ms. Send typed arrays over `postMessage`, never
  `Array.from` of memory.

### 3.12 What ships **[now — known violations in `docs/cleanup.md` 1.4]**
`.vscodeignore` excludes everything that is not runtime: docs, AI files, tools, tests,
caches (`.emscripten_cache`), TS sources whose `dist/` ships, and every ROM/save-state
extension (`*.sfc`, `*.smc`, `*.srm`, `*.spc`, `*.state`). Check with `vsce ls` after
touching it.

---

## 4. Tests **[now — `tests/tiers.json`, `tools/test.mts`]**

| Script | Tier | Needs | Time (2026-10) |
|---|---|---|---|
| `npm test` | grammar + `unit` | nothing | ~7 s |
| `npm run test:rom` | `rom` | a ROM in the ROM library (skips without) | ~80 s |
| `npm run test:dom` | `dom` | headless Chromium (Playwright) | ~45 s |
| `npm run test:emulator` | `emulator` | the built snes9x cores (`build:cores`) | ~20 s |
| `npm run test:all` | every tier, after building cores and the music engine | all of the above | ~3 min |

Every `tests/**/*.test.js` is in exactly one tier or in `manual` with a reason; the runner fails
otherwise. A ROM test finds its ROM with `romPath()` and skips cleanly without one. `npm test`
never rebuilds native code or rewrites tracked files.

---

## 5. Checks and release

- `npm test`, `npm run typecheck` and every `check:*` must pass: `circular`, `deps`, `dead`,
  `dup` (clones of 30+ lines), `legal`, `knowledge` (no new undocumented address),
  `ai-context` (these files' limits). Their baselines and allow lists only shrink.
- Versioning, commit format and install steps have one home: the `release-ritual` skill
  (`.agents/skills/release-ritual/SKILL.md`). Do not restate them elsewhere.

---

## 6. Where things are

| Need | Read |
|---|---|
| Cleanup decisions and backlog | `docs/cleanup.md` |
| Target structure for any game | `docs/architecture/multi-game.md` |
| Which domain does what | `src/README.md`, then `src/<domain>/README.md` |
| Rules for one domain | `src/<domain>/AGENTS.md` (auto-loaded by agents in that folder) |
| Machine-enforced dependency rules | `.depcruise.js` |
| State ownership details | the owning domain's `AGENTS.md` |

The map editor's client-side state owners: `src/games/evermore/rooms/webview/STATE.md`.
