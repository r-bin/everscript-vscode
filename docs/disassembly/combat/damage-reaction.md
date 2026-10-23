# Entity Damage Processing, HUD HP Sync & Recoil Reaction

## Overview
When an entity incurs physical, projectile, or alchemical damage, the engine converts `pending_damage` (`+$76`) into concrete health loss, records it into `last_damage_taken` (`+$AA`), updates the HUD display if the target possesses an active health bar (`+$8E`), and triggers a hit reaction animation.

If the entity takes fatal damage or a qualifying flinch hit, the recoil dispatcher inverts its facing direction, sets temporary invulnerability flags, and initiates the character-specific damage animation track via `$90:8124`.

---

## Memory Map & Data Structures

### Entity Structure Offsets (`$7E:XXXX`)
- `+0x10`: `status_flags` (Bit 6: in hit recoil / temporary invulnerability `0x0040`)
- `+0x12`: `anim_state` (Bits 8-9: movement transition mode)
- `+0x14`: `character_flags` (Bit 10: player flinch reaction asserted `0x0400`)
- `+0x16`: `combat_flags` (Bit 0: flinch eligibility)
- `+0x22`: `facing_direction` (Compass direction; XOR 8 inverts facing 180 degrees)
- `+0x2A`: `current_hp` (Remaining hit points)
- `+0x36`: `knockback_speed` (Step displacement during knockback)
- `+0x60`: `anim_table_ptr` (Pointer to character animation descriptor table in bank `$8E`)
- `+0x76`: `pending_damage` (Damage queued to be subtracted this tick)
- `+0x78`: `latch_timer` (Immobilization duration timer)
- `+0x8E`: `hud_bar_active` (Non-zero if entity is tracked on the active HP bar)
- `+0xAA`: `last_damage_taken` (Records recent hit damage)

### WRAM Globals
- `$7E:2261`: `barrier_buff_flags` (Bit 0: Companion Barrier, Bit 1: Boy Barrier)
- `$7E:0EB8`: `combat_flow_flags` (Bit 5: force stagger / boss recoil override)
- `$4E89`: Base address of Boy entity structure

---

## Decompiled C Code

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/90/908124_damage_reaction.c`](../../../reconstructed-c/90/908124_damage_reaction.c).
> [View in VFS: soe://rom/code/908124](soe://rom/code/908124?c=1&asm=0)

