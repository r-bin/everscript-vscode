# entity_cardinal_facing_direction_resolve

Resolves cardinal and diagonal facing direction codes from signed X and Y displacement vectors.

## Metadata
- **Address:** `$8F:9DBD`
- **Type:** `routine`
- **Bank:** `$8F`
- **Size:** 140 bytes

## Functionality
Determines which direction an entity should face when pursuing or tracking a target.
The routine compares signed delta-X (`$1A,Y`) and delta-Y (`$1C,Y`).

It evaluates quadrant and relative slope magnitudes, resolving an 8-way directional facing code (Up, Down, Left, Right, and Diagonals), and writes the resulting direction index into entity attribute `$22,Y` to select the corresponding animation walk/idle cycle.

## Callers
- `$8F:9C24` (`FUN_8f9c24`)

## Callees
- None

## Variables and Memory
- `$1A,Y` (Target relative delta-X displacement)
- `$1C,Y` (Target relative delta-Y displacement)
- `$22,Y` (Entity resolved facing direction code)
