# Guide to Game Decompilation: From 65816 Assembly to Native C and ROMs

> A comprehensive handbook on reverse-engineering retro games (specifically SNES / 65816), comparing
> development timelines, architectural approaches, toolkits, memory mapping, and how to execute an LLM-assisted
> C decompilation.

---

## 1. Decomp Timelines & Feature Milestones

To understand how long a decompilation takes, we must look at commit histories and project lifecycles across both
manual C reimplementations, static recompilations, and assembly disassemblies.

| Project & Platform | Type | Primary Features | Active Dev Timeline (First commit to playable v1.0) | Effort & Team Size |
|---|---|---|---|---|
| **[snesrev/zelda3](https://github.com/snesrev/zelda3)** (SNES) | Manual C Reimplementation / Source Port | Native PC executable, 16:9 / 16:10 widescreen, MSU-1 audio, lockstep RAM verification mode, zero emulator latency | **~1.5 – 2 years** (2020 – May 2022 v1.0 release) | Core author (`snesrev`) + small testing/community team; ~75,000 lines of C |
| **[snesrev/sm](https://github.com/snesrev/sm)** (SNES) | Manual C Reimplementation / Source Port | Native PC port of *Super Metroid*, frame-by-frame memory lockstep verification, widescreen rendering, audio overhaul | **~1 – 1.5 years** (2022 – 2023) | Core author (`snesrev`); built faster using patterns established in `zelda3` |
| **[snesrev/smw](https://github.com/snesrev/smw)** (SNES) | Manual C Reimplementation | *Super Mario World* in C; supports Lunar Magic custom ROM hack loading | **~1 – 1.5 years** (2022 – 2024) | `snesrev` |
| **[BrianPugh/earthbound](https://github.com/BrianPugh/earthbound)** (SNES) | Manual C Port | Native PC port of *EarthBound* (Mother 2); leverages `ebsrc` disassembly | **~1.5+ years** (2023 – ongoing) | Small open-source contributor group |
| **[n64decomp/sm64](https://github.com/n64decomp/sm64)** (N64) | Byte-Matching C Decompilation | 100% byte-identical ROM match against original IDO compiler, spawned native PC port | **~1.5 – 2 years** (2018 – Sept 2019) | Dozens of active contributors (crowdsourced decomp movement) |
| **[pret/pokeemerald](https://github.com/pret/pokeemerald)** (GBA) | Byte-Matching C Decompilation | Byte-for-byte identical build to original AGBCC compiler, clean C source tree | **~2.5 – 3 years** (2018 – 2021) | pret team & broad Pokémon hacking community |
| **[RetroPortingToolKit/snesrecomp](https://github.com/RetroPortingToolKit/snesrecomp)** (SNES) | Automated Static Recompilation (AOT) | Automatic translation of 65816 machine code to C; native desktop runtime, widescreen, high FPS | **Weeks to ~2 months per game** (e.g. *DKC1Recomp*, *SuperMetroidRecomp*) | Automated toolchain does 90% of the heavy lifting; humans write PPU/APU glue & HLE hooks |

### Key Takeaway on Timelines
- **Manual C Decompilation (`zelda3`)**: Takes **1 to 2 years** of dedicated engineering. Every routine must be manually converted, types reconstructed, and bugs diagnosed.
- **Static Recompilation (`snesrecomp`)**: Reaches a bootable, fully playable native game in **weeks**. It generates "mechanical C" on Day 1, allowing developers to incrementally rewrite routines into clean C at their own pace without delaying a playable release.

---

## 2. Decompilation Approaches

Reverse engineering a game console executable follows one of four primary paradigms:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Decompilation Approaches                         │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ 1. Manual C Port     │ 2. Static Recomp     │ 3. Byte-Matching Disassembly  │
│    (zelda3, sm)      │    (snesrecomp)      │    (ebsrc, smw-disasm)        │
│                      │                      │                               │
│ • Hand-written C     │ • Automated AOT lift │ • 65816 Assembly text         │
│ • Native PC / Mac    │ • Day-1 playable     │ • Assembles back to .sfc ROM  │
│ • Widescreen / 60fps │ • Gradual HLE hooks  │ • Hardware accurate           │
│ • High human effort  │ • Fast turnaround    │ • No native PC port           │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
```

### Approach 1: Hand-Written Clean C Reimplementation / Source Port
* **Examples**: `snesrev/zelda3`, `snesrev/sm`
* **How it works**: Developers study the original assembly and rewrite every function in idiomatic C (`player.c`, `dungeon.c`). Memory is abstracted into a flat 128 KB WRAM array (`g_ram`), and hardware registers are handled by a lightweight emulation runtime (e.g., LakeSnes PPU/APU).
* **Pros**: Cleanest code, highly portable (runs on PC, Mac, Linux, Android, Switch, WebAssembly), trivial to mod, supports arbitrary native resolutions and widescreen.
* **Cons**: Enormous manual effort; no playable build until hundreds of routines and hardware shims are complete.

### Approach 2: Automated Ahead-Of-Time (AOT) Static Recompilation
* **Examples**: `RetroPortingToolKit/snesrecomp`, `N64Recomp`
* **How it works**: A compiler tool parses the binary ROM and translates every machine instruction directly into corresponding C instructions (e.g. `LDA $12` becomes `cpu->a = wram_read8(0x12);`). The resulting C files compile natively alongside a hardware simulation runtime.
* **Pros**: **Day 1 Playability**. The entire game runs natively from the start. You can then replace mechanical functions one by one with clean, readable C functions using high-level replacement hooks (`hle_func`).
* **Cons**: The generated raw C is verbose and mechanical until manually refactored.

### Approach 3: Byte-Matching Assembly Disassembly
* **Examples**: `Herringway/ebsrc`, `spannerisms/jpdasm`, `prent/smw`
* **How it works**: The ROM is disassembled into 65816 assembly source files for assemblers like Asar or bass. Labels and macros are inserted until running the assembler produces a binary with the exact identical SHA-1 hash as the original commercial cartridge.
* **Pros**: 100% faithful to the original hardware; perfect for ROM hacking and making IPS/BPS patches.
* **Cons**: It remains 65816 assembly—not portable C. It cannot run on modern PCs without an SNES emulator.

### Approach 4: Byte-Matching C Decompilation (N64 / GBA / PS1 Standard)
* **Examples**: `sm64`, `pokeemerald`, `zelda64`
* **How it works**: Developers decompile machine code back into C, then invoke the exact historic C compiler used by the original developers (e.g., SGI IDO 5.3 or GCC 2.7.2) with matching optimization flags until the compiled binary matches the original ROM byte-for-byte.
* **Why this is rare on SNES**: Almost all commercial SNES games were **written directly in 65816 assembly**, not C. There is no historic C compiler output to "byte-match" against. Therefore, "decompiling" an SNES game almost always means Approach 1 (Manual C) or Approach 2 (Static Recompilation).

---

## 3. What Makes Yoshifanatic1 & p4plus2 DKC Disassemblies "Lesser" Decomps?

Links referenced:
- [Yoshifanatic1/Donkey-Kong-Country-1-Disassembly](https://github.com/Yoshifanatic1/Donkey-Kong-Country-1-Disassembly)
- [p4plus2/DKC2-disassembly](https://github.com/p4plus2/DKC2-disassembly)
- [Yoshifanatic1/Donkey-Kong-Country-3-Disassembly](https://github.com/Yoshifanatic1/Donkey-Kong-Country-3-Disassembly)

These repositories are impressive achievements for the ROM-hacking community, but they are frequently differentiated
from "true decompilations" like `snesrev/zelda3` for several technical reasons:

### 1. Disassembly vs. Decompilation
* **These are disassemblies, not decomps**: They contain **65816 assembly code**, not C. A decompilation converts low-level instructions into a high-level programming language (C/C++).
* Calling an assembly disassembly a "decomp" is a category error in computer science, even if colloquially blurred in retro gaming forums.

### 2. Not Natively Executable
* You cannot compile Yoshifanatic1's DKC code with GCC, Clang, or MSVC to run on Windows or macOS. It must be assembled into an `.sfc` ROM using an assembler (Asar/bass) and run in an SNES emulator.
* Projects like `zelda3` or `DKC1Recomp` produce native x86/ARM desktop binaries with high refresh rates, true widescreen, and no emulator input lag.

### 3. Hardcoded Hex Blobs & Non-Shiftable Assembly
* In many assembly disassemblies (especially in early to mid stages), large portions of the codebase are simply raw un-disassembled hex dumps (`db $A9, $00, $8D...`) or data tables filled with hardcoded absolute pointers.
* **Non-shiftable**: If you add a single instruction or change an asset, all subsequent absolute addresses shift, breaking jump tables and pointers throughout the ROM. A mature decomp or clean disassembly uses relocatable symbolic labels for all branch and jump targets.

### 4. Lack of High-Level Semantics
* An assembly listing preserves the lowest common denominator: `LDA $12 : STA $34`.
* A high-level decompilation gives you structured types, descriptive names, and logic flows:
  ```c
  if (player->current_hp == 0) {
      Player_TriggerDeathAnimation(player);
  }
  ```

---

## 4. Tools Assisting Decompilation

Modern reverse-engineering rarely relies on raw hex editors. The modern toolchain includes:

1. **Static Recompilers**:
   - `RetroPortingToolKit/snesrecomp`: The state-of-the-art AOT recompiler for 65816. Parses SNES ROMs, lifts routines into C functions, and binds them to LakeSnes/SDL runtime.
2. **Interactive Disassemblers & Decompilers**:
   - **Ghidra**: Free, extensible NSA tool with community 65816 processor definitions and SNES loaders. Can emit pseudo-C (useful for reverse-engineering logic, though requiring manual cleanup for 65816 quirks).
   - **IDA Pro**: Commercial standard, excellent cross-referencing and graph views.
3. **Trace & Code/Data Logging (CDL)**:
   - **Mesen 2 & Snes9x CDL**: Records at runtime whether every single byte in the ROM was executed as **Code**, read as **Data**, or used as an **Audio/Video asset**.
   - **Register Width Logging**: Mesen 2 tracks the state of the 65816 `M` (Accumulator 8/16-bit) and `X` (Index 8/16-bit) processor status flags at every instruction address.
4. **Binary & Memory Diffing**:
   - `objdiff`: Modern UI tool for comparing compiled object files against target assembly during decompilation.
   - `asm-differ`: CLI tool that visually aligns assembly outputs during matching efforts.

---

## 5. Compiling C Back into a ROM-Compatible Memory Map

If your objective is **not** a PC source port, but compiling decompiled C code **back into a playable `.sfc` SNES cartridge ROM**:

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   Clean C Code  │ ───►  │  65816 Compiler │ ───►  │  Linker Script  │ ───► [ Playable .sfc ROM ]
│ (player.c, etc) │       │ (Calypsi / GCC) │       │   (hirom.ld)    │      (Emulators / Flashcarts)
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

### 5.1 The 65816 C Compilers
To compile ISO C into 65816 machine code:
- **Calypsi 65816 C Compiler**: Modern, actively maintained C compiler tailored for 6502/65816 with native HiROM/LoROM bank management.
- **GCC-65816**: Community port of GCC for 65816.
- **WDC 816 C Compiler**: The official Western Design Center compiler (historical, stricter syntax).

### 5.2 The 65816 Architectural Hurdles for C
1. **Dynamic Register Widths**: On 65816, `LDA #$00` is 2 bytes if $M=1$ (8-bit) and 3 bytes if $M=0$ (16-bit). C compilers cannot handle variable instruction encodings.
   - *Solution*: Compilers mandate a strict ABI: functions enter and exit with $M=0, X=0$ (16-bit mode via `REP #$30`).
2. **Virtual Register File in Direct Page**: The 65816 only has 3 data registers (`A`, `X`, `Y`). Compilers allocate `$00–$1F` in Direct Page as virtual 16-bit registers (`r0` through `r15`).
3. **Software Stack**: The 65816 hardware stack is limited to 256 bytes ($0100–$01FF). C functions maintain a software stack pointer (`sp`) in WRAM ($7E:2000+) to support deep call graphs.

### 5.3 HiROM Memory Map & Linker Configuration (`hirom.ld`)
The linker script tells the compiler where to place `.text` (code), `.rodata` (constants), and `.bss` (variables)
to conform to the SNES cartridge bus (HiROM Mode 21):

```ld
/* Minimal HiROM (Mode 21) Linker Configuration */
MEMORY {
    ZEROPAGE:    start = $000000, size = $000100; /* Direct Page registers */
    STACK:       start = $000100, size = $000100; /* Hardware Stack */
    WRAM:        start = $7E2000, size = $00E000; /* C Variables (.bss / .data) */

    /* 64 KB ROM Banks ($C0-$FF) */
    ROM_BANK_C0: start = $C00000, size = $010000, fill = yes; /* Compiled C Code */
    ROM_BANK_C1: start = $C10000, size = $010000, fill = yes; /* Game Data / Tables */

    /* Cartridge Registration Header & Interrupt Vectors */
    SNES_HEADER: start = $00FFC0, size = $000040;
}

SECTIONS {
    .zeropage : { *(zp) } > ZEROPAGE
    .bss      : { *(bss) } > WRAM
    .text     : { *(text) } > ROM_BANK_C0
    .rodata   : { *(rodata) } > ROM_BANK_C1
    .header   : { *(snes_header) } > SNES_HEADER
}
```

### 5.4 Hybrid Injection via Asar Trampolines
If you only decompile specific subsystems (e.g. combat logic) rather than the whole ROM:
1. Compile your C file with Calypsi/GCC into a standalone binary blob (`combat.bin`).
2. Include the binary into an empty ROM bank with Asar (`org $418000 : incbin "combat.bin"`).
3. Insert an assembly trampoline at the original entry point to switch register states and jump to C:
   ```assembly
   org $849A12
   Hook_ApplyDamage:
       PHP                 ; Save M/X flags
       REP #$30            ; Standardize to 16-bit A, X, Y
       PHB                 ; Save Data Bank Register
       PEA $7E7E : PLB : PLB ; DBR = WRAM ($7E)
       JSL $418000         ; Call compiled C function
       PLB : PLP           ; Restore DBR and flags
       RTL
   ```

---

## 6. Where Are We With Secret of Evermore?

In this repository (`everscript-vscode`), we have already completed almost all preliminary ground work required
for a full C decompilation of *Secret of Evermore*:

| Prerequisite | Status | Evidence in Codebase |
|---|---|---|
| **Memory Map & Banking** | ✅ 100% | Full HiROM + ExHiROM layout documented in `docs/reverse-engineering/c-compilation-hirom-memory-map.md`. |
| **WRAM Variable Census** | ✅ ~90% | Exhaustive variable map and entity structs documented in `docs/disassembly/engine-core/wram-map.md` and `src/platform/cdl/wram-export.js`. |
| **Code vs. Data Separation** | ✅ 100% | Comprehensive CDL tracking logs distinguishing instructions from audio/graphics data. |
| **Bytecode / VM Engine** | ✅ 100% | Script dictionary, animation VM opcodes, and alchemy tables decoded in `everscript` and `docs/map-format/`. |
| **Static Recompilation Engine** | ✅ Working | `snesrecomp` integration in `tools/recomp/` boots the game natively on Day 1. |
| **Automated Lockstep Verification** | ✅ Working | `npm run recomp:lockstep` runs `snes9x2005-wasm` and the native recompiled binary in lockstep, verifying all 128 KB of WRAM byte-for-byte every frame. |

### Conclusion on Feasibility
We are at the **final execution stage**: developers can select any function from the disassembly, draft clean C
code, register it via `hle_func` in `bankXX.cfg`, and immediately verify it against the lockstep emulator harness.

---

## 7. Step-by-Step Guide: LLM-Assisted C Decompilation

Because SNES games were written in assembly, an LLM cannot target "compiler byte-matching". Instead, the goal is
**state-behavioral equivalence** proven via the lockstep test oracle.

```text
┌────────────────┐     ┌──────────────────┐     ┌────────────────┐     ┌────────────────┐
│ 1. Extract ASM │ ──► │ 2. LLM Prompting │ ──► │ 3. Hook C via  │ ──► │ 4. Lockstep Emu │
│  + CDL Widths  │     │ (Clean C struct) │     │    hle_func    │     │   Validation   │
└────────────────┘     └──────────────────┘     └────────────────┘     └────────────────┘
                               ▲                                                │
                               └────────── If desync: feed RAM diff ────────────┘
```

### Step 1: Extract Assembly & CDL Width Annotations
Select a target routine (start with leaf routines: math, collision detection, damage calculations).
Extract the assembly along with known register widths ($M/X$):

```assembly
; Routine: CheckPlayerCollision ($80:8100)
; Preconditions: M=0 (16-bit A), X=0 (16-bit X/Y)
; Reads: $7E0F3E (player_x), $7E0F40 (player_y)
; Modifies: Carry flag (Set = collided, Clear = free)
```

### Step 2: Formulate the LLM Prompt
Feed the LLM the exact context:

```text
System: You are an expert 65816 reverse-engineer decompiling SNES game logic into clean, portable C99.
Context:
- Target game uses HiROM.
- WRAM is a flat 128KB buffer: `extern uint8_t g_ram[0x20000];`
- Player struct at $7E0F3E:
    typedef struct {
        uint16_t x, y;
        uint16_t hp;
    } Player;
    #define g_player ((Player*)(g_ram + 0x0F3E))

Task:
Convert the following 65816 assembly routine into idiomatic C:
[PASTE ASSEMBLY HERE]

Rules:
1. Preserve exact underflow/overflow/carry behavior.
2. If the routine returns a flag in Carry, return a boolean.
3. Replace raw addresses with struct fields or macro names.
```

### Step 3: Understand the snesrecomp Hook Mechanism (`hle_func`)

How does `snesrecomp` let you decompile a game incrementally without breaking execution?
It uses **High-Level Emulation (HLE) function overrides**:

```text
               Original Game Loop (snesrecomp)
                             │
                             ▼
                    Call to address $80:8100
                             │
        ┌────────────────────┴────────────────────┐
        ▼ (Default)                               ▼ (Configured in bank80.cfg)
func_808100_M0X0(cpu)                      hle_func 8100 HLE_CheckPlayerCollision
(Raw mechanical opcode-by-opcode C)                       │
                                                          ▼
                                            HLE_CheckPlayerCollision(CpuState *cpu)
                                            ├── Reads cpu->a, cpu->x, or g_ram
                                            ├── Invokes clean C: CheckCollision()
                                            └── Sets cpu->p (Carry flag) & returns
```

#### 1. What snesrecomp Generates by Default (Mechanical C)
By default, `snesrecomp` emits low-level, instruction-by-instruction emulation C:
```c
// out/recomp/project/src/game/bank_80.c (Generated by snesrecomp)
void func_808100_M0X0(CpuState *cpu) {
    uint16_t px = wram_read16(0x0F3E);
    uint16_t py = wram_read16(0x0F40);
    // mechanical comparisons, bitshifts, flag updates...
    if (px >= 0x0100) {
        cpu->p |= FLAG_C;  // Set Carry flag
    } else {
        cpu->p &= ~FLAG_C; // Clear Carry flag
    }
}
```

#### 2. Declaring the Hook in `bank80.cfg`
To replace this mechanical routine with your decompiled C function, add a line to the bank configuration file:
```ini
# tools/recomp/host/config/bank80.cfg
bank = 80

# Syntax: hle_func <4-digit-hex-offset> <c_function_symbol>
hle_func 8100 HLE_CheckPlayerCollision
```
When `snesrecomp` compiles the game, every call or jump that targets `$80:8100` is redirected to `HLE_CheckPlayerCollision` instead of `func_808100_M0X0`.

#### 3. Implementing the Clean C Function & the HLE Bridge Wrapper
In `src/decomp/collision.c`:
```c
#include "game_memory.h" // Provides g_ram (128 KB WRAM) and CpuState
#include <stdbool.h>

// --- Pure, Portable C Implementation (Target Decomp) ---
typedef struct {
    uint16_t x;
    uint16_t y;
    uint16_t hp;
} PlayerEntity;

#define g_player ((PlayerEntity*)(g_ram + 0x0F3E))

bool Player_CheckCollision(const PlayerEntity *player) {
    // Clean, readable game logic with no 65816 assembly artifacts
    return (player->x >= 0x0100);
}

// --- snesrecomp HLE Hook Adapter ---
// Signature required by snesrecomp: void FunctionName(CpuState *cpu)
void HLE_CheckPlayerCollision(CpuState *cpu) {
    // 1. Execute our clean, idiomatic C logic
    bool collided = Player_CheckCollision(g_player);

    // 2. Set CPU return states expected by original callers (Carry Flag)
    if (collided) {
        cpu->p |= FLAG_C;   // SEC (Set Carry)
    } else {
        cpu->p &= ~FLAG_C;  // CLC (Clear Carry)
    }

    // snesrecomp automatically handles RTS/RTL execution when this hook returns
}
```

---

### Step 4: Run the Lockstep Oracle
Execute the automated co-simulation runner:
```bash
npm run recomp:lockstep -- --rom "Secret of Evermore (U) [!].smc"
```
The test harness runs the original ROM in `snes9x` and the recompiled binary side-by-side using prerecorded inputs.

---

### Step 5: Iterative Bug Remediation with the LLM
If the lockstep runner detects a divergence:
```text
[DIVERGENCE] Frame 412: Address $7E0F42 Expected 0x0010, Got 0x000F
```
Feed the failure report back into the LLM:
> *"The C implementation produced 0x000F at frame 412 while hardware produced 0x0010.
> Notice that 65816 `SBC` subtracts the NOT of Carry (`A - data - (1 - C)`). Did your C code assume Carry was set before subtraction?"*

Once the run completes with **0 RAM differences across all test frames**, mark the function complete and commit!
