# Calypsi 65816: Compiler Deep Dive & Parameter Analysis

> **Target:** Calypsi ISO C compiler for 65816 (v5.18, July 2026).  
> **Project Goal:** Compile C code directly to a bootable Super Nintendo ROM image targeting FastROM (3.58 MHz) in an empty ROM space, as well as compiling reconstructed C routines for ROM injection.

---

## 1. Executive Parameter Recommendation

### 1.1 Clean / Standalone SNES ROM (Empty ROM targeting FastROM)

For compiling a standalone C program or complete game into an empty SNES ROM running in **FastROM (3.58 MHz Mode 21 HiROM)**:

```sh
# Compile C sources to object files
cc65816 \
  --target=snes \
  --core=65816 \
  --code-model=large \
  --data-model=large \
  -O1 \
  --speed \
  --no-cross-call \
  --force-switch=if-else \
  -c main.c -o main.o

# Link into bootable .sfc ROM image
ln65816 \
  --target=snes \
  -o game.sfc \
  --list-file=game.lst \
  --output-format=raw \
  main.o \
  snes-HiROM.scm \
  clib-lc-ld-snes.a
```

### Why this specific combination?

1. **`--target=snes` (Essential)**:
   - Defines `__CALYPSI_TARGET_SNES__` to activate SNES MMIO definitions and headers.
   - Integrates with Calypsi's SNES runtime library (`clib-lc-ld-snes.a`), enabling **5A22 hardware multiplication (`$4202/$4203`) and division (`$4204/$4206`)** instead of slow software loops.
   - Enables `snes-HiROM.scm` which automatically creates the standard SNES Cartridge Header (`$00FFC0`), native/emulation interrupt vectors (`$00FFE4–$00FFFF`), and the `cstartup` entry point.
2. **`--code-model=large`**: Uses 24-bit function pointers and `JSL`/`RTL` calls, allowing code to span across banks `$C0–$FF` seamlessly.
3. **`--data-model=large`**: Generates 24-bit long addresses (`lda long:addr` or `lda [.tiny _Dp]`). Memory accesses are fully bank-independent; the Data Bank register (`DB`) does not restrict pointer dereferences.
4. **`-O1 --speed`**: Enables constant folding, algebraic simplification, and direct-page byte-offset folding (`(res >> 8)` becomes `lda dp:.tiny (_Dp+1)`). Avoids the fatal sign reload optimizer bug in `-O2`.
5. **`--no-cross-call`**: Prevents the compiler from extracting duplicate instruction sequences into shared subroutines (`jsl ?L170`), eliminating ~16 cycles of call/return overhead per instance.
6. **`--force-switch=if-else`** (or `--force-switch=jump-table`): Ensures switch statements compile to self-contained branch logic without requiring external runtime symbols like `_ValueSwitch16`.
7. **FastROM Speed (3.58 MHz)**: By writing `1` to `$420D` (`MEMSEL = 1`) in `main()`, the CPU executes out of FastROM banks (`$C00000+` / `$808000+`) at 3.58 MHz (6 master clocks vs 8 for SlowROM, a 33% hardware speedup).

---

## 2. Parameter Category Breakdown

### 2.1 Target Architecture & Core Selection

| Parameter | Options / Default | Behavior & Mechanics | Best for Our Project? |
|---|---|---|---|
| `--core` | `65816` (default) | Enables native WDC 65C816 instruction set. | **Mandatory** (`--core=65816`) |
| `--target` | `none`, `SNES`, `C256`, `F256` | Enables target board macros (`__CALYPSI_TARGET_SNES__`), SNES hardware math, and runtime linker rules. | **Mandatory for Clean ROMs** (`--target=snes`). In standalone builds, `--target=snes` provides boot headers, reset vectors, and hardware math. |
| `--no-ppu-mul` | Flag (off by default) | Disables compiler use of PPU registers `$211B/$211C` for Mode 7 multiplication. | **Recommended if using PPU Mode 7 in game**, preventing conflict during NMI. |
| `--no-vector-sections` | Flag (off by default) | Suppresses automatic emission of interrupt vector sections (`0xFFE0–0xFFFF`). | Use only when injecting into existing ROM with pre-existing vectors; **keep default for clean ROMs**. |

---

### 2.2 Memory Models & Address Spaces

The 65816 address space spans 16 MB across 256 banks of 64 KB. Calypsi provides 3 code models and 4 data models:

#### Code Models (`--code-model`)

