# Companion Waypoint Raycast Collision & Neighbor Cell Probe

**Addresses**:
- `companion_waypoint_raycast_probe`: `$8F:9EA3` – `$8F:9EC2`
- `companion_neighbor_cell_collision_test`: `$8F:9EC3` – `$8F:9F04`
- `companion_metatile_raycast_line_stepper`: `$8F:9F05` – `$8F:A3D7`

**ROM Source**: Bank `$8F` (US 1.0)  
**Subsystem**: Actor & Animation Engine / Companion Pathfinding

---

## 1. Overview & Architectural Role

In Secret of Evermore, the follower companion (Dog or Boy) cannot merely walk in a straight line toward the leader; doing so would cause the follower to constantly get stuck on walls, water ponds, fences, and 45-degree elevation ramps.

To achieve robust navigation, the companion pathfinding engine integrates a real-time **metatile raycasting and line-of-sight validation pipeline**:
1. **Waypoint Raycast Probe (`companion_waypoint_raycast_probe`)**:
   Calculates the 2D trajectory vector between the companion's current metatile coordinates `($66, $67)` and the target breadcrumb waypoint `($69, $6A)`. Determines the 16-direction angle via `$8F:AA51`, executes the line stepper (`$8F:9F05`), and verifies that the destination layer plane (`$44`) matches the target layer (`$6B`).
2. **8-Way Neighbor Cell Scanner (`companion_neighbor_cell_collision_test`)**:
   Dispatches through 8-way directional jump table `$8F:A3E8` to probe orthogonal and diagonal adjacent metatiles. Used for local steering adjustment when the primary line of sight is obstructed.
3. **Metatile Raycast Line Stepper (`companion_metatile_raycast_line_stepper`)**:
   An integer grid line-rasterization engine (similar to Bresenham's algorithm) that steps through each metatile between origin and destination:
   - Uses hardware multiplier `$4202`/`$4216` to look up metatile attributes from `$7F:0000` / `$7F:0004`.
   - Extracts 4-bit slope/solid collision geometry bits via `collision_geometry_bits_3_0` (`$8F:A774`).
   - Cross-references slope tables `$8F:A3F8` and `$8F:A418` through multi-way jump table `$8F:A3D8`.
   - Returns Carry Clear (`false`) if any solid wall or impassable slope obstructs the path, or Carry Set (`true`) if the path is clear.

---

## 2. Data Structures & Memory Layout

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8F9EA3_companion_steering.c`](../../../reconstructed-c/8F/8F9EA3_companion_steering.c).
> [View in VFS: soe://rom/code/8F9EA3](soe://rom/code/8F9EA3?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8F9EA3_companion_steering.c`](../../../reconstructed-c/8F/8F9EA3_companion_steering.c).
> [View in VFS: soe://rom/code/8F9EA3](soe://rom/code/8F9EA3?c=1&asm=0)

