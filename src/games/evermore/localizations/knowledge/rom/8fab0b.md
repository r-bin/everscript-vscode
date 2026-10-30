# companion_pathfinding_breadcrumb_queue_pop

Pulls historical path breadcrumbs recorded by the Boy for dog companion navigation tracking.

## Metadata
- **Address:** `$8F:AB0B`
- **Type:** `routine`
- **Bank:** `$8F`
- **Size:** 99 bytes

## Functionality
Extracts navigation waypoints from the protagonist\'s historical movement trail.
The dog companion tracks the player by following a ring buffer of movement breadcrumbs stored in WRAM at `$3BFF,Y`.

The routine checks breadcrumb validity flag bit `$20`; if valid, it pops the next waypoint coordinates from queue index `X` and assigns them as the dog companion\'s navigation pursuit target.

## Callers
- `$8F:D1F6` (`func_8FD1F6`)

## Callees
- None

## Variables and Memory
- `$4E` (Companion entity record pointer)
- `$3BFF,Y` (Player movement breadcrumb ring buffer pointer)
- `$3C12,Y` (Breadcrumb buffer status flags)
