# Entity Velocity & Coordinate Physics Integration

- **ROM Location**: Bank `$80` (`$80:96BB` – `$80:96FD`)
- **Primary Function**: `update_entity_physics` (`$80:96BB`)
- **Physics Core Subroutine**: `apply_velocity_and_collision` (`$80:9040`)
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E`
- **WRAM Core Addresses**:
  - `$7E:50A7`: Sentinel head node (`status = 0xFFFE`).
  - `$7E:5127`: Tail node of active entity pool.
  - DP `$02`: Entity world position X (16-bit).
  - DP `$04`: Entity world position Y (16-bit).
  - DP `$06`: Entity elevation Z (16-bit).
  - DP `$26`: Velocity vector X (8-bit signed).
  - DP `$27`: Velocity vector Y (8-bit signed).

---

## 1. Architectural Architecture & Reverse Linked-List Traversal

The physics loop at `$80:96BB` drives per-frame positional updates for all active actors in the game (the boy, the dog, active enemies, NPCs, and spell sprites).

### Reverse Traversal Order
The loop iterates **backwards** through the doubly-linked actor pool, starting at tail slot `$7E:5127` and stepping backward through `node->prev` pointers (`+0x00`) until it encounters the sentinel head node at `$7E:50A7`.
This reverse ordering ensures that child entities, particles, and trailing companions process relative to previous frame parent states without frame-ahead ordering artifacts.

### Node Slot State Filtering
- **Active Node (`status >= 0`)**: Extracts coordinates (`+0x06`..`+0x0A`) and velocity (`+0x0C`..`+0x0D`), invoking `JSL $80:9040` to compute tile collisions and coordinate translation.
- **Sentinel Head (`status == 0xFFFE`)**: End of linked list reached. Calls `JSL $80:9685` (`init_entity_pool`) to reset chain limits and returns.
- **Inactive / Free Node (`status == 0xFFFF`)**: Skips processing and continues to `node->prev`.

---

## 2. Disassembly & Annotations

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8096BB](soe://rom/code/8096BB?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/8096BB_physics_integration.c`](../../../reconstructed-c/80/8096BB_physics_integration.c).
> [View in VFS: soe://rom/code/8096BB](soe://rom/code/8096BB?c=1&asm=0)


