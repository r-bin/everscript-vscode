# Dialogue Window & Text Box String Decoder Engine ($8C:CCF5, $8C:CD35, $91:D000)

> **Subsystem**: Dialogue Window & String Key Decompression Subsystem  
> **ROM Addresses**: `$8C:CCF5` (`decode_dialogue_string_key`), `$8C:CD35` (`decode_dialogue_string_key_secondary`), `$91:D000` (String Keys Master Table)  
> **Clean C Module**: `ui/dialogue-window.c`  
> **Recomp Symbol**: `func_CCCCF5_M0X0`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore manages all in-game text (NPC dialogue, item descriptions, alchemy names, menu labels) via a dictionary-compressed 3,002-entry string table:
- **String Keys Master Table (`$91:D000`)**:
  - 3 bytes per string key: 24-bit pointer/descriptor.
  - Bit 23 (`0x800000`): Compression flag (1 = dictionary/Huffman compressed, 0 = raw ASCII).
  - Bits 15..22: Target ROM bank index (typically `$C0..$C4`).
  - Bits 0..14: In-bank address offset.
- **Decompression Algorithm (`$8C:CCF5`)**:
  - Unpacks characters into WRAM text buffer `$7F:D81E` for active dialogue windows and font tile blitters.
  - Control Byte Parsing:
    - `0xC0`: Primary word dictionary pointer table (`$91:F46C`), data stream at `$91:F7D5`.
    - `(d & 0xC0) == 0xC0`: Secondary word dictionary table (`$91:F3EC`), data stream at `$91:F66C`.
    - `(d & 0xC0) == 0x40`: Literal plain ASCII string of length `d & 0x3F`.
    - `(d & 0xC0) == 0x80`: 2-byte digraph substitution table (`$91:F32E`).
    - `(d & 0xC0) == 0x00`: Single-character glyph table (`$91:F3AE`).
- **VM Opcode Trigger**: Script VM opcode `0x51` (`dialogue(key)`) invokes this decoder before rendering the dialogue frame and commencing the typewriter tile scroll.

---

## 2. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8CCCF5](soe://rom/code/8CCCF5?asm=1&c=0)


---

## 3. Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CCCF5_dialogue_window.c`](../../../reconstructed-c/8C/8CCCF5_dialogue_window.c).
> [View in VFS: soe://rom/code/8CCCF5](soe://rom/code/8CCCF5?c=1&asm=0)

