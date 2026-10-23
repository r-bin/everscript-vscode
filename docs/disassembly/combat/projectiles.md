# Projectile & Spell Sprite Spawner Pipeline

> **ROM Bank**: `$8F` (Spawner & Entity Pool), `$90` (Animation Script `$90:9815`)  
> **Source Routines**: `$8F:B094` (`projectile_spawn_master`), `$8F:B0A4` (`entity_slot_allocate_and_init`)  
> **Related Routines**: `$8F:B2BE` (Entity pool scanner), `$8F:A93B` (Animation setup), `$90:9815` (Default projectile animation track)  
> **Memory Map**: `$7E:1072` (Active entity count), `$7E:1074` (Total spawned entities), direct page `$46` (X tile/pixel), `$48` (Y tile/pixel), `$4C` (Target entity pointer)

---

## 1. Architectural Overview

Combat spells (Flash, Hard Ball, Acid Rain, Fireball) and ranged physical hazards in *Secret of Evermore* are materialized in the engine as temporary **projectile entities**. Rather than having a separate collision subsystem for missiles, the engine unifies all dynamic moving objects—Boy, Dog, NPCs, monsters, and flying projectiles—into a single contiguous array of entity records in WRAM.

### Key Subsystems:
1. **Master Spawner Interface (`$8F:B094`)**:
   - Sets the Data Bank register to `$7E`.
   - Calls the entity pool scanner (`$8F:B2BE`) to locate an unoccupied entity slot.
   - Forwards execution to `$8F:B0A4` to initialize the missile's core attributes.
2. **Entity Initialization & State Cleansing (`$8F:B0A4`)**:
   - Increments active entity counters `$1072` and `$1074`.
   - Injects launch coordinates from direct page `$46` (X position) and `$48` (Y position).
   - Binds the default animation track via `$90:9815`.
   - **Status Effect Cleansing**: Writes `$FFFF` to all four status effect slots (`+$46`, `+$4C`, `+$52`, `+$58`), ensuring projectiles never inherit stale buff/ailment data from recycled entity slots.
   - Sets character attribute flags: facing heading `+$22 = 0x0008`, priority bits `+$10`, and links the origin caster / parent entity pointer `+$60 = $02`.
3. **Ballistic vs. Homing Trajectories**:
   - **Linear Ballistic**: Projectiles calculate fixed directional delta components ($v_x, v_y$) derived from the caster's heading angle.
   - **Homing**: Projectiles evaluate the target entity's position (`$4C`) each frame, steering toward the target using an angular tracking clamp to prevent instant 90-degree snapping.
4. **Impact Detection & Expiration**:
   - Missile entities execute isometric hitbox checks every tick.
   - Upon intersecting a hostile target or solid metatile geometry, the projectile initiates an impact burst animation and marks its entity slot for reclamation.

---

## 2. 65816 Assembly Implementation

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/909815](soe://rom/code/909815?asm=1&c=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/90/909815_projectiles.c`](../../../reconstructed-c/90/909815_projectiles.c).
> [View in VFS: soe://rom/code/909815](soe://rom/code/909815?c=1&asm=0)

