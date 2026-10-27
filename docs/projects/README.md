# Project map: layers, projects, juggling and AI-file scopes

Sources merged: [multi-game.md](../architecture/multi-game.md), [src/README.md](../../src/README.md), [AI_ARCHITECTURE_GUIDE.md](../../AI_ARCHITECTURE_GUIDE.md), [cleanup.md](../cleanup.md), [todo/README.md](../todo/README.md), [merge-into-everscript.md](../todo/merge-into-everscript.md), [romhacks-and-ports.md](../todo/romhacks-and-ports.md), `tools/README.md`.

> [!NOTE]
> The sibling `everscript` repo isn't readable from my sandbox. Its row is built from what these docs say about it (Python compiler, `in/` content, kaizo, patches, wiki). Please correct it.

## 1. The core idea: rank by layer first, importance second

Your concern is that a hotkey romhack and the script VM aren't peers. They aren't, so the structure should say so. Everything in the repo falls into four layers. A layer may depend only on layers above it.

```mermaid
flowchart TD
  L0["L0 Ground truth: facts + data access<br/>knowledge entries, docs/, soe:// som:// terra://, ROM library, platform/ (SNES facts), legal checks"]
  L1["L1 Engines: reusable machinery<br/>everscript compiler, script-vm, emulator, CDL recorder, MCP, map-editor core, decomp/RE pipeline"]
  L2["L2 Products: what you open daily<br/>Evermore tabs + language IDE, Mana maps, Terra maps"]
  L3["L3 Labs and romhacks: experiments built on L0-L2<br/>table hack, ExHiROM, recomp, c-to-rom, kaizo, hotkey/mirror/multiplayer hacks, Mana to SoE port, combo ROM"]
  L0 --> L1 --> L2 --> L3
```

- **Lower layers get stricter rules.** L0 and L1 get tests, checks and the release ritual. L3 gets a one-page charter and nothing more.
- **Every L3 item must say which L0–L2 pieces it consumes**, and may not change them silently. Needing a change means a small L1 change in its own commit.
- **Facts flow down only.** A romhack discovers an address, so it writes a knowledge entry in L0. Facts are never written only in the hack's docs.

## 2. All projects, by importance within layer

Importance reflects "what everything else breaks without". It is my judgement, so reorder it freely. Status values: 🟢 active, 🟡 maintained, ⚪ parked, 💡 idea.

| # | Project | Layer | Where | Status | Depends on | AI scope |
|---|---|---|---|---|---|---|
| 1 | **Knowledge base and VFS**: addresses, flags, tables; `soe://` `som://` `terra://`; ROM library | L0 | `localizations/knowledge/`, `src/games/*/resources/`, `src/platform/` | 🟢 | – | `game-knowledge`, `vfs-and-knowledge`, `games-and-roms`, `memory-map` |
| 2 | **Legal and quality gates**: `check:legal`, `check:knowledge`, `check:ai-context`, release ritual | L0 | `tools/check-*` | 🟡 | – | `release-ritual`, `test-discipline` |
| 3 | **Everscript language and compiler** (sibling repo `everscript`, Python; `in/` content, patches) | L1 | `../everscript` | 🟢 | 1 | the sibling repo's own files; here only a boundary contract |
| 4 | **Script VM, decoder and simulation** | L1 | `src/games/evermore/script-vm`, `script-model`, `simulation` | 🟢 | 1, 3 | `simulation`, `docs/scripts/` |
| 5 | **Language IDE** (grammar, hover, diagnostics, DAP debugger) | L2 | `games/evermore/language`, `debugger` | 🟢 | 3, 4, 6 | `grammar-rules`, `debugger-protocol` |
| 6 | **Embedded emulator + CDL recorder** | L1 | `src/core/emulator`, recorder | 🟢 | – | `emulator-subsystem`, `cdl-recorder`, `emulator-script-debugging` |
| 7 | **MCP server** (read-only window onto L0 for AI) | L1 | `src/core/mcp` | 🟡 | 1 | `vfs-and-knowledge` |
| 8 | **Map editor core** (shared shell plus per-game adapters) | L1 | `src/core/map-editor` | 🟢 | 1 | `map-editor-rules`, `feature-validation` |
| 9 | **Evermore Rooms/Map editor** | L2 | `games/evermore/rooms`, `maps` | 🟢 | 8, 1 | `map-format`, `map-construction`, `map-entities`, `rooms-tab` |
| 10 | **Evermore data tabs**: memory radar, sprites, music, scaling/alchemy, routes, ROM, data | L2 | `games/evermore/*` | 🟡 | 1, 6 | `memory-radar`, `animation-script`, `alchemy-spell-mechanics` |
| 11 | **Engine decompilation / RE pipeline** (CDL → asm → C, Ghidra, `reconstructed-c/`) | L1 | `docs/disassembly`, `reconstructed-c/`, `tools/cdl` | 🟢 | 1, 6 | `code-vfs`, `ghidra-analysis`, `re-curator` agent |
| 12 | **Table hack and ExHiROM** (move content out of the 3 MB limit) | L3→L1 | `tools/table-hack`, `tools/exhirom`, `patches/` | 🟡 | 1, 11 | `snes-asm-asar-patching`, `sample-playbacks` |
| 13 | **Custom opcodes and Kaizo opcodes** | L3 | `docs/todo/custom-opcodes.md`, sibling `in/kaizo` | 🟡 | 3, 4, 12 | `docs/scripts/opcodes.md` |
| 14 | **Static recomp** | L3 | `tools/recomp` | ⚪ | 11 | `recomp`, `recomp-debugging` |
| 15 | **C-to-ROM** and `standalone-c-rom/` | L3 | `tools/c-to-rom`, `compiler/` toolchains | ⚪ | 11 | `code-vfs` §4 |
| 16 | **Secret of Mana support** (maps, `som://`) | L2 | `src/games/mana` | 🟡 | 1, 8 | `supported-games`, `docs/mana/` |
| 17 | **Terranigma support** (rooms, `terra://`) | L2 | `src/games/terra` | 🟡 | 1, 8 | `supported-games`, `docs/terra/` |
| 18 | **Mana→Evermore bridge / SoM port** | L3 | `games/evermore/imports/mana` | 💡 | 9, 16 | `docs/mana/evermore-rooms.md` |
| 19 | **Romhack products**: hotkey, mirror mode, multiplayer, combo ROM | L3 | `docs/mirror-romhack-idea.md`, `docs/plans/multiplayer-mod.md`, `docs/exhirom/combo-rom.md` | 💡 | 12, 13 + whatever it needs | per-hack charter only |

