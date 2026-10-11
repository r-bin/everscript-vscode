# AI Architecture Guide — Everscript VS Code Extension

> The laws every change must follow. Read it before modifying any subsystem.
> Each law is marked **[now]** (enforced today) or **[target]** (the direction; new code
> must follow it, legacy code is migrated when touched).
> Current measurements and the backlog live in `docs/architecture-state.md`, not here.

---

## 1. Mission

Make Everscript code more readable in VS Code, and make Secret of Evermore romhacking
tooling usable from inside the editor. Every change must serve one of:
- better token differentiation, hover, completion, diagnostics or navigation for `.evs`
- better insight into the ROM / running game (emulator, maps, sprites, music, memory)
- better developer tooling (build, debug, patch export, tests)

---

## 2. Domain kinds

Every directory under `src/` is exactly one of three kinds. The kind decides what it may
depend on.

| Kind | Domains | May depend on |
|---|---|---|
| **Library** (pure, no `vscode`, no UI) | `shared`, `maps`, `script`, `localizations` | other libraries only (`shared` depends on nothing) |
| **Platform** (VS Code integration, no tab UI) | `resources` (soe:// VFS), `mcp`, `language`, `debugger` | libraries; `mcp` only `vscode.workspace.fs` |
| **Feature** (a tab or panel) | `emulator`, `memory` (radar host), `rooms`, `sprites`, `music`, `rom`, `scaling`, `routes`, `docs` | libraries, platform read APIs (`soe://`) |

`src/extension.js` is the composition root: it registers commands and injects
cross-feature capabilities (e.g. the emulator's `readMemory` into `resources`). It owns no
state and no logic.

---

## 3. Laws

### 3.1 Features are independently removable **[now: rule · target: fully true]**
Deleting a feature domain may only break its own registration lines in `src/extension.js`.
- A feature never `require`s another feature — not its host code, not its webview files,
  not its globals. Cross-feature capability flows **only** through injection in
  `extension.js` or through `soe://`.
- Anything two features need moves down into a library (`shared/`, `maps/`, …) or into
  `soe://`.
- Tabs that share one webview are given to the host as a plain list of
  `{ id, label, html, css, js, onMessage }` objects; a missing tab is skipped, not fatal.
  (A plain array is not a "registry" in the sense of §3.6.)
- Enforced by `.depcruise.js` (`npm run check:deps`). A new feature domain gets a
  no-feature-to-feature rule the same day.

### 3.2 Direction **[now]**
```
library  ←  platform  ←  feature  ←  extension.js
   (parser → model → renderer → UI inside each)
```
Forbidden: renderer → parser, UI mutating models except through explicit action files,
any library touching `vscode`, the DOM or extension state, host code importing a
`webview/` file.

### 3.3 One owner per state **[now]**
Every piece of state has exactly one owner file; no mirrored state, no implicit sync.
Viewport, zoom, selection, filters, emulator runtime state, panel lifecycle, room tree
cache, memory-map cache, enum cache and extension config each have a single owner listed
in the domain's `README.md`.

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
- Known canonical homes: SNES addressing and byte reads → `shared/snes-addr`; graphics
  decode (BGR555, 2/4bpp, sprite blocks) → `maps/`; webview helpers (`escH`, hex format,
  tab strip, CSP shell, theme) → `shared/webview/`.

### 3.7 Types **[target: strict everywhere]**
- New files are TypeScript with `strict: true`. Libraries and platform code are TS first.
- Existing JS is ratcheted: a file, once added to the strict list, may never fall out of
  it. `@types/vscode` is a dev dependency, so the VS Code API is typed, not `any`.
- Host↔webview messages are a typed union per panel; no stringly-typed `command` switch
  without a type.

### 3.8 Data provenance **[now — known violations in `docs/architecture-state.md` §16]**
- ROM facts (addresses, tables, layouts, formats) must come from the ROM itself, traces,
  or our own disassembly, and be checkable by a test against the ROM.
- Do not copy code, data tables or structure definitions from other projects
  (SoETilesViewer, SoEScriptDumper, …) — they are reference only and GPL-licensed, while
  this project is MIT. The one exception is naming/localization data (room names, etc.),
  which lives in `src/localizations/`.
- No runtime or test path may point into another repository's checkout; ROM location
  comes from settings or `EVERSCRIPT_ROM`.

### 3.9 File size **[now]**

| Hand-written LOC | Status |
|---|---|
| ≤ 250 | fine |
| 250–400 | justify in the domain README |
| > 400 | must split before adding to it |

Generated files, JSON data and vendored code are exempt. A large template literal is not
"indivisible" — see §3.5.

### 3.10 Local reasoning **[now]**
Each `src/<domain>/` has a `README.md` stating: kind, ownership, state owned, allowed
dependencies, key invariants. A directory must be understandable from its own files; do
not write "see extension.js for details" — move the logic or document the invariant
locally.

### 3.11 Performance **[now — known violations in `docs/architecture-state.md` §9]**
- The extension activates only on `.evs`, `soe://`, its commands, debug and MCP — never
  `onStartupFinished`. Heavy modules are `require`d lazily on first use.
- Emulator per-frame work runs only when its output is visible. No per-frame round trip to
  the extension host; batch to ≥ 100 ms. Send typed arrays over `postMessage`, never
  `Array.from` of memory.

### 3.12 What ships **[now — known violations in `docs/architecture-state.md` §10]**
`.vscodeignore` excludes everything that is not runtime: docs, AI files, tools, tests,
caches (`.emscripten_cache`), TS sources whose `dist/` ships, and every ROM/save-state
extension (`*.sfc`, `*.smc`, `*.srm`, `*.spc`, `*.state`). Check with `vsce ls` after
touching it.

---

## 4. Tests **[target — see `docs/architecture-state.md` §17]**

| Script | Contents | When |
|---|---|---|
| `npm test` | grammar + unit tier (no ROM, no emcc, no browser), < 10 s | every commit |
| `npm run test:rom` | ROM- and DOM-backed tests; skip cleanly without a ROM | when a ROM is present |
| `npm run test:emulator` | built cores + headless runtime | when `src/emulator/**` or cores change |
| `npm run test:slow` / `test:all` | full parity runs | on demand / pre-release |

A new test file must be added to a tier; a test needing a ROM uses the shared skip guard.
`npm test` must never rebuild native code or rewrite tracked files.

---

## 5. Checks and release

- `npm run typecheck`, `npm run check:circular`, `npm run check:deps`, `npm test` must pass;
  `npm run check:dead` is advisory.
- Versioning, commit format and install steps have one home: the `release-ritual` skill
  (`.agents/skills/release-ritual/SKILL.md`). Do not restate them elsewhere.

---

## 6. Where things are

| Need | Read |
|---|---|
| Current measurements, debt and backlog | `docs/architecture-state.md` |
| Which domain does what | `src/README.md`, then `src/<domain>/README.md` |
| Machine-enforced dependency rules | `.depcruise.js` |
| State ownership details | the owning domain's `README.md` |

`STATE_FLOW.md` and `docs/architecture/*` predate the `src/` refactor; trust `src/` and
the domain READMEs over them until they are rewritten or archived.
