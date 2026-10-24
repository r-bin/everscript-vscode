# Metatile Collision Evaluator & Elevation Plane Mechanics

- **ROM Locations**:
  - `eval_tile_collision`: `$90:9DE8` – `$90:9E72`
  - `update_entity_plane`: `$8F:A914` – `$8F:A922`
  - `collision_null_table`: `$90:9E73` – `$90:9E92` (32 bytes of `0x00`)
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E` / `$7F`
- **WRAM Core Addresses**:
  - DP `$44`: Current entity elevation plane (bits 5..4: `$00`, `$10`, `$20`, `$30`).
  - DP `$4C`: Current active entity slot pointer (`$4E89` = Boy, `$4F37` = Dog).
  - DP `$50`: 16-bit raw collision word from map metatile at `$7F:0004,x`.

---

## 1. Architectural Architecture & The 16-Bit Collision Word

Secret of Evermore room terrain is composed of $16 \times 16$ metatiles. In WRAM, each metatile record occupies 8 bytes:
- `+0x00`: Layer 1 (canopy) tilemap word
- `+0x02`: Layer 2 (terrain) tilemap word
- `+0x04`: **16-bit Collision Word** (`LDA $7F0004,x`)

### Anatomy of the Collision Word
```
 15  14  13  12  11  10   9   8   7   6   5   4   3   2   1   0
┌───┬───┬───┬───┬───────────────┬───┬───┬───────┬───────────────┐
│ I │ S │AW │ P │  Entity Gate  │ 0 │PT │ Plane │ Geometry/Drift│
└───┴───┴───┴───┴───────────────┴───┴───┴───────┴───────────────┘
```

- **Bits 3..0 (`geometry` / `drift`)**: Sub-tile passability slopes (`0x0` open, `0xF` solid, `0x1`..`0xE` 45° slopes/barriers). If bit 13 is set, becomes conveyor/drift vector.
- **Bits 5..4 (`plane`)**: Elevation plane `0`..`3`.
- **Bit 6 (`PT`, Plane-Transparent)**: Walkable from any *other* plane. On the same plane, tile's own geometry applies.
- **Bits 11..8 (`Entity Gate`)**: Filter gates active when bit 8 is set.
- **Bit 12 (`P`, Priority)**: Character drawn in front of canopy (OAM priority 3) vs behind (OAM priority 2).
- **Bit 13 (`AW`, Always-Walkable)**: Geometry forced to `0` (open), bits 3..0 become conveyor drift.
- **Bit 14 (`S`, Step-on Trigger)**: Cell triggers step-on script scan.
- **Bit 15 (`I`, Interact Gate)**: B-button evaluates B-triggers (`0x8000`) instead of swinging weapon.

---

## 2. Disassembly & Annotations

### Part 1: Tile Collision Evaluator (`$90:9DE8`)
> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/909DE8](soe://rom/code/909DE8?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source: [`reconstructed-c/90/909DE8_eval_tile_collision.c`](../../../reconstructed-c/90/909DE8_eval_tile_collision.c) and
> [`reconstructed-c/8F/8FA914_update_entity_plane.c`](../../../reconstructed-c/8F/8FA914_update_entity_plane.c),
> both exact to the ROM (gate G1, `tools/c-to-rom/g1.mts`).
> [View in VFS: soe://rom/code/909DE8](soe://rom/code/909DE8?c=1&asm=0)

