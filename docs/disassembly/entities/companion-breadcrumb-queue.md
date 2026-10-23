# Companion Breadcrumb FIFO Shift Operations & Navigation State

**Addresses**:
- `companion_breadcrumb_fifo_delete_node`: `$8F:9E49` – `$8F:9E76`
- `companion_breadcrumb_fifo_insert_node`: `$8F:9E77` – `$8F:9EA2`
- `companion_waypoint_prune_and_steer`: `$8F:9C24` – `$8F:9CD9`

**ROM Source**: Bank `$8F` (US 1.0)  
**Subsystem**: Actor & Animation Engine / Companion FIFO Breadcrumbs

---

## 1. Overview & Architectural Role

Secret of Evermore maintains a high-frequency breadcrumb history FIFO (First-In, First-Out) ring buffer in WRAM (`$7E:3BC9`..`$7E:3BF5`) tracking the leader player's recent footsteps (up to 15 nodes, 3 bytes per node).

Key mechanisms:
1. **FIFO Pop / Shift Backwards (`companion_breadcrumb_fifo_delete_node`)**:
   When the companion steps onto a breadcrumb waypoint, that node is consumed. The engine decrements the tail offset register (`$7E:3BFF,X -= 3`) and uses the 65816 hardware block move instruction `MVN $7E, $7E` to slide all subsequent waypoint records down by 3 bytes in a single atomic instruction.
2. **FIFO Push / Shift Forwards (`companion_breadcrumb_fifo_insert_node`)**:
   When the leader traverses past a 16-pixel tile threshold, a new waypoint is logged. If an intermediate waypoint needs insertion into the queue, the engine advances the tail offset (`$7E:3BFF,X += 3`) and shifts existing records upward by 3 bytes using `MVP $7E, $7E`.
3. **Queue Prune & Dynamic Steering Stepper (`companion_waypoint_prune_and_steer`)**:
   Evaluates companion navigation flags (`$7E:3C12,X`):
   - Bit 9 (`0x0200`): Direct path override (bypass breadcrumbs).
   - Bit 5 (`0x0020`): Proximity arrival latch (companion is adjacent to leader).
   - If waypoints are exhausted (`queue_head >= queue_tail`), companion stops movement (`velocity = 0`) and clears moving bit 11 in `$0010,Y`.
   - If waypoints remain, calculates direction vector angle to the next node using `$8F:AA51`, checks 8-way adjacent collision via `$8F:9EC3`, and steers the companion's physics velocity vectors.

---

## 2. Data Structures & Memory Layout

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8F9E49_companion_breadcrumb_queue.c`](../../../reconstructed-c/8F/8F9E49_companion_breadcrumb_queue.c).
> [View in VFS: soe://rom/code/8F9E49](soe://rom/code/8F9E49?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8F9E49_companion_breadcrumb_queue.c`](../../../reconstructed-c/8F/8F9E49_companion_breadcrumb_queue.c).
> [View in VFS: soe://rom/code/8F9E49](soe://rom/code/8F9E49?c=1&asm=0)

