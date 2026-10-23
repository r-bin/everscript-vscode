# Combat Damage Delivery, Flinch Recoil & Floating Number Spawner

**Addresses**:
- `combat_floating_damage_number_spawn`: `$8F:C09A` – `$8F:C0D2`
- `combat_damage_delivery_and_flinch`: `$8F:C0D3` – `$8F:C11C`
- `combat_attacker_attribution_bind`: `$8F:C17F` – `$8F:C1BA`

**ROM Source**: Bank `$8F` (US 1.0)  
**Subsystem**: Combat Subsystem / Hit Reaction & Hurtbox Resolution

---

## 1. Overview & Architectural Role

When an entity (player character, companion, or enemy monster) is struck by a physical weapon, projectile, or alchemy formula, the combat subsystem executes a synchronized 3-step response:
1. **Damage Delivery & Flinch Flagging (`combat_damage_delivery_and_flinch`)**:
   - Stores the calculated damage value into `$7E:0EA0`.
   - Inspects victim status flags to verify invulnerability (e.g. death state, phase shift, barrier shield).
   - If vulnerable, raises hit reaction flags (`0x0438`) on the entity's status word (`entity +$12`):
     - Bit 3 (`0x0008`): Entity flinch recoil trigger.
     - Bit 4 (`0x0010`): In-flight damage latch.
     - Bit 5 (`0x0020`): HUD health bar flash alert.
     - Bit 10 (`0x0400`): Active invulnerability frame tick.
   - Enforces a strict hard cap of **999 HP** (`0x03E7`) and adds damage to `entity->pending_damage` (`+$76,Y`).
2. **Floating Damage Number Spawner (`combat_floating_damage_number_spawn`)**:
   Allocates an OAM particle slot (`$7E:2480`), converts the 16-bit integer damage into decimal sprite tiles, centers the text over the victim's head ($Y - 16\text{px}$), and arms a 30-frame upward float animation.
3. **Attacker Attribution Binding (`combat_attacker_attribution_bind`)**:
   Records the attacking entity's memory address into `entity->last_attacker` (`+$24,Y` and `+$80,Y`). This enables AI aggro retaliation (enemies turning to face their attacker) and kill-credit XP awarding.

---

## 2. Data Structures & Memory Layout

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FC09A_hit_recoil_physics.c`](../../../reconstructed-c/8F/8FC09A_hit_recoil_physics.c).
> [View in VFS: soe://rom/code/8FC09A](soe://rom/code/8FC09A?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FC09A_hit_recoil_physics.c`](../../../reconstructed-c/8F/8FC09A_hit_recoil_physics.c).
> [View in VFS: soe://rom/code/8FC09A](soe://rom/code/8FC09A?c=1&asm=0)

