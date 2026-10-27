---
name: snes-re
description: Use to reverse-engineer a SNES game from its CDL: interview for goals, split the ROM into functions, build ROM/WRAM maps, find tables and script VMs, keeping truths apart from community guesses.
---

# Skill: reverse-engineer a SNES game (`snes-re`)

Design and rationale: `docs/reverse-engineering/snes-re-skill.md`. The skill has two phases:
an **intake** run in grilling rounds, then a **pipeline** that turns recorded facts into maps. Its state
lives in files, so any session or agent can resume it: `docs/re/<game>/intake.md`, `leads.md` and `worklist.md`
(`<game>` = `evermore`, `mana`, `terra`, …). Read them first if they exist and continue from them.

Games stay apart (AGENTS.md §0.4). Only SNES hardware facts carry over from one game to another.
Outputs go to that game's knowledge files and docs (`supported-games` skill).

## 1. Intake (grilling rounds)

**Facts are your job.** Look each one up and never ask the user for it:

| Fact | Where |
|---|---|
| ROM identity: title, region, mapping (LoROM / HiROM / ExHiROM), coprocessor, SHA-1 | header, `npm run roms` (`games-and-roms`) |
| Supported game or new | game descriptors (`supported-games`) |
| CDL coverage for this SHA-1: code %, functions, DMA destinations | CDL library (`cdl-recorder`) |
| Tools present: our emulator, Mesen2, Ghidra + ghidra-snes (loader patch?), REA, snesrecomp | PATH, `$GHIDRA_INSTALL_DIR`, `ghidra-analysis` §2 |
| What we already know | the game's knowledge entries, docs, VFS (`game-knowledge`, `vfs-and-knowledge`) |

**Decisions belong to the user.** Ask them all in one round, give a recommendation for each, and word
each question so that "yes" accepts your recommendation:

1. **Goals:** ROM map, WRAM map, recomp, map editor, engine docs. Each goal needs certain stages (§3).
2. **Scope:** the whole ROM, or one subsystem first (field, menus, battle, sound).
3. **Recording plan:** which parts of the game to record next, and by whom (the user plays; stored
   playbacks, `sample-playbacks`). Only the user can produce new recordings, so give a concrete list.
4. **Sources:** which outside RAM/ROM maps may be read, decided per source and per licence. Whatever
   comes from them is a *lead* (§2), never a fact.
5. **Confidence bar:** whether `guess` is acceptable for this pass.

Recompute the questions after each round. **Done when** every answer is in `intake.md` and the
user has confirmed it. Start the pipeline only after that confirmation.

## 2. Truths vs leads

Every claim has an **origin** (who says so, never changes) and a **status** (what we checked).

| Origin | Trust on its own |
|---|---|
| `runtime`: CDL, trace, WRAM watch, our test | high, for what was executed |
| `static`: our disassembly, Ghidra / REA call graph | medium (no M/X/DB/D, misses jump targets) |
| `inference`: your reading of a routine | low until checked |
| `community`: wikis, public maps, old projects, forum posts | **lead only** |

| Status | Lives in |
|---|---|
| `lead` (claimed, not looked at) | `leads.md` only |
| `checked` (our static/inference evidence agrees) | knowledge entry, `confidence: guess` / `likely` |
| `confirmed` (our runtime evidence agrees) | knowledge entry, `confidence: confirmed` |
| `contradicted` | `leads.md` with the counter-evidence; an existing entry gets `Previously believed: …` |

- **Our own evidence promotes a claim.** Two community sources agreeing are still a lead, and
  so is a paraphrase of one. A lead tells you where to look, and the knowledge entry cites what *you* observed.
- **Runtime beats static beats inference.** Record every disagreement in `leads.md`. Keep a hit rate
  per source there, so you know how far to trust each one.
- **An inference reaches `confirmed`** through a runtime experiment that is listed in `worklist.md` and was run.
- **Leads in our own words:** one line each, holding the address, the claim, the source title or URL and
  the status. Copy no tables or comments, and import no whole map (AGENTS.md §0.1).

