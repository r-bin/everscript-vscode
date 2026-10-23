# Hitbox Damage Intersections, Elliptical Collision & Knockback Vectors ($8F:B46D, $8F:B4AB, $8F:C0D3)

> **Subsystem**: Combat Hitbox Resolution, Entity Collision & Hurtbox Reaction  
> **ROM Addresses**: `$8F:B46D` (`entity_collision_check`), `$8F:B4AB` (`test_entity_pair_overlap`), `$8F:C0D3` (`dispatch_hit_reaction_and_knockback`)  
> **Clean C Module**: `combat/hitbox-intersections.c`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore utilizes an isometric/elliptical collision model for entity bodies, distinct from axis-aligned bounding boxes (AABBs):
- **Collision Radius (`character +0x0D`)**:
  - Each character record defines a collision radius $r$ in pixels (e.g., Boy = 8, Dog = 16, Flowers = 14, Raptors = 20, Thraxx claws = 24).
- **Isometric Overlap Formula (`$8F:B4AB`)**:
  - Two entities collide if and only if:
    $$|dx| < (r_1 + r_2) \quad \text{AND} \quad 2 \cdot |dy| < (r_1 + r_2)$$
  - Because SNES Mode 7 and top-down isometric perspectives project vertical distances foreshortened by $\approx 50\%$, the collision boundary is an ellipse with twice the width of its height ($2:1$ aspect ratio).
- **Overlapping Mover Rule (`$8F:B4FD`)**:
  - If two entities already overlap prior to movement (e.g., spawning on the same coordinate), movement is *not* blocked, preventing softlocks.
- **Hurtbox Strike & Knockback Dispatch (`$8F:C0D3`)**:
  - When struck by an attack or spell:
    1. Sets invulnerability flash frames in `target +0x14` (typically 30–60 frames).
    2. Spawns floating damage numbers via `$8F:C09A` (white for physical damage, orange for spell damage, blue for heal).
    3. Calculates knockback displacement vector:
       $$\vec{v}_{\text{knockback}} = \text{normalize}(\vec{P}_{\text{target}} - \vec{P}_{\text{attacker}}) \times \text{knockback\_speed}$$
    4. Integrates displacement across 8 frames while testing against metatile tile collision (`$90:9DE8`).

---

## 2. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8FB46D](soe://rom/code/8FB46D?asm=1&c=0)


---

## 3. Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FB46D_hitbox_intersections.c`](../../../reconstructed-c/8F/8FB46D_hitbox_intersections.c).
> [View in VFS: soe://rom/code/8FB46D](soe://rom/code/8FB46D?c=1&asm=0)

