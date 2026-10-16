---
addr: 7E2284
size: 1
kind: flags
name: OMNITOPIA_CHESTS_A
title: Omnitopia chests opened (storage room, greenhouse)
lifetime: save
confidence: confirmed
tags: [loot, flag]
evidence: ["script: each bit is tested at the top of its B-button script and set at its end; the storage room enter script $9B:8CE6 hides objects 0/1/2/5 by bits 2/3/4/7 (simulation report, v0.207.0)"]
see: [ram/7e2345.md, docs/cheats.md]
---
| bit | chest |
|---|---|
| `0x02` | Greenhouse (room `0x44`) — 30 Cryo-Blast, `$9B:889A` |
| `0x04` | Storage room (`0x47`) — 4 Dry Ice |
| `0x08` | Storage room — 2 Acorns |
| `0x10` | Storage room — Honey |
| `0x20` | Storage room — 30 Thunder Ball, `$9B:8EAB` |
| `0x40` | Storage room — Protector Ring, `$9B:8EE8` |
| `0x80` | Storage room — 30 Particle Bomb, `$9B:8F1F` (skipped only while `$22E6` bit 7 is set too) |

The four scripted chests (`0x02`, `0x20`, `0x40`, `0x80`) give first and set their bit 134
ticks later, after the jingle. Leaving the room in between keeps the reward and leaves the
bit clear ([docs/cheats.md](../../../../../../docs/cheats.md#leaving-a-room-cuts-every-running-script)).
