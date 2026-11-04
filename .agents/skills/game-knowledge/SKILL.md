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
1. `src/games/evermore/localizations/knowledge/{wram,routines}/<name>.md` and the memory maps (`data/wram-map.md`, `data/wram-map-7f.md`, `data/rom-map.md`)
2. `soe://rom/code/index.md?q=<addr or word>` (routines), `soe://ram/<addr>.json`, `soe://bus/<addr>`, `soe://tags/search/<word>.md` (MCP `soe_read`)
3. `docs/` (`grep -ri "<addr without \$>" docs`)

## 2. After learning anything — record it in the same commit

Record when you learned **what** something is, **how** it behaves, or that an earlier entry
is **wrong**. Partial knowledge counts: an entry with `confidence: guess` and one honest
sentence beats nothing. No permission needed — this is part of every task.

| You learned about | Write to |
|---|---|
| a WRAM address, struct, flag byte or region | `src/games/evermore/localizations/knowledge/wram/<NAME>.md` (and map entry in `data/wram-map.md` or `wram-map-7f.md`) |
| an asm routine, script, script function, table or data block in the ROM | `src/games/evermore/localizations/knowledge/routines/<NAME>.md` (and map entry in `data/rom-map.md`) |
| an asm comment on one instruction | `src/games/evermore/localizations/data/asm-comments.json` (key: US file offset) — never in docs; served in `soe://rom/code/<name>/<name>.asm` |
| a routine's C | `reconstructed-c/<bank>/`, the US address in the comment right above the function (`code-vfs` skill) |
| a script opcode byte (what, why, group tags, Everscript name) | `src/games/evermore/localizations/knowledge/opcodes/<xx>.md` (its handler: `routines/`) |
| anything about **Secret of Mana** (a different game) | `docs/mana/README.md` and the comment of the `src/games/mana/decoder/` file that reads it — never `knowledge/`, never mixed with Evermore entries |
| a format or mechanism spanning many addresses | the topic's `docs/` folder (`docs/scripts/`, `docs/entities/`, `docs/map-format/`, …), linked from the entries |
| a workflow trap, a tool fact, or a skill/AGENTS.md statement that is wrong | fix that skill / `AGENTS.md` directly |

Correcting is as important as adding: if an entry is wrong, fix it and say what the old
belief was in the body (`Previously believed: …`).

## 3. Entry format

Entries live in `knowledge/wram/<NAME>.md` and `knowledge/routines/<NAME>.md`, named by their
canonical identifier (`UPPER_SNAKE` for data/WRAM, `lower_snake` for code/scripts).
A region/struct gets one file at its start address; lookups for addresses inside it resolve through `end:`.
WRAM structs and types are cataloged in `src/games/evermore/localizations/data/types.json`.

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
see: [docs/scripts/room-scratch.md]
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
- **Trap — no front matter, no entry.** `knowledge.ts` silently skips any `.md` without `---`
  front matter, and `check:knowledge` still counts the file. Always write the real format, and
  check the "documented %" rises after adding entries. Bulk REA naming from a partial read
  (first lines of the dossier) is `confidence: guess` with tags `[unverified, rea-partial-read]`;
  only read the whole routine body before writing `likely`.
- **One commit:** the code change and the knowledge it produced land together.

## 5. Memory maps and validation

The overview tables (`data/wram-map.md`, `data/wram-map-7f.md`, `data/rom-map.md`) link directly to
these knowledge entries. To prevent drift, syntax errors, and missing definitions:
- **Validation tool:** `node tools/check-maps.mts` (`npm run check:memory-maps`) verifies:
  1. Continuity and zero gaps across all 131,072 bytes ($7E:0000..$7F:FFFF) of WRAM.
  2. Strict ascending order without address regressions or overlaps.
  3. Valid Markdown table formatting and unescaped pipe checking.
  4. Type syntax matching primitives (`u8`, `u16`, `ptr24`, arrays) or structs in `types.json`.
  5. Tag taxonomy matches approved tags without redundancy.
  6. All markdown links resolve to existing knowledge files.
  7. Exact 1:1 file parity between `src/.../data/` and `docs/disassembly/engine-core/`.
