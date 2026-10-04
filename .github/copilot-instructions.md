# Everscript VS Code Extension — Agent Rules

These rules apply to **every agent** working in this repository. They cannot be
overridden by individual agent spec files.

This is a vibe-coding project. Every prompt should end in a commit that follows the
`release-ritual` skill below. If the worktree is still dirty afterward, or the version
was not bumped, or nothing was installed, finish the ritual before ending the session.

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

Full domain map (post v0.6.0 `src/` refactor): see `src/README.md`.

---

## 3. Skills

This repo used to keep everything in this one file. It's now split into scoped skill
files that auto-attach based on the files you're touching
(`.github/instructions/*.instructions.md`, matched via each file's `applyTo` glob).

**These files are the single canonical copy.** `.claude/skills/*/SKILL.md` are
symlinks into this directory (each carries both `applyTo` for Copilot and
`name`/`description` for Claude in one frontmatter block, so one file serves both), and
`GEMINI.md` `@`-imports them directly. Edit a skill here and Claude/Gemini pick it up
automatically — never edit the same content in three places.

| Skill | Applies to | Covers |
|---|---|---|
| `release-ritual` | every commit | version bump, validation, commit format, `npm run deploy` |
| `memory-radar` | `src/memory/**`, `src/rooms/**` | WRAM grid, rooms/map-browser tab, tab ownership |
| `map-format` | `src/maps/**`, `tools/generate_data.py` | ROM map decoding is being migrated to the sibling `everscript` repo's verified implementation — read before extending either |
| `rom-map-data` | `src/maps/**`, `docs/map-format/**`, `sandbox/maps/**` | room blob layout, the three compressed payload blocks, the collision bitfield |
| `grammar-rules` | `src/language/syntaxes/**`, `src/language/tests/**` | TextMate pattern rules, test assertion format |
| `colour-theme` | `src/language/themes/**` | P1–P9 priority palette |
| `code-quality` | `src/**/*.js`, `src/**/*.ts` | TS migration policy, dead code policy, guarding scripted edits |
| `compress-architecture` | `src/**` | splitting oversized files by ownership |
| `isolate-subsystem` | `src/**` | fixing forbidden cross-domain dependencies |
| `stabilize-state-flow` | `src/**` | consolidating state to a single owner |
| `split-orchestration` | `src/extension.js` and panel files | decomposing god files |
| `webview-dom-safety` | `src/**/webview/**` | idempotent event binding, `e.target` walk-up, VS Code webview API gaps, SVG coordinate systems |

Read the matching skill file before working in its area. When in doubt, open
`.github/instructions/` and skim the `applyTo` lines.

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

## 5. Custom agents

Full workflow personas (not just scoped rules) live in `.github/agents/*.agent.md`:
`architecture-compressor`, `everscript-plugin-builder`, `mechanics-modeler`,
`script-parser-generator`. Same personas are available to Claude as subagents in
`.claude/agents/` and to Gemini as slash commands in `.gemini/commands/`.
