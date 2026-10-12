# Bugfixes & Engine Repairs in Secret of Evermore

A technical disassembly and root-cause analysis of the primary engine bugs in vanilla *Secret of Evermore* and the patches developed to repair them.

---

## 1. Overview of Known Vanilla Bugs & Patches

| Bug Name | Severity | Vanilla Root Cause | Fix / Patch | Target Code Address |
|---|---|---|---|---|
| **5 Status Effects Overflow** | Critical (Infinite stat stacking, stuck glow) | Eviction routine runs cleanup for the *new* status ID instead of the *evicted* status ID. | `five_status_effects_fix.asm` (Everscript) / [5-status-effects-bug.md](../5-status-effects-bug.md) | `$91:B7FA` |
| **Atlas Boost Retention** | High (Permanent attack inflation across saves/death) | Stat recalculation on death/revival or save does not decrement Atlas boost before updating base stats. | `assassin_atlas.ips` (Assassin17) / Ninakoru 1.1 | `$91:BD2D` (`$11BD2D`) |
| **Unlimited Bazooka Ammo** | High (Infinite heavy ammunition) | Selecting/swapping ammo types with 0 count underflows the ammo counter to 255. | `assassin_bazooka_ammo.ips` (Assassin17) / Ninakoru 1.1 | `$90:82E4` (`$1082E4`) |
| **Silver Sheath Passive Leak** | Moderate (Free +25% attack boost without item) | Attack calculation fails to check possession flag for the Silver Sheath charm (`$7E2261`). | `assassin_silversheath.ips` (Assassin17) / Ninakoru 1.1 | `$8F:8464` / `$8F:8480` |
| **Bazooka Charge Level 0** | Minor (Visual/stat display glitch) | Weapon charge logic initializes Bazooka at Level 0 rather than Level 1. | `assassin_bazooka_charge.ips` (Assassin17) / Ninakoru 1.1 | `$8D:A521` / `$8F:8057` |
| **Miracle Cure Confound Omission** | Minor (Fails to cure reverse-D-Pad control) | Spell cleanup bitmask omitted the Confound status bit. | Ninakoru Balance 1.1 | Spell effect table |
| **SPC700 Sound Latency** | Minor (Delayed sound effects on emulators) | Audio handshake routine introduces timing stalls during sample playback. | Ninakoru Balance 1.1 | Sound driver upload |

---

## 2. The 5 Status Effects Bug

*Documented in detail in [docs/5-status-effects-bug.md](../5-status-effects-bug.md) and fixed in `everscript/patches/five_status_effects_fix.asm`.*

### The Symptom
Each character entity in SoE supports up to 4 status slots. If a player casts 4 buffs (e.g. Atlas, Barrier, Defend, Speed) and then casts a 5th buff:
1. One of the old buffs is evicted from the entity's 4 status slots.
2. The evicted buff's statistical bonus (e.g. +ATK from Atlas, +DEF from Defend) **remains permanently active**.
3. The entity's colored outline glow continues cycling forever.
4. No *"… has worn off"* message ever appears.
5. Repeating this process allows players to stack bonuses infinitely until attack or defense reaches the 999 ceiling.

### The Status Slot Layout
Each entity struct contains 4 status slots of 6 bytes, starting at offset `+$46`:

| Slot Number | Status ID (`+$00`) | Expiry Timer (`+$02`) | Parameter / Boost (`+$04`) |
|---|---|---|---|
| **Slot 1** | `+$46` | `+$48` | `+$4A` |
| **Slot 2** | `+$4C` | `+$4E` | `+$50` |
| **Slot 3** | `+$52` | `+$54` | `+$56` |
| **Slot 4** | `+$58` | `+$5A` | `+$5C` |

`$FFFF` denotes an empty slot. Bit 15 indicates the most recently applied status.

### The Root Cause at `$91:B7FA`
When a 5th status is applied, the allocation routine at `$91:B632` searches for an empty slot. Finding none, it picks the first slot holding an older buff to evict. Before writing the new status, it calls a subroutine at `$91:B7FA` to silently clean up the existing buff:

```assembly
; Vanilla Code at $91:B7FA:
$91:B7FA:  STA $60          ; Save timer pointer of slot
           INC : INC
           STA $62          ; Save param pointer of slot
           LDX $02          ; <-- BUG: Loads $02 (the NEW status ID!), NOT the slot's ID!
           PHY : PHX
           LDA #$FFFF : STA $15D2   ; Set silent flag (suppress "worn off" message)
           JSR ($AE33,X)    ; Jumps to cleanup handler from table $91:AE31
           STZ $15D2
           PLX : PLY : STX $02
           RTS
```

Because `LDX $02` loads the **new** status ID rather than the status ID currently residing in the slot:
- When refreshing an existing buff (IDs match), it works correctly.
- When **evicting** an old buff (IDs differ), it runs the cleanup routine for the *new* status!
- The old status in the slot is brutally overwritten without ever reversing its stat bonus, clearing its timer, or stripping its outline glow bit.

