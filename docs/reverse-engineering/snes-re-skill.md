# A "grill + REA" skill for SNES games

Proposal, 2026-10-27. Why `/grill-me` and REA work well for agents, and how one skill could
apply the same pattern to any SNES ROM: an intake interview, then a CDL- and
snesrecomp-driven pipeline that produces a function list, a ROM map, a WRAM map, and tables,
enums and script languages. Sources: the `grilling` skill, [rea.md](rea.md) §10 (our spike),
[README.md](README.md) (goals G1–G5), [tools/recomp/README.md](../../tools/recomp/README.md), the
`re-curator` agent.

---

## 1. Why `/grill-me` works

`/grill-me` only loads `grilling`. That skill is efficient because it splits the work so
the user spends attention only on what only they can decide:

| Mechanism | Effect |
|---|---|
| **Design tree + frontier.** Ask every question whose prerequisites are settled, all in one round. | Few round-trips. No question is asked before the answer it depends on is known. |
| **A recommended answer per question; "yes" accepts it.** | Most answers are one word. The agent does the thinking and the user only vetoes. |
| **Facts are the agent's job, decisions are the user's.** Sub-agents look things up without blocking the round. | The user is never asked anything a `grep` could answer. |
| **Stop when the frontier is empty, act only after confirmation.** | Nothing is silently assumed, and no work starts on a misunderstanding. |

## 2. Why REA works (and where it doesn't)

From our spike ([rea.md](rea.md) §10): 376 unnamed functions were turned into dossiers in about 5 minutes,
and 12 names came out of one pass.

| Mechanism | Effect |
|---|---|
| **One front end (MCP) over a heavy analyzer.** Open once, then run many cheap queries. | The agent asks narrow questions and gets narrow answers instead of reading a whole listing. |
| **Evidence-tagged output.** Each dossier holds the assembly, callers, callees and named references. | Naming becomes ranking plus reading. Every claim can cite its evidence. |
| **Batching.** One session drives every function, with a timeout per call. | Throughput comes from the pipeline, not from the model. |

The weak points matter more for SNES than the strong ones:
- It knows nothing about the 65816: no M/X, DB or D, jump tables or mirrors.
- Nothing persists between sessions.
- Without our **CDL seeds** it found 1 procedure. With them it found 556.

So the efficiency came from *our* runtime data fed through *its* query shape. The skill keeps
that query shape and swaps the engine: the CDL library and snesrecomp come first, and Ghidra
only fills the static gaps.

## 3. The skill: `snes-re` (working name)

The skill has two phases. Phase 1 is a grilling-style intake. Phase 2 is a REA-style pipeline
whose results persist in the CDL library and the game's knowledge files. It is **game-neutral**:
the generic code uses SNES hardware facts only (`src/platform/`), and each game's outputs go to
that game's folder and docs (AGENTS.md §0.4).

### 3.1 Phase 1: intake (rounds, as in `grilling`)

**Facts the agent finds itself (never asked):**

| Fact | How |
|---|---|
| ROM identity: title, region, LoROM / HiROM / ExHiROM, coprocessor (SA-1, SuperFX, DSP), checksum, SHA-1 | header + `npm run roms` (`games-and-roms` skill) |
| Supported game already, or new? | game descriptors, `supported-games` |
| CDL coverage for this SHA-1 (code %, data %, functions, DMA destinations) | CDL library (`cdl-recorder` skill) |
| Installed tools: our emulator (always), Mesen2, Ghidra + ghidra-snes (with the loader patch?), REA, snesrecomp checkout | PATH, `$GHIDRA_INSTALL_DIR`, `ghidra-analysis` traps table |
| Existing knowledge: names, WRAM entries, docs for this game | `docs/<game>/`, knowledge entries, the VFS |

**Decisions put to the user (one round, a recommendation each):**

1. **Goal(s):** recomp, WRAM map, ROM map, map editor, or engine/mechanics documentation.
   The recommendation follows from §3.3: almost every goal starts with the ROM map.
2. **Scope:** whole ROM, or one subsystem first (field engine, menus, battle, sound)?
3. **CDL plan:** if coverage is low, which parts of the game to record next, and by whom (the
   user playing, a stored playback, scripted input from save states). **This is the one input
   only the user can produce**, so the intake must end with a concrete recording list.
4. **Outside maps** (community RAM/ROM maps): treat them as leads to check against the running
   game, never copy them (AGENTS.md §0.1). Whether a given source may be read at all is the
   user's call, per source and per licence.
5. **Confidence bar:** is `guess` acceptable in a first pass, or only `likely` and above?

### 3.2 Phase 2: the pipeline

Each stage writes to a persistent place: the library, the knowledge files, or the docs. A
later session resumes where the last one stopped, which REA cannot do.

