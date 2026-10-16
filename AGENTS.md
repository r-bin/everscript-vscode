# Everscript VS Code Extension — Agent Rules

These rules apply to every AI agent (Gemini, Claude, Copilot) working in this repository.

This is a vibe-coding project. Every prompt should end in a commit that follows the
`release-ritual` skill (`.agents/skills/release-ritual/SKILL.md`). If the worktree is still dirty afterward,
or the version was not bumped, or nothing was installed, finish the ritual before ending the
session.

External resources:
- `everscript` repo (this repo)
- `SoETilesViewer` / `SoEScriptDumper` (GPLv3, third-party): **do not use** — no code, tables,
  layouts or names from them, and do not read their source while implementing something
  they also implement. Derive everything from the game itself.

---

## 0. Standing rules (every task)

1. **Legal first.** Nothing that could bring legal trouble enters the repo: no ROM or ROM
   bytes, no extracted graphics/icons/palettes/music/text/maps/script dumps, no screenshots,
   no code or data copied from other projects. The extension decodes the *user's own ROM at
   runtime*; the repo holds only our code and our own descriptions of facts.
   See `AI_ARCHITECTURE_GUIDE.md` §3.8.
2. **Write down what you learn.** Every address, routine, script, flag, struct or format you
   learn about — even partially — is recorded in the same commit, in our own words, with its
   purpose and evidence. Look it up before re-researching it. Format and locations: the
   `game-knowledge` skill (`.agents/skills/game-knowledge/SKILL.md`).
3. **Keep the AI files true.** When you find that a skill, an `AGENTS.md` (root or nested) or
   the guide is wrong, stale or missing a trap you just hit, fix it in the same commit — no
   need to ask. Prefer editing the existing file over adding a new one.
4. **Secret of Mana is a different game.** Nothing known about Evermore (formats, engine,
   addresses, scripts) is assumed for Secret of Mana, or the other way round; only SNES
   hardware facts carry over. Mana code lives in `src/mana`, `src/mana-resources` and
   `src/mana-maps` and never imports an Evermore domain (`.depcruise.js`); Mana facts go to
   `docs/mana/`, checked against the running game (`tools/mana/check-map.js`,
   `check-events.js`). The one place the two meet is `src/mana-to-evermore`: an explicit
   translation table (`docs/mana/evermore-rooms.md`), each row pairing two documented facts.
   Use the plugin's features for both games (`supported-games` skill).

---

## 1. Goal

Make Everscript code **more readable** in VS Code. Every change must serve one or more
of:
- Better visual differentiation of token categories
- More information on hover, completion, or diagnostics
- Better developer tooling (build tasks, problem matchers, snippets)

---

## 2. File map

