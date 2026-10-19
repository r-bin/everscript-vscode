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

```c
// Direct Page Scratch Variables for Pathfinding:
// DP $44: Current elevation plane / layer
// DP $50: Metatile collision word under test
// DP $52: Extracted 4-bit collision geometry code
// DP $54: Neighbor tile collision geometry code
// DP $56: Active metatile grid memory offset in $7F:0000
// DP $66, $67: Current follower metatile coordinate (X, Y)
// DP $69, $6A: Target waypoint metatile coordinate (X, Y)
// DP $6B: Target waypoint elevation plane

// Metatile Map Layout:
// $7E:08EE: Map width in metatiles (stride)
// $7E:0F46: Map row stride in bytes (width * 2)
// $7F:0000: Metatile layer 0 grid array
// $7F:0004: Metatile collision attribute descriptor table
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

extern uint16_t g_map_metatile_width;  // $7E:08EE
extern uint16_t g_map_row_byte_stride; // $7E:0F46
extern uint16_t g_metatile_grid[4096]; // $7F:0000
extern uint16_t g_metatile_attrs[4096];// $7F:0004

extern uint8_t compute_vector_angle_16(int16_t dx, int16_t dy); // $8F:AA51
extern uint8_t collision_geometry_bits_3_0(uint16_t attr_word);  // $8F:A774

// ROM Slope Traversal Feasibility Tables in Bank $8F
extern const uint8_t g_slope_exit_mask[16];  // $8F:A3F8
extern const uint8_t g_slope_entry_mask[16]; // $8F:A418

/**
 * Checks if adjacent neighbor metatile in specified 16-direction heading is traversable.
 */
bool companion_neighbor_cell_collision_test(uint8_t direction_16, int16_t cur_x, int16_t cur_y, uint8_t current_plane) {
    int16_t target_x = cur_x;
    int16_t target_y = cur_y;

    // Map 16-direction heading to 8 grid deltas
    switch (direction_16 >> 1) {
        case 0: target_y--; break;             // North
        case 1: target_x++; target_y--; break; // North-East
        case 2: target_x++; break;             // East
        case 3: target_x++; target_y++; break; // South-East
        case 4: target_y++; break;             // South
        case 5: target_x--; target_y++; break; // South-West
        case 6: target_x--; break;             // West
        case 7: target_x--; target_y--; break; // North-West
    }

    if (target_x < 0 || target_y < 0) return false;

    uint16_t tile_idx = (target_y * g_map_metatile_width) + target_x;
    uint16_t attr_word = g_metatile_attrs[g_metatile_grid[tile_idx]];
    uint8_t geom = collision_geometry_bits_3_0(attr_word);

    // Solid wall (geometry 0) or boundary tile
    if (geom == 0) return false;

    // Check layer plane bits (bits 5..4)
    uint8_t tile_plane = (attr_word >> 4) & 3;
    if (tile_plane != current_plane && !(attr_word & 0x0040)) {
        return false;
    }

    return true;
}

/**
 * Bresenham-like metatile raycast line stepper.
 * Traces line between (start_x, start_y) and (target_x, target_y).
 *
 * @return true if straight line of sight is unobstructed, false if blocked
 */
bool companion_metatile_raycast_line_stepper(int16_t start_x, int16_t start_y,
                                            int16_t target_x, int16_t target_y,
                                            uint8_t plane) {
    int16_t dx = target_x - start_x;
    int16_t dy = target_y - start_y;
    int16_t step_x = (dx >= 0) ? 1 : -1;
    int16_t step_y = (dy >= 0) ? 1 : -1;

    int16_t abs_dx = (dx >= 0) ? dx : -dx;
    int16_t abs_dy = (dy >= 0) ? dy : -dy;

    int16_t cur_x = start_x;
    int16_t cur_y = start_y;

    int16_t error = abs_dx - abs_dy;

    while (cur_x != target_x || cur_y != target_y) {
        uint16_t tile_idx = (cur_y * g_map_metatile_width) + cur_x;
        uint16_t attr_word = g_metatile_attrs[g_metatile_grid[tile_idx]];
        uint8_t geom = collision_geometry_bits_3_0(attr_word);

        // Solid obstacle
        if (geom == 0) return false;

        // Check slope entry / exit masks
        uint8_t exit_mask = g_slope_exit_mask[geom];
        if (exit_mask & 0x80) {
            // Evaluates specialized slope diagonal barrier
            if (!(exit_mask & 0x03)) return false;
        }

        int16_t e2 = error * 2;
        if (e2 > -abs_dy) {
            error -= abs_dy;
            cur_x += step_x;
        }
        if (e2 < abs_dx) {
            error += abs_dx;
            cur_y += step_y;
        }
    }

    return true;
}

/**
 * Validates direct waypoint path between follower companion and target waypoint.
 *
 * @param cur_x Current follower metatile X
 * @param cur_y Current follower metatile Y
 * @param target_x Target breadcrumb metatile X
 * @param target_y Target breadcrumb metatile Y
 * @param cur_plane Follower active plane
 * @param target_plane Target breadcrumb plane
 * @return true if waypoint is directly reachable, false otherwise
 */
bool companion_waypoint_raycast_probe(int16_t cur_x, int16_t cur_y,
                                      int16_t target_x, int16_t target_y,
                                      uint8_t cur_plane, uint8_t target_plane) {
    // 1. Elevation layer matching: companion cannot traverse across mismatched planes without ramps
    if (cur_plane != target_plane) {
        return false;
    }

    // 2. Trace line through metatile collision grid
    return companion_metatile_raycast_line_stepper(cur_x, cur_y, target_x, target_y, cur_plane);
}
```
