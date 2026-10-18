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
```assembly
; ==============================================================================
; eval_tile_collision ($90:9DE8)
; Input:
;   DP $50 = Metatile 16-bit collision word
;   DP $44 = Entity current elevation plane (bits 5..4)
;   DP $4C = Entity pointer ($4E89 = Boy, $4F37 = Dog)
; Output:
;   A = 4-bit geometry code ($00 = fully open .. $0F = fully solid)
; ==============================================================================
$909DE8  A5 50       LDA $50           ; Load collision word
$909DEA  89 00 01    BIT #$0100        ; Is Entity Gate active (bit 8)?
$909DED  F0 33       BEQ $909E22       ; No gate -> branch to plane check

; Entity Gate Filtering:
$909DEF  49 00 03    EOR #$0300        ; Gate 3: solid for all except boy & dog
$909DF2  89 00 0F    BIT #$0F00
$909DF5  F0 22       BEQ $909E19
$909DF7  49 00 06    EOR #$0600        ; Gate 5: solid for dog
$909DFA  89 00 0F    BIT #$0F00
$909DFD  F0 11       BEQ $909E10
$909DFF  49 00 02    EOR #$0200        ; Gate 7: solid for boy & dog (NPCs pass)
$909E02  89 00 0F    BIT #$0F00
$909E05  D0 1B       BNE $909E22       ; Gate 1 / 9: pass-through to plane check

$909E07  A5 4C       LDA $4C           ; Test entity pointer
$909E09  C9 89 4E    CMP #$4E89        ; Is entity the boy or dog?
$909E0C  B0 56       BCS $909E64       ; If boy or dog -> block! (solid 0x0F)
$909E0E  80 10       BRA $909E20

$909E10  A5 4C       LDA $4C
$909E12  C9 37 4F    CMP #$4F37        ; Is entity the dog ($4F37)?
$909E15  F0 4D       BEQ $909E64       ; Dog blocked!
$909E17  80 07       BRA $909E20

$909E19  A5 4C       LDA $4C
$909E1B  C9 89 4E    CMP #$4E89        ; Is entity boy or dog?
$909E1E  90 44       BCC $909E64       ; If NPC or enemy -> block!

$909E20  A5 50       LDA $50           ; Reload collision word

; Elevation Plane Testing:
$909E22  89 40 00    BIT #$0040        ; Is tile Plane-Transparent (bit 6)?
$909E25  D0 1D       BNE $909E44       ; Yes -> branch to transparent logic

$909E27  38          SEC
$909E28  E5 44       SBC $44           ; Compare tile's plane against entity's plane
$909E2A  29 30 00    AND #$0030
$909E2D  D0 24       BNE $909E53       ; Plane mismatch -> block!

; Normal Plane Match:
$909E2F  A5 50       LDA $50
$909E31  89 00 20    BIT #$2000        ; Is tile Always-Walkable (bit 13)?
$909E34  D0 04       BNE $909E3A
$909E36  29 0F 00    AND #$000F        ; Return tile's normal sub-tile geometry
$909E39  6B          RTL

$909E3A  29 0F 00    AND #$000F        ; Always-walkable: lookup in null table
$909E3D  0A          ASL A
$909E3E  AA          TAX
$909E3F  BF 73 9E 90 LDA $909E73,X     ; Reads 0x0000 (forces fully open)
$909E43  6B          RTL

; Plane-Transparent Logic (Bit 6 = 1):
$909E44  45 44       EOR $44
$909E46  29 30 00    AND #$0030
$909E49  D0 06       BNE $909E51       ; Different plane -> A = 0 (walk straight through!)
$909E4B  A5 50       LDA $50
$909E4D  29 0F 00    AND #$000F        ; Same plane -> apply tile's own geometry
$909E50  6B          RTL
$909E51  7B          TDC               ; A = 0 (fully open)
$909E52  6B          RTL

; Plane Mismatch Handling:
$909E53  89 20 00    BIT #$0020
$909E56  F0 10       BEQ $909E68
$909E58  89 10 00    BIT #$0010
$909E5B  F0 07       BEQ $909E64
$909E5D  A5 44       LDA $44
$909E5F  89 40 00    BIT #$0040
$909E62  D0 CB       BNE $909E2F
$909E64  A9 0F 00    LDA #$000F        ; Fully solid (0x0F)
$909E67  6B          RTL

$909E68  A5 50       LDA $50
$909E6A  89 00 20    BIT #$2000        ; Check Always-Walkable
$909E6D  D0 CB       BNE $909E3A
$909E6F  A9 0F 00    LDA #$000F        ; Fully solid
$909E72  6B          RTL
```

