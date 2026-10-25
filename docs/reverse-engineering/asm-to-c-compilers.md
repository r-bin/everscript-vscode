# SNES 65816 C Compilation: Architecture, Compilers, and Parity Guide

> **Status:** Written 2026-10-25 (v0.353.1+).  
> **Purpose:** Authoritative reference on lifting 65816 assembly to C, evaluating 65816 C compilers, configuring toolchains for the Super Nintendo, and achieving ~1.0x instruction and cycle parity with original ROM assembly.

---

## 1. Executive Summary: The Parity Breakthrough

Historically in this project, reconstructed C routines in `reconstructed-c/` compiled to 4x–27x the instruction count of vanilla 1995 assembly. Early assumptions attributed this to 65816 compiler inefficiencies or lack of architectural fit.

**Rigorous empirical testing disproved this assumption.**

When Calypsi 65816 is given clean, idiomatic C with native register parameters and typed structs, it compiles C to **virtually 1:1 assembly parity with hand-written 1995 code**:
- **Vanilla Hand-Written 65816 ASM:** 18–29 instructions
- **Legacy `SOE_BIND(soe_regs r)`:** 346 instructions (11.9x bloat)
- **Native Typed C (`scale_damage_typed`):** **35 instructions (~1.2x parity)**
- **Hardware Primitives with `__asm`:** **25 instructions (1.0x bit-exact parity)**

The bottleneck was **how we wrote the C files and bridge**, not the compiler.

---

## 2. The 65816 C Compiler Landscape

We evaluated all viable C compilers capable of generating WDC 65816 machine code:

| Compiler | Maturity | License | Code Quality | 24-bit Far Pointers | Verdict & Role |
|---|---|---|---|---|---|
| **Calypsi 65816** (v5.18) | Production | Proprietary (Free non-commercial) | ★★★★★ (0.9x–1.2x vanilla) | Native (`--data-model=large`) | **Winner: Best overall compiler for SNES ROM builds** |
| **loomcc** (Sept 2026) | Cutting-edge | MIT (Open Source, Rust) | ★★★★☆ (0.37x cycles vs 816-tcc) | Flat data model | **Best open-source compiler for standalone modules** |
| **vbcc 65816** (Release 2) | Active | Proprietary (Free non-commercial) | ★★★☆☆ (Heavy stack spills) | Supported (`__far`) | Viable alternative for C99 math |
| **816-tcc** (PVSnesLib) | Legacy | LGPL 2.1 | ★☆☆☆☆ (Bloated stack churn) | 16-bit segmented only | Deprecated; crashes on C99 / `const` |
| **llvm-mos-65816** | Experimental | Apache-2.0 w/ LLVM Exp. | ★★★★☆ (Native A16/XY16) | Supported | Future potential once merged upstream |

### Why Calypsi 65816 Was Chosen
1. **Instruction Density:** Generates the most compact 65816 code available, matching or beating hand-written assembly on control flow and arithmetic through tail-merging.
2. **24-bit Large Memory Models:** Seamlessly addresses all 16 MB of SNES address space via `--code-model=large` (`JSL`/`RTL`) and `--data-model=large` (24-bit pointers). Memory access is completely independent of the caller's Data Bank (`DB`).
3. **SNES Hardware Acceleration:** `--target=snes` links directly with SNES 5A22 hardware multiplication (`$4202/$4203`), division (`$4204/$4206`), and PPU Mode 7 registers (`$211B/$2134`).
4. **Peephole Optimization:** Folds byte shifts into Direct Page byte-offset loads (`res >> 8` becomes `lda dp:.tiny (_Dp+1)`), saving dozens of shift cycles.

---

## 3. Recommended Compiler Setup & Flags

### 3.1 Invocation Flags
```sh
cc65816 \
  --target=snes \
  --core=65816 \
  --code-model=large \
  --data-model=large \
  -O1 \
  --speed \
  --no-cross-call \
  --force-switch=if-else \
  -I reconstructed-c/include \
  -c source.c -o source.o
```

### 3.2 Flag Justification
- **`--target=snes`:** Defines `__CALYPSI_TARGET_SNES__`, enables hardware math routines, and supplies linker memory scripts.
- **`-O1 --speed`:** Mandatory over `-O2`. As documented in Gate G1, Calypsi 5.18 at `-O2` has a compiler bug that drops the sign reload after `lda 0,s`, corrupting stack memory. `-O1 --speed` is safe, fast, and passes 100% of differential tests.
- **`--no-cross-call`:** Prevents the compiler from extracting duplicate instruction sequences into shared subroutines (`jsl ?Lxxx`), eliminating ~16 cycles of call/return overhead per instance.
- **`--force-switch=if-else`:** Lowers `switch` statements to compact `cmp ##val; beq target` branch chains without linking external runtime tables.

