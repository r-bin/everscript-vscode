# Public Patches Analysis: Secret of Evermore

An in-depth technical analysis of the existing public patches and reverse-engineering tools in a local `public patches` folder (not in the repo).

This document answers:
1. **What exists for the game already?**
2. **What do they modify in ROM and WRAM?**
3. **Why were they created (what design, mechanical, or technical problem do they solve)?**

---

## 1. Inventory of Public Patches & Tools

| Folder / File | Author | Purpose / Type | Patch Size / Records | ROM Header |
|---|---|---|---|---|
| `soe102/` | FuSoYa | 2-Player Cooperative Gameplay (v1.02) | 114 IPS records (524 KB payload, expands ROM to 4MB) | **Headered** (`.smc`) |
| `secret_of_evermore_gameplay_balance_patch_1_1/` | Ninakoru | Major Gameplay Rebalance & Bugfix Suite (v1.1) | 243 IPS records (2,657 bytes changed) | Both Headered & Unheadered |
| `Evermore25AnniversaryBal_qfyd10/` | Master Knight DH | 25th Anniversary Survival Balance & Hit Roll Rework | 573 IPS records (4,236 bytes changed) + Hit Roll (271 bytes) | **Unheadered** (`.sfc`) |
| `Secret of Evermore Faster Magic.7z` | Community | 4x–5x Spell Leveling Acceleration | 1 IPS record (9 bytes changed at `$C4:5B9C`) | **Unheadered** (`.sfc`) |
| `SoE_ABswap_v100/` | mziab | Menu A/B Button Swap to standard SNES layout (v1.00) | 27 IPS records (52 bytes changed) | **Headered** (`.smc`) |
| `SoE_DebugMenu/` | XaserLE | Developer Debug Ring Menu Rebuild (v1.0–v1.3) | 38 IPS records (expands ROM to 4MB, hooks at `$CEA3EA`) | **Unheadered** (`.sfc`) |
| `Comparer-SoE-x64/` | xeth | SaveRAM & Savestate Comparison Utility | Standalone 64-bit Windows utility with guides | N/A (SRM / Savestate) |
| `RAMsetta Stone SoE.html` | phonymike | Complete WRAM-to-SRAM Memory Mapping Specification | Reference HTML document | N/A (Documentation) |
| `sram-doc.txt` | John David Ratliff | SRAM Memory Layout & Sanity Check Algorithm | Reference Text document | N/A (Documentation) |

---

## 2. FuSoYa's 2-Player Cooperative Patch (v1.02)

*Directory: `soe102/` (`SoE2P.ips`)*

### Why was it created?
*Secret of Evermore* was developed by Square USA on a codebase derived from *Secret of Mana*. *Secret of Mana* is renowned for its 3-player cooperative combat. However, *Secret of Evermore* shipped as single-player only: the companion dog was relegated to simple follower AI, switchable only via the Select button. FuSoYa developed this patch in 2004–2009 to restore full cooperative 2-player multiplayer.