| Stage | Input | Method | Output |
|---|---|---|---|
| **A. Split into functions** | CDL `SUB`/`JUMP` bits, `rets.bin` widths, observed indirect targets; snesrecomp's seed config | entries = CDL subroutine heads + jump-table targets; bounds and entry M/X from the CDL; Ghidra (seeded at the *execution* bank) only for unplayed code, tagged `static` | function list with bounds, entry state, callers and callees (the library, then `functions.json`) |
| **B. Document → ROM map** | stage A + dossiers | rank by evidence (callers, named callees, WRAM touched, hardware registers); read the asm with its callers; name with a confidence level (`re-curator` loop) | names and notes per function; ROM map regions: code, named tables, assets |
| **C. WRAM map** | CDL WRAM accessors and widths, `regs.bin` DB/D | group bytes by the functions that access them → owner; indexed access with a fixed stride → struct and slot size; `CMP #imm` / jump-table indices on a byte → enum candidates | WRAM entries with owner, size, purpose; `structs`, `enums` |
| **D. Tables, enums, script languages** | data regions read by indexed loads; DMA destinations | indexed load from a ROM range → table (stride = record size); **a byte fetched through a moving pointer, then dispatched through a jump table → bytecode VM**: the handler table gives the opcode set, and how far each handler advances the pointer gives operand lengths; DMA to VRAM / CGRAM / APU → graphics / palette / sound | table and enum docs; for a script VM, an opcode overview like `docs/scripts/`; asset decoders as follow-up tasks |
| **E. Verify** | the outputs | Asar rebuild byte-identical; recomp boots; claims checked in the emulator (`feature-validation`) | report: what was proven, what still needs a recording |

**Free hints from SNES hardware (game-neutral, `src/platform/`):** a function that writes
`$2116–$2119` uploads to VRAM. One that writes `$43x0–$43xA` and `$420B` runs DMA. One that
talks to `$2140–$2143` talks to the sound CPU. One that reads `$4218–$421F` reads joypads.
One reached from the NMI vector runs every frame. These hints give a first name to many
functions before anyone reads their game logic.

### 3.3 Which stages each goal needs

| Goal | Stages | Done means (from [README.md](README.md) §1) |
|---|---|---|
| ROM map | A, B, D | every ROM byte has an owner |
| WRAM map | A, C | every WRAM byte has an owner, a size and a purpose |
| Recomp | A (complete entries + jump tables), E | snesrecomp output boots; functions carry our names |
| Map editor | A, D (room tables, tile/collision formats), C (room state) | renders in the core map editor like the game (AGENTS.md §0.6) |
| Engine docs | A, B, C, D around one subsystem | a doc per mechanic, checked in the running game |

## 4. Why this would be efficient, point by point

| From | Kept as |
|---|---|
| grilling: frontier batching, recommended answers | intake asks one round, and most answers are "yes" |
| grilling: facts vs decisions | the agent finds ROM type, coverage and tools itself; the user decides goals and does the recording |
| REA: one front end, many narrow queries | a dossier per function from the library (and `soe://`-style VFS) instead of reading banks |
| REA: evidence per claim | every name carries evidence and a confidence level (`game-knowledge` rules) |
| *not* REA: no persistence, no 65816 context | the CDL library supplies M/X, DB/D and jump targets, and results stay in the library and the knowledge files |

## 5. What exists and what to build

| Piece | Status |
|---|---|
| CDL recorder, per-ROM library, Asar / Mesen / recomp export | ✅ (`cdl-recorder`), but for any ROM? check the export's Evermore assumptions |
| `npm run recomp` (export → rebuild → snesrecomp → report) | ✅ Evermore only: names, asset regions and glue come from `src/games/evermore/` |
| Naming loop with evidence | ✅ `re-curator` agent, Evermore only |
| Ghidra seeds and dossier batch | ⚠️ in the spike folder outside the repo (`gen-seeds.js`, `dossiers.js`) |
| **Dossier generator from the CDL alone** (no Ghidra): asm + callers + callees + WRAM + hardware registers per function | ❌ to build, game-neutral; the core of stage B |
| **Hardware-register hints** (§3.2) | ❌ to build in `src/platform/` |
| **Struct / enum / bytecode-VM detectors** (stages C, D) | ❌ to build; Evermore's script VM is the test case (we know the answer) |
| **The skill file** (intake round + stage recipes + per-game output paths) | ❌ `.agents/skills/snes-re/SKILL.md` once the generator exists |
| A game-neutral `re-curator` (per-game sources as a parameter) | ❌ generalize after the skill proves itself on a second game |

**Proving it:** run the skill on Evermore first, where the answers are known (functions,
WRAM, the script VM), and measure what it rediscovers. Then run it on Terranigma or Mana,
which have little code knowledge today, and see what it finds.

## 6. Open decisions (first grilling round)

❓ **Q1 — Name:** `snes-re`?
➡️ Yes. It is short and says it is game-neutral.

❓ **Q2 — Build the CDL-only dossier generator before the skill file?**
➡️ Yes. Without it, stage B depends on Ghidra and a patched REA.

❓ **Q3 — Calibrate on Evermore first?**
➡️ Yes. It is the only game where the output can be scored.

❓ **Q4 — Outside RAM/ROM maps: leads only, decided per source?**
➡️ Yes. This is AGENTS.md §0.1 applied as written.

❓ **Q5 — Should the skill be allowed to launch a playback/recording run on its own (headless,
time-boxed) to raise coverage, instead of only handing the user a recording list?**
➡️ Yes for stored playbacks (`sample-playbacks`). New play sessions stay with the user.
