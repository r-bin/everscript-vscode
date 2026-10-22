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
- `0` (`$8F:B6CC`): Default melee strike hit resolution (returns Carry Set to sweep arc)
- `2` (`$8F:B6E0`): Consumable projectile hit resolution (deletes projectile, checks lethal kill XP, returns Carry Clear)
- `4` (`$8F:B724`): Piercing projectile hit resolution (returns Carry Set to pierce)
- `6` (`$8F:B73C`): Spell burst projectile hit resolution (uses `$8FC07E`, returns Carry Clear)
- `8` (`$8F:B75A`): Melee strike with direct Boy kill XP awarding
- `10` (`$8F:B77D`): Special attack resolution
- `12` (`$8F:B7A0`): Special contact resolution
- `14` (`$8F:B7D7`): Area-of-effect blast resolution
- `16`–`28` (`$8F:B7DF`, `$B7FB`, `$B7F3`, `$B85E`, `$B82D`, `$B8E3`, `$B898`): not decoded yet; records with poison, plague or confound strikes use `$12`–`$1C`

## Notes
- Previously believed: 8 entries (0..14). The table has 15.
