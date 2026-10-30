# math_vector_2d_angle_and_distance_calc

Computes 2D vector distance and angle (0..255) from signed X and Y coordinate displacements.

## Metadata
- **Address:** `$80:AEAC`
- **Type:** `routine`
- **Bank:** `$80`
- **Size:** 369 bytes

## Functionality
General mathematical primitive for calculating directional angle and linear distance between two points.
The function takes signed 16-bit delta-X in `$02` and delta-Y in `$04`.

It determines the quadrant, performs octant folding to keep values within 0..45 degrees, computes the ratio of displacements, and uses a lookup table to determine the 8-bit heading angle (0..255, where 0 is East, 64 is South, etc.). It also computes Euclidean distance approximation for projectile speeds and homing trajectory calculations.

## Callers
- `$90:DE11` (`FUN_90de11`)
- `$91:CBB1` (`FUN_91cbb1`)

## Callees
- None

## Variables and Memory
- `$02` (Input signed delta-X displacement)
- `$04` (Input signed delta-Y displacement)
- `$12`, `$14` (Absolute magnitude temporary coordinates)
