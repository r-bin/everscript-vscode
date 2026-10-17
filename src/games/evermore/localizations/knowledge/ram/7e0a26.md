---
addr: 7E0A26
end: 7E0A6F
kind: struct
name: BOY_STATS
title: Boy's stats block (level, XP, attack, defense, charge)
lifetime: save
confidence: likely
tags: [boy, stats, party]
evidence: ["evs: the everscript compiler's ATTRIBUTE_GENERAL enum (POINTER_BOY) gives the block and the offsets below (soe://tags/boy.stats)", "read: the Memory Radar and the Scaling tab read level and stats here"]
see: [ram/7e4e89.md]
---
The boy's persistent stats: what levels up and what the save keeps. The entity record in the
$4E89 area holds the live copies the fight uses (HP, boosts).

## Fields
| offset | size | name | meaning |
|---|---|---|---|
| +$00 | 2 | NAME_POINTER | Points at the name |
| +$0F | 2 | MAX_HP | Maximum HP |
| +$19 | 2 | ATTACK | Attack |
| +$1B | 2 | DEFENSE | Defense |
| +$1D | 2 | MAGIC_DEFENSE | Magic defense |
| +$1F | 2 | EVASION | Evade |
| +$21 | 2 | HIT | Hit |
| +$23 | 4 | XP | Experience (32-bit) |
| +$2A | 2 | LEVEL | Level |
| +$2C | 2 | CHARGE_MAX | Attack charge maximum |
| +$2F | 1 | CHARGE_RATE | Attack charge rate |
