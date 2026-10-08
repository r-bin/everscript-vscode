# Everscript VS Code Extension — Agent Rules

These rules apply to every AI agent (Gemini, Claude, Copilot) working in this repository.

This is a vibe-coding project. Every prompt should end in a commit that follows the
`release-ritual` skill (`.agents/skills/release-ritual/SKILL.md`). If the worktree is still dirty afterward,
or the version was not bumped, or nothing was installed, finish the ritual before ending the
session.

External resources:
- `everscript` repo (this repo)
- `SoETilesViewer` repo (reference only; do not modify or depend on it)

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
| `docs/vscode-highlighter-spec.md` | Token category spec |
| `AI_ARCHITECTURE_GUIDE.md` | Architectural laws, file size limits, ownership rules |
| `STATE_FLOW.md` | Authoritative state ownership table |
| `docs/architecture/domain-overview.md` | Which `src/` domains to load for a given task |
| `simulation/` | Design notes for the planned simulation domain — md only, no code yet |

Full domain map (post v0.6.0 `src/` refactor): see `src/README.md`.

---

## 3. Skills

The canonical skill content is maintained in `.agents/skills/<skill-name>/SKILL.md`.
Skills load on demand based on their `description` and `applyTo` globs.

| Skill | Canonical Location | Covers |
|---|---|---|
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
| `cdl-recorder` | `.agents/skills/cdl-recorder/SKILL.md` | Code/Data Logger: core hooks, mergeable library, xrefs, Asar / ram.asm / snesrecomp exports, recorded gaps |
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

---

## 4. Architectural cognitive stabilization

Before working in any domain, read:
- `AI_ARCHITECTURE_GUIDE.md` — global architectural laws, file size limits, anti-abstraction rules, entropy hotspots
- `STATE_FLOW.md` — authoritative state ownership table and data flow maps (cross-check file paths against actual `src/` layout — this doc predates the `src/` refactor in places)
- `docs/architecture/domain-overview.md` — which domains to load for a given task
- The domain's own `src/<domain>/README.md` — local ownership contract, allowed deps, key invariants

---

## 5. Workflows and personas

Specialized workflow personas live in `.agents/agents/`:
- `architecture-compressor.md`
- `everscript-plugin-builder.md`
- `mechanics-modeler.md`
- `script-parser-generator.md`