---

## 3. Reconstructed Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define COLLISION_GEOMETRY_MASK  0x000F
#define COLLISION_PLANE_MASK     0x0030
#define COLLISION_FLAG_PT        0x0040 // Bit 6: Plane-Transparent
#define COLLISION_ENTITY_GATE    0x0F00 // Bits 11..8: Entity Gate Nibble
#define COLLISION_GATE_ACTIVE    0x0100 // Bit 8: Gate Active Flag
#define COLLISION_FLAG_AW        0x2000 // Bit 13: Always-Walkable
#define COLLISION_FLAG_STEPON    0x4000 // Bit 14: Step-on Trigger
#define COLLISION_FLAG_INTERACT  0x8000 // Bit 15: B-Trigger Interactive Gate

#define ACTOR_BOY_SLOT           0x4E89
#define ACTOR_DOG_SLOT           0x4F37

#define GEOMETRY_OPEN            0x00
#define GEOMETRY_SOLID           0x0F

/**
 * Evaluates whether an entity can traverse a metatile and returns its geometry.
 * Corresponds to $90:9DE8.
 */
uint8_t eval_tile_collision(uint16_t collision_word, uint8_t entity_plane, uint16_t entity_ptr) {
    // 1. Entity Gate Check (Bits 11..8)
    if ((collision_word & COLLISION_GATE_ACTIVE) != 0) {
        uint8_t gate = (uint8_t)((collision_word >> 8) & 0x0F);
        bool is_boy_or_dog = (entity_ptr == ACTOR_BOY_SLOT || entity_ptr == ACTOR_DOG_SLOT);

        if (gate == 3) {
            // Gate 3: Solid for everything EXCEPT Boy and Dog
            if (!is_boy_or_dog) return GEOMETRY_SOLID;
        } else if (gate == 5) {
            // Gate 5: Solid specifically for the Dog
            if (entity_ptr == ACTOR_DOG_SLOT) return GEOMETRY_SOLID;
        } else if (gate == 7) {
            // Gate 7: Solid for Boy and Dog (Enemies & NPCs pass)
            if (is_boy_or_dog) return GEOMETRY_SOLID;
        }
        // Gates 1 and 9 pass through to plane logic
    }

    uint8_t tile_plane = (uint8_t)(collision_word & COLLISION_PLANE_MASK);
    bool is_transparent = (collision_word & COLLISION_FLAG_PT) != 0;

    // 2. Plane-Transparent Check (Bit 6)
    if (is_transparent) {
        if (tile_plane == entity_plane) {
            return (uint8_t)(collision_word & COLLISION_GEOMETRY_MASK);
        } else {
            return GEOMETRY_OPEN; // Walk straight through from other planes!
        }
    }

    // 3. Elevation Plane Match
    if (tile_plane != entity_plane) {
        // Plane mismatch: solid unless overridden
        return GEOMETRY_SOLID;
    }

    // 4. Always-Walkable Override (Bit 13)
    if ((collision_word & COLLISION_FLAG_AW) != 0) {
        // Sewer pipes, volcano slides, and quicksand: forced open
        return GEOMETRY_OPEN;
    }

    // 5. Normal Sub-Tile Geometry (Bits 3..0)
    return (uint8_t)(collision_word & COLLISION_GEOMETRY_MASK);
}

/**
 * Updates entity elevation plane when stepping onto ordinary tiles.
 * Corresponds to $8F:A914.
 */
void update_entity_plane(uint16_t collision_word, uint8_t *entity_plane) {
    // Standing on Always-Walkable (bit 13) or Plane-Transparent (bit 6) preserves plane
    if ((collision_word & (COLLISION_FLAG_AW | COLLISION_FLAG_PT)) == 0) {
        *entity_plane = (uint8_t)(collision_word & COLLISION_PLANE_MASK);
    }
}
```
