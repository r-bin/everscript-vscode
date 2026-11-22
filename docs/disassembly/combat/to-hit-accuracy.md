# Physical Combat To-Hit Accuracy, Invulnerability Cooldown & Pending Damage

- **ROM Locations**:
  - `to_hit_evade_vs_hit_rate`: `$8F:B75A` – `$8F:B7D0`
  - `hit_cooldown_same_attacker_blocked_for_21_ticks`: `$8F:BA1A` – `$8F:BA40`
  - `physical_damage_into_pending_0x76`: `$8F:C067` – `$8F:C0B0`
- **CPU State**: 16-bit A/X (`REP #$30`), Data Bank `$7E` / `$8F`
- **WRAM Core Addresses**:
  - Attacker slot offset `+0x42`: Attacker Hit Rate / weapon base accuracy.
  - Defender slot offset `+0x44`: Defender Physical Evade stat (`$0A3F`).
  - Defender slot offset `+0x36`: Last attacker entity slot ID (for repeat hit rejection).
  - Defender slot offset `+0x38`: its countdown, set to 20 (`0x0014`) and cleared with `+0x36` once below 0 (`$8F:B00F`): 21 ticks. Previously written here as `+0x72`/`+0x74` set to 21; the code at `$8F:BA1A` writes `+$36`/`+$38` (docs/entities/combat.md §4, §10).
  - Defender slot offset `+0x76`: Pending damage accumulator (applied to HP via `$8F:C237`).
  - `$7E:2262` bit 0: Speed buff (boosts accuracy / hit chance).

---

## 1. Architectural Role & Combat Pipeline

When an attack hitbox (melee weapon slash or projectile) intersects an enemy or player hurtbox, the combat engine executes a 3-stage validation pipeline before modifying HP:

```mermaid
flowchart TD
    Intersect["Hitbox Intersect Detected ($8F:B5F2)"] --> Cooldown{"Cooldown Check ($8F:BA1A)"}
    Cooldown -->|"Same Attacker & Timer > 0"| Revert["Ignore Hit (Invulnerable)"]
    Cooldown -->|"Timer == 0 or New Attacker"| SetTimer["Set +0x36 = attacker, timer +0x38 = 20 ($0014): locked 21 ticks"]
    
    SetTimer --> Accuracy["Calculate To-Hit: to_hit_evade_vs_hit_rate ($8F:B75A)"]
    Accuracy --> NetChance["Net Accuracy = Base Hit Rate - Target Evade"]
    NetChance --> RNG["Roll Random Number via $80:859B"]
    RNG --> TestMiss{"Roll < Net Accuracy?"}
    TestMiss -->|No| MissPop["Set MISS Flag -> Pop 'MISS' Graphic ($80:B149)"]
    TestMiss -->|Yes| HitSuccess["Attack Connects!"]

    HitSuccess --> DamageCalc["physical_damage_into_pending_0x76 ($8F:C067)"]
    DamageCalc --> Accumulate["Write Damage into Defender Offset +0x76"]
    Accumulate --> ApplyHP["Execute $8F:C237 (Decrement HP & Trigger Hurt Animation)"]
```

### 1. 21-Frame Invulnerability Cooldown (`$8F:BA1A`)
- Prevents multiple damage ticks during a single attack animation swing.
- The strike sweep (`$8F:B62B`) skips a target whose `+0x36` (last attacker) is this attacker, so no roll happens.
  - `$8F:BA1A` records the attacker in `+0x36` and sets `+0x38` to 20 (`0x0014`); the target's tick clears both
    once `+0x38` passes 0 (`$8F:B00F`), so the lock lasts **21 ticks**.

### 2. To-Hit Accuracy & Evade Verification (`$8F:B75A`)
- Reads attacker Hit Rate from slot `+0x42` (typically 80%–95% depending on weapon).
- Subtracts target Physical Evade from slot `+0x44` (`$7E:0A3F`).
- Pulls a 16-bit pseudo-random value from `$80:859B` and keeps 15 bits (`& $7FFF`); the threshold is a word from the table at `$8F:BAAF` (row by evade, column by hit rate), not a percentage:
  - If `RNG & $7FFF < threshold`, the attack hits (chance = threshold / 32768).
  - If `RNG >= Net Accuracy`, the attack misses: carry is cleared and the routine triggers the floating `"MISS"` sprite popup.

### 3. Pending Damage Accumulation (`$8F:C067`)
- Computes gross weapon attack power, applies stamina scaling (from `$8F:86C0`), and subtracts armor defense.
- Clamps the minimum physical damage to 1 HP.
- Writes the result into defender field `+0x76`.
- Routine `$8F:C237` subsequently deducts `+0x76` from target HP and invokes knockback physics.

---

## 2. Disassembly & Annotations

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8FB75A](soe://rom/code/8FB75A?asm=1&c=0)


---

## 3. Reconstructed Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FB75A_to_hit_accuracy.c`](../../../reconstructed-c/8F/8FB75A_to_hit_accuracy.c).
> [View in VFS: soe://rom/code/8FB75A](soe://rom/code/8FB75A?c=1&asm=0)

