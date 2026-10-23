# Enemy AI Behavioral State Machine & Leash Radius ($8F:CD17, $8F:D34B, $8F:D69B, $8F:D6FB)

> **Subsystem**: Enemy Combat AI & Behavioral Dispatcher  
> **ROM Addresses**: `$8F:CD17` (`enemy_ai_dispatcher`), `$8F:D34B` (`enemy_ai_roaming_chaser`), `$8F:D69B` (`enemy_ai_check_aggro`), `$8F:D6FB` (`enemy_ai_stationary_turret`)  
> **Clean C Module**: `entities/enemy-ai.c`  
> **Jump Table**: `$8F:CBE0` (15 AI behavior pointers)  
> **Confidence**: Confirmed

---

## 1. Architectural Role

In Secret of Evermore, enemy AI is executed natively in 65816 assembly (Bank `$8F`), rather than via an interpreted scripting bytecode:
- **Dispatcher (`$8F:CD17`)**: Each entity in WRAM holds an offset into the ROM character table at `entity +0x60`. Every frame, the dispatcher reads `LDA $8E0003,X` to fetch the 16-bit behavior index (`0, 2, 4, ..., 28`) and jumps through the master table at `$8F:CBE0`.
- **Standard Roaming / Chasing Monster (`$8F:D34B`, Index `0x00`)**: Drives 53 monster types (Raptors, Oglins, Son of Set, Hedgadillos, Sand Spiders, Bad Boys, etc.). Monsters roam within their spawn leash radius (`entity +0x40`), test target proximity against their `aggro_range` (`character +0x13`), and advance along 8/16-angle vectors towards the player.
- **Aggro Filter Pipeline (`$8F:D69B` – `$8F:D6FA`)**:
  1. **Stamina Gate**: An enemy will *never* initiate an aggro charge or attack cycle if its stamina `+0x2E` is below `0x0400` (100%).
  2. **RNG Dice Roll**: Calls engine RNG (`$80:859B`) and requires `rand(0..255) < aggro_chance` (`character +0x15`).
  3. **Target Proximity Test (`$8F:D6CE`)**: Tests Boy (`$0F3E`) and Dog (`$0F40`). If HP > 0 and horizontal distance $|dx| < \text{range}$ and vertical distance $|dy| < \text{range}$, the target is acquired.
  4. **Target Acquisition**: Stores target pointer in `entity +0x24`, faces target via `$80:ADF0`, and sets combat action state `+0x78`.
- **Stationary Plant / Turret Hazard (`$8F:D6FB`, Index `0x08`)**: Drives 12 immobile enemies (Wimpy Flower, Carniflower, Thraxx Claws, Stone Cobra). They remain rooted, evaluate the aggro pipeline, and fire projectile lunges, spits, or claw strikes when targets enter reach.

---

## 2. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8FCD17](soe://rom/code/8FCD17?asm=1&c=0)


---

## 3. Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FCD17_enemy_ai.c`](../../../reconstructed-c/8F/8FCD17_enemy_ai.c).
> [View in VFS: soe://rom/code/8FCD17](soe://rom/code/8FCD17?c=1&asm=0)

