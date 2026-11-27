---
addr: $7E:3564
end: $7E:3913
size: 944
kind: table
type: ProjAlchemySlot[8]
name: PROJ_ALCHEMY_SLOTS_BASE
title: Active Projectile Alchemy slots array
lifetime: room
confidence: confirmed
tags: [combat, alchemy, projectile]
evidence: ["src/games/evermore/emulator/webview/bottom-bar/02-update-alchemy-tab.js: reads 8 slots at $7E3564 with 118-byte ($0x76) stride", "rom: the slot loops in bank $91 bound the table by the immediates #$3564 and #$3914 (alloc_proj_alchemy_slot, alchemy_all_slots_clear, alchemy_all_slots_frame_tick), stride #$0076", "rom: field_cutscene_freeze_init_and_entities stores zero to +$14 of each of the 8 slots, unrolled ($8E:E152-$8E:E167)"]
see: [knowledge/wram/ANIM_ALCHEMY_SLOTS_BASE.md, knowledge/wram/SPRITE_ANIM_CHANNELS.md]
---
8-slot active state buffer for Projectile-based Alchemy spells (e.g. Fireball, Flash, Acid Rain, Crush, Explosion).

- **Slot count**: 8 slots
- **Stride**: 118 bytes (`0x76`)
- **Total buffer size**: 944 bytes (`$7E:3564`–`$7E:3913`)

### Struct Layout
| Offset | Type | Description |
|---|---|---|
| `+$12` | Word | Spell formula type / script block ID (e.g. `$8C86` Fireball, `$8756` Flash) |
| `+$26` | Byte | Active status flag (`0` = active / flying) |
| `+$28` | Word | Source caster entity address pointer |
| `+$2A` | Word | Power rating (base spell attack power) |
| `+$2E` | Word | Target entity address pointer |

### What fixes the count at 8 (2026-11-27)

The slot count is not a stored number. Five places in the code hold it:

- **Three loops in bank `$91`** walk the table from `#$3564` in steps of `#$0076` and stop at `#$3914` (the end, an
  immediate): `alloc_proj_alchemy_slot` (`cmp #$3914` / `bmi`; returns Y = 0 when no slot's `+$14` word is zero),
  `alchemy_all_slots_clear` (`cmp #$3914` / `bne`: an exact end, so a new end must be a multiple of the stride from
  the base), and the projectile half of `alchemy_all_slots_frame_tick` (`cpy #$3914` / `bmi`).
- **One unrolled clear**: `field_cutscene_freeze_init_and_entities` writes `stz` to `+$14` of each slot, eight
  instructions in a row (`$8E:E152`-`$8E:E167`), right after the eight for the animation slots.
- **Callers check Y = 0**: `script_op_9e_cast_all` (two allocations, `$8C:D0F1`, `$8C:D159`) and the formula cast loops
  (Barrier, Corrosion, Crush) branch away when the allocator returns 0. So a full table alone does not crash the game.
  The owner's crash with 9 projectile spells at once (8 from the player, 1 from a boss) therefore lies elsewhere. Not
  traced yet; one candidate is a child-particle path (`alchemy_effect_spawn_child_particle`) that reaches the slots
  without the allocator.

A 9th slot needs 118 bytes from `$3914`. Only 2 are free there (`PROJ_ALCHEMY_ALIGN_PAD`), then come
`TARGET_SELECTION_ACTOR_0`/`_1` (4 bytes), then `DAMAGE_POPUP_PRE_BUFFER` (292 bytes, no reader known). If the two
target words move, 298 bytes are free, enough for two more slots. To grow the table, implode must rewrite the three end
immediates, add a ninth `stz` (or replace the unrolled run with a loop), and move the two target words. This is step
W10 in `docs/todo/wram-allocation.md`.

