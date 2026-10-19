# Entity Mover Step Direction Dispatch, Stair Shear, and Wall Slide Physics ($8F:ADAA – $8F:AF48)

## 1. Subsystem Architecture Overview

The Secret of Evermore physics engine handles dynamic terrain interactions—including conveyers, ramps, stairs, and diagonal wall sliding—via a unified direction dispatch and collision resolution pipeline in Bank `$8F`:

1. **Terrain Modifier Vector Dispatch (`$8F:ADAA` – `$8F:AE46`)**:
   - Inspects the entity's current tile collision attributes from `$003C,Y`.
   - Checks bit 13 (`0x2000`): Ramp / Stairway / Conveyor modifier active.
   - If bit 13 is set:
     - Extracts the low 4 bits (`AND #$000F`), scales by 2 (`ASL A`), and dispatches through the 16-entry jump table `ptrs_CFAF30` (`$8F:AF30`).
     - Applies directional conveyor thrust or 45-degree stairway elevation displacement.
   - If bit 13 is clear:
     - Falls directly through to normal linear vector evaluation at `loc_CFAE46`.

2. **Diagonal Stair Shear & Orthogonal Wall Sliding (`$8F:AE46` – `$8F:AF0E`)**:
   - Takes proposed displacement vector $(dx, dy)$ from `DP $1A` and `DP $1C`.
   - Probes proposed target coordinates:
     - $X_{new} = X_{current} + dx$ (`DP $46`)
     - $Y_{new} = Y_{current} + dy$ (`DP $48`)
   - Calls composite metatile and body collision probe `collision_probe_and_plane_update` (`$8F:AF48`).
   - If direct diagonal path is blocked (Carry Clear from probe):
     - Checks whether diagonal movement can shear along an unblocked single axis:
       - Attempts horizontal shear: moves $X$ by $dx$ while holding $Y$ constant, probing target $(X + dx, Y)$.
       - Attempts vertical shear: moves $Y$ by $dy$ while holding $X$ constant, probing target $(X, Y + dy)$.
     - If both axes are impassable:
       - Asserts obstacle collision flag `entity->flags_12 |= 0x0002` (`loc_CFAEDE`).
     - If an axis is free:
       - Slides smoothly along the unblocked surface and commits coordinates.

3. **Movement Success Latch & State Commit (`$8F:AF0E`)**:
   - If movement succeeded along the direct or sheared vector:
     - Asserts step success flag `entity->flags_12 |= 0x0001`.
     - Preserves updated plane elevation in `DP $44` into `entity->elevation_plane` (`$0018,Y`).
     - Returns to entity movement coordinator.

4. **Composite Collision Probe (`$8F:AF48` – `$8F:AFAB`)**:
   - Evaluates entity movement mode bits in `entity->movement_mode_10` (`$0010,Y`):
     - Bit 11 (`0x0800`): Flying / ethereal mode; bypasses map collision and calls elevation update `$8F:A906`.
     - Bit 10 (`0x0400`) / Bit 7 (`0x0080`): Ignore terrain boundaries.
   - In ground mode:
     - Looks up tile collision word at $(X, Y)$ via `$90:9815`.
     - Validates elevation plane transition via `$8F:A946`.
     - Evaluates active room viewport bounding box via `$90:9561`.
     - Evaluates solid entity-to-entity hitbox overlap via `$8F:B4AB`.
   - Returns Carry Set (`SEC`) if clear, Carry Clear (`CLC`) if blocked.

---

## 2. 65816 Disassembly Analysis

