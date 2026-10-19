# Map Elevation Ramp Stepper & Stair Shear Vector Mathematics

**Addresses**:
- `elevation_ramp_plane_project`: `$8F:A93B` – `$8F:A945`
- `elevation_vector_shear_step`: `$8F:A963` – `$8F:A97C`
- `elevation_manhattan_distance_eval`: `$8F:A97D` – `$8F:A998`
- `elevation_compass_direction_resolve`: `$8F:A999` – `$8F:A9C8`

**ROM Source**: Bank `$8F` (US 1.0)  
**Subsystem**: Map Metatiles & Collision Grid / Elevation Mathematics

---

## 1. Overview & Architectural Role

Navigating isometric 2.5D terrain with multiple elevation planes (ground floor, bridge overpass, underground tunnels, and diagonal stairways) requires specialized fixed-point geometry and projection algorithms:
1. **Ramp Layer Projector (`elevation_ramp_plane_project`)**:
   Inspects metatile collision word bit 13 (`0x2000`). If clear, extracts bits 5..4 (`attr & 0x0030`) into Direct Page `$44` as the active traversable plane. If bit 13 is set, the tile represents a ramp or staircase connecting two layers, enabling seamless vertical transition.
2. **Chebyshev Chebyshev & Shear Metric (`elevation_vector_shear_step`)**:
   Calculates $\min(|\Delta X|, |\Delta Y|)$ between origin and destination coordinates. Used to govern diagonal movement speed throttling across 45-degree slope terrain.
3. **Manhattan Diagonal Distance Evaluator (`elevation_manhattan_distance_eval`)**:
   Evaluates diagonal distance $|\Delta X \pm \Delta Y|$ depending on quadrant sign parity:
   $$\text{Metric} = |\Delta X + \Delta Y| \quad (\text{opposite signs}), \quad |\Delta X - \Delta Y| \quad (\text{same signs})$$
4. **Compass Heading Direction Resolver (`elevation_compass_direction_resolve`)**:
   Maps signed horizontal ($\Delta X$) and vertical ($\Delta Y$) pixel displacements into 4-way cardinal compass codes:
   - `0x0A`: North ($\Delta X < 0, \Delta Y \ge 0$)
   - `0x0E`: West ($\Delta X < 0, \Delta Y < 0$)
   - `0x06`: East ($\Delta X \ge 0, \Delta Y \ge 0$)
   - `0x02`: South ($\Delta X \ge 0, \Delta Y < 0$)

---

## 2. Data Structures & Memory Layout

```c
// Direct Page Scratch Variables:
// DP $12: Signed X displacement delta (dx)
// DP $13: Signed Y displacement delta (dy)
// DP $14: Absolute magnitude |dx|
// DP $44: Current active elevation layer plane (bits 5..4)

// Compass Direction Constants:
#define HEADING_SOUTH 0x02
#define HEADING_EAST  0x06
#define HEADING_NORTH 0x0A
#define HEADING_WEST  0x0E
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

/**
 * Projects the candidate metatile collision layer plane into active elevation context.
 *
 * @param collision_word 16-bit metatile attribute word
 * @param current_plane Current active layer in DP $44
 * @return Updated elevation layer plane
 */
uint8_t elevation_ramp_plane_project(uint16_t collision_word, uint8_t current_plane) {
    // Bit 13 indicates a ramp connecting planes: preserve bridge transition
    if (collision_word & 0x2000) {
        return current_plane;
    }

    // Extract elevation plane bits 5..4
    return (uint8_t)(collision_word & 0x0030);
}

/**
 * Calculates the Chebyshev minimum coordinate delta: min(|dx|, |dy|).
 */
uint8_t elevation_vector_shear_step(int8_t dx, int8_t dy) {
    uint8_t abs_dx = (dx < 0) ? (uint8_t)(-dx) : (uint8_t)dx;
    uint8_t abs_dy = (dy < 0) ? (uint8_t)(-dy) : (uint8_t)dy;

    return (abs_dy < abs_dx) ? abs_dy : abs_dx;
}

/**
 * Evaluates diagonal distance projection across quadrants: |dx ± dy|.
 */
uint8_t elevation_manhattan_distance_eval(int8_t dx, int8_t dy) {
    if ((dx ^ dy) < 0) {
        int16_t sum = dx + dy;
        return (sum < 0) ? (uint8_t)(-sum) : (uint8_t)sum;
    } else {
        int16_t diff = dx - dy;
        return (diff < 0) ? (uint8_t)(-diff) : (uint8_t)diff;
    }
}

/**
 * Resolves 4-way cardinal compass direction from signed coordinate deltas.
 */
uint8_t elevation_compass_direction_resolve(int8_t dx, int8_t dy) {
    if (dx < 0) {
        if (dy < 0) {
            return HEADING_WEST;
        } else {
            return HEADING_NORTH;
        }
    } else {
        if (dy < 0) {
            return HEADING_SOUTH;
        } else {
            return HEADING_EAST;
        }
    }
}
```