---

## 4. Key Architectural Learnings

### 4.1 The Direct Page ($D$) Trap: Stack vs. Fixed Allocation
- **The Mistake:** To prevent Calypsi's 32-byte pseudo-registers (`_Dp`) from overwriting vanilla WRAM `$0000–$001F`, early bridges moved the stack pointer $S$ down 32 bytes and set $D$ to that stack frame (`tsc; sbc #32; tcs; tcd`).
- **The Consequence:** Because $D$ was hijacked, C code could not access Evermore's actual Direct Page variables ($00..$FF) via 1-byte opcodes (`LDA $82`). Every read expanded to a 24-bit far indirect access (`LDA [.tiny _Dp]`), exploding execution time by 20x.
- **The Solution:** In Bank `$00` WRAM, addresses `$0140..$01FF` are completely unused by vanilla Secret of Evermore. Configuring the linker (`rules.scm`) to place Calypsi's `registers` section at a fixed address (e.g. `$01C0..$01DF`) allows $D$ to remain static ($0000). Direct Page reads become native 1-byte opcodes.

### 4.2 The `soe_regs *r` CPU-Emulator Antipattern
- **The Mistake:** Wrapping every function in `void func(soe_regs r)` treated each C routine as a CPU simulator running inside the CPU. Register reads and writes became indirect memory dereferences through stack pointers.
- **The Solution:** Recover native function signatures:
  ```c
  // Bad (346 instructions):
  void scale_damage(soe_regs r);
  
  // Good (35 instructions):
  uint16_t scale_damage(Entity __far *e);
  ```
  Calypsi passes the first argument in `A`, second in `X`, and returns in `A`. Register transfer is immediate with zero memory traffic.

### 4.3 Inline Assembly (`__asm`) Syntax and Disciplines
For hardware micro-primitives where pure C cannot represent 65816 opcodes (e.g. `ROL A` carry-chain propagation), Calypsi supports inline assembly:
- **Whitespace Rule:** Instructions **must have leading whitespace** (e.g. `"  lda 0x0139\n"`). Column 0 is reserved for labels.
- **Register Constraints:** Use class `K`: `"=Kc"` for 16-bit C accumulator, `"=Ka"` for 8-bit accumulator, `"Kx"` for X register, `"Ky"` for Y register. Only one output parameter is supported per block.
- **Hex Literals:** Must use C-style `0x0139`, not assembly `$0139`.
- **Stack Balance:** In 16-bit mode ($M=0$), `php` pushes 1 byte, but `pla` pulls 2 bytes. To capture flags without corrupting the stack pointer:
  ```assembly
  php
  sep #0x20   ; 8-bit A pulls exactly 1 byte
  pla
  rep #0x20   ; restore 16-bit A
  ```

### 4.4 The FastROM Speed Dividend (3.58 MHz)
Vanilla Secret of Evermore executes out of SlowROM at **2.68 MHz** (8 master clock cycles per bus cycle). Calypsi-compiled code in the 4th megabyte (`$F80000+`) executes in **FastROM at 3.58 MHz** (6 master clock cycles per bus cycle). This provides an automatic **33.3% hardware speedup** across every CPU cycle, meaning C code with ~15% more instructions actually executes faster in wall-clock microseconds than vanilla hand-written SlowROM assembly.

---

## 5. The ASM-to-ASM Lifting Workflow

When lifting a vanilla 65816 routine to C:
1. **Disassemble Baseline:** Run `npm run c-to-rom:diff-asm -- <name>` to view the original ROM assembly.
2. **Identify True Signature:** Determine the true input parameters (registers `A`, `X`, `Y` or Direct Page) and return value.
3. **Write Typed C:** Use explicit `uint16_t` / `uint8_t` widths and typed structures (`Entity*`, `Item*`) rather than raw pointer arithmetic.
4. **Fold Condition Codes:** Never emulate processor flags (`r->n = ...`). Use idiomatic `if / else` statements.
5. **Verify with Parity Gate:**
   ```sh
   npm run c-to-rom:asm-parity
   ```
   - Target ratio: `<= 1.2x`.
   - If ratio `> 1.2x`, inspect emitted assembly via `diff-asm.mts` and eliminate redundant 32-bit math or pointer spills.
   - For micro-primitives, implement an optimized variant under `#ifdef SOE_OPTIMIZE` or retain native ROM ASM.
