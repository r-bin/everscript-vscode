# Retire everscript-vscode: one repo for language, compiler, plugin and knowledge

**Status: draft (2026-10-16), not decided.** Nothing here applies until the owner accepts it.
It changes cleanup decisions D7 and D9 ([cleanup.md](../cleanup.md)) and replaces the
recommendation in [architecture-state.md](../architecture-state.md) §22.

## 1. Why

The owner is the only user of both repos. That removes the one reason to keep them apart
(the compiler as a standalone CLI with its own releases). What is left is drift: the plugin
depends on the compiler through unversioned, hand-maintained copies.

| Where the plugin depends on `everscript` today | How it drifts |
|---|---|
| Build & Run spawns `python everscript.py`, found via `everscript.compilerPath` / `../everscript` (`src/extension.js`, `src/shared/config.js`) | The two checkouts can be at any versions |
| `tools/generate_data.py` regexes `in/core/*.evs` → `src/language/data/index.json` | A second, weaker grammar; not wired into any build; writes to a stale path |
| Signatures hand-copied from `compiler/ast_everscript.py` into `src/script/everscript.ts` | Nothing checks them |
| RAM region bounds hard-coded in `src/extension.js:18` | Copied from `in/core/…/02_ram.evs` |
| `out/source_map.json` read by the debugger | No schema, no version |
| Parity tests (`check:maps`, `check:script`, simulation `everscript.test.js`) | **Skip** when `../everscript` is missing, so a green run can mean nothing |
| Six skills in both repos: `alchemy-spell-mechanics`, `rom-map-data`, `secret-of-evermore-engine`, `snes-asm-asar-patching`, `snes-memory-mapping`, `wram-memory-mapping` | Edited on one side only |
| RAM/ROM facts in three places: `src/localizations/knowledge/` (here), `.github/memory-map.md` + `.github/rom-map.md` (there), `wiki/` Ram-Map (both, as a submodule) | The wiki page calls itself authoritative; nothing checks it |

## 2. Decision proposed

1. **The hand-written Python compiler stays** and is the one definition of the language. No
   TypeScript port of the compiler is planned; the TS ports that exist (map decoder and
   renderer, script decoder, simulation operand grammar) stay because they run inside the
   extension and its webviews, and each is pinned to the Python by a parity test.
2. **everscript-vscode moves into `everscript`** as the folder `vscode/` and this repo is
   archived.
3. **The plugin's language data is generated from the compiler's own parser.** The regex
   scraper, the hand copies and the hard-coded bounds are deleted.

### The condition (go / no-go)

The owner's condition: deprecate this repo **only if one build can share the information and
the skill files**. Concretely, all four must hold in the merged repo before step 8 (archive):

| # | Condition | Check |
|---|---|---|
| G1 | **One skill tree.** Every skill exists once, in `.agents/skills/`; Claude Code (`.claude/skills` symlink), Antigravity and Copilot (`.github/skills`) all read that tree, whether the agent works in `compiler/` or `vscode/` | A script lists skill names across all agent folders; no duplicate names, no stale copies; one root `AGENTS.md`, nested ones per area |
| G2 | **One source per fact.** RAM/ROM/script facts live in `knowledge/` (moved from `src/localizations/knowledge/`); language facts (functions, signatures, enums, RAM variable names) come from the compiler's parse of `in/core/` | `memory-map.md`, `rom-map.md` and the wiki Ram-Map are generated from `knowledge/` or deleted; a check fails when a name or address in `in/core/` and `knowledge/` disagree |
| G3 | **One build produces everything the plugin ships.** `scripts/build.sh` (or npm at the root) runs the Python exporter, then the plugin build; the `.vsix` contains the generated `language-data.json` and the knowledge the `soe://` MCP serves | Build from a clean clone with no env vars and no sibling checkout; diff the generated files against the committed ones (none committed, or the check fails) |
| G4 | **Parity tests never skip for a missing compiler.** They may still skip for a missing ROM (that comes from `soe://`, D5) | `npm test` output lists compared rooms/scripts, not "everscript repo not found" |

If G1–G4 can't all be met, stop after step 4: steps 2–4 are useful in two repos too.

## 3. Target layout (`r-bin/everscript`)

