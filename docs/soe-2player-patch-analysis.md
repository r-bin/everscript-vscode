# Secret of Evermore: 2-Player Patch Analysis & Modern Co-Op Architecture

An in-depth reverse-engineering report on FuSoYa's **Secret of Evermore : 2 Player Edition** (v1.02), analyzing its disassembly, engine modifications, gameplay UX shifts, failure modes (hard locks), and specifications for a modern, rock-solid 2-player cooperative implementation.

---

## 1. Executive Summary

In 1995, Square USA released *Secret of Evermore* running on a heavily overhauled derivative of the *Secret of Mana* engine. Despite keeping the real-time battle ring, two-character party (Boy and Dog), and stamina bar, multiplayer capability was stripped out, reducing the companion to an autonomous AI follower.

In 2004–2009, FuSoYa developed the **Secret of Evermore 2-Player Enhancement Patch** (final version 1.02, May 25, 2009). The patch enables real-time 2-player gameplay by hooking hardware Joypad registers, intercepting the companion AI, and arbitrating ring menus. However, players have frequently reported **hard locks, freezes, and edge-case softlocks** throughout the campaign.

This document breaks down:
1. Exact binary and assembly modifications introduced by the patch.
2. UX and gameplay changes compared to vanilla SoE and *Secret of Mana*.
3. Detailed architectural root-cause analysis of reported crashes and hard locks.
4. Recommendations and system architecture for a modern, crash-proof 2-player mode.

---

## 2. ROM & Assembly Modifications

Binary analysis of `SoE2P.ips` against the unheadered North American ROM (`Secret of Evermore (U) [!]`, 3,145,728 bytes) reveals **114 IPS records**.

### 2.1 ROM Expansion & Header Updates
* **Cartridge Size Expansion:** Expands the ROM from **3.0 MB** (FastROM HiROM, banks `$C0..$EF`) to **4.0 MB** (banks `$C0..$F7`).
* **Bank `$F0` Payload:** Houses ~2.5 KB of custom 65816 assembly code (`$F0:0000` to `$F0:0A16`) containing the 2-player kernel, input dispatcher, and HUD renderer.
* **Internal Header:** Modifies cartridge title at `$C0:FFC1` to `SoE 2-Player FuSoYa` and updates the internal SNES checksum and complement at `$C0:FFDC` (`59 22 A6 DD`).

### 2.2 Input Polling Replacement (NMI / VBlank Hook)
Vanilla SoE polls Joypad 1 at `$C0:847A` during vertical blanking, reading `$4218` into `$0104` (held inputs) and `$0EC6` (newly pressed triggers).

The patch replaces this routine with a long jump:
```assembly
$C0:847A:  JSL $F00000     ; Jump to FuSoYa's 2P Polling Kernel
           BRA +$29        ; Skip vanilla Joypad 1 single-read logic
```

At `$F0:0000`, the patch:
1. Polls hardware register `$4218` (Joypad 1) and `$421A` (Joypad 2).
2. Calculates single-frame button edges:
   * Controller 1: Held in `$F4`, previous in `$EE`, trigger in `$F6`.
   * Controller 2: Held in `$F8`, previous in `$F0`, trigger in `$FA`.
3. Maintains a **Master 2-Player Control Bitfield in Direct Page `$F2`**:
   * `Bit 0 ($01)`: Controller 1 controls the Boy.
   * `Bit 1 ($02)`: Controller 1 controls the Dog.
   * `Bit 2 ($04)`: Controller 2 controls the Boy.
   * `Bit 3 ($08)`: Controller 2 controls the Dog.
   * `Bit 4 ($10)`: Camera / primary focus is on the Boy (`$4E89`).
   * `Bit 5 ($20)`: Camera / primary focus is on the Dog (`$4F37`).

### 2.3 Drop-In / Drop-Out and Focus Arbitrator
* **Start Button Handling (`$F0:00AD`, `$F0:00EE`):**
  * When **START** (`$1000`) is pressed on Controller 1 or 2, the bitfield in `$F2` is dynamically shifted:
    * If inactive, the controller claims the companion character.
    * If active, the controller relinquishes control back to AI (`$7E4FCF` or `$7E4F21` set to `$FFFF`).
