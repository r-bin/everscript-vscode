# Engine Core & Main Loop Disassembly & Decompilation

This directory documents the lowest-level execution foundations of **Secret of Evermore (US)**: the cold/warm hardware reset handler, hardware register initialization, PPU/CPU register shadow synchronization, the NMI interrupt handler, and the top-level game main loop.

All analyses are derived from the clean retail ROM using CDL traces, Ghidra annotations, emulator runtime debugging (`snes9x2005-wasm` / `Mesen2`), and verified against the static recompilation (`snesrecomp`).

---

## Architecture & Execution Pipeline

```text
       Hardware Reset Vector ($00:FFE0 -> $00:8020)
                         │
                         ▼
             [boot-reset.md: reset_handler ($80:8020)]
             • Force blank ($2100 = $8F), switch to 65816 native mode
             • Stack pointer $1FFF, Direct Page $0000, Data Bank $80
             • Clear PPU & CPU hardware registers ($2101..$2133, $4200..$420D)
             • DMA clear 64 KB VRAM ($80:8008 -> $2118)
             • DMA clear 64 KB WRAM Bank $7E ($80:8008 -> $2180)
             • DMA clear 64 KB WRAM Bank $7F ($80:8008 -> $2180)
             • PPU shadow defaults ($0106 = $8F, $0110..$0120 = $FF)
             • Seed PRNG ($0133..$0139) via PPU H/V latches ($2137..$213D) XOR constants
             • Initialize sound / graphics sub-systems ($8C:8000, $80:B5B6, $8C:801F, $80:B72B)
             • Enable NMI + Auto-Joypad ($4200 = $81, mirror $0E6B)
                         │
                         ▼ JML $80:8B66
             [main-loop.md: main_loop_entry ($80:8B66)]
             • Initialize save / battery RAM check ($30:6001, $0B3B)
             • Handshake with SPC700 / APU ($8C:81FD)
             • Load initial map/room ($92:8002 -> $0ADB, call enter_room $8E:E4E2)
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
[main-loop.md: Per-Frame Loop]    [nmi-vblank.md: NMI Handler ($80:823A)]
 1. Wait for VBLANK ($80:858C)     1. Save CPU registers (A, X, Y, D, B)
    - Spin until $0100 changes     2. Acknowledge NMI ($4210), disable HDMA ($420C = 0)
 2. Clear frame transient flags    3. INIDISP PPU update ($0106 -> $2100)
 3. Execute actors & physics       4. Process VRAM DMA upload queue (if $0F3A == 0)
 4. Execute script VM turns        5. Flush PPU shadows (scroll/windows $010E..$0125)
 5. Queue graphics/DMA updates     6. Increment 32-bit frame counter ($0100, $0102)
 6. Repeat frame loop              7. Restore HDMA enable ($72 -> $420C)
                                   8. Await joypad auto-read ($4212 bit 0), store $4218
                                   9. Restore CPU registers and RTI
```

---

## File Breakdown

| Document | Topic & Focus | Key Addresses Covered |
|---|---|---|
| [boot-reset.md](boot-reset.md) | **Cold / Warm Boot & Hardware Init**: 65816 native transition, register wiping, VRAM/WRAM clearing DMA, PPU shadow setup, RNG seeding from hardware latches. | `$00:FFE0`, `$80:8020`, `$80:802D`, `$80:857F`, `$80:8227` |
| [main-loop.md](main-loop.md) | **Game Main Loop & Task Scheduling**: Initial boot orchestration, save data check, APU audio handshake, room enter dispatch, and the continuous frame update loop. | `$80:8B66`, `$80:8BB5`, `$80:8C70`, `$80:858C`, `$80:8F85` |
| [nmi-vblank.md](nmi-vblank.md) | **V-Blank Interrupt & PPU Transfer**: NMI dispatch, queue gating (`$0F3A`), PPU register shadow flush, frame timing counters, HDMA restoration, and controller auto-polling. | `$80:823A`, `$80:823E`, `$80:8265`, `$80:830C`, `$80:8460` |
| [wram-map.md](wram-map.md) | **Core Engine WRAM Structure**: C struct layout, address offsets, lifetimes, bitmasks, and cross-references for core frame variables. | `$7E:0100`..`$7E:013A`, `$7E:0E65`..`$7E:0EC6`, `$7E:0F3A`, `$7E:22EA` |

---

## Conventions & Register States

- **SNES Memory Model**: Secret of Evermore uses standard HiROM / ExHiROM mapping. Bank `$80` mirrors Bank `$00` in the `$8000`–`$FFFF` range with FastROM access cycle timing enabled.
- **Direct Page**: By convention throughout the engine core, Direct Page (`D`) is set to `$0000` (so direct page instructions access WRAM `$7E:0000`–`$7E:00FF`).
- **Data Bank**: Engine core routines run with Data Bank (`B`) set to `$80` or `$7E`. Routines explicitly switch `B` using `phb; pea $7E7E; plb; plb` when accessing upper WRAM structures.
- **Processor Widths**:
  - `rep #$30` (16-bit Accumulator, 16-bit Index registers X/Y) is the standard state for memory copies, 16-bit pointers, and coordinate math.
  - `sep #$20` (8-bit Accumulator, 16-bit Index) is set when reading or writing 8-bit SNES PPU/CPU hardware registers (`$2100`–`$213F`, `$4200`–`$421F`).