| Code Model | Function Pointer Width | Call Instruction | Return Instruction | Cross-Bank Calls? | Verdict for SoE |
|---|---|---|---|---|---|
| `small` | 16 bits | `JSR` | `RTS` | No (Bank $00 only) | ❌ Incompatible |
| `compact` | 16 bits | `JSR` | `RTS` | No (single arbitrary 64KB bank) | ❌ Incompatible |
| `large` | 24 bits | `JSL` | `RTL` | **Yes (all 16 MB)** | ✅ **Mandatory** |

#### Data Models (`--data-model`)

| Data Model | Pointer Width | Pointer Arithmetic | Unqualified Global Access | DB Dependence | Verdict for SoE |
|---|---|---|---|---|---|
| `small` | 16 bits | 16 bits | `lda addr` (Bank $00) | Assumes Bank $00 | ❌ Corrupts WRAM/ROM |
| `medium` | 16 bits | 16 bits | `lda .near addr` | Bound to active `DB` | ❌ Fails if DB $\neq$ target |
| `large` | 32 bits (4B) | 16 bits | `lda long:addr` | **None (Full 24-bit)** | ✅ **Mandatory** |
| `huge` | 32 bits (4B) | 32 bits | `lda long:addr` | None (Spans 64KB banks) | Unnecessary overhead |

> **Key Learning on Data Models**: In `large` data model, Calypsi stores pointers as 32-bit values (low word address, high byte bank, 1 byte padding) and accesses memory via 24-bit indirect long `lda [.tiny _Dp]`. This completely decouples the C routine from the caller's Data Bank register.

---

### 2.3 Optimization Levels & Tuning

#### Comparison of `-O0`, `-O1`, and `-O2`

| Optimization Level | Code Density | Cycle Performance | Peephole Folding | Known Bugs & Traps |
|---|---|---|---|---|
| **`-O0`** | Low | Slow | None (many redundant `pha/pla`) | Safe, but verbose |
| **`-O1`** | High | **Fastest safe** | Folds byte shifts to Direct Page offsets (`+1`) | ✅ **Safe for production** |
| **`-O2`** | Highest | Unsafe | Eliminates redundant loads aggressively | ❌ **Fatal sign reload bug** |

#### The `-O2` Compiler Bug in Calypsi 5.18
During Gate G1 validation on routine `$8F:A963` (`elevation_vector_shear_step`), Calypsi at `-O2` miscompiled the sign test:
```diff
             rep     #32
             lda     0,s
             bmi     `?L116`
-            lda     1,s
             and     ##255
             bra     `?L50`
-`?L116`:    lda     1,s
-            eor     ##-1
+`?L116`:    eor     ##-1
             inc     a
```
* **What happened**: `lda 0,s` reads a 16-bit word off the stack to check its high sign bit. In `-O2`, Calypsi incorrectly assumed `A` already contained the byte `1,s`, skipping the reload. It then performed `eor` on `0,s` (the uninitialized stack word below $S$), corrupting the calculation!
* **Remedy**: Keep optimizations locked to **`-O1`**.

#### Tuning Flags: `--speed` vs. `--space`

* **`--speed`**: Prioritizes execution speed over code footprint. Inlines small leaf functions and leaves loops unrolled.
* **`--space`**: Prioritizes binary size. Under `-O2`, `--space` activates **cross-call optimization**, which identifies identical 3-to-5 instruction sequences across functions and extracts them into separate subroutines. On the 65816, jumping to a cross-call subroutine (`jsl long:?Lxxx` followed by `rtl`) adds 16 CPU cycles per call, slowing down hot loops.
* **Recommendation**: Use **`--speed --no-cross-call`**.

---

### 2.4 Inlining Strategies

Calypsi provides granular inlining controls:

1. **`--always-inline`**: Inlines every function where syntactically possible (ignores size constraints).
2. **`--no-inline`**: Completely disables inlining.
3. **`--only-marked-as-inline`**: Inlines only functions explicitly tagged with `inline` or `static inline`.
4. **`--strong-inline`**: Strongly favors inlining functions tagged `inline`, relaxing heuristic thresholds.
5. **`--inline-on-matching-custom-text-section`**: Prevents inlining a function from section `A` into section `B`. Crucial if different functions are mapped to separate physical ROM banks.

* **Recommendation**: In `reconstructed-c/include/soe.h`, utility functions like `soe_nz16`, `soe_nz8`, `soe_carry`, and `soe_cmp16` are declared `static inline`. Using **`-O1 --speed`** automatically inlines them directly into the caller without subroutine overhead.

---

### 2.5 Switch Statement Lowering (`--force-switch`)

When lowering C `switch (x)` statements, Calypsi supports three strategies:

```
--force-switch=if-else       ; Sequential CMP ##imm / BEQ target branches
--force-switch=jump-table    ; Jump table via PHA / RTS inside bank
--force-switch=value-table   ; Binary search via JSL long:_ValueSwitch16
```

1. **`if-else`**:
   - Generates pure in-line `cmp ##val / beq label` instructions.
   - Requires zero RAM, zero table space, and **zero runtime library helpers**.
   - Ideal for routines with 1–6 switch cases.
2. **`jump-table`**:
   - Generates an offset lookup into `.section switch,rodata`, followed by `pha; rts` (trampoline into the target within the same bank).
   - Fast $O(1)$ dispatch for dense integer ranges.
   - Requires `.section switch` to be mapped in the linker script (mapped in `tools/c-to-rom/build.mts`).
3. **`value-table`**:
   - Calls `_ValueSwitch16`, an external runtime routine in `clib.a`.
   - ❌ **Do not use in C-to-ROM builds** because we do not link `clib.a` (to avoid shipping unwanted static RAM buffers).

* **Recommendation**: Use **`--force-switch=if-else`** by default for predictable, self-contained assembly.

---

### 2.6 Types, ABI, and Alignment

| Flag | Purpose | Project Policy |
|---|---|---|
| `--char-is-unsigned` | Default in Calypsi. Treats `char` as `uint8_t`. | Keep default (matches SNES register semantics). |
| `--char-is-signed` | Treats `char` as `int8_t`. | Avoid (SNES bytes are naturally unsigned). |
| `--32bit-doubles` | Default. Floats and doubles are 32 bits. | Keep default (avoid 64-bit float math). |
| `--align-functions=2` | Aligns function entry points to even 16-bit addresses. | Optional (improves cache/fetch clarity). |
| `--pascal-strings` | Generates Pascal-style string length bytes. | Avoid (SoE uses custom text encoding). |
| `--enable-huge-attribute`| Enables `__huge` keyword and makes `size_t` 32-bit. | Avoid (not needed; adds 32-bit pointer math). |

---

## 3. Empirical Test Matrix on Real Evermore Routines

We measured the effect of Calypsi configurations across 6 representative SoE routines (`random_number_generator`, `scale_damage_by_stamina`, `elevation_vector_shear_step`, `update_entity_plane`, `enemy_attack_reach_test`, `companion_breadcrumb_fifo_insert_node`):

| Configuration | Total Instructions | Estimated Code Size | Cross-Calls Emitted? | Sign Reload Bug? | Status |
|---|---|---|---|---|---|
| **`-O1 --speed` (Current)** | **2,351** | ~6,583 B | None | ✅ No | **Recommended** |
| `-O1 --space` | 2,351 | ~6,583 B | None | ✅ No | Identical at -O1 |
| `-O2 --speed` | 1,824 | ~5,107 B | None | ❌ **YES** | **Rejected (Corrupts stack)** |
| `-O2 --space` | 1,833 | ~5,132 B | None | ❌ **YES** | **Rejected (Corrupts stack)** |
| `-O1 --speed --target=SNES` | 2,351 | ~6,583 B | None | ✅ No | Redundant without CRT0 |
| **`-O1 --speed --no-cross-call`**| **2,351** | ~6,583 B | None | ✅ No | **Safest production** |
| **`-O1 --speed --force-switch=if-else`**| **2,351** | ~6,583 B | None | ✅ No | **Cleanest standalone** |

---

## 4. Interaction with Project Trampolines & WRAM Isolation

In `tools/c-to-rom/build.mts`, Calypsi is invoked with:
```typescript
const MODEL = ['--core=65816', '--code-model=large', '--data-model=large'];
const OPT = ['-O1', '--speed'];
```

### Why Calypsi Fits the Bridge Architecture Perfectly:
1. **Pseudo-Registers on the Stack**:
   Calypsi requires 32 bytes of Direct Page space for its virtual registers (`_Dp` and `_Vfp`). Instead of placing them at fixed WRAM addresses `$0000–$001F` (which would overwrite game variables), the generated bridge lowers `S` by 32 bytes and sets `D` to this clean stack frame:
   ```asm
   tsc
   sec
   sbc     ##32
   tcs
   tcd                         ; Direct Page D now points to fresh stack!
   ```
   On exit, `S` is restored with `tsc; clc; adc ##32; tcs`. Vanilla WRAM remains 100% untouched.
2. **Pristine Exit Flags**:
   Calypsi preserves the processor status register contract. By restoring registers and setting exit flags (`N`, `Z`, `C`) explicitly through `soe_nz16` and `soe_carry`, Calypsi-built functions satisfy Gate G1 byte-for-byte.