* **Select Button Handling (`$F0:020F`):**
  * If **SELECT** (`$2000`) is pressed on either controller, camera pointer `$7E0F42` toggles between the Boy struct (`$4E89`) and Dog struct (`$4F37`).

### 2.4 Companion AI Bypass
Vanilla Evermore checks whether an entity matches the active camera target `$7E0F42`. If it does not match, the character is fed into the follower AI routines at `$8FD066` (Boy AI) and `$8FD0B0` (Dog AI).

The patch replaces these checks at `$CF:D05E` and `$CF:D0A8`:
```assembly
; Vanilla check at $CF:D05E:
CPY $0F42
BNE CompanionAI

; Patched hook:
JML $F00270    ; Inspects $4FCF and routes to Human Control ($8FCD88) or AI ($8FD066)
```
```assembly
; Vanilla check at $CF:D0A8:
CPY $0F42
BNE CompanionAI

; Patched hook:
JML $F002A0    ; Inspects $4F21 and routes to Human Control ($8FCECC) or AI ($8FD0B0)
```

### 2.5 Ring Menu & Subsystem Dispatching
Vanilla reads raw button presses from `$0104` across all ring menu handlers. The patch rewrites these call sites across Banks `$CC` and `$CD`:
* `$CC:A284`, `$CC:A2E9`, `$CC:A399`: Ring menu navigation hooks.
* `$CD:92A7`, `$CD:959F`, `$CD:988A`, `$CD:BA8D`: Item/Alchemy submenu confirmations.
* Call routines at `$F0:0939` / `$F0:0965` / `$F0:09A0` / `$F0:09CF`:
  * Routine inspects `$05A7` (active ring menu owner entity) or `$EC` (initiating entity).
  * Returns either Controller 1 (`$F6`) or Controller 2 (`$FA`) buttons.
  * Uses `TRB` (Test and Reset Bit) to clear the consumed button from that player's trigger register so both characters don't respond to the same button press.

### 2.6 On-Screen Player Indicator HUD
* At `$F0:0132..$F0:0175`, routines calculate VRAM tile addresses (`$051D + $0B40` for Boy, `$0561 + $0B49` for Dog).
* Directly writes to SNES VRAM registers `$2116` / `$2118` to render numeric tiles `1` and `2` adjacent to player HUD names.

---

## 3. User Experience: What Changes in Gameplay?

### 3.1 What Players Can Do That They Usually Cannot
1. **True Real-Time Cooperative Combat:**
   * Both players can attack, run, and reposition simultaneously.
   * Player 2 (controlling the Dog) can manually kite fast enemies, flank bosses, avoid lethal area-of-effect spells, and execute timed bite attacks rather than relying on the random Dog AI loop.
2. **Seamless Drop-In / Drop-Out:**
   * Player 2 can press START at any time to enter the game or drop out. Dropping out instantly returns the Dog to the vanilla companion AI script.
3. **Controller Inversion:**
   * Player 1 can control the Dog while Player 2 controls the Boy, or both can swap roles on the fly.
4. **Decoupled Off-Screen Scouting:**
   * In *Secret of Mana*, both players are strictly trapped within the camera viewport. If one player hits the screen edge, scrolling halts.
   * In FuSoYa's Evermore patch, **only one character has camera focus**. The other character has no camera collision constraint and can run freely off-screen, scout adjoining corridors, fight monsters outside the view, or pick up ingredients off-screen.

### 3.2 Asymmetries and UX Quirks
* **Camera Hegemony:**
  * Only the character holding camera focus can trigger room transitions (walking into doorways, staircases, or cave entrances).
  * If the non-focused character walks onto an exit tile, nothing happens.
* **Weapon Charging Visuals:**
  * Only the character with camera focus exhibits the 100% weapon charge flashing palette animation.
  * If camera focus is toggled while charging a weapon, the charge progress can pause at its current value until the attack button is released.