| File / Dir | Role |
|---|---|
| `package.json` | Extension manifest — version lives here |
| `src/extension.js` | Activation entry point (registered as `main`) |
| `src/language/syntaxes/everscript.tmLanguage.json` | TextMate grammar |
| `src/language/themes/everscript-dark.json` | Bundled colour theme — P1–P9 palette |
| `src/language/language-configuration.json` | Bracket matching, comment toggle, word pattern |
| `src/language/tests/highlight.test.evs` | Grammar unit tests (vscode-tmgrammar-test) |
| `docs/future-features.md` | Roadmap — read before starting new features |
| `docs/recomp/` | Recomp master page (`README.md`), setup (`setup.md`), Game Runtime Layer (`game-rtl.md`), debugging (`debugging.md`), headless exploration (`headless-exploration.md`), open bugs & roadmap (`bugs-and-todos.md`), addons (`snesmod-addons.md`), enhancements (`enhancements.md`), experimental graphics (`experimental-renderer.md`) |
| `docs/reverse-engineering/` | RE master page (`README.md`: goals, how each is reached) + one page per approach (CDL, recomp/C port, Ghidra, REA, formats, other tools) — read before RE work |
| `docs/vscode-highlighter-spec.md` | Token category spec |
| `AI_ARCHITECTURE_GUIDE.md` | Architectural laws, file size limits, ownership rules |
| `STATE_FLOW.md` | Authoritative state ownership table |
| `docs/architecture/domain-overview.md` | Which `src/` domains to load for a given task |
| `docs/architecture/one-map-editor.md` | Decided plan: one map editor (core + per-game adapter) for Evermore and Secret of Mana, what is saved, order of work — read before touching `src/rooms/webview/map-editor*` or `src/mana-maps` |
| `docs/exhirom/port.md` | Plan: why and how to port Evermore from HiROM to ExHiROM (bus map, vectors/header, mirror-read audit, SMZ3 model) |
| `docs/table-hack.md`, `docs/extension-tables.md`, `docs/enemies-and-palettes.md`, `tools/table-hack/` | The table hack: content tables (rooms, enter scripts, string keys, script pointers, enemies, palettes) moved into the 4th MB; how enemies and palettes load (ROM → WRAM shadow → CGRAM); which tables can move and what each buys; `npm run table-hack` / `table-hack:prove` (sample playbacks vs the original → `out/table-hack/REPORT.md`) |
| `docs/exhirom/layout-options.md` | Comparison: stay HiROM vs ExHiROM vs SA-1 — Evermore's ROM map, mutual exclusivity, effort, benefits, recommendation |
| `docs/exhirom/combo-rom.md` | A second game next to Evermore on one ExHiROM cartridge: where it can go, LoROM fits by rearranging / HiROM must relocate, cost of SlowROM, candidate games (index: `docs/exhirom/README.md`) |
| `tools/recomp/` | `room-nav.js` (room triggers/spawns → headless script lines), `check-obj-tiles.js`, `s9x-run.js` (same script on snes9x); `npm run recomp`: CDL + names + assets → Asar (byte-identical) + Mesen2 files → snesrecomp host project (`out/recomp/project/`, generated) + our glue (`tools/recomp/host/`, the only game-specific host files in git) → playable `out/recomp/SecretOfEvermore-<os>-<arch>/` + `REPORT.md`; `npm run recomp:lockstep`: that game vs snes9x |
| `scripts/` | Shell wrappers for the npm commands: `build-plugin.sh`, `test.sh`, `build-recomp.sh`, `play-recomp.sh`, `lockstep.sh`, `release.sh` (see `scripts/README.md`) |
| `src/recorder/`, `recorder/`, `tools/recorder/` | SNES CDL Recorder, the second extension: entry (`src/recorder/extension.js`), manifest + store README (`recorder/`), file list + build (`tools/recorder/`; `npm run build:recorder` / `scripts/build-recorder.sh` → `out/snes-cdl-recorder-<version>.vsix`). Emulator profiles and Evermore gating: `src/emulator/README.md` |
| `src/scripts-tab/` | Scripts tab (radar): Everscript + map, animation and alchemy scripts + animation, music sequences + silent player — not `src/script/` (the decoder) |
| `simulation/` | Design notes for the simulation; the code is `src/simulation/` (scenarios, loot cases, byte-identical Everscript; `npm run test:simulation`) |
| `src/mana/`, `src/mana-resources/`, `src/mana-maps/` | Secret of Mana, kept apart from Evermore: pure decoder/renderer (TS library), the read-only `som://` file system, and the Maps panel (`everscript.openManaMaps`). Format + evidence: `docs/mana/` |
| `src/mana-to-evermore/` | Secret of Mana maps converted into Evermore rooms, listed in the Rooms tab under the vanilla rooms (`docs/mana/evermore-rooms.md`) |
| `tools/mana/check-map.js`, `check-events.js`, `find-picture.js` | Load any Secret of Mana map in the headless game and compare its screen / its step events with ours; find which map a picture shows |

Full domain map (post v0.6.0 `src/` refactor): see `src/README.md`.

---

## 3. Skills

The canonical skill content is maintained in `.agents/skills/<skill-name>/SKILL.md`.
Skills load on demand based on their `description` and `applyTo` globs.
Claude Code finds them only under `.claude/skills/`, which is a symlink to `.agents/skills` —
add new skills in `.agents/skills/<name>/SKILL.md` and they show up in both (new session needed).