```assembly
; ==============================================================================
; entity_mover_step_direction_dispatch ($8F:ADAA - $8F:AE46)
; ==============================================================================
$8F:ADAA  B9 3C 00     LDA $003C,Y         ; Collision tile attributes ($003C,Y)
$8F:ADAD  89 00 20     BIT #$2000          ; Bit 13: Conveyor / Stair ramp active?
$8F:ADB0  D0 03        BNE $8FADB5
$8F:ADB2  4C 46 AE     JMP $8FAE46         ; Normal linear movement

$8F:ADB5  29 0F 00     AND #$000F          ; 16 directional impulse presets
$8F:ADB8  0A           ASL A
$8F:ADB9  AA           TAX
$8F:ADBA  7C 30 AF     JMP ($AF30,X)       ; Jump indirect through conveyor table

; Conveyor / Stair Impulse Jump Table ($8F:AF30):
; Entries dispatch to directional shears or converge at $8F:AE46

; ==============================================================================
; collision_stair_shear_and_wall_slide ($8F:AE46 - $8F:AF0E)
; ==============================================================================
$8F:AE46  A5 1A        LDA $1A             ; Check dx
$8F:AE48  05 1C        ORA $1C             ; Check dy
$8F:AE4A  D0 07        BNE $8FAE53         ; Moving?
$8F:AE4C  A5 02        LDA $02
$8F:AE4E  F0 03        BEQ $8FAE53
$8F:AE50  4C 0E AF     JMP $8FAF0E         ; Stationary commit

$8F:AE53  B9 1A 00     LDA $001A,Y         ; Entity X coordinate
$8F:AE56  18           CLC
$8F:AE57  65 1A        ADC $1A             ; Proposed X = entity->x + dx
$8F:AE59  85 46        STA $46             ; DP $46 = target X
$8F:AE5B  B9 1C 00     LDA $001C,Y         ; Entity Y coordinate
$8F:AE5E  18           CLC
$8F:AE5F  65 1C        ADC $1C             ; Proposed Y = entity->y + dy
$8F:AE61  85 48        STA $48             ; DP $48 = target Y

; Probe direct diagonal target (target_x, target_y):
$8F:AE63  22 48 AF 8F  JSL $8FAF48         ; Composite collision probe
$8F:AE67  B0 7E        BCS $8FAEE7         ; If path blocked, try shear!

; Check entity state flags before shearing:
$8F:AE69  B9 16 00     LDA $0016,Y
$8F:AE6C  89 01 00     BIT #$0001
$8F:AE6F  F0 03        BEQ $8FAE74
$8F:AE71  4C 0E AF     JMP $8FAF0E         ; Skip shear if override active

$8F:AE74  B9 12 00     LDA $0012,Y
$8F:AE77  89 04 00     BIT #$0004
$8F:AE7A  F0 03        BEQ $8FAE7F
$8F:AE7C  4C 0E AF     JMP $8FAF0E

; Shear Resolution Phase:
$8F:AE7F  A5 1A        LDA $1A             ; Is dx == 0?
$8F:AE81  D0 1D        BNE $8FAEA0

; Pure vertical motion blocked: probe horizontal slide
$8F:AE83  B9 1A 00     LDA $001A,Y
$8F:AE86  65 1C        ADC $1C             ; Target X = entity->x + dy
$8F:AE88  85 46        STA $46
$8F:AE8A  22 48 AF 8F  JSL $8FAF48         ; Probe (entity->x + dy, target_y)
$8F:AE8E  B0 4E        BCS $8FAEDE         ; Blocked!
$8F:AE90  B9 1A 00     LDA $001A,Y
$8F:AE93  38           SEC
$8F:AE94  E5 1C        SBC $1C             ; Target X = entity->x - dy
$8F:AE96  85 46        STA $46
$8F:AE98  22 48 AF 8F  JSL $8FAF48         ; Probe (entity->x - dy, target_y)
$8F:AE9C  B0 40        BCS $8FAEDE
$8F:AE9E  80 4A        BRA $8FAEEA         ; Shear succeeded!

; Pure horizontal or diagonal motion blocked:
$8F:AEA0  A5 1C        LDA $1C             ; Is dy == 0?
$8F:AEA2  D0 1D        BNE $8FAEC1

; Pure horizontal motion blocked: probe vertical slide
$8F:AEA4  B9 1C 00     LDA $001C,Y
$8F:AEA7  38           SEC
$8F:AEA8  E5 1A        SBC $1A             ; Target Y = entity->y - dx
$8F:AEAA  85 48        STA $48
$8F:AEAC  22 48 AF 8F  JSL $8FAF48         ; Probe (target_x, entity->y - dx)
$8F:AEB0  B0 2C        BCS $8FAEDE
$8F:AEB2  B9 1C 00     LDA $001C,Y
$8F:AEB5  18           CLC
$8F:AEB6  65 1A        ADC $1A             ; Target Y = entity->y + dx
$8F:AEB8  85 48        STA $48
$8F:AEBA  22 48 AF 8F  JSL $8FAF48         ; Probe (target_x, entity->y + dx)
$8F:AEBE  B0 1E        BCS $8FAEDE
$8F:AEC0  80 28        BRA $8FAEEA

; Diagonal motion blocked: probe single-axis wall slide
$8F:AEC1  B9 1C 00     LDA $001C,Y         ; Hold Y constant
$8F:AEC4  85 48        STA $48
$8F:AEC6  22 48 AF 8F  JSL $8FAF48         ; Probe horizontal only (target_x, entity->y)
$8F:AECA  B0 12        BCS $8FAEDE
$8F:AECC  B9 1A 00     LDA $001A,Y         ; Hold X constant
$8F:AECF  85 46        STA $46
$8F:AED1  B9 1C 00     LDA $001C,Y
$8F:AED4  65 1C        ADC $1C             ; Target Y = entity->y + dy
$8F:AED6  85 48        STA $48
$8F:AED8  22 48 AF 8F  JSL $8FAF48         ; Probe vertical only (entity->x, target_y)
$8F:AEDC  90 0C        BCC $8FAEEA

; Completely Blocked:
$8F:AEDE  B9 12 00     LDA $0012,Y
$8F:AEE1  09 02 00     ORA #$0002          ; Assert Wall Obstacle Collided flag
$8F:AEE4  99 12 00     STA $0012,Y
$8F:AEE7  4C E4 C2     JMP $8FC2E4         ; Trigger collision recoil handler

; Shear Succeeded: update position
$8F:AEEA  A5 1A        LDA $1A
$8F:AEEC  EB           XBA
$8F:AEED  05 1A        ORA $1A
$8F:AEEF  3A           DEC A
$8F:AEF0  30 01        BMI $8FAEF3
$8F:AEF2  7B           TDC
$8F:AEF3  38           SEC
$8F:AEF4  79 1A 00     ADC $001A,Y
$8F:AEF7  85 46        STA $46
$8F:AEF9  A5 1C        LDA $1C
$8F:AEFB  EB           XBA
$8F:AEFC  05 1C        ORA $1C
$8F:AEFE  3A           DEC A
$8F:AEFF  30 01        BMI $8FAF02
$8F:AF01  7B           TDC
$8F:AF02  38           SEC
$8F:AF03  79 1C 00     ADC $001C,Y
$8F:AF06  85 48        STA $48
$8F:AF08  22 48 AF 8F  JSL $8FAF48
$8F:AF0C  B0 D0        BCS $8FAEDE

; Step Success Commit:
$8F:AF0E  B9 12 00     LDA $0012,Y
$8F:AF11  09 01 00     ORA #$0001          ; Assert Step Success flag
$8F:AF14  99 12 00     STA $0012,Y
$8F:AF17  6B           RTL

; ==============================================================================
; collision_probe_and_plane_update ($8F:AF48 - $8F:AFAB)
; ==============================================================================
$8F:AF48  B9 18 00     LDA $0018,Y         ; Elevation plane ($0018,Y)
$8F:AF4B  85 44        STA $44             ; DP $44
$8F:AF4D  B9 10 00     LDA $0010,Y         ; Movement mode flags ($0010,Y)
$8F:AF50  89 00 08     BIT #$0800          ; Bit 11: Flying / Ethereal?
$8F:AF53  D0 12        BNE $8FAF67
$8F:AF55  89 80 04     BIT #$0480          ; Bit 10 or 7: Ignore terrain?
$8F:AF58  F0 34        BEQ $8FAF8E

; Flying bypass:
$8F:AF67  A6 46        LDX $46             ; Target X
$8F:AF69  A4 48        LDY $48             ; Target Y
$8F:AF6B  22 15 98 90  JSL $909815         ; Map cell lookup
$8F:AF6F  22 06 A9 8F  JSL $8FA906         ; Update elevation plane bits
$8F:AF73  A4 4C        LDY $4C             ; Restore entity pointer
$8F:AF75  38           SEC                 ; Permitted
$8F:AF76  6B           RTL

; Ground mode collision pipeline:
$8F:AF8E  A6 46        LDX $46
$8F:AF90  A4 48        LDY $48
$8F:AF92  22 15 98 90  JSL $909815         ; Fetch map cell word
$8F:AF96  22 46 A9 8F  JSL $8FA946         ; Test elevation ramp boundary
$8F:AF9A  90 0F        BCC $8FAFAB         ; Blocked!
$8F:AF9C  22 61 95 90  JSL $909561         ; Viewport boundary check
$8F:AFA0  90 09        BCC $8FAFAB
$8F:AFA2  22 AB B4 8F  JSL $8FB4AB         ; Solid actor hitbox collision
$8F:AFA6  90 03        BCC $8FAFAB
$8F:AFA8  A4 4C        LDY $4C
$8F:AFAA  6B           RTL                 ; Carry Set: Permitted!

$8F:AFAB  A4 4C        LDY $4C
$8F:AFAD  6B           RTL                 ; Carry Clear: Blocked!
```

