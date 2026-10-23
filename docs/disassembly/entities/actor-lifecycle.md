# Actor & Entity Active Pool Initialization

- **ROM Location**: Bank `$80` (`$80:9685` – `$80:96BA`)
- **Primary Function**: `init_entity_pool` (`$80:9685`)
- **Invoked By**: Main engine frame setup (`$80:8BB5`)
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E`
- **WRAM Core Addresses**:
  - `$7E:50A7`–`$7E:512F`: Circular doubly-linked list of active actor nodes (17 slots $\times$ 8 bytes = 136 bytes).
  - `$7E:1276`: Tail boundary address of entity linked list pool (`0x512F`).

---

## 1. Architectural Architecture & Doubly-Linked Actor Pool

Secret of Evermore manages all on-screen interactive actors (boy, dog, NPCs, enemies, projectiles) using an active entity list allocated in WRAM bank `$7E`.

### Node Structure (8 Bytes Per Node)
The allocator at `$80:9685` formats 17 node headers of 8 bytes each:
- `+0x00`: `prev` pointer (16-bit address in `$7E:xxxx`)
- `+0x02`: `next` pointer (16-bit address in `$7E:xxxx`)
- `+0x04`: `status` / slot state:
  - `0xFFFE`: Sentinel / List head marker
  - `0xFFFF`: Inactive / Unallocated free slot
  - `0x0000`..: Active entity index / type
- `+0x06`: Self pointer / backlink

### Pool Layout (17 Slots)
- **Slot 0 (`$7E:50A7`)**: Sentinel head node.
- **Slots 1..16 (`$7E:50AF`..`$7E:5127`)**: Free actor slots chained into the unallocated pool.
- **End boundary (`$7E:512F`)**: Upper bound written to `$7E:1276`.

---

## 2. Disassembly & Annotations

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/809685](soe://rom/code/809685?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/809685_actor_lifecycle.c`](../../../reconstructed-c/80/809685_actor_lifecycle.c).
> [View in VFS: soe://rom/code/809685](soe://rom/code/809685?c=1&asm=0)


