# Companion Leash & Teleport Recovery System

> **ROM Bank**: `$8F` (Companion AI Engine)  
> **Source Routines**: `$8F:D018` (`companion_teleport_recovery`), `$8F:D0B0` (`companion_proximity_evaluator`)  
> **Related Routines**: `$8F:A78A` (Distance calculation $|dx| + |dy|$), `$8F:98A4` (Pathfinding validation), `$8C:DAC5` (Input & companion dispatcher)  
> **Memory Map**: `$7E:1443` (Target recovery X coordinate), `$7E:1445` (Target recovery Y coordinate), `$7E:1459` (Waypoint path validity flag), `$7E:4FAF` (Companion recovery state register)

---

## 1. Architectural Overview

In *Secret of Evermore*, the companion character (the Dog, or the Boy during Dog-first chapters) follows the primary player through dense top-down room terrain. Because the companion can get wedged behind obstacles, doors, or screen boundaries, the game implements an autonomous **tether / leash and teleport recovery system** in Bank `$8F`.

### Proximity Thresholds:
The distance between the two characters ($d = |dx| + |dy|$) governs companion behavior:
1. **$d \le 32$ pixels (Close)**: Companion enters idle behavior (sniffing ground spots, wagging tail, roaming).
2. **$32 < d \le 128$ pixels (Moderate)**: Companion walks towards the player along the path waypoint trail.
3. **$128 < d \le 384$ pixels (Far)**: Companion sprints / dashes at double speed to close the distance.
4. **$d > 384$ pixels or Path Blocked (Lost / Stranded)**: The engine triggers **Teleport Recovery** (`$8F:D018`).

### Key Subsystems:
1. **Pathfinding Validation (`$8F:D0B0`)**:
   - Calculates distance vector to partner character (`$4E89` or `$4F37`) via `$8F:A78A`.
   - Inspects waypoint list index `$0098,y`. If the companion cannot find a continuous path to the player or distance exceeds the tether threshold, execution diverts to `$8F:D018`.
2. **Teleport Recovery Protocol (`$8F:D018`)**:
   - Sets recovery state code `#$0009` in companion register `$4FAF`.
   - Reads the safe landing destination from player trailing anchor registers `$1443` and `$1445`.
   - Directly teleports the companion's world coordinates to the anchor position.
   - Resets the companion's velocity components and purges obsolete waypoint nodes via `$8F:9C24`.
   - Re-aligns the companion to face the same direction as the player.

---

## 2. 65816 Assembly Implementation

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8FD018](soe://rom/code/8FD018?asm=1&c=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FD018_companion_leash.c`](../../../reconstructed-c/8F/8FD018_companion_leash.c).
> [View in VFS: soe://rom/code/8FD018](soe://rom/code/8FD018?c=1&asm=0)