> [!WARNING]
> `compiler/` holds third-party toolchains (Calypsi, vbcc, vasm, 816-tcc, loomcc). Check that `git ls-files compiler` tracks only your own glue and notes, not their binaries or sources. That is a legal-first item. Also, `standalone-c-rom/` has an `extract-assets` step, so confirm it only reads the user's ROM at runtime.

## 3. How to juggle it

1. **One focus per session, named in the first line of the prompt.** Use a header like `PROJECT: #12 table-hack`. The agent loads only that project's AI scope (§4). If a task needs an L0/L1 change, split it into its own commit.
2. **Cap active work.** Allow at most 2 🟢 L3 items and 1 spike at a time. Everything else is ⚪ or 💡, with a charter that says what unlocks it.
3. **Give every project a one-page charter** in `docs/projects/<name>.md`:
   - Goal and status.
   - Layer and consumed pieces.
   - Exit criterion ("done means...").
   - Next 3 steps.
   - Parking reason.

   The charter replaces the pile of `docs/*-idea.md` and `docs/todo/*` files. `docs/todo/README.md` becomes an index grouped by layer, and each row carries a `#` from the table above.
4. **Promotion and demotion rules.**
   - An L3 item that is used by two other items becomes L1. Move its code out of `tools/` and give it tests.
   - An L1 item nobody has touched or needed in about 3 months becomes ⚪ and drops out of default AI context.
5. **Shared bottleneck = L0.** Whatever you learn during a romhack (rule 0.2) lands in knowledge entries. Then side projects stay cheap, because each one starts from facts instead of re-research.
6. **Release posture.** With one user and no independent releases, treat `main` as the product. L3 work lives on short-lived branches and merges only when the L0–L2 gates are green. A *labs* folder is a later option for physically separating L3 (§5).

## 4. Fixing the AI files

The pollution comes from three habits: generic skill names that are really Evermore-only, game facts written inside skills, and one flat skill list for every layer.

**A. Three scopes, no more.**

| Scope | Where | Content | Loaded |
|---|---|---|---|
| Standing | root `AGENTS.md` | rules + the project routing table (§2 as 1 line per project) | always |
| Area | `src/**/AGENTS.md`, `tools/<x>/AGENTS.md`, `docs/projects/<x>.md` | invariants, tests, allowed deps | by location |
| Skill | `.agents/skills/` | procedure + traps for one mechanism | by trigger |

