---
addr: C438E6
end: C43B01
size: 540
kind: table
category: ⚔️
name: BOY_WEAPON_TABLE
title: Boy weapon table
confidence: confirmed
evidence: ["legacy: migrated from tables.js", "disasm v0.456.0: boy_load_weapon ($8F:81C9) copies +4..+$1C into the Boy's WRAM character record ($0A26) field by field; character_defense_and_buff_rebuild ($8F:8485) adds +0 to the attack; the weapons ring reads +$1E"]
---
15 × 36 bytes: the 12 weapons, then the Bazooka's three ammo (`$C4:3A96`). +0 attack, +2 the name (bank `$C4`, the ring item's text), +4 palette (record +$09), +6 range (record +$13), +8-+$14 stand, walk, run, attack 0-3 (record +$32-+$3E), +$16 dodge (+$48), +$18 knockback (+$40), +$1A / +$1C the idle animations (`$1460` / `$1462`: BOY_IDLE_ANIMATION, BOY_IDLE_ANIMATION_RARE), +$1E the ring item id, +$20-+$23 zero (no reader seen). Open Evermore: `equipment/weapons/`, `equipment/bazooka_ammo/`.
