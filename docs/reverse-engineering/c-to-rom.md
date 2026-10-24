# From reconstructed C back into the ROM

> Status: **plan**, written 2026-10-24 (v0.343.0). Nothing here is built yet.
> The question: how do the C files in `reconstructed-c/` become source that compiles into the
> ROM, so the game looks and plays exactly as it does when built from the Asar export, and,
> ideally, the bytes match too?
> Read first: [asm-to-c-port.md](asm-to-c-port.md) (stages 0–6, the Asar export, lockstep),
> [c-compilation-hirom-memory-map.md](c-compilation-hirom-memory-map.md) (HiROM, C memory models).

---

## 0. What "identical" means here

There are two different goals, and they need different tools:

| Level | Name | Passes when | Who sees a difference if it fails |
|---|---|---|---|
| **L2** | behaviour-exact | For the same input movie, every frame ends with the same WRAM, VRAM, CGRAM, OAM and APU-port writes as the vanilla ROM, with the **same lag frames** | the player: a different picture, sound, RNG or a slowdown |
| **L1** | byte-exact | The compiled routine is the same bytes at the same address; with every routine matched, the ROM's SHA-1 is the vanilla one | nobody playing; it proves the C is complete, down to every side effect |

L2 is the requirement ("looks and feels identical"). L1 is the stretch goal and the strongest
proof, measured per routine.

**Why L1 needs our own compiler.** N64/GBA decomps match by running the original compiler.
SoE was hand-written in 65816 assembly: there was no compiler to match. No off-the-shelf
65816 C compiler emits what a human wrote. They have their own calling convention (arguments
in a direct-page register file, a software stack), run everything 16-bit, and call a runtime
library. The original passes arguments in A/X/Y, returns in the carry flag, switches width
mid-routine, falls through into shared tails and dispatches through `PHA : RTS`. So byte
matching needs a compiler whose lowering is built around this game's idioms (§4). That is
realistic one routine at a time. It is not realistic as a goal for routines that do something
no C statement expresses (§7).

**What C compiled by a stock compiler costs, even at L2:** the code is slower and larger. SoE
uses most of its frame time in busy rooms, so a slower routine adds lag frames. Lag frames
are an L2 failure (the game *feels* different), so each routine's cycle count is checked (§5,
G3).

---

## 1. Where the C stands today

Measured on 2026-10-24 over `reconstructed-c/` (258 files, ~18,900 lines, ~550 function
definitions):

| Finding | Count | Why it blocks a build |
|---|---|---|
| Files that fail `clang -std=c99 -fsyntax-only` | 45 / 258 | mostly undeclared functions; some are prose examples, not routines (`808100_how_to_create_a_game_decomp.c`, `FFFFFF_*`) |
| Files declaring their own `extern` WRAM globals | 224 | no shared header; 898 distinct extern names |
| WRAM addresses with more than one name | 32 | e.g. `$7E:0100` is `g_frame_counter` and `g_frame_counter_lo`; one name per address is required |
| Address prefixes with two files | 8 | the same routine reconstructed twice (`80A1B4_hdma_gradients.c` / `80A1B4_weather_blending.c`) |
| Raw 24-bit ROM pointer casts (`*(const uint16_t *)0x928002`) | 11 files | meaningless on a host; on the SNES it hard-codes data that must stay movable |
| `float` / `double` / `<math.h>` | 2 files | the 65816 has no floating point; the original is fixed-point |
| snesrecomp machine C (`CpuState *cpu`) | 3 files | generated code, not decompiled C |

Beyond what a script can count, most files are **descriptions in C syntax**: they give the
control flow and intent, but drop what the hardware sees. That includes direct-page scratch
writes, the carry flag as a return value, 8-bit wraparound, which register carries an
argument, and the exact order of I/O writes. PROGRESS.md counts these files as "clean C".
In the gates of §5, every one of them is at **G0 or below**.

So turning them into build input is a **rewrite into a stricter form, proven one routine at a
time**. The existing files remain the best map of what each routine does.

---

## 2. The build: Asar stays the base, C replaces routines