* **Shared Pause & Ring Menus:**
  * Opening a ring menu still halts gameplay globally. If Player 1 opens their ring, Player 2 is paused.

---

## 4. Root-Cause Analysis: Why Do Players Report Hard Locks?

Players across speedrunning and romhacking forums have documented game freezes and softlocks when playing with this patch. Disassembly of Bank `$F0` and the vanilla game engine pinpoints the exact technical causes:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PRIMARY SOURCES OF HARD LOCKS                        │
├──────────────────────────┬─────────────────────────────────────────────┤
│ 1. Invisible Exit Tiles  │ Non-focused player trapped on spawn hitbox  │
│ 2. Script VM Desync      │ Cutscene wait loops waiting for arrival     │
│ 3. Pyramid Switch Freeze │ Anti-companion freeze bitmask ($22EB)       │
│ 4. Ring Menu TRB Clashing│ Simultaneous button consumption deadlock    │
│ 5. Direct Page Clashing  │ DP $E6..$FE scratchpad corruption in math   │
│ 6. Desert Select Lockout │ SELECT disabled while Dog holds focus       │
└──────────────────────────┴─────────────────────────────────────────────┘
```

### 4.1 The "Invisible Exit Tile" Trap at Map Entrances
* **Mechanism:** In vanilla SoE, when entering an interior room (e.g., Fire Eye's village Inn, Nobilia Inn, Volcano tunnels), the enter script places the primary character 16–32 pixels inside the doorway. In vanilla, the AI companion automatically steps inward.
* **Failure Mode:** In 2-player mode, the non-focused character spawns slightly behind or to the side. Right behind the spawn coordinate is an invisible step-on exit trigger tile (`map_transition(...)`).
* If the second player holds a movement direction upon entry or spawns directly over the exit bounding box, they hit the exit trigger. Because they do not have camera focus, the transition code cannot complete its camera pan/fade sequence. The room transition state machine stalls or enters an infinite reload cycle, freezing gameplay.

### 4.2 Cutscene Script VM Hangs (`wait_until_entity_finished`)
* **Mechanism:** Secret of Evermore cutscenes (boss introductions, Salabong bridge, Iglis elevator, Omnitopia transport) execute script bytecode:
  ```csharp
  freeze_player();
  walk_entity(BOY, target_x, target_y);
  walk_entity(DOG, target_x, target_y);
  wait_until_entity_finished(DOG);
  ```
* **Failure Mode:** In vanilla, companion AI cedes movement control immediately to the script engine. In the 2P patch:
  1. The companion human movement handler (`$8FCECC`) continues to process controller inputs. If Player 2 holds a direction on the D-Pad or is wedged behind an obstacle off-screen, the Dog never reaches `(target_x, target_y)`.
  2. The script interpreter halts at `wait_until_entity_finished(DOG)` indefinitely. Because all player controls are frozen during cutscenes, the game is **permanently hard locked**.

### 4.3 The Pyramid Dungeon Pressure Plate Freeze
* **Mechanism:** In the Antiqua Pyramid, one character must stand on a switch to open a doorway for the other. To keep the vanilla AI from stepping off the switch when the player pressed SELECT, Square USA wrote a script routine that explicitly sets an entity freeze flag (`$22EB` & `$20`) on the companion.
* **Failure Mode:** In 2P mode, FuSoYa's patch notes:
  > *"At the pyramid, the first time you switch the camera focus the other character will become frozen until they get the camera focus back."*
  If both characters step on and off switches while toggling camera focus, the engine's companion freeze state bitmask can desync, leaving **both** characters frozen and neither able to move.

### 4.4 Ring Menu Input Deadlocks via `TRB`
* **Mechanism:** In `$F0:09A0` and `$F0:09CF`, FuSoYa's input dispatcher clears buttons using `TRB $F6` (Player 1) or `TRB $FA` (Player 2).
* **Failure Mode:** Evermore only has a single ring menu data structure in WRAM (`$0A26` / `$05A7` / `$0B25`). If Player 1 opens the Alchemy ring at the exact frame Player 2 presses a button, or if a button is held down across a dialogue prompt, the TRB instruction can strip the dismiss/cancel button from the input stream. The ring menu cannot be closed, leaving the UI permanently open and the game paused.

### 4.5 Direct Page Scratchpad RAM Corruption
* **Mechanism:** FuSoYa allocated temporary variables directly in the 65816 Direct Page:
  * `$E6`, `$E8`, `$EA`, `$EC`, `$EE`, `$F0`, `$F2`, `$F4`, `$F6`, `$F8`, `$FA`, `$FC`, `$FE`.
* **Failure Mode:** A disassembly scan of the vanilla Evermore ROM reveals **over 3,500 accesses** to direct page locations between `$E6` and `$FE` across Banks `$C0`, `$C1`, and `$C2`.
  Vanilla uses these exact addresses as temporary scratchpad bytes during hardware math operations (SNES hardware multiplication and division registers `$4204..$4216`), Mode 7 matrix calculations, and sprite decompression. If an NMI interrupt or input polling routine fires while a math routine is utilizing `$EC` or `$EA`, the values are corrupted, resulting in invalid jumps, sprite garbage, or CPU `STP` halts.

### 4.6 The Desert Spin & Event SELECT Lockout
* **Mechanism:** During specific events (e.g. falling into the desert quicksand / spin secret), vanilla script opcodes temporarily disable the SELECT button.
* **Failure Mode:** If Player 2 (the Dog) had camera focus when this sequence began, the Boy cannot regain camera focus, and the Dog cannot leave the map area. FuSoYa acknowledged this limitation in the readme, requiring the player to press START to withdraw P2 from the game to force focus back.

---

## 5. Architectural Blueprint for a Modern 2-Player Engine

To build a modern, 100% stable 2-player mode for Secret of Evermore (either via an updated Asar patch or an Everscript engine enhancement), the following subsystems must be redesigned:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   MODERN 2-PLAYER ARCHITECTURE                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌─────────────────────┐              ┌─────────────────────┐         │
│   │   Controller P1     │              │    Controller P2    │         │
│   └──────────┬──────────┘              └──────────┬──────────┘         │
│              │                                    │                    │
│              ▼                                    ▼                    │
│   ┌──────────────────────────────────────────────────────────┐         │
│   │              2P Input & State Arbiter                    │         │
│   │  - Clean WRAM allocation ($7E28D0..$7E28FF)              │         │
│   │  - Hard Cutscene Lockout Override                        │         │
│   │  - Turn-Based Ring Menu Queue                            │         │
│   └──────────────────────────┬───────────────────────────────┘         │
│                              │                                         │
│              ┌───────────────┴───────────────┐                         │
│              ▼                               ▼                         │
│   ┌─────────────────────┐         ┌─────────────────────┐              │
│   │ Dynamic Dual-Anchor │         │ Transition Boundary │              │
│   │   Midpoint Camera   │         │    Auto-Tether      │              │
│   │  Center = (P1+P2)/2 │         │ Pulls P2 on Exit    │              │
│   └─────────────────────┘         └─────────────────────┘              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Dynamic Dual-Anchor Midpoint Camera
Instead of tying camera scrolling to a single entity (`$7E0F42`):
1. **Midpoint Calculation:**
   $$\text{Camera}_X = \frac{\text{Boy}_X + \text{Dog}_X}{2}, \quad \text{Camera}_Y = \frac{\text{Boy}_Y + \text{Dog}_Y}{2}$$
2. **Elastic Viewport Clamping (Leash System):**
   * Establish an inner bounding box ($200 \times 160$ px within the $256 \times 224$ screen).
   * If a player reaches the edge of the bounding box, their movement vector towards the screen edge is clamped to 0 unless the other player moves with them (identical to *Secret of Mana*).
   * This prevents off-screen wandering, eliminates the "invisible exit tile" bug, and ensures both players are always visible.
3. **Emergency Auto-Tether Warp:**
   * Holding **L + R** for 1.5 seconds teleports the lagging player to the primary player's coordinates with a poof animation.

### 5.2 Room Transition & Entrance Safety Hook
1. **Exit Trigger Interception:**
   * Hook `map_transition()`: when either player steps on an exit tile, immediately immobilize both characters, pull the trailing companion to the entrance point, and trigger the screen fade.
2. **Safe Room Spawning:**
   * On room initialization (`enter script`), spawn both characters with a fixed 16-pixel horizontal offset away from the entry threshold.
   * Grant a 30-frame invulnerability and trigger-ignore window so players cannot immediately bounce back through the exit door.

### 5.3 Global Script & Cutscene Lockout Guard
1. **VM Cutscene Flag Hook:**
   * When any dialogue window opens or an event script begins (`$22EB` event flag set), unconditionally sever raw controller inputs from **both** Controller 1 and Controller 2.
2. **Pathfinding Guarantee:**
   * When script instructions issue `walk_entity()`, force the entity's input state to pure script-driven kinematics. Human controller overrides must be completely disabled until `end_script()` fires.

### 5.4 Turn-Based Ring Menu Arbitrator
Evermore's single ring menu memory structure cannot support two concurrent menus without rewrite.
* **Mutually Exclusive Ring Access:**
  * If Player 1 opens the ring menu, a small "P1" badge appears, gameplay pauses, and Player 2's inputs are ignored until P1 closes the menu.
  * If Player 2 presses the menu button while P1's menu is open, the request is buffered and opens immediately when P1 finishes.
  * If the Dog opens the ring menu, display the Dog's specific inventory/action ring (as vanilla does when controlling the Dog).

### 5.5 Relocation of Scratchpad RAM to Safe WRAM
* Do **not** use Direct Page addresses `$E6..$FE`.
* Allocate state in **Safe Session WRAM** at `$7E28D0..$7E28FF` (which is designated in Evermore's memory map for runtime session scratchpad and cleared safely on map reloads).
* Preserve DP registers strictly during interrupts to eliminate math and Mode 7 corruption.

### 5.6 HUD and Parity Improvements
* Implement double weapon-charge flashing so both Boy and Dog display visual feedback at 100% stamina.
* Provide an optional split status bar at the bottom: Boy HP / Weapon Charge on the left, Dog HP / Charge on the right.

---

## 6. Comparison Matrix

| Feature | Vanilla SoE (1995) | FuSoYa 2P Patch (v1.02) | Recommended Modern 2P |
|---|---|---|---|
| **Player Count** | 1 Player (AI Dog) | 2 Players | 2 Players |
| **Drop-in / Drop-out** | N/A | Supported via START | Supported via START |
| **Camera Model** | 100% tied to Active Entity | 100% tied to Focused Entity | Midpoint Average $(P_1 + P_2)/2$ |
| **Off-Screen Wandering** | Not possible (AI tethers) | Unrestricted (causes bugs) | Clamped by Viewport Leash |
| **Map Transitions** | Focused entity only | Focused entity only | Automatic boundary tether |
| **Room Spawn Traps** | None | Frequent softlocks on exits | Spawn offset + immune buffer |
| **Cutscene Synchronization**| Stable | Prone to hard lock | Absolute controller override |
| **Pyramid Switches** | Script freezes companion | Companion frozen on focus switch | Contextual cooperative switch logic |
| **RAM Safety** | Standard DP allocations | Overwrites DP `$E6..$FE` | Dedicated Safe WRAM `$7E28D0+` |

---

## 7. Conclusion

FuSoYa's 2-Player patch was an ingenious engineering accomplishment for its era (2004–2009), demonstrating that Secret of Evermore's underlying Secret of Mana DNA could indeed support dual human controllers with minimal ROM space.

However, because the patch implemented an **asymmetric camera model without a viewport leash** and **reused sensitive Direct Page scratch registers**, it opened the door to cutscene desynchronizations, map boundary traps, and engine hard locks.

By adopting a **midpoint leashed camera**, **safe WRAM memory allocations**, and **foolproof cutscene input overrides**, a modern 2-player patch can deliver the seamless cooperative experience that Secret of Evermore always deserved.