**B. Name skills by scope.** Today `map-format`, `memory-map`, `map-entities`, `simulation`, `rooms-tab`, `animation-script`, `memory-radar` and others read as universal but are Evermore-only. I suggest:
- `core-*`: game-neutral machinery (`core-map-editor`, `core-emulator`, `core-vfs`).
- `evermore-*`: Evermore-only formats and tabs.
- `mana-*` and `terra-*`: only when a game truly needs procedure beyond its docs. Usually `supported-games` plus `docs/<game>/` is enough.
- `lab-*`: romhack/L3 procedures (`lab-table-hack`, `lab-recomp`).
- Process skills (`release-ritual`, `test-discipline`, `feature-validation`) stay unprefixed.

**C. Rule: skills hold procedure, never facts.** Facts live in knowledge entries and `docs/<game>/`. A skill links to them. This is D10 ("no fact in two AI files") applied strictly, and it means a skill can't be polluted by a second game.

**D. Mana and Terra reusing the map editor.**
- The *mechanism* skill (`core-map-editor`) says only "adapter contract + shell rules".
- Each game gets a `src/games/<game>/AGENTS.md` that names its adapter, its decoder and its facts docs.
- The only cross-game file stays `imports/mana` and its table. That bridge is one explicit "mixed" area with its own AGENTS.md.
- Agent prompts then read "core-map-editor + games/mana/AGENTS.md", never the Evermore map skills.

**E. Add a routing table to the root `AGENTS.md`** (the §2 table, trimmed to project → AI scope). It replaces the long skill list, so an agent in project #12 never sees the map-editor skills. Keep the `check:ai-context` limits.

**F. The sibling `everscript` repo.** Keep the merge *deferred*. What helps now is a **boundary contract**: a generated `language-data.json` plus a versioned `source_map.json` (steps 3 of the merge doc). That ends the hand-copied signatures without merging history. If you do merge later, the gates G1–G4 in the merge doc still apply. Until then each repo owns its own skills, and the six duplicated ones need one owner each, with the other side linking.

## 5. Repo shape — recommendation

Stay a single repo for now. Splitting costs more than it saves with one user. Do these first, cheapest to most invasive:

1. Add the project table to the root `AGENTS.md` and `docs/projects/` charters (no code moves).
2. Tag `docs/todo/*` clusters with project numbers and layer.
3. Rename skills with the scope prefixes and update links (`check:ai-context` verifies the links).
4. Add `src/games/mana/AGENTS.md` and `terra/AGENTS.md` if missing.
5. Move L3 tools into `labs/` (recomp, c-to-rom, standalone-c-rom, romhack charters). This is optional, and only worthwhile if the gates should skip them.
6. Revisit the `everscript` merge after steps 1–4. Rename the repo only if it ever ships independently.

## 6. Decisions I need from you

1. Is the importance order in §2 right? In particular, where do the hotkey/mirror romhacks sit relative to Mana and Terra?
2. Prefix renames of skills (§4B): yes or no? It touches many links, but `check:ai-context` will catch breaks.
3. Do you want this committed as `docs/projects/README.md`, replacing the old structure notes? That includes the release ritual, a version bump and deploy.

## 7. The ideal AI file setup

The goal: an agent working on one project reads the standing rules, that project's area file and two or three skills. It never loads another project's procedures, and it never finds a fact that is also written somewhere else.

### 7.1 The shape

```
AGENTS.md                      standing rules + project routing table        (always loaded, ≤150 lines)
AI_ARCHITECTURE_GUIDE.md       the laws (layers, VFS, legal, size)           (linked, read on demand)
docs/projects/README.md        this map; one charter per project             (linked)
docs/projects/<project>.md     charter: goal, status, exit criterion, scope  (one per project)

src/platform/AGENTS.md         area file: invariants, deps, tests            (loaded by location)
src/core/<x>/AGENTS.md
src/games/<game>/AGENTS.md     facts docs, adapter, what this game lacks
tools/<x>/AGENTS.md            lab area files

.agents/skills/<scope>-<name>/SKILL.md     procedures + traps, loaded by trigger
.agents/agents/<role>.md                   personas = a fixed bundle of skills + a project
```

| Kind of file | Answers | Never holds |
|---|---|---|
| Root `AGENTS.md` | What may I never do? Which project am I in, and where is its scope? | Procedures, facts, per-folder detail |
| Area `AGENTS.md` | What does this folder own, what may it import, how is it tested? | Game facts, cross-project advice |
| Skill | How do I do this kind of work, and what traps have bitten before? | Facts that exist in knowledge entries or `docs/<game>/` |
| Charter | Why does this project exist, what is done, what is next? | Procedures, code descriptions |
| Knowledge entry / `docs/<game>/` | What is true about the game, with evidence? | Instructions to an agent |

### 7.2 Rules