| Skill | Canonical Location | Covers |
|---|---|---|
| `supported-games` | `.agents/skills/supported-games/SKILL.md` | Secret of Mana vs Evermore: som:// vs soe://, no facts across games, where each game's facts go and how they are checked, one UI for both games |
| `sample-playbacks` | `.agents/skills/sample-playbacks/SKILL.md` | Stored vanilla playbacks with known coverage (attract loop: 6224 frames, all four table readers); the input for any original-vs-changed-ROM proof |
| `game-knowledge` | `.agents/skills/game-knowledge/SKILL.md` | Look up and record RAM/ROM/script knowledge: entry format, evidence, where it goes |
| `release-ritual` | `.agents/skills/release-ritual/SKILL.md` | version bump, validation, commit format, `npm run deploy` |
| `memory-radar` | `.agents/skills/memory-radar/SKILL.md` | WRAM grid tab, rooms/map-browser tab, tab ownership |
| `map-format` | `.agents/skills/map-format/SKILL.md` | ROM map decoding port and validation against `everscript` repo |
| `rom-map-data` | `.agents/skills/rom-map-data/SKILL.md` | Room blob layout, compression blocks, collision bitfields |
| `grammar-rules` | `.agents/skills/grammar-rules/SKILL.md` | TextMate pattern rules, test assertion format |
| `colour-theme` | `.agents/skills/colour-theme/SKILL.md` | P1–P9 priority palette |
| `code-quality` | `.agents/skills/code-quality/SKILL.md` | TS migration policy, dead code policy |
| `compress-architecture` | `.agents/skills/compress-architecture/SKILL.md` | Splitting oversized files by ownership |
| `isolate-subsystem` | `.agents/skills/isolate-subsystem/SKILL.md` | Fixing forbidden cross-domain dependencies |
| `stabilize-state-flow` | `.agents/skills/stabilize-state-flow/SKILL.md` | Consolidating state to a single owner |
| `split-orchestration` | `.agents/skills/split-orchestration/SKILL.md` | Decomposing god files (`src/extension.js`, panel files) |
| `webview-dom-safety` | `.agents/skills/webview-dom-safety/SKILL.md` | Idempotent event binding, event target walk-up, SVG coordinate systems |
| `emulator-subsystem` | `.agents/skills/emulator-subsystem/SKILL.md` | snes9x2005-wasm core build, licensing, audio sync, display scaling, keybinds |
| `cdl-recorder` | `.agents/skills/cdl-recorder/SKILL.md` | Code/Data Logger: core hooks, call stack / DB / D / SPC700 recording, mergeable library, Asar export with table assets, enums, structs, functions.json, snesrecomp directives; what recomp / decomp / SA-1 still need |
| `map-editor-rules` | `.agents/skills/map-editor-rules/SKILL.md` | Editor hard rules: 7 tile families, ROM budgets, collision bit layouts |
| `map-construction` | `.agents/skills/map-construction/SKILL.md` | How maps are constructed, cell-to-graphic mapping, animation groups |
| `map-entities` | `.agents/skills/map-entities/SKILL.md` | Characters, enemies, spawns, palettes, body/hurt/strike boxes |
| `animation-script` | `.agents/skills/animation-script/SKILL.md` | Animation bytecode, frame-end bit, holds, opcode tables |
| `alchemy-spell-mechanics` | `.agents/skills/alchemy-spell-mechanics/SKILL.md` | Combat alchemy slots, projectile calculations, spell damage formulas |
| `debugger-protocol` | `.agents/skills/debugger-protocol/SKILL.md` | Debug adapter protocol (DAP) implementation and mock runtime |
| `secret-of-evermore-engine` | `.agents/skills/secret-of-evermore-engine/SKILL.md` | Engine execution loops, script stack, event flags |
| `snes-asm-asar-patching` | `.agents/skills/snes-asm-asar-patching/SKILL.md` | 65816 assembly conventions, Asar patching pipelines |
| `snes-memory-mapping` | `.agents/skills/snes-memory-mapping/SKILL.md` | SNES memory maps (HiROM, LoROM, cartridge ROM vs WRAM) |
| `sprites-subsystem` | `.agents/skills/sprites-subsystem/SKILL.md` | Sprites rendering, animation frames, OBJ palettes |
| `wram-memory-mapping` | `.agents/skills/wram-memory-mapping/SKILL.md` | WRAM address allocation, entity tables, party stats |
| `recomp` | `.agents/skills/recomp/SKILL.md` | The snesrecomp build: commands, ownership of generated files, headless runs |
| `recomp-debugging` | `.agents/skills/recomp-debugging/SKILL.md` | Reproduce and fix recomp bugs: headless repro, reference emulators (snes9x headless/lockstep, Mesen2, snesref, COSIM) and how to compare, classifying C vs seeds vs glue vs runtime, fixes, where to find what |
| `emulator-script-debugging` | `.agents/skills/emulator-script-debugging/SKILL.md` | Start emulator, launch ROM, teleport Boy, step onto triggers, and analyze script trace logs and VFS log files |
| `ghidra-analysis` | `.agents/skills/ghidra-analysis/SKILL.md` | Ghidra + ghidra-snes / REA on SoE: what for, setup traps, seeding from the CDL, trusting static results |

---

## 4. Architectural cognitive stabilization

Before working in any domain, read:
- `AI_ARCHITECTURE_GUIDE.md` — the laws: domain kinds, dependency direction, removable features,
  no code in strings, data provenance, file size, types
- The domain's own `src/<domain>/AGENTS.md` — its kind, ownership, allowed deps (and the
  existing exceptions not to extend), invariants and tests. Agents that support nested
  `AGENTS.md` load it automatically when touching files in that folder; the domain's
  `README.md` holds the descriptive docs.
- `docs/architecture-state.md` — current measurements, known violations and the backlog

`STATE_FLOW.md` and `docs/architecture/*` predate the `src/` refactor; trust `src/` and the
domain `AGENTS.md`/`README.md` files over them.

---

## 5. Workflows and personas

Specialized workflow personas live in `.agents/agents/`:
- `architecture-compressor.md`
- `everscript-plugin-builder.md`
- `mechanics-modeler.md`
- `script-parser-generator.md`
- `re-curator.md` — one pass over the knowledge gaps (names, RAM/ROM entries) from CDL, `soe://`, curated sources and Ghidra/REA dossiers

Claude Code sees these through the symlink `.claude/agents` → `.agents/agents`.
