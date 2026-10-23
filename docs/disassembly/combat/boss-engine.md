# Boss Multi-Part State Driver & HP Phase Transitions ($8F:D5D2, $8F:D76A, $8F:D715)

> **Subsystem**: Boss Combat Engine & Multi-Segment Coordination  
> **ROM Addresses**: `$8F:D5D2` (`boss_ai_magmar`), `$8F:D76A` (`boss_part_static_target`), `$8F:D715` (`boss_ai_submerging_segmented`)  
> **Clean C Module**: `combat/boss-engine.c`  
> **Jump Table Indices**: `0x10` (Magmar), `0x02` (Thraxx Heart / Coleoptera / Aegis), `0x0E` (Salabog / Tar Skull)  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Major boss encounters in Secret of Evermore feature multi-segmented entity models, state transitions based on HP milestones, and phase synchronization:
- **Magmar Lava Encounter (`$8F:D5D2`, Index `0x10`)**:
  - Encounters `#87` and `#140`.
  - Phase 1 (Submerged Tracking): Magmar sinks beneath molten lava, tracking the player's X/Y coordinates while invulnerable (`flags | 0x0002`).
  - Phase 2 (Surfaced Projectile Barrage): Breaches lava surface to fire aimed lava spit projectiles (`$DA66`, `$DA7E`).
  - Phase 3 (Charging Roll): Curls into a blazing boulder with entity mode `0x4000` (continuous charging contact damage at `$8F:B52C`), sweeping across the arena until crashing into arena bounds.
- **Static Multi-Part Boss Targets (`$8F:D76A`, Index `0x02`)**:
  - Powers stationary scripted boss targets: Thraxx Heart, Coleoptera Heart, Mungola, Aquagoth, Aegis shield.
  - Zero autonomous roaming (`aggro_range = 0, aggro_chance = 0`).
  - Controlled by room scripts and parent boss controllers: exposes vulnerability windows when peripheral parts (e.g., Thraxx's 4 claws) are stunned or destroyed.
- **Submerging Multi-Segment Ambush (`$8F:D715`, Index `0x0E`)**:
  - Powers Salabog and Tar Skull.
  - Composed of multi-segment node lists (`opcode 0x57`), with 14 bytes per segment link.
  - Submerges beneath swamp/mud terrain, evaluates proximity to party, erupts with forward lunges, fires projectile mud bubbles, and retreats underground to reposition.

---

## 2. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8FD5D2](soe://rom/code/8FD5D2?asm=1&c=0)


---

## 3. Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FD5D2_boss_engine.c`](../../../reconstructed-c/8F/8FD5D2_boss_engine.c).
> [View in VFS: soe://rom/code/8FD5D2](soe://rom/code/8FD5D2?c=1&asm=0)