### What does it modify?
- **ROM Size:** Expands ROM from 3.0 MB (HiROM `$C0..$EF`) to 4.0 MB (`$C0..$F7`).
- **Input Polling Hook (`$C0:847A`):**
  Replaces vanilla single-controller joypad polling with a long jump:
  > **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/C45B9C](soe://rom/code/C45B9C?asm=1&c=0)

- **Bank `$F0` Payload (`$F0:0000..$F0:0A16`):**
  - Reads hardware registers `$4218` (Joypad 1) and `$421A` (Joypad 2).
  - Maintains master 2-player control state in Direct Page `$F2`:
    - Bit 0 (`$01`): Controller 1 controls the Boy (`$4E89`).
    - Bit 1 (`$02`): Controller 1 controls the Dog (`$4F37`).
    - Bit 2 (`$04`): Controller 2 controls the Boy.
    - Bit 3 (`$08`): Controller 2 controls the Dog.
    - Bit 4 (`$10`): Camera focus is on the Boy.
    - Bit 5 (`$20`): Camera focus is on the Dog (`$7E0F42`).
- **Companion AI Bypass (`$CF:D05E` and `$CF:D0A8`):**
  Replaces the vanilla check (`CPY $0F42 : BNE CompanionAI`) with jumps to `$F00270` and `$F002A0`, allowing human input to drive whichever character does not hold camera focus.
- **Ring Menu Dispatching (Banks `$CC` and `$CD`):**
  Replaces button reads across ring menu handlers (`$CC:A284`, `$CD:92A7`, etc.) to query `$05A7` (ring owner) and consume buttons using `TRB` so both players do not trigger the same action.
- **HUD Player Indicator (`$F0:0132`):**
  Writes tile numbers `1` and `2` to SNES VRAM at `$2116` / `$2118` adjacent to character names.

### Known Limitations & Quirks
- **Camera Anchor Restriction:** Only the character with camera focus can exit rooms or trigger area transition scripts.
- **Pyramid Switch Softlock:** In the pyramid, switching camera focus leaves the other character frozen on floor switches (original vanilla anti-drift behavior).
- **Dialogue Ownership:** Prior to v1.02, dialogues (such as the desert skeleton boat) checked the last interacting entity rather than the speaker, sometimes confusing player inputs.
- *Detailed analysis available in [docs/soe-2player-patch-analysis.md](../soe-2player-patch-analysis.md).*

---

## 3. Ninakoru's Gameplay Balance Patch 1.1

*Directory: `secret_of_evermore_gameplay_balance_patch_1_1/`*
*Variants: Standard Mode & Hard Mode, available for both US ROM and Spanish Translation ROM (`es`), headered and unheadered.*

### Why was it created?
Vanilla *Secret of Evermore* suffers from severe pacing, balance, and combat design issues:
1. **Subtractive Defense Imbalance:** Damage is `Attack * Multiplier - Defense`. A Level 3 weapon charge dealt 4x base damage, which against high-defense enemies didn't just deal 4x damage—it dealt 10x to 20x damage, rendering Level 1 and 2 attacks completely useless.
2. **Dogcasting Exploit:** Players could initiate alchemy spells while the Boy was attacking, trapped, or running, bypassing spell cast animations by opening menus through the Dog.
3. **Magic Leveling Grind:** Leveling all 30+ alchemy spells required repetitive grinding, casting each spell dozens of times.
4. **Dog Stat Dominance:** The Dog's natural Defense growth (+6 per level) made him a nearly invincible physical tank by mid-game.
5. **Infinite Stat Stacking Bugs:** Stat-buff spells (like Atlas) could be stacked infinitely or permanently saved onto the character upon death/resurrection.

### What does it modify?
- **Weapon Charge Multipliers:**
  - Vanilla: Level 1 = `1.0x`, Level 2 = `2.0x`, Level 3 = `4.0x`.
  - Patched: Level 1 = `1.0x`, Level 2 = `1.75x`, Level 3 = `2.75x`.
- **Shared Weapon Class EXP:**
  - Every 4th kill with an equipped weapon grants EXP to *all* other weapons of that type (Sword, Axe, Spear), including weapons not yet obtained.
- **Alchemy Gating (Dogcast Elimination):**
  - Requires the Boy to have **100% weapon stamina charge** to cast alchemy. Casting immediately resets Boy weapon stamina to 0%, introducing tactical pacing.
- **Shared Magic Experience (5 Spell Schools):**
  - Spells are divided into 5 categories: Physical Attack, Elemental Attack, Healing, Stat Boost, and Utility.
  - Casting a spell shares EXP across its school at logarithmic cast thresholds (2, 4, 8, 16, 32, 64 casts).
- **Stat Growth Adjustments:**
  - Dog Defense growth: Reduced from `+6.0` to `+3.5` per level.
  - Dog Attack growth: Reduced from `+4.0` to `+3.5` per level.
  - Dog Magic Defense: Reduced from `+1.0` to `+0.5` per level.
  - Boy Magic Defense: Reduced from `+1.0` to `+0.75` per level.
  - Toaster Dog Bonus: Reduced from `+80 ATK / +250 DEF` to `+70 ATK / +180 DEF`.
- **Evasion Hard Cap:**
  - Evasion capped at `64%` (prevents Speed buff and dog agility from reaching 100% physical invulnerability).
- **Barrier Nerf:**
  - Duration slashed from 45 seconds to 30 seconds.
  - Catalyst ingredient changed from common Limestone to rare **Atlas Amulet**, eliminating free invulnerability loops.
- **Bugfixes Integrated:**
  - Fixes emulator sound delay in the SPC700 sound driver.
  - Fixes stat magic wear-off routine to stop infinite Atlas boost accumulation.
  - Fixes Miracle Cure failing to dispel Confound reverse-movement status.
  - Integrates Assassin17's 3rd-party fixes: unlimited Bazooka ammo bug, Silver Sheath passive leak bug, and Bazooka Level 1 base stats.
- **Hard Mode Additions:**
  - Enemies and bosses receive +50% HP, +10% Hit Rate, +25% Attack, and +25% Magic Damage (applied *before* defense subtraction, resulting in 40–50% effective extra damage).

---

## 4. Master Knight DH's 25th Anniversary Balance Patch

*Directory: `Evermore25AnniversaryBal_qfyd10/`*
*Files: `Evermore-AnniversaryBal.ips` (Full Patch, 573 records), `Evermore-HitRollChange.ips` (Hit Roll ASM, 3 records)*

### Why was it created?
Created in 2020 by Master Knight DH to celebrate the game's 25th anniversary, following a YouTube survival challenge playthrough (no ingredient purchasing). The patch reframes *Secret of Evermore* as a resource-management survival adventure while rebalancing physical combat, smoothing boss RNG spikes, and cutting exploration tedium.

### What does it modify?
- **Hit Roll Recalculation ASM (`Evermore-HitRollChange.ips`):**
  - Re-engineers the 65816 hit/accuracy check routines between `$0FB92C` and `$0FB9AF`.
  - Simplifies the cumbersome vanilla calculation, freeing over **1 KB of ROM space** used to house the rest of the patch.
- **Dog Sniffing Mobility ("Power Walk"):**
  - In vanilla SoE, the Dog's sniffing animation crawls at a fraction of walking speed, creating severe exploration tedium.
  - The patch increases sniffing velocity to normal walking speed ("power walk"), drastically improving dog gameplay viability.
- **Targeting Flags & Spell Buff Reductions:**
  - Forced Single-Targeting: Barrier, Cure, Energize, Reflect, Regrowth, Confound, Regenerate, and Aura are forced to single-target, preventing zero-penalty multi-buffing.
  - Shield forced to all-target.
  - Barrier duration reduced from 45s to **10 seconds**; Aura reduced from 30s to 20s.
  - Regenerate auto-revival status duration cut from 2 minutes to **30 seconds**.
- **Linear Magic Scaling (Grind Reduction):**
  - Level 9 spell level requires only the number of casts previously needed for Level 5.
  - Damage multiplier curve across spell levels changed to a linear slope rather than an exponential spike, discouraging grinding.
- **Boss RNG Smoothing:**
  - **Thraxx:** Acid Rain Might reduced from 50 to 40. Heart bonus damage multiplier changed from `{1, 2, 9, 10}` to `{4, 5, 6, 7}` (maintains 5.5 average while eliminating catastrophic high rolls).
  - **Verminator:** Chance of double-casting instant-kill single-target Explosion reduced from `5/16` to `3/16`. Drain and Acid Rain increased to `6/16`.
- **Combat & Hitbox Geometry:**
  - Axe Level 2 attack hitbox extended northward so it can reliably reach the Face boss without crossing barrier lines.
  - Bone Crusher and Sword frame data accelerated.
  - Heavy Bazooka mobility bonus removed.

---

## 5. Faster Magic Patch

*Directory: `Secret of Evermore Faster Magic.7z`*
*File: `Secret of Evermore Faster Magic.IPS` (22 bytes total)*

### Why was it created?
In vanilla *Secret of Evermore*, leveling alchemy spells requires an extraordinary amount of grinding: each cast awards only 1 to 10 points toward the 100 points required per level, slowing down to a crawl at higher levels. This patch accelerates spell progression by 4x–5x without altering spell damage or enemy health.

### What does it modify?
- Targets exactly **9 bytes** at HiROM address `$C4:5B9C` (file offset `0x045B9C` in unheadered ROM):

| Spell Level Range | Vanilla EXP Award per Cast | Patched EXP Award per Cast | Speedup Factor |
|---|---|---|---|
| Level 0 → 1 | `10` (`0x0A`) | `50` (`0x32`) | **5.0x** |
| Level 1 → 2 | `5` (`0x05`) | `20` (`0x14`) | **4.0x** |
| Level 2 → 3 | `4` (`0x04`) | `16` (`0x10`) | **4.0x** |
| Level 3 → 4 | `3` (`0x03`) | `12` (`0x0C`) | **4.0x** |
| Level 4 → 5 | `2` (`0x02`) | `8` (`0x08`) | **4.0x** |
| Level 5 → 6 | `2` (`0x02`) | `8` (`0x08`) | **4.0x** |
| Level 6 → 7 | `1` (`0x01`) | `4` (`0x04`) | **4.0x** |
| Level 7 → 8 | `1` (`0x01`) | `4` (`0x04`) | **4.0x** |
| Level 8 → 9 | `1` (`0x01`) | `4` (`0x04`) | **4.0x** |

---

## 6. mziab's A and B Button Swap (v1.00)

*Directory: `SoE_ABswap_v100/`*
*File: `SoE_ABswap_v100.ips` (27 records, 52 bytes changed)*

### Why was it created?
*Secret of Evermore* adopted *Secret of Mana*'s non-standard control layout: **B** confirms and **A** runs / cancels. In almost every other SNES RPG (*Final Fantasy*, *Chrono Trigger*, *Super Mario RPG*), **A** confirms and **B** cancels / runs. While Evermore's in-game config menu allowed swapping buttons during exploration, menu navigation and dialog confirmations were hardcoded to B = Confirm.

### What does it modify?
- **Menu Input Bitmasks:** Inverts bit testing for A (`$0080` / `$01`) and B (`$8000` / `$80`) across menu validation routines in Bank `$C0`.
- **Default Config:** Forces save games to initialize with Control Config 2.
- **UI & Font Graphics:** Replaces the on-screen "B" button prompt sprite with an "A" button graphic in save menus, alchemy setup rings, and action menus.
- **Dialog Strings:** Updates textual prompts ("Press B") to match the new buttons.

---

## 7. XaserLE's Debug Menu Rebuild (v1.0–v1.3)

*Directory: `SoE_DebugMenu/`*
*Files: `debug_menu_v1.0.asm` through `v1.3.asm`, corresponding `.ips` files*

### Why was it created?
During development, Square USA built an extensive in-game debug ring menu allowing developers to warp across maps, toggle clipping, spawn monsters, and max out equipment. Prior to retail release, Square locked this menu out by placing a return (`RTS`) opcode at `$CEA3EA`. XaserLE unlocked and rebuilt this debug ring, expanding the ROM and adding high-level cheat routines.

### What does it modify?
- **Unlocking the Menu:**
  > **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/C45B9C](soe://rom/code/C45B9C?asm=1&c=0)

- **Config Ring Hook (`$CE:9A86`):**
  Intercepts the routine loading the config ring and redirects it to extended ROM space (`$FE:0000`):
  > **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/C45B9C](soe://rom/code/C45B9C?asm=1&c=0)

- **Extended Ring Builder (`$FE:0000`):**
  Populates ring menu item array `$0F5A..$0F72` with 11 debug command IDs:
  1. Character Presets
  2. Dog Setup
  3. Atlas Boost
  4. Walk Through Walls (No-Clip)
  5. Miscellaneous Controls
  6. Event Flag Editor
  7. Spawn Enemy
  8. Unlock All Items
  9. Mode 7 Windwalker Flight
  10. Alchemy Unlocks
  11. Warp to Brian's Test Room / Map Select
- **No-Clip Routine (`$FE:0330`):**
  Disables character tile collision checks until the ring menu is reopened; prints the on-screen notice *"Clipping off until ring menu opened!"* via message handler `$8CC521`.
- **Full Equipment Routine (`$FE:0400`):**
  - Sets Boy and Dog Max HP to 999 (`$7E0A35`, `$7E0A7F`) and current HP (`$7E4EB3`, `$7E4F61`).
  - Sets Attack, Defense, Magic Defense, Evade %, and Hit % to 999.
  - Sets Levels to 99 (`$7E0A50`, `$7E0A9A`).
  - Writes 99 to all 35 ingredient slots (`$7E22FF..$7E2322`).
  - Sets Bazooka ammo to 99 (`$7E2345..$7E2346`).
  - Sets all 4 currencies to max (`$7E0AC6..$7E0AD0`).
  - Sets all weapon levels to Level 3:99 (`$7E0ADF..$7E0AF9`).
  - Unlocks all alchemy spells (`$7E2258`) and sets all alchemy levels to Level 9:99 (`$7E2F52..$7E2FD7`).
  - Unlocks all trade goods at quantity 99 (`$7E2517..$7E2533`).

---

## 8. Reverse Engineering & Save Tools

*Directory: `Comparer-SoE-x64/`, `RAMsetta Stone SoE.html`, `sram-doc.txt`*

### SramComparer (by xeth)
A 64-bit Windows utility (`SramComparer.exe`) designed to diff binary save states and battery `.srm` files. It includes markdown guides for tracking down unknown memory offsets between story flags and item pickups.

### John David Ratliff's SRAM Document (`sram-doc.txt`)
Documents the structure of the SNES cartridge battery SRAM (`512` bytes per save slot across 4 slots):
- Slot 1: `0x0002..0x0201`
- Slot 2: `0x0202..0x0401`
- Slot 3: `0x0402..0x0601`
- Slot 4: `0x0602..0x0801`
- Header: Byte `0x00` = Mono/Stereo, Byte `0x01` = Last Active Slot.
- **Sanity Check Algorithm:** Save data is validated via a 16-bit additive checksum covering slot bytes `0x0026..0x01FF`, compared against the stored word at `0x0024`.

### phonymike's RAMsetta Stone (`RAMsetta Stone SoE.html`)
The authoritative reference mapping live SNES WRAM (`$7E:0000..$7F:FFFF`) to SRAM save slot offsets. Demonstrates exact byte correspondence for Boy/Dog stats, weapon experience, alchemy formulas, ingredient counts, and story progression flags.

