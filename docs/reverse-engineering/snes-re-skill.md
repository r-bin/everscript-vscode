# A "grill + REA" skill for SNES games

Rationale and build status (proposal of 2026-10-27; the skill file now exists). Why `/grill-me` and REA work well for agents, and how one skill could
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

## 3. The skill: `snes-re`

The skill exists: [`.agents/skills/snes-re/SKILL.md`](../../.agents/skills/snes-re/SKILL.md) is the
canonical text. It holds the two phases (grilling-style intake, then the stage A–E pipeline), the goal →
stage table, the SNES hardware-register hints, the origin / status rules for truths vs community leads
(`lead → checked → confirmed`, or `contradicted`) and the per-game state files (`intake.md`, `leads.md`,
`worklist.md`). It is game-neutral: generic code uses SNES hardware facts only (`src/platform/`); each
game's outputs go to that game's folder and docs (AGENTS.md §0.4). This page keeps only the rationale,
the build status and the decisions.

## 4. Why this would be efficient, point by point

| From | Kept as |
|---|---|
| grilling: frontier batching, recommended answers | intake asks one round, and most answers are "yes" |
| grilling: facts vs decisions | the agent finds ROM type, coverage and tools itself; the user decides goals and does the recording |
| REA: one front end, many narrow queries | a dossier per function from the library (and `soe://`-style VFS) instead of reading banks |
| REA: evidence per claim | every name carries evidence and a confidence level (`game-knowledge` rules) |
| *not* REA: no persistence, no 65816 context | the CDL library supplies M/X, DB/D and jump targets; results, intake answers and the worklist are written down (skill §3, §2) |
| *neither*: a source of a claim | origin and status per claim; community claims stay leads until our evidence agrees (skill §2) |

## 5. What exists and what to build

| Piece | Status |
|---|---|
| CDL recorder, per-ROM library, Asar / Mesen / recomp export | ✅ (`cdl-recorder`), but for any ROM? check the export's Evermore assumptions |
| `npm run recomp` (export → rebuild → snesrecomp → report) | ✅ Evermore only: names, asset regions and glue come from `src/games/evermore/` |
| Naming loop with evidence | ✅ `re-curator` agent, Evermore only |
| Ghidra seeds and dossier batch | ⚠️ in the spike folder outside the repo (`gen-seeds.js`, `dossiers.js`) |
| **Dossier generator from the CDL alone** (no Ghidra): asm + callers + callees + WRAM + hardware registers per function | ❌ to build, game-neutral; the core of stage B |
| **Hardware-register hints** (skill §3 B) | ❌ to build in `src/platform/` |
| **Struct / enum / bytecode-VM detectors** (stages C, D) | ❌ to build; Evermore's script VM is the test case (we know the answer) |
| **The skill file** (intake round + stage recipes + per-game output paths) | ✅ draft: `.agents/skills/snes-re/SKILL.md`; stage B uses the asm export or REA until the generator exists |
| **`origin` field on knowledge entries** + a leads register; `check:knowledge` rejects an entry whose only evidence is `community` | ❌ to build; existing entries default to `origin: runtime/static` from their evidence kinds, the community-Ghidra-derived ones are re-tagged |
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

❓ **Q4b — Add `origin` to the knowledge-entry schema now (for Evermore too), and enforce "no
community-only entries" in `check:knowledge`?**
➡️ Yes. It is cheap now and expensive to back-fill later.

❓ **Q5 — Should the skill be allowed to launch a playback/recording run on its own (headless,
time-boxed) to raise coverage, instead of only handing the user a recording list?**
➡️ Yes for stored playbacks (`sample-playbacks`). New play sessions stay with the user.
