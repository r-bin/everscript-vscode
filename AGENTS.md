# Everscript VS Code Extension — Agent Rules

These rules apply to every AI agent (Gemini, Claude, Copilot) working in this repository.

Every prompt ends in a commit that follows the `release-ritual` skill
(`.agents/skills/release-ritual/SKILL.md`): version bump, tests and checks, commit, `npm run deploy`.

External resources:
- `everscript` (sibling repo): the compiler, the reference for formats it already decodes.
- `SoETilesViewer` / `SoEScriptDumper` (GPLv3, third-party): **do not use** — no code, tables,
  layouts or structure from them, and do not read their source while implementing something
  they also implement. Derive everything from the game itself. The one exception is the names
  already in the repo (room, enemy, item, flag names): they stay for now and get rewritten in our
  own style; add no new ones (`docs/cleanup.md` D3, D4).

---

## 0. Standing rules (every task)

1. **Legal first.** Nothing that could bring legal trouble enters the repo: no ROM or ROM
   bytes, no extracted graphics/icons/palettes/music/text/maps/script dumps, no screenshots,
   no code or data copied from other projects. The extension decodes the *user's own ROM at
   runtime*; the repo holds only our code and our own descriptions of facts
   (`AI_ARCHITECTURE_GUIDE.md` §3.8; `npm run check:legal` blocks the rest).
2. **Write down what you learn.** Every address, routine, script, flag, struct or format you
   learn about — even partially — is recorded in the same commit, in our own words, with its
   purpose and evidence. Look it up before re-researching it (`game-knowledge` skill).
3. **Keep the AI files true.** When a skill, an `AGENTS.md` or the guide is wrong, stale or
   missing a trap you just hit, fix it in the same commit. Prefer editing an existing file.
   Keep them slim: `npm run check:ai-context` holds the limits.
4. **Games stay apart.** Nothing known about one game (formats, engine, addresses, scripts) is
   assumed for another; only SNES hardware facts carry over (`src/platform/`). A game's code
   lives in `src/games/<game>/` and never imports another game; the one bridge is
   `src/games/evermore/imports/mana`, an explicit translation table
   (`docs/mana/evermore-rooms.md`). Each game's facts go to its docs (`docs/mana/`,
   `docs/terra/`), checked against the running game (`supported-games` skill).
5. **Shared working tree.** Several agents work in this checkout at once. Stage and commit
   only the files you changed (`git commit -- <paths>`, or `git add <paths>`); never
   `git add -A`, `git add .`, `git add -u` or `git commit -a`. Check
   `git diff --cached --name-only` before committing and re-read `package.json`'s version
   right before bumping it.

---

## 1. Goal

Make Everscript code more readable in VS Code and make SNES romhacking (Evermore first, any game
the plugin recognises) workable from the editor: better tokens, hover and diagnostics; insight
into the ROM and the running game; build, debug and export tooling.

---

## 2. Where things are

| Where | What |
|---|---|
| `src/README.md` | Every folder under `src/` and its dependency rules: `platform/` (no game, no VS Code), `core/` (game-neutral features, the emulator), `games/<game>/` (each with `extension.js`), `recorder/` (the SNES CDL Recorder, a second extension); `src/extension.js` is the composition root |
| `src/**/AGENTS.md` | Each folder's kind, ownership, allowed dependencies, invariants and tests — read before working there |
| `AI_ARCHITECTURE_GUIDE.md` | The laws: dependency direction, removable features, no code in strings, data provenance, file size, types |
| `docs/architecture/multi-game.md` | The target and its status: platform / core / games, game descriptors, variants and base ROM, the ROM library, game views, the one map editor (§8) |
| `docs/cleanup.md` | The cleanup: decisions D1–D13 and the open work — read before deleting, moving, deduplicating or porting to TS |
| `docs/todo/README.md` | Open work and ideas, by topic |
| `docs/map-format/`, `docs/script-format/`, `docs/mana/`, `docs/terra/` | Each game's formats, with evidence |
| `docs/reverse-engineering/README.md`, `docs/recomp/README.md`, `docs/exhirom/README.md` | RE approaches; the static recompilation; ExHiROM, the table hack and layouts |
| `docs/evermore-releases.md` | The Evermore ROMs that exist, how they are identified, why US addresses do not apply to PAL builds |
| `scripts/README.md` | Shell wrappers for the npm commands (build, test, recomp, ExHiROM, release) |
| `tools/` | `check-*.mts` (the checks), `roms.js` (the ROM library), `recomp/`, `exhirom/`, `table-hack/`, `recorder/`, `mana/` |

---

## 3. Skills

Canonical files: `.agents/skills/<name>/SKILL.md` (Claude Code reads them through the symlink
`.claude/skills`). They load by their `description`; read the one that fits before working.

- **Process:** `release-ritual`, `architecture`, `game-knowledge`, `supported-games`, `games-and-roms`
- **Evermore data:** `map-format`, `memory-map`, `map-construction`, `map-entities`,
  `animation-script`, `alchemy-spell-mechanics`, `secret-of-evermore-engine`
- **Editor and UI:** `map-editor-rules`, `rooms-tab`, `memory-radar`, `webview-dom-safety`, `grammar-rules`,
  `debugger-protocol`
- **Emulator and RE:** `emulator-subsystem`, `emulator-script-debugging`, `cdl-recorder`,
  `sample-playbacks`, `ghidra-analysis`, `snes-asm-asar-patching`, `recomp`, `recomp-debugging`

Personas (`.agents/agents/`, `.claude/agents` for Claude Code): `everscript-plugin-builder`,
`mechanics-modeler`, `re-curator` (one pass over the knowledge gaps).
