---
name: game-knowledge
description: Use whenever you learn or need anything about an Evermore address, flag, routine, script, table or format: look it up first, write it down (knowledge entries) before you finish.
applyTo: "**"
---

# Skill: Game knowledge — write down everything you learn

We re-learn the same addresses almost daily because findings stay in chat logs. **A finding
that is not written down is lost.** This skill is the one place that says where and how.

## 1. Before researching an address

Look it up first — it may already be known:
1. `src/games/evermore/localizations/knowledge/{ram,rom}/<addr>.md` (and regions containing it — check `end:`)
2. `soe://ram/<addr>.json`, `soe://bus/<addr>`, `soe://tags/search/<word>.md` (MCP `soe_read`)
3. `docs/` (`grep -ri "<addr without \$>" docs`)

## 2. After learning anything — record it in the same commit

Record when you learned **what** something is, **how** it behaves, or that an earlier entry
is **wrong**. Partial knowledge counts: an entry with `confidence: guess` and one honest
sentence beats nothing. No permission needed — this is part of every task.

| You learned about | Write to |
|---|---|
| a WRAM address, struct, flag byte or region | `src/games/evermore/localizations/knowledge/ram/<addr>.md` |
| an asm routine, script, script function, table or data block in the ROM | `src/games/evermore/localizations/knowledge/rom/<addr>.md` |
| anything about **Secret of Mana** (a different game) | `docs/mana/README.md` and the comment of the `src/games/mana/decoder/` file that reads it — never `knowledge/`, never mixed with Evermore entries |
| a format or mechanism spanning many addresses | `docs/game-research/…` (prose), linked from the entries |
| a workflow trap, a tool fact, or a skill/AGENTS.md statement that is wrong | fix that skill / `AGENTS.md` directly |

Correcting is as important as adding: if an entry is wrong, fix it and say what the old
belief was in the body (`Previously believed: …`).

## 3. Entry format

One file per entry, named by the **bus address as the game uses it**, 6 lowercase hex digits,
no `$`: `ram/7e2834.md`, `rom/8cd0a6.md`. A region/struct gets one file at its start address;
lookups for addresses inside it resolve through `end:`.

```markdown
---
addr: 7E2834
end: 7E2BFF
kind: region
name: ROOM_SCRATCH
title: Room scratch RAM
lifetime: room
confidence: likely
tags: [room, scratch, script]
evidence: ["write: cleared on screen transition (watched in emulator, v0.200.0)", "read: room scripts of 0x33 and 0x5c use it differently"]
see: [docs/game-research/room-scratch.md]
---
Temporary RAM for whatever the current room needs. Reset on every screen transition.
Multi-purpose with no fixed structure: each room's scripts lay it out their own way
(boss phase counters, puzzle state, …), so a value only means something together with
the room id.

## Layout per room
| room | offset | size | meaning |
|---|---|---|---|
| 0x33 | +0x00 | 2 | boss phase |
```

### Front matter (flat: `key: value` or `key: [a, b]` — no nesting)
| Key | Required | Values |
|---|---|---|
| `addr` | yes | hex bus address, uppercase, no `$` |
| `end` / `size` | if longer than 1 byte | inclusive end address, or byte count |
| `kind` | yes | RAM: `var`, `struct`, `region`, `flags`, `table`, `stack` · ROM: `code`, `script`, `table`, `data`, `region` |
| `name` | yes | our own identifier (`UPPER_SNAKE` for data, `lower_snake` for code/scripts) |
| `title` | yes | short human label |
| `lifetime` | RAM | `frame`, `room`, `map`, `save` (persists in SRAM), `boot`, `unknown` |
| `confidence` | yes | `guess`, `likely`, `confirmed` |
| `tags` | no | `soe://tags` ids; `compiler-region` marks the Everscript compiler's RAM regions (radar lifecycles) |
| `category` | ROM code / tables | the emoji group that lists it in the ROM tab, `soe://` and the exports |
| `evidence` | yes unless `guess` | list of `"kind: what was observed"` — kinds: `trace`, `write`, `read`, `cdl`, `disasm`, `test`, `evs` |
| `see` | no | related entries/docs |

### Body
1. **First paragraph: plain-language purpose** — what it is for, when it changes, who uses it.
   Write for someone who has never seen the game's code. Required for every entry.
2. Optional fixed sections, as small Markdown tables: `## Fields` (struct: offset, size,
   name, meaning), `## Bits` (flags), `## Values` (enum-like values), `## Layout per room`.
3. Optional `## Notes` for caveats, open questions, `Previously believed: …`.

## 4. Rules

- **Facts only, our own words.** Addresses, behaviours, formats observed in the ROM or
  emulator. Never paste game text, graphics, byte dumps or disassembly listings longer than a
  few lines, and never copy from the third-party tools the root `AGENTS.md` names or other projects
  (`AI_ARCHITECTURE_GUIDE.md` §3.8).
- **Names are ours.** Pick descriptive names; don't import names from other projects.
- **Evidence makes it trustworthy.** Say how you know. `confirmed` needs a trace, test or
  disassembly you actually looked at.
- **Entries are the one source.** `localizations/knowledge.ts` loads them; `functions.ts` and
  `tables.ts` are views of the ROM entries of kind `code`/`script` and `table`/`data` that have a
  `category` (🧠 code, 📜 script, 📋 table, ⚗️ alchemy, 👾 enemies, 🎞️ animation, ⚔️ weapons,
  🎒 items) — that is how a routine or table reaches the ROM tab, `soe://localization`, the asm
  view, the Asar/recomp exports. A new routine or table name is an entry with a `category`; never
  a JS line. `size:` on a table is its length for `soe://` table views. `names.json` (script
  operand names) is still separate and frozen (cleanup D4).
- **One commit:** the code change and the knowledge it produced land together.

## 5. Why not one big Markdown table

The overview tables (RAM map, ROM map) are meant to be **generated** from these entries (the generator does not exist yet). A single
hand-edited table can't hold multi-sentence purposes, per-room layouts or bit tables; pipes
and line breaks break it; and parallel agents editing one file conflict. One file per entry
is greppable, merge-friendly, readable on its own, and served as-is by `soe://`.