---

## 3. Clean C Reconstructed Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define ENTITY_FLAG_STEP_SUCCESS     0x0001  /* +$12 bit 0 */
#define ENTITY_FLAG_WALL_BLOCKED     0x0002  /* +$12 bit 1 */

#define TILE_ATTR_CONVEYOR_STAIRS    0x2000  /* +$3C bit 13 */
#define MOVEMENT_MODE_FLYING         0x0800  /* +$10 bit 11 */
#define MOVEMENT_MODE_GHOST          0x0480  /* +$10 bits 10/7 */

typedef struct {
    uint16_t movement_mode_10;      /* +$10: movement flags */
    uint16_t reaction_flags_12;     /* +$12: step status / collisions */
    uint16_t state_flags_16;        /* +$16 */
    uint16_t elevation_plane;       /* +$18: 0..3 layer plane */
    int16_t  x;                     /* +$1A: subpixel/pixel X */
    int16_t  y;                     /* +$1C: subpixel/pixel Y */
    uint16_t collision_tile_3C;     /* +$3C: metatile collision word */
} PhysicsEntity;

/* Jump Table for 16 Conveyor / Ramp Impulse Presets ($8F:AF30) */
typedef void (*ConveyorImpulseFunc)(PhysicsEntity *entity, int16_t *dx, int16_t *dy);
extern const ConveyorImpulseFunc g_conveyor_impulse_table[16];

