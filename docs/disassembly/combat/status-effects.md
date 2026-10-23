# Status Effect Timers, Buff Stacking & Eviction Subsystem

> **ROM Bank**: `$91` (Status Engine & Handlers)  
> **Source Routines**: `$91:B632` (`status_effect_apply`), `$91:BC28` (`status_effects_tick_all`), `$91:B7FA` (`status_cleanup_caller`), `$91:B9A7` (`status_purge_slot`)  
> **Master Jump Table**: `$91:AE31` (8 bytes per status entry: tick, cleanup, outline bit, type)  
> **Entity Layout**: 4 status slots per entity at `+$46`, `+$4C`, `+$52`, `+$58` (6 bytes per slot: ID, Timer, Boost Param)  
> **Memory Map**: `$7E:15D2` (Silent cleanup flag, `$FFFF` = silent), `$7E:0FB2` (Active status tick counter), direct page `$60` (timer ptr), `$62` (param ptr)

---

## 1. Architectural Overview

Every combat entity in *Secret of Evermore* possesses **four dedicated status effect slots** in its character record. These slots manage both beneficial buffs (Atlas, Barrier, Defend, Reflect, Speed, etc.) and harmful ailments (Poison, Confound, Plague, Stun):

| Slot | Offset | ID Field | Timer Field | Parameter / Boost Field |
|---|---|---|---|---|
| **Slot 1** | `+$46` | `+0x00` (`+$46`) | `+0x02` (`+$48`) | `+0x04` (`+$4A`) |
| **Slot 2** | `+$4C` | `+0x00` (`+$4C`) | `+0x02` (`+$4E`) | `+0x04` (`+$50`) |
| **Slot 3** | `+$52` | `+0x00` (`+$52`) | `+0x02` (`+$54`) | `+0x04` (`+$56`) |
| **Slot 4** | `+$58` | `+0x00` (`+$58`) | `+0x02` (`+$5A`) | `+0x04` (`+$5C`) |

A slot is empty when its ID is `$FFFF`. Bit 15 of the status ID indicates the most recently applied status on that entity.

### Key Subsystems:
1. **Per-Frame Tick Dispatcher (`$91:BC28`)**:
   - Each frame during active gameplay, the engine iterates over all 4 status slots for active entities.
   - Non-empty slots decrement their 16-bit countdown timer.
   - Dispatches execution through master jump table `$91:AE31,X` based on status ID.
   - When a timer expires, execution falls directly into that status's cleanup handler.
2. **Status Application & Eviction Priority (`$91:B632`)**:
   - When a spell or item inflicts a status effect, the engine searches the 4 slots in strict priority:
     1. **Refresh**: If a slot already holds the *same* status ID, the timer is refreshed to max.
     2. **Empty Slot**: If any slot is `$FFFF`, the status occupies the empty slot.
     3. **Eviction**: If all slots are full, the engine selects the *first slot holding a buff that is not the most recent*.
     4. **Failure**: If no eligible slot can be evicted, the status application fails.
3. **The Vanilla "5 Status Effects" Bug (`$91:B7FA`)**:
   - During eviction, `$91:B7FA` is supposed to clean up the displaced status before overwriting it.
   - However, the vanilla code loaded `LDX $02` (which held the **new** incoming status ID) rather than the evicted status ID!
   - As a result, the old buff's stat boosts (e.g. Atlas attack multiplier) and outline glow were never reverted, remaining permanently stacked on the character.
4. **Cleanup Protocol (`$91:B9A7`)**:
   - Reverts stat modifications (e.g. subtracts boost from base stats, recalculates derived attributes via `$8F:8398`).
   - Clears the character's outline glow bit in `$9A,X` via `$90:C9B2`.
   - Clears the slot to `$FFFF` and zeroes the timer and parameter fields.
   - If `$15D2 == 0`, prints "*... has worn off*" message via `$8C:C521`.

---

## 2. 65816 Assembly Implementation

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/91B632](soe://rom/code/91B632?asm=1&c=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/91/91B632_status_effects.c`](../../../reconstructed-c/91/91B632_status_effects.c).
> [View in VFS: soe://rom/code/91B632](soe://rom/code/91B632?c=1&asm=0)

