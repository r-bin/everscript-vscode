# Dialogue Variable Token Expander & Word-Wrap Line Measurer ($8C:9E03 – $8C:A0C4)

> **Subsystem**: Dialogue Window, Proportional Font Layout & Variable Expansion Engine  
> **ROM Addresses**: `$8C:9E03` (`dialogue_format_and_append_line`), `$8C:9E44` (`dialogue_measure_line_width_loop`), `$8C:A01D` (`dialogue_token_dispatch_table`)  
> **Clean C Module**: `ui/string-digraphs.c`  
> **Recomp Symbols**: `func_8C9E03`, `func_8C9E44`  
> **Confidence**: Confirmed  

---

## 1. Architectural Role

When Secret of Evermore prints dialogue, notifications, or inspection cards, text strings can contain dynamic tokens, proportional-width characters, and automated word wrapping. The engine processes strings in Bank `$8C` through a two-phase line coordinator:

1. **Phase 1: Line Measurement & Variable Token Expansion (`$8C:9E44` – `$8C:9F65`)**:
   - Inspects each 8-bit character from source string descriptor in Direct Page `$22`–`$24`.
   - **Printable ASCII (`0x20`..`0x7F`)**: Looks up individual character kerning/stride from the proportional font width table pointed to by Direct Page `$92` (`$92`–`$94`), accumulating pixel width into register `$0A`.
   - **Whitespace & Control**:
     - `0x0A` (`\n`): Forces immediate line break.
     - `0x20` (` `): Commits word boundary and adds proportional space advance.
     - `0x09` (`\t`): Computes tab-stop column stride via `$8C:AAFA`.
   - **Variable Tokens (`0x80`..`0x8F`)**:
     - Jumps through jump table `$8C:9EFA`:
       - `0x81`: Expands to Boy's name (switches source pointer to WRAM `$7E:2210` / `$7E:2400`).
       - `0x82`: Expands to Dog's name (switches source pointer to WRAM `$7E:2234` / `$7E:2420`).
       - `0x83`: Expands to literal string `"player 3\0"` (`$8C:A087`, engine multiplayer leftover).
       - `0x84`: Expands to literal string `"player 4\0"` (`$8C:A0AF`, engine multiplayer leftover).
       - `0x8A` / `0x8B`: Injects dynamic decimal value tokens into window attribute buffer `$05B1`.
   - **Word-Wrap Evaluation**:
     - Tests total line width (`$0A + $0C`) against maximum window display width (`$0E,Y`).
     - If exceeding max width and a previous word boundary occurred, splits the line before the overflowing word.

2. **Phase 2: VRAM Glyph Blitting & Stream Commit (`$8C:9F6F`+)**:
   - Reruns stream to blit proportional 1bpp/2bpp character tiles into VRAM staging buffer `$7F:A000` for active dialogue windows.

---

## 2. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8C9E03](soe://rom/code/8C9E03?asm=1&c=0)


---

## 3. Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8C9E03_string_digraphs.c`](../../../reconstructed-c/8C/8C9E03_string_digraphs.c).
> [View in VFS: soe://rom/code/8C9E03](soe://rom/code/8C9E03?c=1&asm=0)


---

## 4. Verification & Behavioral Equivalence

| Test Condition | Assembly Logic | C Implementation | Status |
|---|---|---|---|
| Boy Token (`0x81`) | Points to `$7E:2210` via `$8C:A040` | `get_boy_name_buffer()` | Identical |
| Dog Token (`0x82`) | Points to `$7E:2234` via `$8C:A05B` | `get_dog_name_buffer()` | Identical |
| Player 3 Token (`0x83`) | Points to `"player 3\0"` (`$8C:A087`) | `STRING_PLAYER_3` | Identical |
| Player 4 Token (`0x84`) | Points to `"player 4\0"` (`$8C:A0AF`) | `STRING_PLAYER_4` | Identical |
| Newline (`0x0A`) | Branches directly to `$9F4E` break | Commits line and resets counters | Identical |
| Space (`0x20`) | Adds `$04,Y + $06,Y` to `$02` | Adds `space_width + kerning_pad` | Identical |
| Tab (`0x09`) | `$8C:AAFA` column stride lookup | `dialogue_calculate_tab_stop` | Identical |
| Proportional Glyph Width | Reads width from `[$92],Y` | `dialogue_get_glyph_width(ch)` | Identical |
| Word-Wrap Threshold | Exceeds `$0E,Y` window limit | Exceeds `layout->max_line_width` | Identical |