/* External Collision Routines */
extern bool probe_elevation_plane_ramp(int16_t x, int16_t y, uint16_t plane); /* $8F:A946 */
extern bool probe_viewport_boundary(int16_t x, int16_t y);                    /* $90:9561 */
extern bool probe_actor_hitbox_collision(PhysicsEntity *entity, int16_t x, int16_t y); /* $8F:B4AB */
extern void handle_collision_recoil(PhysicsEntity *entity);                    /* $8F:C2E4 */
extern void update_elevation_plane_flying(int16_t x, int16_t y, uint16_t *plane); /* $8F:A906 */

/**
 * Composite collision probe testing elevation plane, viewport limits, and solid actors.
 * Corresponds to native routine $8F:AF48.
 *
 * @param entity Entity attempting movement.
 * @param target_x Proposed X coordinate.
 * @param target_y Proposed Y coordinate.
 * @return True if target location is unblocked, false if obstructed.
 */
bool collision_probe_and_plane_update(PhysicsEntity *entity, int16_t target_x, int16_t target_y) {
    // Flying / ethereal bypass
    if (entity->movement_mode_10 & MOVEMENT_MODE_FLYING) {
        update_elevation_plane_flying(target_x, target_y, &entity->elevation_plane);
        return true;
    }

    if (entity->movement_mode_10 & MOVEMENT_MODE_GHOST) {
        return true;
    }

    // Ground tier checks
    if (!probe_elevation_plane_ramp(target_x, target_y, entity->elevation_plane)) {
        return false;
    }

    if (!probe_viewport_boundary(target_x, target_y)) {
        return false;
    }

    if (!probe_actor_hitbox_collision(entity, target_x, target_y)) {
        return false;
    }

    return true; // Path is completely clear
}

