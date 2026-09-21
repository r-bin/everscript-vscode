# Everscript VS Code Extension — Agent Rules

These rules apply to every agent working in this repository.

This is a vibe-coding project. Every prompt should end in a commit that follows the
`release-ritual` skill. If the worktree is still dirty afterward, or the version was
not bumped, or nothing was installed, finish the ritual before ending the session.

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
| `simulation/` | Design notes for the planned simulation domain — md only, no code yet |

Full domain map (post v0.6.0 `src/` refactor): see `src/README.md`.

---

## 3. Skills

Skills load on demand based on their `description` — you don't need to read them all up
front, just be aware they exist. `.claude/skills/*/SKILL.md` are symlinks into
`.github/instructions/` (the canonical copy, shared with Copilot and — via `GEMINI.md`
imports — Gemini). Edit the target in `.github/instructions/`, not the symlink.

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

The same content is also available to Copilot as path-scoped instructions
(`.github/instructions/*.instructions.md`) and to Gemini via `GEMINI.md` imports —
keep all three in sync if you edit one.

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

## 5. Subagents

Full workflow personas live in `.claude/agents/`: `architecture-compressor`,
`everscript-plugin-builder`, `mechanics-modeler`, `script-parser-generator`. Same
personas are available to Copilot in `.github/agents/*.agent.md` and to Gemini as
slash commands in `.gemini/commands/`.
