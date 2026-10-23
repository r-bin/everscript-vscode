# Dialogue Choice Box Frame Blitter & Joypad Branch Cursor Loop

**Addresses**:
- `window_box_frame_render`: `$8C:B647` – `$8C:B6C4`
- `dialogue_choice_joypad_cursor_loop`: `$8C:B81D` – `$8C:B98D`
- `dialogue_choice_character_append`: `$8C:B9A7` – `$8C:B9D5`

**ROM Source**: Bank `$8C` (US 1.0)  
**Subsystem**: UI / Dialogue Box & Name Entry Engine

---

## 1. Overview & Architectural Role

When Secret of Evermore prompts the player with in-game narrative decisions (e.g. answering "Yes" / "No" to NPCs, selecting alchemy formula targets, or entering character names during the opening intro), the UI subsystem switches to an interactive modal choice loop.

Key mechanisms:
1. **9-Slice Window Box Blitter (`window_box_frame_render`)**:
   Renders arbitrary rectangular window frames into shadow tilemap RAM (`$7F:C800`) using 8 border tile primitives (`0x0BF0`..`0x0BF7`). The routine leverages the SNES PPU hardware multiplier registers (`$4202`/`$4216`) to compute row strides ($Y \times 32$ tiles) in a single hardware cycle.
2. **Typematic Joypad Input Filter (`dialogue_choice_joypad_cursor_loop`)**:
   Configures fast UI auto-repeat timings (`$7E:0347 = 15` frames initial delay, `$7E:0349 = 5` frames sustained rate). Evaluates D-pad directions, updates cursor coordinates, ticks cursor sprite animation loops, and plays standardized audio feedback cues:
   - D-Pad navigation: Cursor tick SFX `0x0003`.
   - B Button / Selection: Option select SFX `0x0040`.
   - Start Button / Confirmation: Menu chime SFX `0x0012`.
3. **Character Name Entry & String Append (`dialogue_choice_character_append`)**:
   Converts ASCII keys into internal 1-byte character table codes, appends glyphs to the player's name buffer (`$7E:0387`), and clamps to maximum allowable length.

---

## 2. Data Structures & Memory Layout

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CB647_dialogue_choice_box.c`](../../../reconstructed-c/8C/8CB647_dialogue_choice_box.c).
> [View in VFS: soe://rom/code/8CB647](soe://rom/code/8CB647?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CB647_dialogue_choice_box.c`](../../../reconstructed-c/8C/8CB647_dialogue_choice_box.c).
> [View in VFS: soe://rom/code/8CB647](soe://rom/code/8CB647?c=1&asm=0)

