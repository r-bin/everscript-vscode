# C to ROM: what we learned, and the next steps

> Open work for compiling `reconstructed-c/` into a SNES ROM. Written 2026-10-24 (v0.351.0) after
> the first session. The details and measurements are in
> [c-to-rom.md §7a and §10](../reverse-engineering/c-to-rom.md); this page is the plan.

## 1. Where we are

- A working pipeline with one compiler (Calypsi 5.18): `tools/c-to-rom/` builds the vanilla ROM
  with bound C routines in banks `$F8–$FB`, a per-routine check (G1) and a 2:20 reference
  (`intro-2m20.evsmv`).
- 27 routines are exact C: each leaves the same WRAM, registers and flags as its asm on every
  sampled and fuzzed entry state. The ROM with them plays the whole intro and attract loop.
- The other 255 C files are descriptions: 205 compile with Calypsi on their own, 50 do not, and
  223 call functions or globals that exist nowhere (`g_hw`, `snes_write_cgadd`). None of them can
  replace its ROM routine as written: their interfaces are made up (parameters instead of
  registers and direct page) and their behaviour differs (no 8-bit wrap, other flags).

## 2. What we learned

1. **Per-frame identical WRAM needs cycle-exact code.** The main thread is still busy at ~92% of
   NMIs and time-slices its work, so adding 8 cycles to one routine changes WRAM for good from
   frame 474, with the RNG frozen or not. No stock compiler gives the asm's cycles on every path.
2. **The C must be written against the asm, not from a description.** Inputs where the asm keeps
   them, every exit register and flag (`PLY`/`PLB`/`TDC` set N Z; `BIT #imm` sets only Z), DB- and
   D-relative operands, 8-bit wraps, bank carries of indexed operands.
3. **A compiler's own scratch must not touch WRAM.** Calypsi keeps 20 bytes of pseudo-registers in
   the direct page; the bridge moves D into fresh stack, so only the dead stack below S changes.
   However, moving D to stack means C cannot access Evermore's DP ($00..$FF) via 1-byte direct page
   instructions, expanding DP accesses into 24-bit far pointers (8–15 instructions per access).
   Additionally, Calypsi leaves local variables and DP scratch in dead stack below S ($7E:1F8E..$7E:1FCB),
   causing false-positive WRAM diffs in full-RAM comparisons even when game state is identical.
4. **Micro-primitives belong in native assembly.** Routines like `random_number_generator` ($80:859B)
   are 25 instructions (~75 cycles) in ROM. Calling them via C bridge indirection costs ~100 instructions
   and ~700 cycles. When called in cycle-tight frames (e.g. frame 374 during LZSS tile decompression),
   this extra overhead delays decompression past the scanline 224 NMI boundary. In `c-to-rom`, unbound
   routines remain vanilla ASM: high-frequency micro-primitives should stay in ASM, while C targets
   game logic, script VMs, and entity systems.
5. **Pre-ROM benchmark gate (~1:1 instruction budget).** Before binding a C function into the ROM,
   its compiled assembly must be audited against the original ROM disassembly (`diff-asm.mts` and `g1.mts`).
   If the instruction expansion exceeds a target budget (e.g. >1.5x), iterate on the C (using
   `SOE_OPTIMIZE`, Calypsi inline assembly `__asm`, direct bank pointers `SOE_BANK(r)`, or eliminating
   far helper calls like `soe_cmp16`) to approach 1:1 before binding into the image.
6. **The compiler can be wrong.** Calypsi `-O2` miscompiles a byte sign test; a comma expression in
   a condition took a wrong branch. Only the per-routine check found them.
7. **Speed is a property, not a goal.** Bridge (~32 instructions) plus Calypsi `-O1` code: 7–60x
   the asm per call; the intro runs 2.9x slower (room `$31` at frame 7498 instead of 2593).
   Faster variants live only under `#ifdef SOE_OPTIMIZE` (AGENTS.md rule 11).
