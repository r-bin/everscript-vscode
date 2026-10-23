# Script VM Character & Entity Spawning Subsystem

## Overview
In Secret of Evermore, scripted actor instantiation, enemy spawning, and projectile generation are driven by four related Script VM opcodes in Bank `$8C`, converging on a shared commit dispatcher (`$8C:DD19`):

What each opcode does is described once, on its opcode page; this file keeps the routines' code: [`0xA2` spawn_at](soe://rom/assets/scripts/opcodes/a2.md), [`0xC2` add_enemy_spawner](soe://rom/assets/scripts/opcodes/c2.md), [`0xBA` spawn](soe://rom/assets/scripts/opcodes/ba.md), [`0x3C` spawn](soe://rom/assets/scripts/opcodes/3c.md).

All handlers query the master character record pointer table at `$8E:B55A` (`enemy_index`), calculate the target tile plane elevation via `$8F:A933`, and branch based on bit 15 (`0x8000`) of the spawn flags:
1. **Bit 15 Set (`0x8000`)**: Stages the actor into the deferred spawn table in WRAM at `$7E:0EC0` via `$8F:DE98` (`spawn_stage_deferred_entity`).
2. **Bit 15 Clear (`0x0000`)**: Immediately instantiates the entity or missile hazard via `$8F:B094` (`projectile_spawn_master`) and returns the entity pointer in `$7E:0341`.

---

## Memory Map & Data Structures

### Direct Page Variables
- `DP $02`: Character record pointer (16-bit address in Bank `$8E` or `$00`)
- `DP $08`: Spawn flags / argument 2 (bit 15 = deferred spawner vs immediate entity)
- `DP $44`: Evaluated tile plane elevation
- `DP $46`: World X coordinate (pixels)
- `DP $48`: World Y coordinate (pixels)
- `DP $82`: Script bytecode instruction pointer (PC)

### WRAM Globals
- `$7E:0341`: Pointer to the most recently spawned active entity
- `$7E:0EC0`: Deferred spawn table allocation pointer (starts at `$7E:0EC0`, capped at `$7E:6183`)
- `$7E:23DD`: Override sprite / animation descriptor pointer
- `$7E:2431`: Map room state snapshot word 1
- `$7E:2433`: Map room state snapshot word 2

### ROM Tables
- `$8E:B55A`: `enemy_index` table (143 words mapping enemy IDs to character records in `$8EB678`)
- `$8E:0017`: Default character animation track index table (indexed by character record offset)

---

## Decompiled C Code

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CDD19_opcode_spawning.c`](../../../reconstructed-c/8C/8CDD19_opcode_spawning.c).
> [View in VFS: soe://rom/code/8CDD19](soe://rom/code/8CDD19?c=1&asm=0)