## 3. Pipeline

Pick the stages the chosen goals need:

| Goal | Stages |
|---|---|
| ROM map | A, B, D |
| WRAM map | A, C |
| Recomp | A (every entry, every jump target), E |
| Map editor | A, D (room tables, tile/collision formats), C (room state) |
| Engine docs | A–D around one subsystem |

Work in batches. **Each item ends in a file:** a knowledge entry, a `leads.md` line, or a
`worklist.md` line that names the experiment that would settle it. An item that exists only in your
context is lost when the session ends.

### A. Split into functions

- Entries are the CDL subroutine heads (`SUB`) plus the observed jump targets. Take bounds and entry
  M/X widths from the CDL (`rets.bin`), and DB/D from `regs.bin`.
- Fill unplayed code with Ghidra, **seeded at the execution bank** (`ghidra-analysis`).
  Tag what you find there `static`.
- **Done when** every CDL entry has bounds and callers, and the unexplored jump tables are listed in `worklist.md`.

### B. Document → ROM map

1. Build a summary per function: its asm, callers, callees, the WRAM it touches, and the
   hardware registers it uses. Use the asm export (`npm run recomp -- --no-recomp`), `soe://rom/code/` for
   Evermore (`code-vfs`), or REA dossiers. A game-neutral generator is not built yet.
2. Rank by evidence: many callers, calls into named code, named WRAM, hardware registers.
3. **Hardware hints** (SNES facts that are true in every game):

   | Registers | Purpose |
   |---|---|
   | writes `$2116–$2119` | VRAM upload |
   | writes `$2121–$2122` | CGRAM (palette) |
   | writes `$43x0–$43xA` + `$420B` / `$420C` | DMA / HDMA |
   | uses `$2140–$2143` | sound CPU |
   | reads `$4218–$421F` | joypad |
   | reached from the NMI vector | runs every frame |

4. Name a function only when you have evidence. Follow the `re-curator` loop (look up first, then
   gather evidence, decide, write). **Done when** every function in the batch has a name with evidence,
   or a `worklist.md` line naming the experiment that would settle it.

### C. WRAM map

- Group bytes by the functions that access them. The functions that write a byte own it.
- Indexed access with a fixed stride is a struct, and the stride is the slot size.
- `CMP #imm` and jump-table indices on a byte suggest an enum.
- Use the width from the CDL (8 vs 16 bit) and the lifecycle: when the byte is cleared, and in which room or mode.
- For Evermore, the `wram-curator` agent does this stage. **Done when** every byte in scope has an
  owner, a size and a purpose, or a worklist line.

### D. Tables, enums, script languages

- **Table:** an indexed load from a ROM range. The stride is the record size, and the readers give its meaning.
- **Bytecode VM:** a byte is fetched through a moving pointer and then dispatched through a jump table.
  The handler table gives the opcode set. How far each handler advances the pointer gives the operand
  lengths. Evermore's VM (`docs/scripts/`) is the known answer to calibrate against.
- **Assets:** DMA to VRAM, CGRAM or the APU marks graphics, palettes and sound. Record the region and
  the reader. Writing a decoder is a separate task.
- **Done when** every data region read in scope has an owner and a format note, or a worklist line.

### E. Verify

- The Asar rebuild is byte-identical, and the recomp boots (`recomp`).
- Claims are checked in the emulator (`emulator-script-debugging`, `feature-validation`).
- Promote statuses in the files (§2).

## 4. Report

End the session with three lists and a pointer to `worklist.md`:
- **confirmed** this session,
- **checked but not confirmed**,
- **contradicted** leads, each with its source.

Then commit following `release-ritual` (doc-only: just commit).

## 5. Rules

- No ROM bytes, no dumps, and no copied community data go in the repo (AGENTS.md §0.1, `npm run check:legal`).
  The state files hold addresses and our own sentences only.
- Write each fact where the game keeps its knowledge (`game-knowledge`; for Mana and Terra, `supported-games`).
- If a tool, the export or this skill turns out wrong while you work, fix it in the same commit (AGENTS.md §0.3).
