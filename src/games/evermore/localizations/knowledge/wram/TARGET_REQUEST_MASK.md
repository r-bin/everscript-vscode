---
addr: 7E05AD
size: 2
kind: flags
name: TARGET_REQUEST_MASK
title: Target request mask — who a spell, item or cursor may pick
lifetime: unknown
confidence: likely
tags: [entities, targeting, ui]
evidence: ["disasm: every bit below is tested by target_candidate_filter $8C:8658-$8C:8718", "disasm: the list builders $8C:8719-$8C:87EC set $0100 and, for two or more targets, $0001", "read: $8C:89DF and $8C:8A25 show 'Multiple' / refuse a multi-target when $0001 is set", "disasm: combat_target_selection_cursor_loop $8C:88CC builds the all-list first when $0200 is set and ignores the D-pad then; past the last or first valid entity it switches to the all-list only when $0002 is set (2026-11-25)", "disasm: $8C:879B with $2000 and four or more entries keeps the three nearest the Boy, |dx|²+|dy|² from $4EA3/$4EA5 via $4202 (2026-11-25)", "rom: formulas ($C4:5BF5) and consumables ($C4:5A84) store these words; Open Evermore names them by rule (targets/, v0.469.0)"]
see: [routines/target_candidate_filter.md, routines/target_list_builders.md]
---
The rules a caller sets before asking for targets: which kinds of entity count, whether they
must be on screen, alive or dead. The builders also write back whether the result is one
target or several.

## Bits
| bit | meaning |
|---|---|
| `$0001` | result: several targets (set by `$8C:879B`) |
| `$0002` | the cursor may step past the last (or first) valid entity to all of them |
| `$0004` | skip the on-screen test |
| `$0008` | accept entities whose `+$10` has bit `$0004` |
| `$0010` | accept ordinary entities (no friendly bit): enemies |
| `$0020` | accept friendly entities (`+$10` bit `$0002`) whose record `+$07` has bit 2 |
| `$0040` | accept entities whose `+$10` has bit `$1000` |
| `$0080` | dead entities (HP 0) may be picked too |
| `$0100` | set by every list builder; the name banner `$8C:89DF` runs while it is set |
| `$0200` | all valid entities from the start; the D-pad cannot leave it |
| `$0400` / `$0800` | accept the Dog / the Boy |
| `$1000` | only dead entities |
| `$2000` | the "all" list keeps only the three entities nearest the Boy when it has four or more |
| `$4000` | accept only entities whose record `+$07` has bit 3 |
