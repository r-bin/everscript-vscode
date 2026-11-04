---
addr: $7E:3364
end: $7E:3563
size: 512
kind: table
type: AnimAlchemySlot[8]
name: ANIM_ALCHEMY_SLOTS_BASE
title: Active Animation Alchemy slots array
lifetime: room
confidence: confirmed
tags: [combat, alchemy, animation]
evidence: ["src/games/evermore/emulator/webview/bottom-bar/02-update-alchemy-tab.js: reads 8 slots at $7E3364 with 64-byte ($0x40) stride"]
see: [knowledge/wram/PROJ_ALCHEMY_SLOTS_BASE.md, knowledge/wram/SPRITE_ANIM_CHANNELS.md]
---
8-slot active state buffer for Animation-based Alchemy spells (e.g. Atlas, Barrier, Heal, Speed, Defend).

- **Slot count**: 8 slots
- **Stride**: 64 bytes (`0x40`)
- **Total buffer size**: 512 bytes (`$7E:3364`–`$7E:3563`)

### Struct Layout
| Offset | Type | Description |
|---|---|---|
| `+$0E` | Word | Active effect duration countdown timer |
| `+$12` | Word | Spell formula type / script block ID (e.g. `$8B2A` Atlas, `$886C` Heal) |
| `+$26` | Byte | Active status flag (`0` = active / in progress) |
| `+$28` | Word | Source caster entity address pointer |
| `+$2A` | Word | Power rating (heal amount, buff magnitude, or formula base power) |

