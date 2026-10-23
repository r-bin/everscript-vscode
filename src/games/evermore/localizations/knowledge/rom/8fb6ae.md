---
addr: 8FB6AE
kind: data
category: 🧠
name: g_attack_proc_table
title: Contact handler table (character record +$30, projectiles)
confidence: confirmed
tags: [combat, damage, projectiles, weapons]
size: 30
evidence: ["disasm: vector table indexed by action ID X in JSR ($B6AE,x); 0=$B6CC, 2=$B6E0, 4=$B724, 6=$B73C, 8=$B75A, 10=$B77D, 12=$B7A0, 14=$B7D7", "read: 15 words point into $8F:B6CC-$8F:B8E3 (ids 0-$1C); the 16th word ($0622) is not code. The 142 character records use ids 0, 8, $0A, $0C, $0E, $12, $14, $16, $18, $1C at +$30 (v0.328.0)", "docs/disassembly/combat/attack-procs.md", "docs/disassembly/combat/strike-hittest.md"]
see: [docs/disassembly/combat/attack-procs.md, docs/disassembly/combat/strike-hittest.md, docs/disassembly/combat/contact-damage.md]
---
Vector table of 16-bit function pointers indexed by attack action ID (even index 0..$1C, 15 entries): a character record's +$30 picks one, and projectiles use the same ids.
Called via `JSR ($B6AE,x)` by both `strike_hit_test_entity_loop` (`$8F:B6A5`) and contact damage collision (`$8F:B57B`).

## Entries
Each melee handler runs the to-hit roll `$8F:BA06`, then damage `$8F:C067`, apply `$8F:C0D3`
(knockback, shield halving, 999 cap) and the retaliation link `$8F:C17F`. Decoded v0.340.1.
- `0` (`$8F:B6CC`): plain melee hit.
- `2` (`$8F:B6E0`): projectile: `$8F:B9F8` (target `+$07` bit 4 is immune), damage from the projectile's power `$0E9C`, the projectile is removed; a kill by the Boy or Dog gives skill (`$8F:973E` / `$8F:97C0`).
- `4` (`$8F:B724`): piercing projectile: the same, but the projectile stays.
- `6` (`$8F:B73C`): projectile that ignores defence (enters the damage routine at `$8F:C07E`).
- `8` (`$8F:B75A`): melee; a kill raises the Boy's weapon skill (`$8F:973E`: +4, +2 from level 2, up to level 3).
- `$0A` (`$8F:B77D`): melee; a kill raises the Dog's attack skill (`$8F:97C0`: +2, up to level 3; a new level sets its charge limit).
- `$0C` (`$8F:B7A0`): melee, then the attacker plays the animation at `$4982` with state `$12` unless the target's `+$16` bit 0 is set (the flowers' swallow).
- `$0E` (`$8F:B7D7`): nothing while `$2261` bit 7 is set (insect incense); otherwise melee through `$8F:C143` (no knockback, no halving, no cap).
- `$10` (`$8F:B7DF`): `$0E` without the incense test.
- `$12` (`$8F:B7FB`): melee, then 1 in 4 adds status `$90` (poison) with a message.
- `$14` (`$8F:B7F3`): `$12` behind the incense test.
- `$16` (`$8F:B85E`): melee, then 1 in 8 adds status `$88` (plague) at power 5.
- `$18` (`$8F:B82D`): melee, then always status `$90`.
- `$1A` (`$8F:B8E3`): no to-hit roll: damage from `$0E9C` and apply.
- `$1C` (`$8F:B898`): melee, then 1 in 4: plague (power 5) or status `$60` (confound), even odds.

Projectile ids (2, 4, 6, `$10`, `$1A`) never appear in a vanilla record; projectiles put them
in `$0E9A` themselves.

## Notes
- Previously believed: 8 entries (0..14). The table has 15.
- Previously believed: `$0A` special attack, `$0C` special contact, `$0E` area-of-effect blast.