/**
 * Resolves proposed displacement vector (dx, dy), handling conveyor impulses,
 * diagonal stair elevation shear, and orthogonal wall sliding.
 * Corresponds to native routines $8F:ADAA - $8F:AF0E.
 *
 * @param entity Entity attempting movement step.
 * @param dx Proposed horizontal delta.
 * @param dy Proposed vertical delta.
 */
void entity_mover_step_and_shear_resolution(PhysicsEntity *entity, int16_t dx, int16_t dy) {
    // Check conveyor / stair ramp tile attribute bit 13
    if (entity->collision_tile_3C & TILE_ATTR_CONVEYOR_STAIRS) {
        uint8_t preset = entity->collision_tile_3C & 0x000F;
        if (g_conveyor_impulse_table[preset] != NULL) {
            g_conveyor_impulse_table[preset](entity, &dx, &dy);
        }
    }

    // Stationary test
    if (dx == 0 && dy == 0) {
        entity->reaction_flags_12 |= ENTITY_FLAG_STEP_SUCCESS;
        return;
    }

    int16_t target_x = entity->x + dx;
    int16_t target_y = entity->y + dy;

    // 1. Probe direct trajectory
    if (collision_probe_and_plane_update(entity, target_x, target_y)) {
        // Direct move succeeded
        entity->x = target_x;
        entity->y = target_y;
        entity->reaction_flags_12 |= ENTITY_FLAG_STEP_SUCCESS;
        return;
    }

    // Direct move blocked: attempt orthogonal shear / wall slide
    bool shear_succeeded = false;

    if (dx == 0) {
        // Pure vertical blocked: test horizontal drift (+dy or -dy)
        if (collision_probe_and_plane_update(entity, entity->x + dy, target_y)) {
            target_x = entity->x + dy;
            shear_succeeded = true;
        } else if (collision_probe_and_plane_update(entity, entity->x - dy, target_y)) {
            target_x = entity->x - dy;
            shear_succeeded = true;
        }
    } else if (dy == 0) {
        // Pure horizontal blocked: test vertical drift (-dx or +dx)
        if (collision_probe_and_plane_update(entity, target_x, entity->y - dx)) {
            target_y = entity->y - dx;
            shear_succeeded = true;
        } else if (collision_probe_and_plane_update(entity, target_x, entity->y + dx)) {
            target_y = entity->y + dx;
            shear_succeeded = true;
        }
    } else {
        // Diagonal move blocked: test single-axis wall slide
        if (collision_probe_and_plane_update(entity, target_x, entity->y)) {
            // Horizontal sliding unblocked
            target_y = entity->y;
            shear_succeeded = true;
        } else if (collision_probe_and_plane_update(entity, entity->x, target_y)) {
            // Vertical sliding unblocked
            target_x = entity->x;
            shear_succeeded = true;
        }
    }

    if (shear_succeeded) {
        entity->x = target_x;
        entity->y = target_y;
        entity->reaction_flags_12 |= ENTITY_FLAG_STEP_SUCCESS;
    } else {
        // Fully obstructed: trigger obstacle collision reaction
        entity->reaction_flags_12 |= ENTITY_FLAG_WALL_BLOCKED;
        handle_collision_recoil(entity);
    }
}
```

---

## 4. Architectural Invariants & Memory Anchors

- **Bit 13 (`0x2000`) Conveyor / Stair Geometry Flag**:
  - In map metatiles, bit 13 identifies active physics modifiers: conveyor belts in omnitopia/factories, 45-degree ramps in Prehistoria, and stairways in Gothica castles.
  - When present, the low 4 bits select one of 16 impulse vectors (North, South, East, West, diagonals, and accelerations).
- **Orthogonal Shear Decomposition**:
  - The engine avoids player "sticking" when running diagonally against walls by decomposing $(dx, dy)$ into independent single-axis tests. If $(X+dx, Y)$ is free while $(X+dx, Y+dy)$ is blocked, the character continues moving horizontally at full speed while sliding along the vertical barrier.
- **Flying Mode (`0x0800`) Immunity**:
  - Entities with bit 11 set in `$0010,Y` (such as airborne crows, wasps, and hovercraft) completely bypass terrain collision barriers while still maintaining valid elevation plane layers via `$8F:A906`.
