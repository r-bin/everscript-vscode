# Save Game NVRAM Serialization & Checksum Verification

> **ROM Bank**: `$8D` (Save/Load Engine), `$80` (Boot Validation `$80:8B6C`)  
> **Source Routines**: `$8D:C905` (`sram_verify_all_save_slots`), `$8D:B478` (`sram_compute_checksum`)  
> **Related Routines**: `$80:8B66` (Main loop entry), `$8E:A091` (Save slot selection screen)  
> **Hardware Memory**: SNES Battery-Backed SRAM (Bank `$30`, `$30:6000`–`$30:7FFF`)  
> **Memory Map**: `$7E:0B33` (Active slot mask bit), `$7E:0B37` (Slot SRAM base pointer), `$7E:0B39` (Valid slot bitfield mask, bits 0..3), `$7E:0B3B` (SRAM present flag)

---

## 1. Architectural Overview

*Secret of Evermore* utilizes battery-backed cartridge SRAM mapped into the SNES upper memory map at **Bank `$30`** (`$30:6000`–`$30:7FFF`). The engine supports **four discrete save files**, each storing the complete state of the campaign.

### Save Slot Memory Layout:
Each save slot occupies exactly **817 bytes** (`0x0331`), structured as a 2-byte 16-bit checksum header followed by an 815-byte (`0x032F`) game state payload:

| Save Slot | Base Address in Bank `$30` | Checksum Header | Payload Range | Length |
|---|---|---|---|---|
| **Header**| `$30:6000` | — | Global NVRAM initialization flag | 2 bytes |
| **Slot 1** | `$30:6002` | `$30:6002` | `$30:6004` – `$30:6332` | 817 bytes (`0x0331`) |
| **Slot 2** | `$30:6333` | `$30:6333` | `$30:6335` – `$30:6663` | 817 bytes (`0x0331`) |
| **Slot 3** | `$30:6664` | `$30:6664` | `$30:6666` – `$30:6994` | 817 bytes (`0x0331`) |
| **Slot 4** | `$30:6995` | `$30:6995` | `$30:6997` – `$30:6CC5` | 817 bytes (`0x0331`) |

### Key Subsystems:
1. **Boot-Time SRAM Validation (`$80:8B6C` & `$8D:C905`)**:
   - Immediately following CPU reset, the engine verifies whether battery SRAM hardware is connected by probing `$30:6001`.
   - The result is stored into `$7E:0B3B`.
   - Calls `$8D:C905` to scan all 4 save slots and verify their integrity.
2. **Rotational Checksum Algorithm (`$8D:B478`)**:
   - The checksum algorithm is an alternating 16-bit rotate-and-accumulate function.
   - **Seed**: Initialized to `0x043F`.
   - Over all 815 bytes of payload data, the accumulator rotates left by 1 bit (`ASL A`) between consecutive byte additions (`ADC $0000,x`).
   - The final 16-bit word is compared against the header word at the beginning of the slot.
3. **Slot Validity Bitfield (`$7E:0B39`)**:
   - As each slot passes verification, the engine asserts its corresponding bit in `$0B39`:
     - Bit 0 (`0x01`): Slot 1 valid
     - Bit 1 (`0x02`): Slot 2 valid
     - Bit 2 (`0x04`): Slot 3 valid
     - Bit 3 (`0x08`): Slot 4 valid
   - If a checksum fails, that slot's bit remains 0, prompting the UI to display the file as empty or corrupted.
4. **WRAM-to-SRAM State Serialization**:
   - During save point interactions (Inns, Save Monuments), the engine packs player stats into the slot:
     - Boy / Dog names and levels (`$7E:0A50`, `$7E:0A35`)
     - Equipped weapons, armor, and weapon skill experience
     - Active alchemy formula bitfield (`$7E:2258`) and ingredient counts (`$7E:22FF`–`$7E:2314`)
     - Story progression and treasure chest flags (`$7E:2280`–`$7E:237F`)

---

## 2. 65816 Assembly Implementation

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/808B6C](soe://rom/code/808B6C?asm=1&c=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/808B6C_save_system.c`](../../../reconstructed-c/80/808B6C_save_system.c).
> [View in VFS: soe://rom/code/808B6C](soe://rom/code/808B6C?c=1&asm=0)

