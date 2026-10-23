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

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8FADAA](soe://rom/code/8FADAA?asm=1&c=0)


---

## 3. Clean C Reconstructed Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FADAA_conveyor_physics.c`](../../../reconstructed-c/8F/8FADAA_conveyor_physics.c).
> [View in VFS: soe://rom/code/8FADAA](soe://rom/code/8FADAA?c=1&asm=0)


---

## 4. Architectural Invariants & Memory Anchors

- **Bit 13 (`0x2000`) Conveyor / Stair Geometry Flag**:
  - In map metatiles, bit 13 identifies active physics modifiers: conveyor belts in omnitopia/factories, 45-degree ramps in Prehistoria, and stairways in Gothica castles.
  - When present, the low 4 bits select one of 16 impulse vectors (North, South, East, West, diagonals, and accelerations).
- **Orthogonal Shear Decomposition**:
  - The engine avoids player "sticking" when running diagonally against walls by decomposing $(dx, dy)$ into independent single-axis tests. If $(X+dx, Y)$ is free while $(X+dx, Y+dy)$ is blocked, the character continues moving horizontally at full speed while sliding along the vertical barrier.
- **Flying Mode (`0x0800`) Immunity**:
  - Entities with bit 11 set in `$0010,Y` (such as airborne crows, wasps, and hovercraft) completely bypass terrain collision barriers while still maintaining valid elevation plane layers via `$8F:A906`.
