---
addr: 7E2391
end: 7E2396
kind: struct
name: LOOT_MAILBOX
title: Loot mailbox — what the next pickup gives
lifetime: room
confidence: confirmed
tags: [loot]
evidence: ["test: every pickup stages these before calling global 0x39/0x3a/0x3b; simulation reads the item at the call (tests/simulation/loot.test.js, v0.202.0)", "script: the default loot script $92:A4E1 copies a prize item ($23A1/$23A3/$23A5) into $2391 (v0.369.0)"]
see: [ram/7e2461.md, rom/92a482.md, docs/scripts/loot.md]
---
| offset | size | meaning |
|---|---|---|
| `$2391` | 2 | `LOOT_ITEM`: reward id (`0x02xx` ingredient, `0x04xx` armor, `0x08xx` consumable, `1` money) |
| `$2393` | 2 | currency amount, for money |
| `$2395` | 2 | `LOOT_OBJECT`: the room object the pickup belongs to (its state is set to `0x63` while looting) |

An enemy's drops are staged in the same id space: the default loot script (trigger id `$172B`,
`$92:A4E1`, attached to a room hook with `attach_script(1, $0040, $172B)`) draws
`random_below($239B + $239D + $239F)`, then copies `$23A1` / `$23A3` / `$23A5` (the three prize
items, weighted by those rates) into `$2391` and `$23A7` / `$23A9` / `$23AB` into `$2393`. So the
prize item cells hold reward ids too (`$0801` = Nectar).
