---
addr: 7E0ADD
size: 44
kind: array
name: WEAPON_LEVELS
title: Weapon skill per weapon, Boy fist .. bazooka ($0ADD-$0AF7) and Dog ($0B07): level × $100 + progress
lifetime: save
confidence: confirmed
tags: [party, boy, dog, weapons]
evidence: ["state: the save states of a 3 h 13 min US playthrough (2026-10-30, replay-checked from power-on) hold $0100 in every weapon not used yet and grow in the ones in use, e.g. Horn Spear $0AEF $0158 -> $01C4, Dog $0B07 $0112 -> $012A; $0AF9-$0B05 stay 0 (v0.385.0)", "script: Everscript core.evs unlock(ITEM.WEAPON_LEVEL_2 / _3) writes $0200 / $0300 to fist..bazooka, DOG_LEVEL_2 / _3 to $0B07"]
see: [docs/disassembly/engine-core/wram-map.md, docs/disassembly/ui/weapon-level-tables.md]
---
One word per weapon, in the order fist ($0ADD), the four swords ($0ADF..$0AE5), the four axes ($0AE7..$0AED),
the four spears ($0AEF..$0AF5), bazooka ($0AF7); `$0AF9`..`$0B05` are not levels; the Dog's is `$0B07`.
The high byte is the level (charge levels the weapon allows), the low byte the progress toward the next.
The emulator's CHEATS tab "Weapon Levels" raises every word below `$0300` to `$0300`.
