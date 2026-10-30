# Compiling Decompiled C into the SNES Memory Map: HiROM Architecture & Decomp Lessons

> **Context**: An architectural guide on how decompiled/reconstructed C source files bind to and compile
> into the SNES physical memory map (specifically **HiROM / Mode 21** for *Secret of Evermore*), drawing
> direct lessons from [`snesrev/zelda3`](https://github.com/snesrev/zelda3), [`snesrev/sm`](https://github.com/snesrev/sm),
> and modern 65816 C toolchains.
>
> **Status (2026-10-24):** the linker script in §5.1 is conceptual and was never run. Measured
> constraints for a ROM whose WRAM must equal vanilla (cycle-exact code; Calypsi's
> direct-page pseudo-registers) are in [c-to-rom.md §7a](c-to-rom.md#7a-measured-a-c-built-rom-must-be-cycle-exact-to-keep-wram-per-frame).
>
> **Related Reading**:
> - [asm-to-c-port.md](asm-to-c-port.md) — The Secret of Evermore ASM-to-C pipeline roadmap.
> - [incremental-decomp-guide.md](incremental-decomp-guide.md) — Step-by-step function decompilation with `snesrecomp`.
> - [../recomp/game-rtl.md](https://github.com/r-bin/SecrefOfEvermoreRecomp/blob/develop/docs/game-rtl.md) — Game Runtime Layer (Game RTL) glue architecture.
> - [../disassembly/PROGRESS.md](../disassembly/PROGRESS.md) — Engine decompilation status and WRAM census.

---

## 1. The Core Problem: C Memory Models vs. SNES 65816 Hardware

In modern C programming, the compiler assumes a **flat, linear virtual address space** (32-bit or 64-bit)
where any pointer can dereference any byte in memory, and variables are placed into standard sections
(`.text`, `.rodata`, `.data`, `.bss`) managed by the operating system.

In contrast, the **SNES 65816 CPU** operates on a **segmented 24-bit bus ($00:0000 – $FF:FFFF)** with:
1. **Physical Banking**: A 24-bit address is split into an 8-bit Bank Byte and a 16-bit Offset.
2. **Dynamic Register Widths**: Accumulator (`A`) and Index registers (`X`, `Y`) switch dynamically between
   8-bit and 16-bit modes at runtime via `REP` and `SEP` instructions.
3. **Hardware-Hardcoded Memory Regions**:
   - Work RAM (WRAM): 128 KB ($7E:0000 – $7F:FFFF), with the first 8 KB mirrored into banks $00–$3F and $80–$BF.
   - Direct Page (DP): Any 256-byte window (usually $00:0000 – $00:00FF) accessible with fast 1-byte addresses.
   - Hardware Stack: Fixed to Page 1 ($00:0100 – $00:01FF, only 256 bytes total!).
   - Memory-Mapped I/O (MMIO): PPU registers ($2100–$213F), CPU/DMA registers ($4200–$437F).

When decompiling an SNES game into C, or writing new C routines intended to cooperate with original assembly,
**how do the C files compile into and interact with this memory map?**

There are two primary paradigms in the SNES reverse-engineering community:

| Paradigm | Exemplars | Compilation Target | Memory Map Role |
|---|---|---|---|
| **A. Native C Source Port** | `snesrev/zelda3`, `snesrev/sm`, `snesrecomp` | Native Desktop / Switch / Web (`x86_64`, `ARM64`, `WASM`) | Simulated in C runtime; global WRAM arrays + pointer macros / struct overlays |
| **B. Native 65816 ROM Target** | Calypsi C, GCC-65816, WDC 816, Asar C injection | Playable `.sfc` SNES cartridge ROM | Physical hardware bus; Linker script maps sections into HiROM ROM banks & WRAM |

Both approaches require a rigorous method for mapping C identifiers to SNES bus addresses.

---

## 2. Deconstructing `snesrev/zelda3`: How It Binds C to the Memory Map

The [`snesrev/zelda3`](https://github.com/snesrev/zelda3) project reverse-engineered *The Legend of Zelda: A Link to the Past*
into clean, portable C. Studying how `zelda3` manages memory reveals key architectural patterns:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        snesrev/zelda3 C Codebase                       │
│                                                                        │
│   src/player.c          src/dungeon.c         src/overworld.c          │
│   (Link logic)          (Room rendering)      (Scroll & transitions)   │
│         │                     │                      │                 │
│         └─────────────────────┼──────────────────────┘                 │
│                               ▼                                        │
│                     src/variables.h                                    │
│       #define link_x_coord (*(uint16*)(g_ram + 0x22))                  │
│       #define main_module_index (*(uint8*)(g_ram + 0x10))             │
│                               │                                        │
│                               ▼                                        │
│                     src/zelda_rtl.c                                    │
│       uint8 g_ram[131072];             // 128 KB WRAM                  │
│       const uint8 *g_asset_ptrs[165];  // Loaded ROM tables            │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                                ▼
         Runtime Emulation Layer (LakeSnes / PPU / APU)
```

### 2.1 WRAM Representation: The Global Array & Macro Binding Pattern
Instead of allocating separate C global variables (e.g. `uint16_t link_x_coord;`), which would allow the host
compiler to reorder, pad, and scatter variables arbitrarily across system memory, `zelda3` defines a single
flat array for the 128 KB of SNES Work RAM:

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/FF/FFFFFF_c_compilation_hirom_memory_map.c`](../../reconstructed-c/FF/FFFFFF_c_compilation_hirom_memory_map.c).
> [View in VFS: soe://rom/code/FFFFFF](soe://rom/code/FFFFFF?c=1&asm=0)


In `src/variables.h`, each named variable from the original disassembly is defined as a macro casting an offset
into `g_ram`:

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/FF/FFFFFF_c_compilation_hirom_memory_map.c`](../../reconstructed-c/FF/FFFFFF_c_compilation_hirom_memory_map.c).
> [View in VFS: soe://rom/code/FFFFFF](soe://rom/code/FFFFFF?c=1&asm=0)


**Why this pattern is powerful**:
1. **Zero Layout Drift**: Memory layout remains 100% identical to the original SNES cartridge.
2. **Lockstep Verification**: At the end of every frame, the entire `g_ram` array can be compared
   byte-for-byte against an emulator running the original ROM. If Link takes damage or moves, the exact same
   bytes change at the exact same offsets.
3. **Natural C Syntax**: Gameplay code in `player.c` writes `link_x_coord += 2;`, which compiles into a direct
   read/modify/write at `g_ram + 0x22`.

### 2.2 ROM Data Separation: Assets vs. Code (`assets.h` & `restool.py`)
In the original SNES ROM, code and data tables are interleaved across cartridge banks. `zelda3` decouples them:
- Code is manually translated into C functions.
- Game data (graphics, collision tables, room headers, audio samples) is extracted by an offline Python tool
  (`assets/restool.py`) into an external package (`zelda3_assets.dat`).
- In `src/assets.h`, data tables are declared as pointers indexed into an asset table:
  ```c
  extern const uint8 *g_asset_ptrs[kNumberOfAssets];
  #define kDungeonRoom        ((uint8*)g_asset_ptrs[3])
  #define kDungeonRoomHeaders ((uint8*)g_asset_ptrs[6])
  ```
- This keeps the C repository clean of copyrighted binary blobs while maintaining direct pointer dereferencing.

### 2.3 The LoROM Quirk in `zelda3`
*A Link to the Past* is a **LoROM (Mode 20)** game.
- In LoROM, ROM banks are only 32 KB each ($8000–$FFFF). The lower 32 KB ($0000–$7FFF) is reserved for system
  registers, direct page, and mirrors.
- If a data table spans across a 32 KB boundary, 65816 code must increment the bank byte and reset the offset
  from `$FFFF` back to `$8000`.
- In `zelda3`, the authors had to write special address normalization functions (`SimpleHdma_GetPtr()`) to handle
  these split 32 KB pointer tables.

---

## 3. HiROM (Mode 21) Memory Map: Architecture & Advantages

*Secret of Evermore* is a **HiROM (Mode 21)** game (and specifically expanded via ExHiROM).
Understanding the HiROM memory map is critical for designing our C memory layout.

### 3.1 HiROM Cartridge Bus Layout

```text
Bank Offset:   $0000          $6000          $8000          $FFFF
               ┌──────────────┬──────────────┬─────────────────────┐
Banks $C0-$FF: │              Full 64 KB ROM per bank              │ (Mode 21 HiROM)
               ├──────────────┴──────────────┼─────────────────────┤
Banks $80-$BF: │ System Area (DP, Stack, MMIO)│ FastROM Mirror      │ (Upper 32 KB mirrors $C0-$FF)
               ├─────────────────────────────┼─────────────────────┤
Banks $00-$3F: │ System Area (DP, Stack, MMIO)│ SlowROM Mirror      │ (Upper 32 KB mirrors $C0-$FF)
               ├─────────────────────────────┴─────────────────────┤
Banks $7E-$7F: │ 128 KB Linear WRAM ($7E:0000 - $7F:FFFF)          │
               ├──────────────┬──────────────┬─────────────────────┤
Banks $30-$3F: │              │ Battery SRAM │                     │ ($30-$3F:6000-7FFF)
               └──────────────┴──────────────┴─────────────────────┘
```

### 3.2 Key Differences: HiROM vs. LoROM for C Compilers

| Feature | LoROM (Mode 20, e.g. Zelda 3) | HiROM (Mode 21, e.g. Secret of Evermore) | Advantage for C Code |
|---|---|---|---|
| **ROM Bank Size** | 32 KB per bank ($8000–$FFFF) | **64 KB continuous per bank ($0000–$FFFF)** | **Huge**: C arrays and structs up to 64 KB never break across bank boundaries. |
| **Bus-to-Offset Formula** | `((bank & 0x7F) * 0x8000) + (addr - 0x8000)` | `((bank & 0x3F) << 16) \| addr` | **Clean Bitshift**: Address conversion requires no modulo or subtraction. |
| **Pointers in Tables** | 16-bit pointers always have bit 15 set (`>= 0x8000`) | 16-bit pointers span full `$0000–$FFFF` | Standard 16-bit C pointers map 1:1 to bank offsets. |
| **WRAM Access** | Lower 8 KB mirrored at `$0000–$1FFF` | Same mirror, but banks $C0–$FF span full 64 KB | Cleaner separation of code and data banks. |

### 3.3 HiROM Bus Address to ROM Offset Translation
Because banks `$C0–$FF` map linearly to ROM offsets `$000000–$3FFFFF`, translating a 24-bit SNES bus address
to a flat file offset in C is straightforward:

```c
static inline uint32_t SnesBusToRomOffset(uint32_t snes_addr) {
    uint8_t bank = (snes_addr >> 16) & 0xFF;
    uint16_t offset = snes_addr & 0xFFFF;

    // Standard HiROM banks $C0-$FF:
    if (bank >= 0xC0) {
        return ((bank - 0xC0) << 16) | offset;
    }
    // FastROM mirrors $80-$BF ($8000-$FFFF):
    if (bank >= 0x80 && bank <= 0xBF && offset >= 0x8000) {
        return ((bank - 0x80) << 16) | offset;
    }
    // SlowROM mirrors $00-$3F ($8000-$FFFF):
    if (bank <= 0x3F && offset >= 0x8000) {
        return (bank << 16) | offset;
    }
    // ExHiROM (Secret of Evermore 4MB+ expansion in banks $40-$7D):
    if (bank >= 0x40 && bank <= 0x7D) {
        return 0x400000 | (((bank - 0x40) << 16) | offset);
    }
    return 0xFFFFFFFF; // Not a ROM address (e.g. WRAM or MMIO)
}
```

---

## 4. Paradigm A: The Source Port Approach (Zelda 3 & Evermore Game RTL)

If your goal is a native desktop or web executable (compiling with GCC, Clang, or MSVC) using the
recompiled/decompiled C code:

### 4.1 Memory Architecture Specification
We construct a unified memory abstraction layer:

```text
┌────────────────────────────────────────────────────────┐
│                   Global Memory State                  │
│                                                        │
│   uint8_t g_ram[0x20000];   // 128 KB WRAM             │
│   uint8_t g_sram[0x8000];   // 32 KB Battery Save RAM  │
│   uint8_t g_vram[0x10000];  // 64 KB Video RAM         │
│   uint8_t g_cgram[0x200];   // 512 B Palette Color RAM │
│   uint8_t g_oam[0x220];     // 544 B Sprite Object RAM │
└────────────────────────────────────────────────────────┘
```

### 4.2 Two Ways to Map Variables in C

#### Option 1: Macro Pointer Binding (The Zelda 3 Style)
Directly maps disassembled variable names to WRAM offsets.
```c
// Evermore Core Engine Variables
#define g_player_hp             (*(uint16_t*)(g_ram + 0x4EB3))
#define g_active_char_index     (*(uint8_t*)(g_ram + 0x05A7))
#define g_vram_lock_flag        (*(uint8_t*)(g_ram + 0x0F3A))
#define g_current_room_id       (*(uint16_t*)(g_ram + 0x0ADB))
#define g_joypad_edge_state     (*(uint16_t*)(g_ram + 0x0105))
```

#### Option 2: Typed Overlay Structs (Idiomatic C Style)
For complex subsystems with repeating records (like Evermore's 70-byte entity records at `$7E:4E45`):
```c
typedef struct EntityRecord {
    uint16_t world_x;          // +$18
    uint16_t world_y;          // +$1A
    uint16_t world_z;          // +$1C
    uint16_t current_hp;        // +$14
    uint16_t status_flags;     // +$16
    uint8_t  facing_direction; // +$22
    uint8_t  active_action_id; // +$23
    // ... total 0x70 (112 bytes)
} EntityRecord;

#define g_entity_pool ((EntityRecord*)(g_ram + 0x4E45))
#define g_boy_entity  (&g_entity_pool[0])
#define g_dog_entity  (&g_entity_pool[1])
```

### 4.3 Interfacing with `snesrecomp` (`hle_func`)
In our static recompiler setup (`tools/recomp/`), clean C decompiled functions replace recompiled assembly
functions one by one.

In `bankXX.cfg`:
```ini
hle_func func_8096bb_M0X0 = Decompiled_UpdateEntityPhysics
```

The C implementation receives the virtual CPU context:
```c
void Decompiled_UpdateEntityPhysics(CpuState *cpu) {
    // The C code directly reads/writes g_ram or cpu registers:
    EntityRecord *boy = &g_entity_pool[0];
    boy->world_x += (int16_t)cpu->x;
}
```

---

## 5. Paradigm B: Compiling C into a SNES ROM Binary (Targeting Hardware HiROM)

What if the goal is to **compile C code into a playable `.sfc` SNES ROM** (e.g. for a total conversion mod,
custom engine extension, or re-assembling the decomp back onto original hardware)?

Modern 65816 C compilers (such as **Calypsi 65816 C Compiler**, **GCC-65816**, or **WDC 816**) can compile
ISO C into 65816 machine code, but they require a **Linker Memory Configuration** that models HiROM.

### 5.1 HiROM Linker Script Architecture (`hirom.ld` / `linker.cfg`)

The linker script tells the compiler where to place code (`.text`), constants (`.rodata`), initialized
variables (`.data`), and uninitialized variables (`.bss`):

```ld
/* Conceptual Linker Configuration for SNES HiROM (Mode 21) */

MEMORY {
    /* Direct Page & Stack in Low RAM */
    ZEROPAGE:  start = $000000, size = $000100, type = rw; /* Virtual C registers: $00-$1F */
    STACK:     start = $000100, size = $000100, type = rw; /* Hardware Stack (Page 1) */

    /* Free Work RAM (WRAM Bank $7E) */
    WRAM_CORE: start = $7E0200, size = $001E00, type = rw; /* Mirror RAM */
    WRAM_USER: start = $7E2000, size = $00E000, type = rw; /* Main C .bss / .data */
    WRAM_EX:   start = $7F0000, size = $010000, type = rw; /* 64 KB Bank $7F staging */

    /* Battery-Backed SRAM */
    SRAM:      start = $306000, size = $002000, type = rw;

    /* HiROM Cartridge ROM Banks (64 KB each) */
    ROM_BANK_C0: start = $C00000, size = $010000, type = ro, fill = yes;
    ROM_BANK_C1: start = $C10000, size = $010000, type = ro, fill = yes;
    ROM_BANK_C2: start = $C20000, size = $010000, type = ro, fill = yes;
    ROM_BANK_C3: start = $C30000, size = $010000, type = ro, fill = yes;
    /* ... additional banks up to $FF ... */

    /* Cartridge Header & Interrupt Vectors (Bank $00 or $FF) */
    ROM_HEADER:  start = $00FFC0, size = $000040, type = ro;
}

SECTIONS {
    /* Virtual register file in Direct Page */
    .zeropage:  load = ZEROPAGE,  type = zp;

    /* C Stack frame & runtime memory */
    .bss:       load = WRAM_USER,  type = bss;
    .data:      load = ROM_BANK_C1, run = WRAM_USER, type = rw;

    /* Compiled C Machine Code placed into HiROM Bank $C0 */
    .text:      load = ROM_BANK_C0, type = ro;

    /* Read-Only Tables & Strings placed into Bank $C1 */
    .rodata:    load = ROM_BANK_C1, type = ro;

    /* Cartridge registration data & SNES Vectors */
    .snes_hdr:  load = ROM_HEADER,  type = ro;
}
```

### 5.2 The 65816 Dynamic Register Problem in C Compilers
On the 65816, instructions like `LDA #$1234` assemble to 3 bytes if `M=0` (16-bit Accumulator), but to 2 bytes
if `M=1` (8-bit Accumulator). A C compiler cannot generate code if register widths are variable!

To solve this, 65816 C compilers establish a strict **Application Binary Interface (ABI)**:
1. **Fixed Standard Width**: Functions are always entered and exited with `M=0` and `X=0` (16-bit A, 16-bit X/Y,
   via `REP #$30`).
2. **Direct Page Register File**: The compiler reserves `$00–$1F` in Direct Page to act as virtual 16-bit
   registers (`r0`, `r1`, `r2`... `r15`), because the 65816 only has 3 hardware data registers (`A`, `X`, `Y`).
3. **Software Stack Pointer**: The hardware stack is limited to 256 bytes ($0100–$01FF). A recursive C function
   or deep call graph will quickly overflow this. Compilers maintain a 16-bit software stack pointer in Direct
   Page (e.g. `sp` at `$00:0020`) that points into the 128 KB WRAM ($7E:2000+).

### 5.3 Near vs. Far Pointers in HiROM
In 65816 C, pointers come in two widths:
- `near` (16-bit pointer): Assumes the **Data Bank Register (`DBR`)** already points to the target bank.
  - **In HiROM, a 16-bit `near` pointer can address any byte within a full 64 KB bank!**
- `far` (24-bit pointer): Stores bank + 16-bit offset (`uint32_t` with high 8 bits ignored). Uses 65816 long
  addressing modes (`[long],y`) to access data anywhere in ROM or WRAM.

### 5.4 Hybrid Asar C Injection (The Romhacker's Bridge)
If you are modifying an existing assembly ROM without recompiling the entire game from scratch:
1. Compile your C file with Calypsi or GCC-65816 to a standalone binary or relocatable object.
2. In Asar assembly, insert the compiled C blob into an empty HiROM bank (e.g., expanded ExHiROM bank `$41`):
   > **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/FFFFFF](soe://rom/code/FFFFFF?asm=1&c=0)

3. Write an assembly **trampoline** to bridge between the original assembly caller and the C ABI:
   > **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/FFFFFF](soe://rom/code/FFFFFF?asm=1&c=0)


---

## 6. Concrete Comparison: How Decomps Handle the Memory Map

| Subsystem | `snesrev/zelda3` (LoROM Decomp) | `snesrecomp` (Evermore Recomp) | Hardware C (Calypsi / Asar HiROM) |
|---|---|---|---|
| **Compilation Host** | Native Host (GCC/Clang/MSVC) | Native Host (C99/SDL) | 65816 Target (SFC Cartridge) |
| **WRAM Access** | `g_ram[131072]` + Macro dereferences | `g_ram[131072]` + `CpuState` / HLE functions | Physical Bus $7E:0000–$7F:FFFF via linker |
| **ROM Banking** | Pre-extracted assets (`zelda3_assets.dat`) | Recompiled C code + loaded vanilla ROM | Segmented 64 KB banks (`$C0–$FF`) via linker `.cfg` |
| **Bank Boundary Crossing** | Handled manually with 32 KB page math | Flat host memory pointers | Automatic within 64 KB HiROM bank |
| **I/O & MMIO Registers** | Function call hooks (`zelda_ppu_write()`) | Emulated PPU / APU runner in Game RTL | Direct hardware memory mapping ($2100 / $4200) |
| **Verification Oracle** | Frame-by-frame WRAM diff against emu | Lockstep co-simulation (`npm run recomp:lockstep`) | SNES hardware / Mesen2 trace comparison |

---

## 7. Implementation Blueprint for *Secret of Evermore*

To transition Secret of Evermore's decompilation ([`docs/disassembly/PROGRESS.md`](../disassembly/PROGRESS.md)) into
a cleanly compilable C memory map:

### Step 1: Generate `variables.h` from our CDL & WRAM Maps
Our repository already contains the complete census of identified WRAM variables (in `docs/disassembly/engine-core/wram-map.md`
and `src/platform/cdl/wram-export.js`). We can automatically emit a `soe_variables.h`:
```c
#ifndef SOE_VARIABLES_H
#define SOE_VARIABLES_H

#include <stdint.h>

extern uint8_t g_ram[0x20000]; // 128 KB WRAM

// Auto-generated from CDL WRAM census:
#define g_vram_lock                 (*(uint8_t*)(g_ram + 0x0F3A))
#define g_current_room_id           (*(uint16_t*)(g_ram + 0x0ADB))
#define g_player_boy_ptr            (*(uint16_t*)(g_ram + 0x0F3E))
#define g_player_dog_ptr            (*(uint16_t*)(g_ram + 0x0F40))
#define g_weather_mode              (*(uint16_t*)(g_ram + 0x2439))
#define g_screen_shake_x            (*(uint16_t*)(g_ram + 0x2409))
#define g_screen_shake_y            (*(uint16_t*)(g_ram + 0x240B))

#endif
```

### Step 2: Implement the HiROM Asset Resolver
Like `zelda3`'s `restool.py`, implement an asset unpacker for Evermore that extracts ROM data tables
(alchemy definitions in bank `$C4`, room metatile headers in bank `$9F`, script dictionaries in bank `$8C`)
into structured C arrays.

### Step 3: Link Hand-Decompiled Functions to the Game RTL
As decompiled functions in `docs/disassembly/` are validated:
1. Add their prototypes to the recomp repository's `src/game_rtl.h`.
2. Hook them into `bankXX.cfg` using `hle_func`.
3. Verify behavioral equivalence using the existing lockstep harness:
   ```bash
   npm run recomp:lockstep
   ```

By adhering to this HiROM-optimized architecture, Secret of Evermore's decompiled C files achieve
**100% binary state fidelity** with the original hardware while remaining clean, maintainable, and portable.