```text
 user's ROM ──► export asar (byte-exact, stage 1) ──► banks/bank_XX.asm
                                                          │  routine R: asm body
 reconstructed-c/<bank>/R.c ──► c816 ──► out/c/R.asm ─────┘  replaced by `incsrc out/c/R.asm`
                                                          ▼
                                                    asar main.asm ──► out.sfc ──► gates G3 / G4
```

- **The ROM is always built by Asar** from the stage-1 export, which already rebuilds
  byte-identically. A routine moves to C by replacing its body in the bank file with the
  compiler's output. Everything not yet in C stays asm. The ROM boots at every step.
- **The compiler emits Asar source, not object files.** Labels stay symbolic (calls to asm
  routines, tables, WRAM names from `ram.asm`). Asar resolves them, so no linker is needed.
  The output can be diffed against the export's listing line by line.
- **Two placements:**
  - *in place*: `org` at the routine's own address. The output must not be larger than the
    original, and any gap is filled with the original's remaining bytes. This is the only
    placement that can reach L1, and it needs no shiftable disassembly.
  - *relocated*: the code goes to free ExHiROM space, with a `JML` at the old address. It can
    never be L1, and it costs 4+ cycles per call. Use it only when the C cannot fit, and only
    once stage 2 (shiftable) covers the bank's pointers.
- **One source, two targets.** The same `.c` file also compiles on the host (clang) against
  a flat `g_ram`, for the unit tests (G1) and as a snesrecomp `hle_func` (G2). The dialect's
  macros (§3) expand to `g_ram` accessors on the host and to annotations c816 reads.
- **Nothing generated is checked in** (`AGENTS.md` §0.1): the export, `out/c/*.asm` and
  `out.sfc` live in `out/` or the CDL library. The C refers to ROM data only by label. The
  data comes from the user's ROM at build time.

The export needs one addition: every known routine has to be its own labelled block with a
known end, so the build can replace exactly that block. Routines still exported as
`incbin rom.bin` (never executed by the CDL) cannot be replaced until they are recorded.

---

## 3. The form each C file must reach ("SoE-C")

A restricted C. Every rule exists because the 65816 or the original code needs it:

**Memory: one name per address, generated.**
- No `extern` in routine files. A generated header `soe_wram.h` comes from the knowledge
  entries and `ram.asm`, with exactly one name per address (resolve the 32 conflicts first):
  `SOE_WRAM(uint16_t, current_room_id, 0x0ADB)`.
- Records are structs with offsets checked by `_Static_assert(offsetof(...) == 0x18)`, never a
  field order that only happens to work.
- **Direct-page scratch is real memory.** When the asm uses `$00–$1F` as temporaries, that is
  a WRAM write, and the L2 frame diff sees it. Declare those slots (`SOE_DP(uint16_t, t0, 0x00)`)
  and write the same values. A C local that the asm kept in DP is an L2 failure.
- ROM data by label only: `SOE_ROM(const uint16_t, map_table, ...)`, resolved by Asar to the
  export's table label. No numeric ROM pointers, no copied table contents.

