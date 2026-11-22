# Player Dash, Sprinting & Movement Control Subsystem

> **ROM Bank**: `$8F` (Code), `$80` (Physics/OAM integration), `$C3` (Slope Vector Dispatch)  
> **Source Routine**: `$8F:CD88` (`player_human_control_boy`), `$8F:CECC` (`player_human_control_dog`)  
> **Related Routines**: `$8F:B28D` (Entity physics integration), `$8C:ABED` (Weapon attack trigger), `$8F:CD78` / `$8F:CD4D` (Entity mode switches), `$C3:A3` (Slope metatile vector table)  
> **Memory Map**: `$0104` (held buttons minus acknowledged presses), `$0105` (its D-pad byte), `$0EB8` (the actor's `+$12`, copied by the entity tick), `$0EC6` (held buttons, `$4218`), `$0B23` / `$0B25` (run / action button of the control setup), `$05A7` (Active ring menu entity), `$05A9` (Ring menu mode bits), `$4EB7` (Boy stamina), `$4F65` (Dog stamina)

---

## 1. Architectural Overview

In *Secret of Evermore*, the active player character's movement is managed by dedicated per-frame dispatchers for the Boy (`$8F:CD88`) and the companion Dog (`$8F:CECC`). When an entity is selected as the primary camera focus (`$7E:0F42`), the engine diverts execution away from the autonomous follower AI routines (`$8F:D066` / `$8F:D0B0`) directly into these human control routines.

### Key Subsystems:
1. **Running** (checked against the ROM 2026-11-12; the C sketch in `reconstructed-c/8F/8FCD88_player_movement.c` predates this and does not match):
   - With a direction held in `$0104`, `$8F:CE7C` (Dog: `$8F:CFB5`) tests the run button `$0B23` (A in Configuration 1, B in 2) in `$0104` and jumps to the run step `$90:82A8`, else to the walk `$90:824B`.
   - The run step walks unless the Jaguar Ring is owned (`$2262` bit 1). Then it costs stamina (`+$2E`): the first frame halves it (`LSR`, `DEC`), later frames (`+$16` bit `$08` set) take 4; once it would go below 0 it is set to 0 and the run button is acknowledged (`TRB $0104` through `$80:8597`), so running on needs a new press. That is why players mash the run button.
   - `$8F:CD91` is not a sprint: while the actor's `+$12` bit `$0800` (attack started) is set and the action button `$0B25` is held at 100 % or more, the gauge **charges** by `$0A54 - 3` a frame up to `$0A52`.
2. **D-Pad Direction Filtering & Mapping**:
   - The directional nibble is extracted from `$0105 & $000F` (representing SNES D-pad Right, Left, Down, Up).
   - This nibble directly indexes direction table `$8F:CC0E,X` to establish the 16-way heading in character record field `+0x22` (`$4EAB` for Boy).
3. **Attack and Subsystem Arbitration**:
   - **Attack / talk (`$0B25`, B in Configuration 1)**: a new press (`TRB $0104` at `$8F:CE0D`) checks the metatile ahead for a B-trigger (attribute bit `$8000`), else starts a swing (`$8F:CE9C`: `+$12` bit `$0800`, then `select_attack_level_by_stamina`). Releasing it above 100 % fires the charged attack (`$8F:CE56`).
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

