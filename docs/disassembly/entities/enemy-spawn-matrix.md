# HUD Stamina Gauge Recharge & Entity Collision Perimeter Mesh

**Addresses**:
- `hud_stamina_meter_recharge_step`: `$8F:8AE4` – `$8F:8B90`
- `entity_collision_mesh_init`: `$8F:8C00` – `$8F:8C79`
- `entity_hitbox_bounds_array_init`: `$8F:8CCB` – `$8F:8D5C`
- `enemy_facing_compass_resolve`: `$8F:8D5D` – `$8F:8D75`

**ROM Source**: Bank `$8F` (US 1.0)
**Subsystem**: Combat Engine / HUD & Collision Subsystems

---

## 1. Overview & Architectural Role

This subsystem bridges two foundational elements of real-time combat in Secret of Evermore:
1. **The Weapon Charge & Stamina Percentage Gauge (`hud_stamina_meter_recharge_step`)**:
   Tracks attack stamina for both Boy and Dog ($0$ to $1024 = \text{0x0400}$). When recharging, it employs the SNES hardware math unit (`$4202` / `$4216`) to scale stamina by 100 into a percentage value, selecting tile patterns `$2BE9`, `$2BF6`, `$2BF7`, and `$2BFF` to fill the visual gauge on screen. Upon reaching 100% full charge, it decrements flash timers (`$7E:0B4D` for Boy, `$7E:0B4F` for Dog) and triggers audio/visual readiness cues via `$80:870C`.
2. **64-Byte Entity Collision Perimeter Mesh (`entity_collision_mesh_init`)**:
   Prepares an entity's 64-byte collision bounding box before evaluating movement against terrain or other actors. It clears internal coordinates while populating boundary extents with `#$FF00` (min limits) and `#$FFFF` (max limits).
3. **8-Directional Compass Heading (`enemy_facing_compass_resolve`)**:
   Maps angular displacement vectors into an 8-way directional enum (`North`, `Northeast`, `East`, etc.) via `AND #$0007; ASL`.

---

## 2. Data Structures & Memory Layout

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8F8AE4_enemy_spawn_matrix.c`](../../../reconstructed-c/8F/8F8AE4_enemy_spawn_matrix.c).
> [View in VFS: soe://rom/code/8F8AE4](soe://rom/code/8F8AE4?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8F8AE4_enemy_spawn_matrix.c`](../../../reconstructed-c/8F/8F8AE4_enemy_spawn_matrix.c).
> [View in VFS: soe://rom/code/8F8AE4](soe://rom/code/8F8AE4?c=1&asm=0)


---

## 4. Verification & Behavioral Equivalence

1. **Stamina Scaling**: Verified against assembly `$8F:8B16` (`LSR; LSR; ORA #$6400; STA $4202`), multiplying by 100 via hardware multiplier to produce exact HUD percentage fill.
2. **Flash Threshold**: Matches `CMP #$000E` (`$8F:8B38`), triggering the visual charge ready state at tick 14.
3. **Bounding Mesh**: Matches 64-byte initialization pattern `$8F:8C11`–`$8F:8C74`.
