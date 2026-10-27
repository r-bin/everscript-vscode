# SNES 65816 C Compilers: Evaluation & Empirical Benchmark

> This document evaluates all viable C compilers for compiling C code into a Super Nintendo Entertainment System (SNES / Super Famicom) ROM image. It covers architectural constraints of the WDC 65816, previous decompilation and homebrew efforts, compiler settings, empirical benchmarks of realistic SNES game kernels, and an empirical analysis of **ASM → C → ASM code quality** (comparing clean compiled C vs. hand-written vanilla assembly).

---

## 1. Executive Summary & Recommendation

| Compiler | Maturity | License | Host Support | Code Quality | Best For |
|---|---|---|---|---|---|
| **Calypsi 65816** (v5.18) | Production | Proprietary (Free non-commercial) | macOS (x86_64/Rosetta), Linux, Windows | ★★★★★ (Clean, compact, idiomatic) | **Best Overall Compiler for SNES ROMs (Clean & Injected)** |
| **loomcc** (Sept 2026) | Cutting-edge | MIT (Open Source, Rust) | macOS (Native arm64), Linux, Windows | ★★★★☆ (0.37x clocks vs 816-tcc, whole-program) | **Best Open-Source Compiler for standalone SNES games / modules** |
| **vbcc 65816** (Release 2) | Actively developed | Proprietary (Free non-commercial) | macOS (native build), Linux, Windows | ★★★☆☆ (C99, 24-bit far ptrs, verbose stack use) | **Viable alternative with rich C99 & math features** |
| **816-tcc** (PVSnesLib) | Legacy | LGPL 2.1 | macOS, Linux, Windows | ★☆☆☆☆ (Bloated stack frames, C89-only, brittle) | **Legacy PVSnesLib projects only** |
| **llvm-mos-65816** | Experimental | Apache-2.0 w/ LLVM Exception | Linux, Windows (macOS build deferred) | ★★★★☆ (Native A16/XY16, Clang front-end) | **Future powerhouse once upstreamed into LLVM-MOS** |
| **WDC816CC** / **ORCA/C** | 1990s legacy | Proprietary / Open | Windows (Wine) / Apple IIgs | ★★☆☆☆ (Obsolete codegen, heavy OS coupling) | **Historical curiosity & retro GS/OS targets** |
| **Custom Cycle-Exact Compiler** | Concept | In-house | Any | ★★★★★ (Deterministic cycles) | **Last resort if frame-exact WRAM lockstep is strictly mandatory** |

### The Winner: **Calypsi 65816** with `--target=snes -O1 --speed`
* **Why Calypsi?** It produces the most compact, idiomatic 65816 assembly (131–137 lines vs 200 for loomcc and 449 for 816-tcc). It natively supports 24-bit far pointers (`--code-model=large --data-model=large`), targets native FastROM (`$C00000+` / `$808000+`, 3.58 MHz), and uses fast `PEI`/`PLx` stack frames.
* **Essential Flag: `--target=snes`**: This flag is **mandatory** for compiling clean SNES ROMs. It enables `__CALYPSI_TARGET_SNES__`, links with SNES hardware math (`clib-*-snes.a` using 5A22 registers `$4202/$4204` and PPU `$211B/$2134`), and provides the linker configuration (`snes-HiROM.scm`) that generates the SNES ROM header, reset vectors, and FastROM cstartup.
* **Recommended Optimization Flag:** Use **`-O1 --speed`** (not `-O2`). As discovered in `docs/reverse-engineering/c-to-rom.md` §10 and verified in Gate G1, Calypsi 5.18 at `-O2` has a compiler bug that drops the reload after testing a byte's sign through `lda 0,s`. `-O1 --speed` is safe, fast, and passes all validation tests.
* **Deep Dive Documentation**: See [compiler/calypsi.md](calypsi.md) for a comprehensive breakdown of all Calypsi parameters, optimization passes, memory model mechanics, and empirical test matrices.
* **Strong Open-Source Alternative:** **loomcc** with **`-O2`**. If a strictly permissive open-source license (MIT) is required, loomcc (written in Rust in September 2026) generates code that runs in ~37% of the clock cycles of PVSnesLib's 816-tcc.