1. **One owner per statement.** A fact, rule or procedure appears in exactly one file; every other file links to it. `check:ai-context` already enforces size and links. Add a duplicate-sentence check to it (same idea as `check:dup`).
2. **Scope is in the name and the frontmatter.** Skills are named `<scope>-<topic>`. The frontmatter has `scope: core | evermore | mana | terra | lab | process` and `projects: [9, 10]`, using the numbers from §2. The description is a trigger condition ("Use before changing X"), at most 2 lines.
3. **Dependencies mirror the layers.** A skill may link to skills of its own scope or a lower layer (`lab-*` → `evermore-*` → `core-*`). `core-*` skills never mention a game. A check can read the links and fail on an upward reference.
4. **Skills hold procedure, never facts.** Facts live in knowledge entries and `docs/<game>/`, reachable through `soe://` `som://` `terra://`. A skill says where to look, not what is there. This is what keeps a second game from polluting it.
5. **Budgets** (extend the existing limits): root ≤150 lines; area `AGENTS.md` ≤80; skill ≤200 with details in `references/`; charter ≤1 page; persona ≤40.
6. **Progressive loading.** The root file lists *routing*, not content: "project #12 → `lab-table-hack`, `evermore-script-opcodes`, `src/games/evermore/AGENTS.md`". Everything deeper loads on demand.
7. **Personas bundle, they don't copy.** A persona names a project, its skills and its exit criterion. It contains no procedure of its own.
8. **Staleness is a defect.** Every AI file has an owner project. A parked project (⚪) drops out of the routing table. Its skills stay, but the root file no longer points at them.
9. **Learn → write down → right place.** A lesson goes to the lowest layer that needs it. Game fact → knowledge entry. Mechanism trap → the `core-*` skill. Project-specific trap → the charter or area file. One-off → nowhere.

### 7.3 Where today's skills land

| New scope | Skills (today's names) |
|---|---|
| `process-` (unprefixed, game-neutral) | `release-ritual`, `test-discipline`, `feature-validation`, `game-knowledge`, `architecture`, `supported-games`, `wiki-entries` |
| `core-` | `emulator-subsystem`, `map-editor-rules`, `webview-dom-safety`, `vfs-and-knowledge`, `games-and-roms`, `cdl-recorder` |
| `evermore-` | `map-format`, `map-construction`, `map-entities`, `memory-map`, `memory-radar`, `rooms-tab`, `animation-script`, `alchemy-spell-mechanics`, `secret-of-evermore-engine`, `simulation`, `grammar-rules`, `debugger-protocol`, `emulator-script-debugging`, `code-vfs`, `sample-playbacks` |
| `lab-` | `recomp`, `recomp-debugging`, `snes-asm-asar-patching`, `ghidra-analysis` |
| `mana-` / `terra-` | none yet. `supported-games` plus the game's `AGENTS.md` and docs cover them. Create one only when a game has a real procedure of its own. |

Some skills mix scopes. `map-editor-rules` mentions Evermore ROM budgets, so split it into `core-map-editor` (adapter contract, shell rules) and an `evermore-` part for the budgets and word layouts. `code-vfs` and `sample-playbacks` are Evermore today but are candidates for `core-` if Mana or Terra gain a recomp.

### 7.4 What an agent loads, by example

| Task | Loaded |
|---|---|
| Fix a Terranigma room render | root, `src/games/terra/AGENTS.md`, `core-map-editor`, `feature-validation` |
| Add a field to the Evermore room editor | root, `src/games/evermore/AGENTS.md`, `core-map-editor`, `evermore-map-format`, `evermore-map-editor-budgets` |
| Move another table in the table hack | root, `tools/table-hack/AGENTS.md`, `lab-snes-asm-asar-patching`, `sample-playbacks` |
| Hotkey romhack | root, its charter, the one `lab-` skill it needs, `game-knowledge` |

None of these load the other games' map skills or an unrelated lab.

### 7.5 Migration, in order

1. Add the routing table to the root `AGENTS.md` and a charter stub per project (no renames yet).
2. Add `scope:` and `projects:` frontmatter to every skill. `check:ai-context` reports any skill without them.
3. Rename skills with the prefixes (`git mv`), fixing links in the same commit. Do it in batches by scope so each commit stays reviewable.
4. Split the mixed skills (§7.3).
5. Add the layer-direction and duplicate-sentence checks to `check:ai-context`.
6. Add area `AGENTS.md` files for `src/games/mana`, `src/games/terra` and each lab under `tools/`, where missing.

> [!NOTE]
> Steps 1–2 change no behaviour and can ship immediately. Step 3 is the large diff, and `check:ai-context` verifies every link.
