# Player Dash, Sprinting & Movement Control Subsystem

> **ROM Bank**: `$8F` (Code), `$80` (Physics/OAM integration), `$C3` (Slope Vector Dispatch)  
> **Source Routine**: `$8F:CD88` (`player_human_control_boy`), `$8F:CECC` (`player_human_control_dog`)  
> **Related Routines**: `$8F:B28D` (Entity physics integration), `$8C:ABED` (Weapon attack trigger), `$8F:CD78` / `$8F:CD4D` (Entity mode switches), `$C3:A3` (Slope metatile vector table)  
> **Memory Map**: `$0104` (Joypad 1 raw buttons), `$0105` (Filtered direction / D-pad), `$0EB8` (Held buttons), `$0EC6` (Trigger edge), `$05A7` (Active ring menu entity), `$05A9` (Ring menu mode bits), `$4EB7` (Boy stamina), `$4F65` (Dog stamina)

---

## 1. Architectural Overview

In *Secret of Evermore*, the active player character's movement is managed by dedicated per-frame dispatchers for the Boy (`$8F:CD88`) and the companion Dog (`$8F:CECC`). When an entity is selected as the primary camera focus (`$7E:0F42`), the engine diverts execution away from the autonomous follower AI routines (`$8F:D066` / `$8F:D0B0`) directly into these human control routines.

### Key Subsystems:
1. **B-Button Sprinting / Dash**:
   - The engine checks whether the **B button** (`$0800`) is held in register `$0EB8`.
   - Sprinting is **gated by a 100% full stamina gauge**: stamina must be at or above `0x0400` (`1024` raw units) in `$4EB7` (Boy) or `$4F65` (Dog) to initiate a sprint.
   - While dashing, the engine drains stamina at **3 units per tick** (`adc #$FFFD`). If stamina drops below the minimum threshold, dash speed is forfeited and the character drops to normal walk speed.
2. **D-Pad Direction Filtering & Mapping**:
   - The directional nibble is extracted from `$0105 & $000F` (representing SNES D-pad Right, Left, Down, Up).
   - This nibble directly indexes direction table `$8F:CC0E,X` to establish the 16-way heading in character record field `+0x22` (`$4EAB` for Boy).
3. **Attack and Subsystem Arbitration**:
   - **Attack (A Button)**: Evaluates trigger edge `$0EC6 & $0080` to initiate weapon charge or swing via `$8C:ABED`.
   - **Ring Menus (Y / X Buttons)**: Tests `$0104 & $4000` (Y button - Boy ring menu) or `$0104 & $0040` (X button - Dog ring menu). Writing the entity pointer into `$05A7` and asserting bits `0x0002` or `0x0004` in `$05A9` suspends gameplay and opens the radial menu.
4. **45-Degree Collision Slopes**:
   - When a character walks into an angled metatile surface (diagonal stone paths, stairs, hillsides), metatile classification invokes jump table `$C3A3,x`.
   - The engine applies a normalized slope guide vector that resolves diagonal movement into proportional X/Y sub-pixel velocity components, preventing jerky snagging against terrain contours.

---

## 2. 65816 Assembly Implementation

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8FCD88](soe://rom/code/8FCD88?asm=1&c=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8F/8FCD88_player_movement.c`](../../../reconstructed-c/8F/8FCD88_player_movement.c).
> [View in VFS: soe://rom/code/8FCD88](soe://rom/code/8FCD88?c=1&asm=0)