8. **The settings were never compared.** Large code and data model, `-O1 --speed`, no
   `--target=SNES` were picked for correctness, not measured against alternatives.

## 3. Next: find a compiler setup that can produce the ROM

Start with **one function**, compare compilers and configurations on it, then expand.

### 3.1 Requirements a setup must meet (in this order)

| # | Requirement | How we check it |
|---|---|---|
| R1 | Runs here (macOS arm64, else Linux), licence lets us fetch and use it (never commit it) | install script like `tools/c-to-rom/calypsi.mts` |
| R2 | Places code at a fixed HiROM bank and emits bytes with addresses (hex, raw, or an object we can link) | the patched image boots |
| R3 | Callable from asm and calling asm (JSL/RTL), with its scratch kept off live WRAM | bridge + G1: no WRAM byte outside the dead stack differs |
| R4 | Correct code: the routine passes G1 at the chosen settings | `g1.mts` |
| R5 | Cost per call (instructions, then cycles) | G1's last column; a cycle count is to add |
| R6 | Cycle predictability: can its output be padded to the asm's cycles (the per-frame goal) | to design |

### 3.2 Candidates (status to verify before use)

| Compiler | Why | Notes |
|---|---|---|
| Calypsi 5.18 | works now | baseline; closed source, personal non-commercial licence, x86_64 under Rosetta |
| vbcc (65816 port) | optimizing, C99, has a SNES target | [nesdev thread](https://forums.nesdev.org/viewtopic.php?t=25773); licence and macOS build to check |
| 816-tcc (PVSnesLib / SNES-SDK) | the common SNES homebrew compiler, open source | [tcc-65816](https://github.com/nArnoSNES/tcc-65816) (archived fork); WLA-DX output; its DP pseudo-registers |
| llvm-mos-65816 | optimizing, open source, LLVM | [llvm-mos-65816](https://github.com/wbniv/llvm-mos-65816): preview builds, LoROM demo; HiROM and our ABI to check |
| loomcc | new 65816 compiler, emits WLA-DX | [loomcc](https://github.com/rje/loomcc): whole-program, links with 816-tcc objects; maturity to check |
| WDC 816CC, ORCA/C | the 65816 vendor's compiler; the Apple IIGS compiler | not confirmed: availability, licence, host |
| our own (cycle-exact) | the only route to R6 | last resort, after the comparison |

### 3.3 Configurations per compiler

Optimization level (none … highest, speed vs size), code model (one bank with JSR vs 24-bit
JSL), data model / pointer width, target options (hardware multiplier: changes I/O, must fail
R3/R4), where the scratch registers go, calling convention (register vs stack arguments).

### 3.4 Steps

1. **Harness per compiler.** `build.mts` gets a backend interface: compile + link one C file to
   bytes at an address, plus that compiler's bridge (its ABI, its scratch). G1 and `compare.mts`
   stay the same.
2. **Probe function: `random_number_generator`** (`$80:859B`, documented version): small, hot,
   uses carry and DB-relative words. Every compiler × configuration: R1–R5, one table.
3. **Choose** the setup(s) that pass R1–R4 with the lowest R5; write the choice and the table here.
4. **Expand** to the 27 exact routines on the chosen setup, then routine by routine through the
   282 known routines the 2:20 reference runs (leaves first).
5. **All C files, as they are (an experiment):** stubs for the missing symbols, bind every
   function that names a ROM address, record which files break and how. Data for the rewrite.
6. **Per-frame identity (R6):** only after 1–4: a cycle counter in G1, then either padding the
   chosen compiler's output or a timing-independent reference (both images patched alike).

## 4. Open questions for the owner

- Keep or restore the old description functions removed when a routine got its exact file
  (`909DE8_tile_collision.c`, `809685_actor_lifecycle.c`, `8FA93B_ramp_elevation.c`, parts of five
  others)? AGENTS.md rule 11 says the documented code is not to be changed.
- Is per-frame identity still the goal after the compiler comparison, or per-routine exactness?
