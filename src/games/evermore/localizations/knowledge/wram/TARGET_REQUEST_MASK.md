---
addr: 7E05AD
size: 2
kind: flags
name: TARGET_REQUEST_MASK
title: Target request mask — who a spell, item or cursor may pick
lifetime: unknown
confidence: likely
tags: [entities, targeting, ui]
evidence: ["disasm: every bit below is tested by target_candidate_filter $8C:8658-$8C:8718", "disasm: the list builders $8C:8719-$8C:87EC set $0100 and, for two or more targets, $0001; $8C:879B returns $2000 in the carry", "read: $8C:89DF and $8C:8A25 show 'Multiple' / refuse a multi-target when $0001 is set"]
see: [rom/8c8658.md, rom/8c8719.md]
---
The rules a caller sets before asking for targets: which kinds of entity count, whether they
must be on screen, alive or dead. The builders also write back whether the result is one
target or several.

## Bits
| bit | meaning |
|---|---|
| `$0001` | result: several targets (set by `$8C:879B`) |
| `$0004` | skip the on-screen test |
| `$0008` | accept entities whose `+$10` has bit `$0004` |
| `$0010` | accept ordinary entities (no friendly bit): enemies |
| `$0020` | accept friendly entities (`+$10` bit `$0002`) whose record `+$07` has bit 2 |
| `$0040` | accept entities whose `+$10` has bit `$1000` |
| `$0080` | dead entities (HP 0) may be picked too |
| `$0100` | set by every list builder; the name banner `$8C:89DF` runs while it is set |
| `$0400` / `$0800` | accept the Dog / the Boy |
| `$1000` | only dead entities |
| `$2000` | returned in the carry by the "all" builder |
| `$4000` | accept only entities whose record `+$07` has bit 3 |