```
everscript/
  AGENTS.md              one root file: standing rules of both repos, merged
  .agents/skills/        the only skill tree (.claude/skills, .github/skills → symlinks)
  .agents/agents/        personas of both repos, merged
  knowledge/             RAM/ROM/script entries (game-knowledge skill format)
  everscript.py  compiler/  utils/  make.py      the Python compiler, unchanged
  in/                    .evs content (core library, examples, mods)
  patches/               asm patches
  tests/                 pytest
  tools/                 compiler-side Python tools (only those not duplicated in TS)
  vscode/                the plugin: package.json, src/, tests/, tools/, scripts/, docs/
  docs/                  language, compiler, game formats; plugin docs stay in vscode/docs/
  wiki/                  submodule, once
  scripts/build.sh       G3: exporter → plugin build → .vsix
```

Rules that change:
- **D7 (Python leaves the repo):** becomes "no Python under `vscode/`; Python only for the
  compiler and its own tools". Python tools that duplicate a TS module still go.
- **D9 (TypeScript everywhere):** scoped to `vscode/`.
- `everscript.compilerPath` / `pythonPath` settings: the compiler is found relative to the
  workspace root; the venv stays the compiler's `.venv`.
- Legal rules (AGENTS.md §0) apply to the whole repo, including `in/`, `docs/`, `wiki/` and the
  compiler's history.

## 4. Order of work

Each step is one commit (or one short series) and leaves both repos working until step 8.

1. **Accept this plan.** Amend D7, D9 and [architecture-state.md](../architecture-state.md) §22; update
   [language-tools-and-lsp.md](language-tools-and-lsp.md) §1.5 (the Python LSP stays an option, the TS port does
   not).
2. **Legal pass on `everscript`, tree and history.** Run the `check:legal` rules over it.
   Known suspects: the `soetilesviewer` skill (this repo's rules forbid using that tool),
   `in/evermizer_contributions/` (third-party content: licence?), any script dumps or hex
   dumps in `docs/`. Fix the tree; list the history findings next to
   [legal-history.md](../legal-history.md).
3. **Exporter (G2, G3), still two repos.** `everscript/tools/export_language_data.py` imports
   `compiler/lexer.py` + `parser.py` + `ast_everscript.py`, parses `in/core/` and writes
   `language-data.json` (functions + signatures, enums, RAM regions, opcode table). The
   plugin reads it; delete `tools/generate_data.py`, the copies in `src/script/everscript.ts`
   and the bounds in `src/extension.js:18`. Give `source_map.json` a `version` field. The
   opcode table is the one D4 wants shared by decoder and compiler.
4. **Skills and knowledge (G1, G2), still two repos.** For each of the six duplicated skills,
   merge both texts into one and keep it in `everscript`; this repo links to it until step 5.
   Decide `memory-map.md` / `rom-map.md` / wiki Ram-Map: generated from `knowledge/` or deleted.
5. **Import the plugin with history.** In a scratch clone of this repo:
   `git filter-repo --to-subdirectory-filter vscode/`, plus `--invert-paths` over the paths
   in cleanup §4 (so the merged repo starts without the flagged commits); then in
   `everscript`: `git remote add plugin <scratch>`, `git merge --allow-unrelated-histories`.
   The archived original keeps the full history.
6. **Rewire.** Paths in `vscode/` docs, skills and `AGENTS.md` files; tests find the compiler at
   `../`; `.vscodeignore`, `.depcruise.js`, knip, tsconfigs relative to `vscode/`; `.mcp.json`
   and `.agents/mcp_config.json` at the root; one `.gitmodules` (wiki once, both emulator
   cores under `vscode/`). Move `knowledge/` to the root.
7. **One build and CI (G3, G4).** `scripts/build.sh`; a CI job that runs pytest, then
   `npm test` in `vscode/`. Decide the compiler's PyInstaller workflows (drop unless still
   used). The release ritual moves to the root and covers both parts.
8. **Gate check, then archive.** G1–G4 green → `everscript-vscode` README points to the new
   home, the GitHub repo is archived (read-only), local memory notes and the `mac-layout` skill
   are updated.

Rollback: before step 8 nothing is lost; the plugin repo still builds on its own.

## 5. Open questions

- **Repo name.** The target is multi-game ([architecture/multi-game.md](../architecture/multi-game.md): Mana, later
  Terranigma); a repo named after Evermore's script language will hold all of it. Rename now,
  later, or never?
- **`in/` vs `content/`.** Renaming costs every compiler path and doc; keeping it costs nothing.
  Proposed: keep.
- **Plugin docs.** Split by topic (game formats → root `docs/`, plugin internals →
  `vscode/docs/`) or move as one folder first and sort later. Proposed: one folder first.
- **Versions.** The plugin keeps its own version in `vscode/package.json`; the compiler has
  none today. One shared version, or the plugin's only?