**Types: the machine's widths.**
- `uint8_t`, `uint16_t`, `int8_t`, `int16_t`, plus a 24-bit `far_ptr` type. No `int`, no `long`
  (their width is the compiler's choice), no floating point. 32-bit values only where the asm
  does 32-bit math in two halves, through a helper that says so.
- C promotes `uint8_t` to `int` before arithmetic. Write the cast back to the width the asm
  wraps at, every time (`x = (uint8_t)(x + 1)`). A check tool rejects implicit wraps.
- No libc. `memcpy` becomes the game's own routine or an `MVN` intrinsic.

**Interface: the game's calling convention, written down.**
- Each function declares its entry state and its register interface, from the asm:
  ```c
  SOE_ROUTINE(random_below, 0x80AD62, SOE_M16 | SOE_X16 | SOE_DB_7E)
  SOE_OUT_A uint16_t random_below(SOE_IN_A uint16_t limit);
  ```
  Inputs in A/X/Y, outputs in A/X/Y or a flag (`SOE_OUT_CARRY bool`), registers it
  preserves, DB/D it assumes, and `JSR` vs `JSL`. The remaining asm callers keep working
  only if this matches exactly.
- Tail jumps (`JMP`/`JML`/`BRA` into another routine) are `SOE_TAILCALL return f(...)`.
  Falling into the next routine is `SOE_FALLTHROUGH(next)`. Routines that share a body
  through several entry points stay one C function with marked entries, not copies.
- Jump tables are `switch` statements annotated with the table's label, so the compiler
  emits the original `JMP (table,X)` / `PHA : RTS` dispatch against the existing table.

**Hardware: named, ordered, timed.**
- I/O through a game-neutral SNES header (`src/platform/` facts: `INIDISP`, `VMADD`, DMA
  channel structs), all `volatile`, in the asm's order.
- Hardware multiply/divide through intrinsics that emit the wait the asm uses, since the
  result is not ready immediately.

**Bookkeeping in the header comment:** `$bank:addr`, `name` (same as the knowledge entry's),
`gate: G0..G4`, and what is not modelled yet. One routine is in exactly one file, and the
code VFS (`soe://rom/code/<name>/<name>.c`) shows that file. Prose examples move out of
`reconstructed-c/` into the docs that quote them.

### Before and after (shape only)

Today ([808B66_main_loop.c](../../reconstructed-c/80/808B66_main_loop.c)):

```c
extern uint16_t g_current_room_id;  /* $7E:0ADB */
uint16_t initial_room = *(const uint16_t *)0x928002;
```

Target:

```c
#include "soe_wram.h"   /* current_room_id @ $0ADB, generated */
#include "soe_rom.h"    /* start_room_id: label in the export's tables */
current_room_id = start_room_id;
```

---

## 4. The compiler (`c816`)

A TypeScript tool (`tools/c816/`, by the language rule) with three parts:

1. **Front end: clang.** `clang -Xclang -ast-dump=json -fsyntax-only` with the SoE headers
   gives a fully typed AST, including implicit casts. We do not write a C parser.
2. **Lowering to the game's idioms.** Instruction selection that knows the patterns the
   original uses: width switches around 8-bit stores, `STZ`, `INC`/`DEC` for ±1, `CLC : ADC` /
   `SEC : SBC`, carry returns, indexed record access `LDA $18,X`, `MVN` copies, the DB juggling
   (`PHB : PEA : PLB`). The output for one routine is an Asar block.
3. **Match mode** (for L1, developer tool only). Many statements have several equivalent
   encodings: `STZ` vs `LDA #0 : STA`, X vs Y as index, branch layout, block order. Match
   mode reads the routine's original bytes from the user's ROM at run time, tries the
   equivalent choices, and reports the ones that match **as hints to write into the C**
   (`SOE_INDEX_Y`, `SOE_BLOCK_ORDER(...)`). The normal build reads only the C: the same file
   always compiles to the same bytes, with or without a ROM present.

**Correctness of c816 itself** is tested differentially: compile a routine, run the output
in `src/platform/snes/cpu65816.ts`, run the host build of the same C, and compare on the
same inputs. This tests the compiler apart from the decompilation.

Stock compilers (Calypsi, the old tcc-816 SDK, WDC's) remain an option only for **new** code
in free space behind a trampoline (mods, `snes-asm-asar-patching`). They cannot reach L1
and need an ABI bridge for every call into the game.

---

## 5. Gates: when a routine counts as done

Each routine climbs these in order. The gate is written in its C header and in its knowledge
entry, so `soe://rom/code/todo.md` and PROGRESS.md can count by gate, not by "a C file exists".

| Gate | Check | Tool |
|---|---|---|
| **G0** | Parses and type-checks as SoE-C (`-Werror`, check tool: no `extern`, no `int`, no raw pointers, no implicit wraps) | clang + `tools/check-soe-c.mts` |
| **G1** | **Host-equal to the asm:** on recorded entry states (WRAM + registers captured at the routine's entry during sample playbacks) and on generated edge cases (0, max, signed edges, every switch case), host C and the original asm run in `cpu65816.ts` end with the same WRAM, registers and flags | node test, ROM tier |
| **G2** | snesrecomp with this `hle_func` diffs the same as without it | `npm run recomp:lockstep` |
| **G3** | **Behaviour-exact in the ROM:** c816 output spliced into the Asar build; every stored playback (`sample-playbacks`) gives per-frame WRAM/VRAM/CGRAM/OAM hashes and lag-frame counts equal to vanilla; the routine's cycles per call ≤ the original's | headless snes9x, emulator tier |
| **G4** | **Byte-exact:** c816 output (no match mode) equals the original bytes; when every routine is G4, the ROM SHA-1 is vanilla | Asar build + compare |

G1 is the gate that catches most errors cheaply. Run it on every edit. G3 is slow and runs on
demand (`test-discipline`). If G2 is blocked by the recomp's known timing drift, it may be
skipped; G1 and G3 may not.

---

## 6. Converting one routine

1. **Pick** a routine whose callees are already G3 or still asm (leaves first). Good first
   candidates: small pure leaves (`random_below`, the `face_*` helpers), then decoders whose
   behaviour we already verified in TS (LZSS `$8C:988D`, used by the map editor).
2. **Write down the interface** in the knowledge entry from the asm
   (`soe://rom/code/<name>/<name>.asm`, CDL widths): registers in/out, flags out, DP/stack
   scratch, DB/D, I/O.
3. **Rewrite the C** into SoE-C, starting from the existing file, and keep every side
   effect. Merge duplicate files. Mark what is still unknown.
4. **G0 → G1.** On a G1 mismatch, the C is wrong, never the test: the asm is the reference.
5. **G3**, then try **G4** with match mode, and write the hints it finds back into the C.
6. **Record:** gate in the C header and the knowledge entry, new facts per `game-knowledge`.

**Order across the engine:** leaves → their callers, one subsystem at a time (decoders, text,
math, entities, combat, room loader). **Timing-critical code goes last:** NMI (`$80:823A`), the IRQ dispatcher
(`8084EE_irq_dispatch.c`), the SPC upload and handshake (`$8C:805C`, `$8C:81FD`), HDMA setup, anything
that polls `$4212`. These may stay asm at L2, since they depend on cycle counts no C
statement states.

Event scripts are bytecode and stay bytecode (everscript); only the engine is C.

---

## 7. What may never reach L1, and is fine at L2

- Self-modifying code or code copied to WRAM: stays asm.
- Code that relies on exact cycle counts (the timing-critical list above).
- Shared tails and overlapping instructions used as data: expressible with
  `SOE_FALLTHROUGH` and labels, but matching may need asm islands (`SOE_ASM("...")`) of a few
  lines. An island counts against G4 for that routine and is listed in its header.
- Dead code inside a routine (bytes that never run): kept as an `incbin` gap of the routine's
  own bytes, not invented C.

---

## 8. Prerequisites, in order

| # | Work | Unblocks |
|---|---|---|
| 1 | Generate `soe_wram.h` / `soe_rom.h` from knowledge + `ram.asm` + export tables; fix the 32 double names | G0 for every file |
| 2 | `tools/check-soe-c.mts` (dialect rules) + clang syntax pass in `npm run check:*` | G0 |
| 3 | Entry-state capture during playbacks + the G1 harness on `cpu65816.ts` | G1 |
| 4 | Asar export: one labelled, splittable block per known routine | splicing |
| 5 | `c816`: clang AST → Asar, with the differential tests | G3 |
| 6 | Per-frame WRAM/VRAM/CGRAM/OAM + lag-frame diff of a built ROM vs vanilla over the stored playbacks | G3 |
| 7 | Match mode | G4 |
| 8 | PROGRESS.md and `todo.md` count by gate | honest metrics |

**First milestone:** one leaf routine through G4 in place. It exercises every step of the
pipeline on the smallest possible input. Then a whole small subsystem through G3.

---

## 9. Traps

- **Stack page is WRAM.** `$0100–$01FF` is in the frame diff. Bytes left below the stack
  pointer differ when C pushes differently. G3 compares that page only above S, or the C
  pushes the same values. Decide this once, in the harness, not per routine.
- **The CDL widths are per instruction.** A routine entered at both 8- and 16-bit has two
  interfaces: two `SOE_ROUTINE` entries, or one with a width parameter.
- **US addresses only.** Gates run on the US ROM. A PAL build differs (`docs/evermore-releases.md`).
- **The asm is the oracle, not the old C.** Many existing files were written from reading the
  code, not from a test. When the old file and the asm disagree, the old file is wrong.
- **Third-party disassemblies are off limits** (`AGENTS.md`): every interface and idiom comes
  from our own export, CDL and traces.