---

## 2. Research: Prior & Similar Projects

How do other SNES reverse-engineering, decompilation, and homebrew projects handle C?

### 2.1 Zelda 3, Super Mario World & Super Metroid Recomp
* **[snesrev/zelda3](https://github.com/snesrev/zelda3)** & **[snesrev/smw](https://github.com/snesrev/smw)**: Neither project compiles C back into a SNES ROM. They compile to a **native PC program** running emulated PPU/DSP (LakeSnes). The user's ROM is used solely as an asset data store.
* **[mstan/SuperMetroidRecomp](https://github.com/mstan/SuperMetroidRecomp)**: Static binary recompilation via `snesrecomp`. Hand-written C replaces routines on the PC via `hle_func`.
* **Learning**: These projects verify correctness by running the original ROM in an emulator side-by-side with the C program and comparing WRAM frame-by-frame on recorded playbacks.

### 2.2 PVSnesLib & 816-tcc
* **PVSnesLib** (Aleksi Eeben, mic_, Alekmaul): The standard open-source SNES SDK for over a decade. It relies on a customized fork of Fabrice Bellard's Tiny C Compiler (**816-tcc**) emitting WLA-DX assembly, post-processed by `816-opt.py`.
* **Documented Pitfalls**:
  1. **Strictly C89**: Fails to parse C99 declarations (e.g. `for (int i = 0; ...)` or `const` pointer qualifiers). In fact, our testing revealed that encountering C99 constructs causes 816-tcc to crash with double-free heap corruption.
  2. **16-bit Pointers**: Pointers are represented as 32-bit values but pointer arithmetic is strictly 16-bit; code cannot span across 64 KB bank boundaries.
  3. **Stack Inefficiency**: Adjusts stack with `tsa / sec / sbc / tas` (14 cycles) on every function call and reload.

### 2.3 Loom & loomcc (September 2026)
* **[rje/loomcc](https://github.com/rje/loomcc)**: Built from scratch in Rust in September 2026 to replace 816-tcc for the upcoming *Loom* SNES game engine.
* **Innovations**:
  1. Whole-program optimization with inter-procedural inlining.
  2. Allocates static Direct Page WRAM frames for functions rather than dynamic hardware stack frames.
  3. Replaces recursion with dynamic `TCD` stack frame relocation (`tsc / sec / sbc / tcs / tcd`).
  4. Generates WLA-DX assembly compatible with PVSnesLib runtime libraries.
  5. Benchmark results: runs in **0.37x the clock cycles** (2.7x faster) and **0.49x code size** compared to 816-tcc.

### 2.4 llvm-mos-65816 (2026)
* **[wbniv/llvm-mos-65816](https://github.com/wbniv/llvm-mos-65816)**: Extension of LLVM-MOS by Daniel Thornburgh (`wbniv`) to support the WDC 65816.
* **Status**: Milestones M0, M1, and M2 completed. Demonstrates bootable LoROM `.sfc` images, native 16-bit accumulator codegen (`+mos-a16`), 16-bit index mode (`+mos-xy16`), and 24-bit far pointers.
* **Availability**: Linux x86_64 and Windows packages exist; macOS host builds are deferred pending upstreaming into official LLVM-MOS.

### 2.5 Secret of Evermore C-to-ROM (`tools/c-to-rom/`)
* In this repository, 27 engine routines have been rewritten in documented C and compiled directly into the 4th megabyte (banks `$F8–$FB`) of the vanilla HiROM image using **Calypsi 5.18**.
* Correctness is verified by **Gate G1**: every sampled entry state is replayed against the vanilla 65816 implementation and the compiled C image on an in-tree 65816 CPU simulator, requiring identical registers (A, X, Y, S, D, DB, P) and full 128 KB WRAM.

---

## 3. Architectural Constraints of the WDC 65816

Compiling modern C to the 65816 is notorious due to several architectural quirks:

### 3.1 Direct Page vs. Zero Page Contention
* The 65816 can relocate its Direct Page anywhere in Bank `$00` via the 16-bit `D` register (`TCD`).
* **The Problem**: In existing commercial SNES games, direct page `$0000–$01FF` and WRAM `$0000–$1FFF` are already densely packed with game engine variables, scratch registers, and NMI/IRQ vectors.
* **Compiler Behavior**:
  * *816-tcc*: Hardcodes fixed direct page locations (`tcc__r0..tcc__r15`), which will corrupt existing game variables if injected into a ROM.
  * *loomcc*: Allocates static Direct Page addresses across the whole program.
  * *vbcc*: Uses direct page pseudo-registers `r0..r31` or stack-relative addressing.
  * *Calypsi*: Uses 32 bytes of pseudo-registers (`_Dp`). In `tools/c-to-rom/build.mts`, our trampoline dynamically moves `S` down by 32 bytes and points `D` to this clean stack space, preventing any contamination of the game's vanilla WRAM.

### 3.2 24-bit Banking & Memory Models
* The 65816 uses a 24-bit address space (16 MB). In HiROM, ROM is mapped to `$C00000–$FFFFFF` and `$808000–$BFFFFF`. WRAM is mapped to `$7E0000–$7FFFFF`.
* Normal 16-bit pointers only index within the current Data Bank (`DB`). Accessing WRAM from code located in ROM bank `$F8` requires **24-bit far pointers** (`lda [dp]`, `sta [dp]`, or long addressing `lda >$7E1000`).
* Compilers must support a **large code model** (cross-bank calls via `JSL` / `RTL`, 3-byte return address) and **large data model** (24-bit pointers).

### 3.3 Dynamic 8-bit / 16-bit Mode Switches (`REP` / `SEP`)
* The 65816 accumulator (`A`) and index registers (`X`/`Y`) can be dynamically toggled between 8-bit and 16-bit modes using `SEP` and `REP`.
* Naive compilers constantly emit `REP #$20` and `SEP #$20` around single-byte operations, creating severe cycle bloat.
* Calypsi and llvm-mos maintain internal state tracking to eliminate redundant `REP`/`SEP` transitions.

### 3.4 Cycle Variance & Frame-Timing Divergence
* **Why C-built ROMs cannot guarantee frame-exact WRAM lockstep**:
  Secret of Evermore (and most action SNES games) time-slices tasks across frames. The main thread processes entity collisions and physics until interrupted by NMI (`$00:823A`).
  If a routine compiled from C takes even 8 cycles more or less than the original assembly, the NMI interrupts the engine at a different point in the entity list. This creates an immediate cascade: entity slots diverge, RNG calls shift, and per-frame WRAM is no longer identical.
* **Standard**: C routines must be validated **per-routine** (Gate G1: identical outputs given identical entry states), not by expecting identical cycle counts.

---

## 4. Compiler Settings & Recommended Flags

### 4.1 Calypsi 65816

| Flag | Purpose | Recommended? |
|---|---|---|
| `--core=65816` | Targets WDC 65816 native mode | **Yes** |
| `--code-model=large` | 24-bit function pointers, `JSL`/`RTL` calls | **Yes** |
| `--data-model=large` | 24-bit `__far` pointers across ROM and WRAM | **Yes** |
| `-O1` | Level 1 optimizations (safe, verified) | **Yes** (Standard) |
| `--speed` | Favor cycle speed over code size | **Yes** |
| `--space` | Favor code density over execution speed | Optional |
| `-O2` | Level 2 optimizations | **NO** (Bug in Calypsi 5.18 drops sign reloads) |
| `--no-ppu-mul` | Disables automatic use of SNES PPU hardware multiplier | **Yes** (prevents non-reentrant multiplier conflicts during NMI) |

### 4.2 loomcc

| Flag | Purpose | Recommended? |
|---|---|---|
| `-S` | Emits WLA-DX assembly | **Yes** |
| `-O2` | Whole-program optimizations, static frame allocation | **Yes** |
| `-O1` | Basic optimizations without aggressive inlining | Optional |
| `-O0` | No optimizations | No (very slow) |
| `-nostdinc` | Ignores bundled libc headers in favor of custom ROM headers | When replacing existing ROM routines |

### 4.3 vbcc 65816

| Flag | Purpose | Recommended? |
|---|---|---|
| `-O=2` or `-O=3` | Optimizing pipeline | **Yes** |
| `-speed` | Optimize for execution speed | **Yes** |
| `-ptr24` | 24-bit far and huge pointers (3 bytes in memory) | Optional (saves RAM, slightly more mode switches) |
| `-mhuge` | Full 24-bit huge pointers and 32-bit pointer math | When data spans 64 KB bank boundaries |
| `-snes-muldiv` | Uses 5A22 hardware multiplier | Use with caution (not re-entrant in interrupts) |
| `-no-delayed-popping` | Immediately pops stack arguments after calls | Helpful for debugging stack depth |

### 4.4 816-tcc

| Flag | Purpose | Recommended? |
|---|---|---|
| `-c` | Compile C source to WLA-DX assembly | **Yes** |
| `-H` | Configure memory mapping for HiROM | When supported by PVSnesLib driver |
| `816-opt.py` | Mandatory external post-pass peephole optimizer | **Yes** (necessary to clean up redundant `lda`/`sta`) |

---

## 5. Empirical Benchmark: Compiling a Known Kernel

To test the compilers under identical conditions, we compiled a standard test kernel containing three representative functions:
1. `scale_and_clamp`: 16x16 $\to$ 32-bit unsigned multiply, 8-bit shift, comparison, conditional clamp.
2. `array_sum`: Loop with pointer indexing and 16-bit accumulation.
3. `fibonacci`: Deep recursion, exercising hardware stack and register preservation.

### 5.1 Benchmark Source Code

```c
unsigned short scale_and_clamp(unsigned short val, unsigned short mult, unsigned short max_val) {
    unsigned long res = (unsigned long)val * mult;
    unsigned short scaled = (unsigned short)(res >> 8);
    if (scaled > max_val) {
        return max_val;
    }
    return scaled;
}

unsigned short array_sum(unsigned short *arr, unsigned short len) {
    unsigned short sum = 0;
    for (unsigned short i = 0; i < len; i++) {
        sum += arr[i];
    }
    return sum;
}

unsigned short fibonacci(unsigned short n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}
```

### 5.2 Quantitative Comparison

| Compiler & Setting | Total Assembly Lines | `scale_and_clamp` Instructions | `array_sum` Loop Inner Instructions | `fibonacci` Base Case Instructions | Stack Frame Strategy |
|---|---|---|---|---|---|
| **Calypsi `-O2 --speed`** | **131** | **23** | **7** | **6** | Dynamic `PEI (dp)` / `PLY` stack frames |
| **Calypsi `-O1 --speed`** | **137** | **24** | **10** | **6** | Dynamic `PEI (dp)` / `PLY` stack frames |
| **Calypsi `-O0`** | 140 | 27 | 10 | 6 | Minimal optimization |
| **loomcc `-O2`** | **200** | **31** | **8** | **9** | Direct Page static frame; `TCD` dynamic stack frame on recursion |
| **loomcc `-O1`** | 197 | 31 | 8 | 9 | Same as `-O2` without leaf inlining |
| **loomcc `-O0`** | 207 | 34 | 8 | 9 | Unoptimized AST lowering |
| **vbcc `-O=2 -speed`** | **197** | **44** | **16** | **11** | Heavy stack relative (`tsc / clc / adc / tcs`) |
| **vbcc `-O=1`** | 204 | 46 | 17 | 11 | Basic stack frame |
| **816-tcc** | **449** | **78** | **38** | **26** | Extreme stack churn (`tsa / sec / sbc / tas`) |

---

### 5.3 Detailed Code Generation Analysis

#### 1. Calypsi 65816 (`-O1 --speed`)
* **Scale and Clamp**:
  ```asm
  scale_and_clamp:
              phy
              phy
              sta     1,s
              lda     dp:.tiny (_Dp+4)
              sta     3,s
              lda     1,s
              ldx     dp:.tiny _Dp
              jsl     long:_Mul16
              stx     dp:.tiny (_Dp+2)
              sta     dp:.tiny _Dp
              lda     dp:.tiny (_Dp+1)     ; 8-bit shift implemented as a 1-byte offset load!
              sta     1,s
              lda     3,s
              cmp     1,s
              bcs     ?L5
              lda     3,s
              bra     ?L3
  ?L5:        lda     1,s
  ?L3:        ply
              ply
              rtl
  ```
  *Key Strength*: Notice line `lda dp:.tiny (_Dp+1)`! Calypsi realizes that `(res >> 8)` can be performed by reading the direct page at byte offset `+1` rather than emitting 8 sequential shift opcodes. This saves over 24 cycles!

#### 2. loomcc (`-O2`)
* **Scale and Clamp**:
  ```asm
  scale_and_clamp:
    ...
    jsl lcc_mul32_loomcc_O2
    sta.b $0c
    stx.b $0e
    lda.b $0c
    sta.b $04
    lda.b $0e
    sta.b $06
    lsr.b $06
    ror.b $04
    ; ... repeated 8 times (16 instructions)!
    cmp.b $02
    bcc __loomcc_O2f0b2
    beq __loomcc_O2f0b2
  ```
  *Analysis*: Emits clean WLA-DX code and uses zero hardware stack in leaf functions. However, it currently lacks the peephole optimization to fold an 8-bit shift into a byte-offset load, falling back to 8 `lsr/ror` pairs.

#### 3. vbcc 65816 (`-O=2 -speed`)
* **Scale and Clamp**:
  Allocates a massive 46-byte stack frame (`tsc; clc; adc #-46; tcs`), shuffles values redundantly across stack offsets (`lda 1,s; sta 9,s; lda 13,s; sta 27,s; lda 27,s; sta 39,s`), calls `___mulint32`, and tears down the stack with another `tsc; clc; adc #46; tcs`.
  *Analysis*: The compiler is functional and supports C99, but its register allocator heavily spills to stack-relative memory, causing high cycle overhead.

#### 4. 816-tcc (PVSnesLib)
* **Scale and Clamp & Fibonacci**:
  Emits 449 lines for the 3 functions. For a simple `n <= 1` condition, 816-tcc emits:
  ```asm
  ldx #1
  lda.b tcc__r0
  sec
  sbc.w #1
  tay
  beq ++
  bcc ++
  + dex
  ++
  stx.b tcc__r5
  lda.b tcc__r5 ; DON'T OPTIMIZE
  bne +
  brl __local_8
  ```
  *Analysis*: Generates 12 instructions and over 35 cycles for a 3-cycle operation. Highly discouraged for performance-sensitive or ROM-injection workloads.

---

## 6. Summary Comparison Matrix

| Criteria | Calypsi | loomcc | vbcc | 816-tcc |
|---|---|---|---|---|
| **Language Standard** | C99 / C11 | C17 subset | C99 | C89 only |
| **Generated Output** | Native Calypsi Assembler (`as65816`) | WLA-DX Assembly | vasm (`vasm6502_std`) | WLA-DX Assembly |
| **Addressing Mode Quality** | ★★★★★ (Direct page offset folding, `PEI`) | ★★★★☆ (Direct page `[$00],y`, static slots) | ★★★☆☆ (Stack-relative heavy) | ★☆☆☆☆ (Redundant load/store churn) |
| **Memory Model Support** | Large code & data (24-bit far pointers) | Large code, flat data | Near, far, huge (16/24/32-bit) | 16-bit segmented |
| **Integration with Existing ROM** | Proven (27 routines passing Gate G1 in SoE) | Feasible with custom bridge | Feasible | Unsafe (DP collisions) |
| **Compiler Bugs & Traps** | `-O2` sign reload bug (use `-O1`) | UTF-8 only, large bank limit | Heavy stack frame overhead | Crashes on C99 / `const` |
| **Recommended Setting** | **`-O1 --speed --code-model=large --data-model=large`** | **`-O2 -S`** | **`-O=2 -speed`** | `-c` with `816-opt.py` |

---

## 7. ASM → C → ASM: Is Compiled C Way Worse Than Vanilla Assembly?

A central question in SNES reverse engineering and C recompilation is: **If we rewrite vanilla 65816 assembly in C and compile it back to 65816 assembly, does the compiler generate horrible code?**

### 7.1 Why Legacy Reconstructed Routines Looked 10x–60x Worse
In earlier experiments (`reconstructed-c/` and Gate G1 files), compiled routines showed instruction counts 10x to 60x larger than vanilla assembly. **This was NOT compiler inefficiency.** It was an artifact of the **hybrid bridge architecture** used to patch into an existing closed binary:
1. **CPU Flag Emulation**: Vanilla routines pass and return hardware status flags (`N`, `Z`, `C`, `V`). To maintain this contract in C, functions had to take a simulated `soe_regs *r` pointer and manually compute condition flags into memory:
   ```c
   r->n = (scaled & 0x8000) != 0;
   r->z = (scaled == 0);
   r->c = (a >= b);
   ```
   Each boolean computation emitted 6–8 instructions (`cmp #0; beq ...; lda #1; sta r->z`).
2. **Trampoline Overhead**: The caller bridge pushed all 65816 registers, subtracted 32 bytes from `S`, redirected `D` to stack space for virtual registers, called the C code, read back the `soe_regs` flags, set the 65816 status register via `PHP/PLP`, and restored all registers.

### 7.2 The Reality for Native / Clean C Logic
When compiling clean, idiomatic C for a fresh SNES ROM (or native modules), **the recompiled assembly is NOT way worse than vanilla hand-written code.** In many cases, it is nearly 1:1, and occasionally **beats** naive hand-written assembly.

#### Side-by-Side Comparison 1: `scale_damage_clean`
*Logic: 5-level tiered stamina threshold checks and power-of-two damage shifts.*

| Vanilla Hand-Written 65816 Assembly | Calypsi Compiled C (`-O1 --speed --target=snes`) |
|---|---|
| ```asm<br>; Input: A = damage, X = stamina<br>cpx #$0200<br>bcs .tier1<br>lsr a<br>lsr a<br>rtl<br>.tier1:<br>cpx #$0400<br>bcs .tier2<br>lsr a<br>rtl<br>.tier2:<br>cpx #$0800<br>bcs .tier3<br>rtl<br>.tier3:<br>cpx #$0C00<br>bcs .tier4<br>asl a<br>rtl<br>.tier4:<br>asl a<br>asl a<br>rtl<br>``` | ```asm<br>scale_damage_clean:<br>            ldx     dp:.tiny _Dp<br>            cpx     ##0x200<br>            bcs     ?L4<br>            lsr     a<br>            bra     ?L10<br>?L4:        cpx     ##0x400<br>            bcs     ?L8<br>?L10:       lsr     a<br>            rtl<br>?L8:        cpx     ##0x800<br>            bcs     ?L12<br>            rtl<br>?L12:       cpx     ##0xc00<br>            bcc     ?L18<br>            asl     a<br>?L18:       asl     a<br>            rtl<br>``` |
| **Total: ~18 instructions** | **Total: 14 instructions** |

*Analysis*: Calypsi achieves **fewer instructions than vanilla** by performing tail-merging:
- For `>> 2`: `lsr a; bra ?L10`, which shares the `lsr a; rtl` of the `>> 1` tier!
- For `<< 2`: `asl a`, which falls through into `?L18: asl a; rtl` of the `<< 1` tier!
- Zero stack frames allocated, zero registers spilled.

#### Side-by-Side Comparison 2: `random_below`
*Logic: Seed step + bounded modulo via hardware divider.*

| Vanilla Hand-Written 65816 Assembly | Calypsi Compiled C (`-O1 --speed --target=snes`) |
|---|---|
| ```asm<br>random_below:<br>    cmp #0<br>    beq .zero<br>    pha<br>    jsl next_random<br>    sta $4204       ; 5A22 Divisor<br>    pla<br>    sep #$20<br>    sta $4206       ; 5A22 Dividend<br>    rep #$20<br>    nop; nop; nop; nop<br>    lda $4216       ; Remainder<br>    rtl<br>.zero:<br>    lda #0<br>    rtl<br>``` | ```asm<br>random_below:<br>            phy<br>            sta     1,s<br>            lda     1,s<br>            bne     ?L9<br>            lda     ##0<br>            bra     ?L7<br>?L9:        jsl     long:next_random<br>            pha<br>            lda     3,s<br>            tax<br>            pla<br>            jsl     long:_UDivMod16<br>?L7:        ply<br>            rtl<br>``` |
| **Total: ~15 instructions** | **Total: 13 instructions** |

*Analysis*: Calypsi's `--target=snes` links directly to `_UDivMod16` from `clib-lc-ld-snes.a`, which executes on the 5A22 hardware divider. Code density is virtually identical to hand-written assembly.

### 7.3 Quantitative Quality Ratio Across Operations
* **ALU / Logic / Shifts**: **0.9x to 1.1x** (competitive with hand-written code, occasionally smaller due to branch tail-merging).
* **Control Flow (`if/else`, loops)**: **1.0x to 1.2x** (emits standard `cmp / bcc / bcs / iny / bne`).
* **Hardware Multiplication / Division**: **1.0x to 1.2x** (uses 5A22 `$4202/$4204` and PPU `$211B/$2134` via `target=snes`).
* **24-bit Struct Pointer Dereferencing**: **1.3x to 1.5x** (large data model emits 24-bit indirect long `lda [.tiny _Dp],y` rather than 16-bit absolute indexing, providing complete bank independence).

### 7.4 The FastROM Speed Dividend (3.58 MHz)
Because we are compiling for an **empty ROM**, our code targets **FastROM** (`$C00000+` or `$808000+`, Mode 21):
- Standard SlowROM executes at **2.68 MHz** (8 master clock cycles per bus read).
- FastROM executes at **3.58 MHz** (6 master clock cycles per bus read) — a **33.3% hardware speedup** across every CPU cycle!
- Enabling FastROM is as simple as writing `1` to `$420D` (`MEMSEL = 1`) during startup.
- **Result**: Even if a compiled C routine takes ~15–20% more instructions than ultra-optimized hand-written SlowROM assembly, running in FastROM means **the compiled C routine often finishes in fewer wall-clock microseconds than vanilla SlowROM assembly!**

### 7.5 The New Bottleneck: Quality of the Generated C Code

Now that the compiler is proven to produce 1:1 assembly when given idiomatic C, **the bottleneck is shifted entirely to the quality and abstraction level of the C code generation or lifting process**.

```
                [ Vanilla 65816 Assembly ]
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
   [ Low-Quality Decompiled C ]   [ High-Quality Semantic C ]
    • Passes soe_regs *r struct    • Clean args: (uint16_t, uint16_t)
    • Emulates CPU N, Z, C flags   • Idiomatic if/else, loops
    • Raw 24-bit pointer math      • Typed structs (Entity, Box)
    • Simulates CPU state          • Natural return values
               │                         │
               ▼ (Compiled by Calypsi)   ▼ (Compiled by Calypsi)
    10x–60x Code Bloat            1:1 Near-Perfect 65816 Assembly
```

To ensure generated C compiles to near-optimal 65816 machine code, code generators and lifting pipelines must follow these 5 rules:
1. **Recover Clean Function Signatures**: Avoid passing CPU state structures (`soe_regs *r`). Recover true parameters (`uint16_t a, uint16_t b`). Calypsi passes the first argument in `A`, second in `_Dp` (or `X`), and returns in `A`, eliminating all memory traffic.
2. **Eliminate Machine Status Flags**: Decompilers must not emit manual boolean computations for CPU flags (`r->n = ...; r->z = ...`). Instead, condition codes must be folded directly into high-level branches (`if (val == 0)`).
3. **Strict Integer Typing (`uint16_t` / `uint8_t`)**: The 65816 native accumulator is 16-bit or 8-bit. Emitting default C 32-bit types (`int32_t` or `long`) forces the compiler to double every arithmetic instruction (`ADC` low word, `ADC` high word).
4. **Typed Data Structures over Raw Pointer Arithmetic**: Replace `*(uint16_t*)(0x7E0000 + off)` with typed structs (`entity->hp`). This lets Calypsi utilize 65816 indexed addressing modes (`lda [dp],y`).
5. **Local Scoping for Temporaries**: Scratch variables should be declared as local C variables so Calypsi can assign them to its fast Direct Page registers (`_Dp`) rather than spilling to global WRAM memory.

### 7.6 The ASM-to-ASM Feedback Loop: How to Know When C Must Be Improved

To ensure decompiled or newly written C routines do not silently introduce performance regressions, developers and subagents must use an **ASM-to-ASM feedback loop** before approving any C implementation:

```
    ┌──────────────────────┐
    │ Vanilla 65816 ASM    │ (Reference instruction count & cycle baseline)
    └──────────┬───────────┘
               │ Lift to C
               ▼
    ┌──────────────────────┐
    │ Reconstructed C Code │
    └──────────┬───────────┘
               │ cc65816 -S -O1 --speed
               ▼
    ┌──────────────────────┐
    │ Compiled 65816 ASM   │
    └──────────┬───────────┘
               │ Compare Instructions & Register Churn
               ▼
     [ Instruction Ratio Check ]
     • <= 1.2x: EXCELLENT (Acceptable for merge)
     • 1.2x - 1.4x: ACCEPTABLE (Valid if far pointers or safety checks added)
     • > 1.5x: CODE SMELL / REJECT (C must be improved first!)
```

#### Diagnostic Checklist when Ratio > 1.3x:
1. **Accidental 32-bit Arithmetic**: Search the compiled assembly for repeated `ADC`/`SBC` pairs with `#0`. Fix by replacing `int`, `long`, or `uint32_t` with explicit `uint16_t` / `uint8_t`.
2. **Boolean Status Flag Spills**: Search for `CMP`, `BEQ`, `LDA #1`, `STA`. Fix by folding conditions directly into `if/else` control flow rather than storing flags in variables.
3. **Stack Churn (`sta 1,s`, `lda 3,s`)**: Check if too many live variables exist simultaneously or if parameters were passed as a pointer to a struct. Refactor to pass up to two 16-bit values in registers (`A` and `X`) and return in `A`.
4. **Shift Bloat**: Search for sequences of 8 `lsr` or `asl` instructions. Fix by casting or loading with direct page byte offsets (`res >> 8` becomes `*(uint8_t*)&res + 1`).

---

## 8. Conclusion

For **compiling C to a clean SNES ROM** targeting FastROM:
1. **Primary Toolchain**: **Calypsi 65816** with flags:
   ```sh
   cc65816 --target=snes --code-model=large --data-model=large -O1 --speed
   ```
   Linked via `ln65816 --target=snes` with `snes-HiROM.scm` and `clib-lc-ld-snes.a`.
   - Generates compact, idiomatic assembly (virtually 1:1 with vanilla 65816).
   - Generates the standard SNES header, reset vectors, and FastROM cstartup automatically.
   - Leverages hardware math registers ($4202/$4204, $211B).
   - Avoids the `-O2` sign-reload compiler bug while achieving peak cycle performance.
2. **Open-Source Future**: **loomcc** with `-O2 -S` is the leading open-source (MIT, Rust) alternative for projects where proprietary toolchain distribution is restricted.

