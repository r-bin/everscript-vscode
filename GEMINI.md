# Everscript VS Code Extension — Agent Rules

These rules apply to every agent working in this repository.

This is a vibe-coding project. Every prompt should end in a commit that follows the
Release Ritual skill imported below. If the worktree is still dirty afterward, or the
version was not bumped, or nothing was installed, finish the ritual before ending the
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
| `CHANGELOG.md` | User-facing change history — update on every version bump |
| `AI_ARCHITECTURE_GUIDE.md` | Architectural laws, file size limits, ownership rules |
| `STATE_FLOW.md` | Authoritative state ownership table |
| `docs/architecture/domain-overview.md` | Which `src/` domains to load for a given task |

Full domain map (post v0.6.0 `src/` refactor): see `src/README.md`.

---

## 3. Skills

The detailed skill content is kept in one place — `.github/instructions/` — and
imported below rather than duplicated, so Copilot's path-scoped instructions and this
file never drift apart. Claude's `.claude/skills/*/SKILL.md` are symlinks into the same
directory for the same reason. Skim the table, then read the imported section relevant
to what you're touching.

| Skill | Covers |
|---|---|
| `release-ritual` | version bump, validation, commit format, `npm run deploy` |
| `memory-radar` | WRAM grid tab, rooms/map-browser tab, tab ownership |
| `map-format` | ROM map decoding is migrating to the sibling `everscript` repo's verified implementation — read before touching `src/maps/` |
| `grammar-rules` | TextMate pattern rules, test assertion format |
| `colour-theme` | P1–P9 priority palette |
| `code-quality` | TS migration policy, dead code policy |
| `compress-architecture` | splitting oversized files by ownership |
| `isolate-subsystem` | fixing forbidden cross-domain dependencies |
| `stabilize-state-flow` | consolidating state to a single owner |
| `split-orchestration` | decomposing god files (`src/extension.js`, panel files) |
| `webview-dom-safety` | idempotent event binding, `e.target` walk-up, VS Code webview API gaps, SVG coordinate systems |
| `emulator-subsystem` | snes9x2005-wasm core build, non-commercial/GPL licensing, audio sync, display scaling, keybinds |

### Release ritual

@.github/instructions/release-ritual.instructions.md

### Memory radar & rooms tab

@.github/instructions/memory-radar.instructions.md

### Map format

@.github/instructions/map-format.instructions.md

### Grammar rules

@.github/instructions/grammar-rules.instructions.md

### Colour theme

@.github/instructions/colour-theme.instructions.md

### Code quality (TS migration & dead code)

@.github/instructions/code-quality.instructions.md

### Compress architecture

@.github/instructions/compress-architecture.instructions.md

### Isolate subsystem

@.github/instructions/isolate-subsystem.instructions.md

### Stabilize state flow

@.github/instructions/stabilize-state-flow.instructions.md

### Split orchestration

@.github/instructions/split-orchestration.instructions.md

### Webview DOM safety

@.github/instructions/webview-dom-safety.instructions.md

### Map editor rules

@.github/instructions/map-editor-rules.instructions.md

### Map construction

@.github/instructions/map-construction.instructions.md

### Map entities

@.github/instructions/map-entities.instructions.md

### Animation scripts

@.github/instructions/animation-script.instructions.md

### Emulator subsystem

@.github/instructions/emulator-subsystem.instructions.md

---

## 4. Architectural cognitive stabilization

Before working in any domain, read:
- `AI_ARCHITECTURE_GUIDE.md` — global architectural laws, file size limits,
  anti-abstraction rules, entropy hotspots
- `STATE_FLOW.md` — authoritative state ownership table and data flow maps (cross-check
  file paths against actual `src/` layout — this doc predates the `src/` refactor in
  places)
- `docs/architecture/domain-overview.md` — which domains to load for a given task
- The domain's own `src/<domain>/README.md` — local ownership contract, allowed deps,
  key invariants

---

## 5. Custom commands

Full workflow personas are available as slash commands in `.gemini/commands/`:
`/architecture-compressor`, `/everscript-plugin-builder`, `/mechanics-modeler`,
`/script-parser-generator`. Same personas are available to Copilot in
`.github/agents/*.agent.md` and to Claude as subagents in `.claude/agents/`.
