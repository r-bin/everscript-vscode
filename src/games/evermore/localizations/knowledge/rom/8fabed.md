# companion_leash_distance_and_stuck_recovery_tick

Monitors dog companion leash distance and triggers recovery teleport if obstructed or separated.

## Metadata
- **Address:** `$8F:ABED`
- **Type:** `routine`
- **Bank:** `$8F`
- **Size:** 118 bytes

## Functionality
AI guard routine maintaining companion proximity to the player.
The routine compares the dog\'s world position against the protagonist, calculating Euclidean leash distance.

If the companion remains beyond maximum leash distance or fails to make navigational progress over consecutive frame intervals, it triggers pathing recovery or teleports the dog near the Boy via waypoint anchor init.

## Callers
- Companion AI state machine loops in Bank `$8F`

## Callees
- `$8F:AC24` (`func_8FAC24`)

## Variables and Memory
- `$4E89` (Boy entity base address)
- `$4EAD` (Dog companion entity base address)
- `$1A,X`, `$1C,X` (Entity X and Y world coordinates)