### The Fix
The fix replaces `$91:B7FA` with a routine that loads the status ID actually occupying the slot:
1. Loads the evicted slot's ID into `X`.
2. Runs the proper cleanup handler at `JSR ($AE33,X)`.
3. Reverts the stat bonus, clears the outline glow bit via `$90:C9B2`, and logs the expiry.
4. Preserves scratch variable `$02` across the call.

---

## 3. Assassin17 Bugfix Suite

A collection of targeted 65816 assembly patches created by community reverse-engineer **Assassin17** in 2014–2015. These patches form the core bugfix foundation for subsequent balance hacks like Ninakoru's patch.

### 3.1 Atlas Boost Retention Bug (`assassin_atlas.ips`)
- **ROM Target:** `$91:BD2D` (Offset `0x11BD2D`, 78 bytes).
- **The Bug:** Atlas temporarily adds a percentage-based bonus to the Boy's base attack (`$7E0A3F`). When the buff expires naturally, a cleanup handler subtracts the bonus. However:
  - If the player saves at an inn or save point while Atlas is active, the inflated attack value is written to SRAM as the permanent base attack.
  - If the Boy or Dog dies while boosted and is subsequently resurrected (via Pixie Dust or Revive), the cleanup routine fails to decrement the boost before stats are recomputed.
  - Repeating this allows permanent attack inflation up to 999.
- **The Fix:** Hooks the death and save routines to explicitly purge active status effect bonuses from the base stat registers before calculating derived statistics or serializing to SRAM.

### 3.2 Unlimited Bazooka Ammo Exploit (`assassin_bazooka_ammo.ips`)
- **ROM Target:** `$90:82E4` (Offset `0x1082E4`, 117 bytes).
- **The Bug:** The Bazooka supports three ammunition types: Thunder Ball, Particle Bomb, and Cryo-Blast, stored at `$7E2345..$7E2347`. In vanilla SoE, if a player cycles through ammunition types when ammo count is `0`, a branch condition fails to clamp negative numbers, underflowing the 8-bit ammo byte to `255` (`$FF`), giving infinite heavy artillery.
- **The Fix:** Replaces the ammo cycle handler with a bounded decrement check that verifies inventory quantity $> 0$ before allowing selection or decrementing ammo counters.

### 3.3 Silver Sheath Passive Leak (`assassin_silversheath.ips`)
- **ROM Target:** `$8F:8464` and `$8F:8480` (Offset `0x0F8464` / `0x0F8480`, 53 bytes).
- **The Bug:** The Silver Sheath is a charm obtained in Gothica that is supposed to grant a passive +25% attack bonus to sword weapons. The vanilla damage calculation routine:
  ```assembly
  ; Vanilla logic at $8F:8480:
  LDA $7E2262      ; Charm bitfield
  AND #$0040       ; Test Silver Sheath bit
  ; BUG: Branch target executes attack boost regardless of flag state!
  ```
  In vanilla SoE, the conditional branch jumped to the wrong target, granting the +25% attack boost from the very start of the game even before the Silver Sheath was acquired.
- **The Fix:** Corrects the branch target so that the attack boost calculation is skipped unless bit `$40` of charm register `$7E2262` is explicitly set.

### 3.4 Bazooka Charge & Equipment Info (`assassin_bazooka_charge.ips`)
- **ROM Target:** `$8D:A521` and `$8F:8057` (Offsets `0x0DA521` and `0x0F8057`, 51 bytes).
- **The Bug:** When equipped, the Bazooka does not have standard melee charge levels (it fires shells based on ammo). However, the engine's weapon initialization routine assigned it Level 0 with uninitialized charge state, causing graphic glitches on the stamina ring and displaying corrupt weapon experience info in the status screen.
- **The Fix:** Forces the Bazooka to initialize with base Level 1, suppresses charging logic on the stamina ring, and cleanly formats weapon information.

---

## 4. Minor Engine Repairs

### Miracle Cure & Confound
- **The Bug:** Confound reverses D-Pad controls (Up moves Down, Left moves Right). The status recovery spell *Miracle Cure* was programmed to remove poison, sleep, and paralysis, but its status clearing mask omitted the Confound bit (`$7E0014`), forcing players to wait for the timer to expire even after casting high-level cure alchemy.
- **The Fix:** Updates the cure bitmask at the alchemy effect handler to include the Confound bit.

### SPC700 Sound Delay & Driver Synchronization
- **The Bug:** On hardware and accurate SNES emulators, audio sample streaming between the 65816 CPU and the SPC700 audio coprocessor would occasionally stall when sound effects were triggered during heavy DMA transfers (such as screen transitions or Mode 7 sequences), causing audible audio latency or missed notes.
- **The Fix:** Optimizes the audio command queue handshake in the sound driver upload block to prevent CPU-SPC700 race conditions.
