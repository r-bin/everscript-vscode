# From traced ASM to C: the Secret of Evermore port process

> Status: **in progress.** Stage 1 (byte-exact Asar export) shipped in v0.156.0, room/string
> relocation in v0.158.0, and the stage 3 lift via snesrecomp in v0.159.x. Where this
> stands and what comes next: §11.
> Prerequisite reading: [tracing-disassembler-and-asar-generation.md](tracing-disassembler-and-asar-generation.md).
> Step-by-step usage: [workflows/cdl-export-build-recomp.md](workflows/cdl-export-build-recomp.md).

---

## 0. What "decomp" can mean for this game

N64/PS1 decomps are *matching*: someone writes C that the original compiler turns back
into the identical bytes. That is not possible here. SoE's engine is hand-written 65816
assembly. There was never C and never a compiler to match.

So the target is **new C that behaves exactly like the asm**. The correctness oracle is
behaviour, not bytes:

| Stage | Oracle |
|---|---|
| Disassembly | Rebuilt ROM is byte-identical to the original |
| Shiftable disassembly | Rebuilt ROM *with padding inserted* plays identically |
| C port | WRAM/VRAM/OAM/CGRAM identical to the real ROM at the end of every frame, given the same inputs |

This is the method used by snesrev's `zelda3` (A Link to the Past) and `sm` (Super Metroid).
Those ports convert the game logic to C. The PPU and the SPC700 audio driver stay
emulated.

**A useful fact about SoE:** much of the game logic is script bytecode, which everscript
already decompiles. The C port only covers the engine: script interpreter, physics, combat,
room loader, decompression, and the DMA/PPU glue. Scripts stay as data, or as everscript
source.

---

## 1. Pipeline overview

```text
 Stage 0  CDL coverage          play / TAS / merge sessions until coverage plateaus
 Stage 1  Byte-exact Asar       ✅ v0.156.0 — export asar, rebuild, hash matches
 Stage 2  Shiftable Asar        every address is a symbol; padding test passes
 Stage 3  Mechanical lift       ✅ snesrecomp, CDL-seeded — compiles; not booting yet (§11)
 Stage 4  Lockstep hybrid       hand-written C replaces routines (snesrecomp hle_func); RAM diff = 0
 Stage 5  Cleanup               registers → locals, addresses → struct fields, enums
 Stage 6  Break compatibility   widen ids, data-driven tables, new content
```

Every stage has a pass/fail check. Do not start a stage until the previous one passes:
the later oracles assume the earlier ones hold.

---

## 2. Stage 0 — coverage

- Record with the CDL tab across many sessions; the per-ROM library merges them (OR/min/max/union).
- Best sources of coverage: a full 100% playthrough, a TAS movie (fast and covers odd
  paths), and deliberate edge cases: every alchemy, every menu, death, game over, every
  boss, every room entered from every door.
- Watch for **M/X conflicts**: an instruction executed with both 8- and 16-bit widths. Each
  one is a routine with several entry states. Stage 3 has to specialise on those.
- Unexecuted code is a real risk. Anything the CDL never saw run is exported as data and
  will be missing from the C port. Keep a "never-executed but reachable" list: targets in
  jump tables that were never hit.

## 3. Stage 1 — byte-exact disassembly (done)

`export asar` from the CDL tab rebuilds the ROM byte for byte (verified on vanilla and
patched SoE). It also writes `ram.asm`, which lists every WRAM address with its width,
the functions that read or write it, and the values seen.

Passing this stage only proves the bytes are in the right *places*. It does not prove the
code is *understood*: a hard-coded `$9FFDE7` and a label `MapPointerTable` assemble to
the same bytes.

## 4. Stage 2 — shiftable disassembly

**This is the stage that lets you move data around.** See §8 for the full treatment.

The goal is that every address in the program is written as a symbol, so the assembler can
place things anywhere. The test, taken from the pokered/pokeruby projects, is:

1. Insert N bytes of padding at the start of a bank (or before a table).
2. Rebuild. The ROM is no longer byte-identical; that is expected.
3. Play the same input movie on the original and the shifted ROM; diff RAM every frame.
4. A divergence means some pointer is still a raw number. Find it, symbolise it, repeat.

Run it for every bank. When every bank survives padding, the disassembly is shiftable.

## 5. Stage 3 — mechanical lift to C

Translate each routine into C over an explicit CPU state. Correct first, readable later.

### 5.0 Use snesrecomp for the lift (v0.159.0)

[snesrecomp](https://github.com/RetroPortingToolKit/snesrecomp) already is this lifter: a
static 65816 → C recompiler with an M/X-tracking analyzer, an interpreter fallback for code
it cannot resolve, and a runner that models the PPU/APU/DMA (HiROM supported; it is how
the SMW, ALttP and Mega Man X ports were made). We feed it what only our CDL knows.

Every export writes `recomp/cfg/bankXX.cfg`, one per bank code ran in (the runtime bank,
`$80`–`$91` for SoE, not `$C0`):

```text
bank = 8c
func func_CC9A76 9a76 entry_mx:0,0        # entry widths as recorded
# indirect at 9951 -> 8C9A76,8C9A7D,...   # observed jump-table targets, to become indirect_dispatch
```

`bank00.cfg` adds `auto_vectors` and `data_region` lines for the known regions (rooms,
strings, key tables), so the analyzer never decodes them as code.

`./recomp.sh` (needs `SNESRECOMP=<checkout>`, Python 3.9+, Rust/cargo for the analyzer,
CMake + Ninja) scaffolds `recomp/project/` once with `snesrecomp build`, copies the seeds
into `config/`, runs `snesrecomp generate --cfg-roots`, and builds the static library.
The result is C for the game code, not a playable port: that still needs a host frame
driver (snesrecomp's `src/game_rtl.c` step), and the lockstep check of §6.

**First run on SoE (v0.159.1, 4 MB library ROM, 412 recorded entries):**

| | roots | function variants | native C (AOT) | interpreter only (LLE) | edges |
|---|---|---|---|---|---|
| vectors only (`snesrecomp build`) | 9 | 61 | 57 | 4 | 722 |
| with CDL seeds | 420 | 1084 | 708 | 376 | 9772 |

The seeded run took about 60 s with the analyzer build. It produced 346k lines of C in
8 banks, with no unresolved stubs, and `libsnesrecomp_game.a` compiled with AppleClang.
Most of what the CDL adds is code reached through indirect jumps and the script
interpreter, which static analysis from the vectors cannot find. The 376 LLE variants are
the next lever: turning the observed `# indirect` sites into `indirect_dispatch` lines
should move them to native code.

The hand-written lifting rules below stay as the reference for reviewing its output.

```c
// lifted from $908F6A — room loader, entry state M=1 X=0
void f_908F6A(Cpu *c) {
    c->A = (c->A & 0xFF00) | ram8(0x0ADB);      // LDA $0ADB
    asl8(c); asl8(c);                           // ASL ; ASL
    c->X = c->A;                                // TAX (X=0 → copies all 16 bits, incl. B)
    c->A = rom16(0x9FFDE7 + c->X);              // LDA $9FFDE7,X
    ...
}
```

Rules:

| 65816 feature | Lifting rule |
|---|---|
| `M`/`X` widths | Take them from the CDL, not from static guesses. If a routine was seen with several entry states, emit one C function per state (`f_908F6A_m8x16`, `f_908F6A_m16x16`) |
| Flags (N V Z C) | Compute lazily. Only materialise a flag when a later branch or `PHP` reads it |
| `DB`, `D` (data bank, direct page) | Track them as part of the entry state; most routines have a single constant value, so fold it in |
| `JSR`/`JSL`/`RTS`/`RTL` | Become C calls and returns |
| Stack tricks (`PLA` of a return address, `PEA`+`RTS` jumps, inline arguments after a `JSL`) | Recognise each pattern by hand; record it in a table so the lifter handles it next time |
| Jump tables (`JMP (tbl,X)`) | Become a `switch`, with cases taken from the CDL indirect targets |
| Waits on hardware (`LDA $4212 : BPL -`) | Become "yield to the frame loop" |
| NMI / IRQ handlers | NMI becomes a per-frame call; IRQ/HDMA timing code stays emulated (see §6) |
| DMA register writes | Stay as writes to the emulated PPU/DMA. Do not reinterpret them yet |

Ghidra's 65816 module is useful for reading a routine, but its output is not a source of
lifted code: it gets widths and banks wrong too often.

## 6. Stage 4 — lockstep hybrid (the core of the method)

> **Update (v0.159.1):** with snesrecomp, machine B is the recompiled game, not snes9x with a
> hook table. A hand-written routine replaces the generated one via
> `hle_func <pc16> <c_name>` in the bank cfg (snesrecomp `docs/HLE_FUNC.md`). snesrecomp
> also has its own diff tooling (`tools/wram_diff.py`, co-simulation design in
> `SNES_COSIM.md`). Everything below about the diff, bisecting and the timing caveat still
> applies. It needs the recompiled game to boot first (§11, step 2).

Run two machines from the same input movie:

- **A**: the original ROM in snes9x.
- **B**: snes9x with a hook table. When B's PC reaches the entry of a routine that has a C
  version, the hook runs the C version, writes the resulting registers back, and simulates
  the `RTS`/`RTL`.

At the end of every frame, diff WRAM, VRAM, OAM and CGRAM. A zero diff over the full movie
means the C routines are correct for that coverage. On a divergence:

1. Report the first frame and the first differing address.
2. `ram.asm` lists who writes that address. Disable the C version of each writer in turn;
   the one that fixes the diff is the bug.

Start with **leaf routines** (math, decompression, the Markov/LZSS decoders already ported
for the map editor), then move up the call graph. A routine whose callees are all C can
itself become C.

**Timing caveat:** a C routine runs in zero emulated cycles. Anything that races the
beam (raster effects, IRQ-timed HDMA, polling loops measured in cycles) can diverge even
though the logic is correct. Compare only at frame boundaries, and keep timing-sensitive
routines emulated until the end.

The headless snes9x harness (see the headless-boot notes) already does frame stepping
and WRAM/VRAM reads, so it is most of machine A.

## 7. Stage 5 — cleanup

Once a routine is verified, refactor it freely and re-run the movie after every change:

- Register shuffling becomes locals and parameters.
- `ram8(0x0ADB)` becomes `g.room_id`. `ram.asm` struct and enum guesses become C `struct`s
  and `enum`s (`Entity`, Boy at `$7E4E45`, Dog at `$7E4EB5`, stride `0x70`).
- Jump-table switches get named cases.

At the end of this stage you can still compile in **compat mode**, where every global is
mapped onto the original WRAM address. That keeps the lockstep oracle working.

---

## 8. Moving data around and adding map indices

The question: *once the asm becomes C, how do things change places, for example to have
more maps than vanilla?*

There are two different products, and the answer differs for each:

- **A ROM** that still runs on hardware and emulators: relocation happens in the
  shiftable Asar project (§8.1).
- **A C port** (a native executable): addresses disappear entirely (§8.2), but RAM layout
  stays frozen until verification is finished (§8.3).

### 8.1 In the ROM: symbolise every pointer form

Moving a table is trivial once every reference to it is a symbol. Most of the work is
*finding* every reference. On the SNES, a pointer can be written in many forms:

| Form | Example | What to symbolise |
|---|---|---|
| 24-bit long | `LDA $9FFDE7,X` | the whole operand → `LDA MapPointerTable,X` |
| 16-bit, bank implied by `DB` | `LDA $FDE7,Y` after `PHB : LDA #$9F : PHA : PLB` | the operand **and** the bank byte → `#bank(MapPointerTable)` |
| 16-bit, bank implied by `PB` (same bank as the code) | `LDA $8F00,X` | the operand; the table must also stay in the code's bank, or the code must change |
| Split tables | `lo`, `hi`, `bank` arrays | each byte → `<x`, `>x`, `bank(x)` |
| Pointers inside data | room blob pointer table, CHR descriptors (`JSL $90D50F` args), script operands | the data generator, not the asm |
| Biased bases | `LDA Table-2,X` because X starts at 2 | keep the bias explicit: `Table-2` |
| Block moves | `MVN $7E,$9F` | bank operands → `bank()` |
| DMA source setup | writes to `$43x2-$43x4` | operand + bank |

Every one of these must be a symbol before the padding test (§4) passes. Once it passes,
moving a table means moving the label. The concrete cost of more rooms in the ROM is
already documented in [map_editor_architecture_and_limitations.md §7](map-format/map_editor_architecture_and_limitations.md):
relocate the `$9FFDE7` table and you get up to 256 rooms.

### 8.1.1 Done: moving a room today (v0.158.0)

The export now places the room blobs as `room_XX: incbin rooms/room_XX.bin`, and
the map table refers to them as `dl room_XX-$400000 : db $00`. To move or grow a room:

1. In its bank file, replace `room_XX:` + `incbin rooms/room_XX.bin` with
   `incbin rom.bin:<start>-<end>` (the old bytes stay, unlabelled), or reuse the space.
2. Put `org $F08000` / `room_XX:` / `incbin rooms/room_XX.bin` at the end of `main.asm`.
3. `./build.sh`: the table entry becomes `$B08000`, and `build/out.cdl` carries the room's
   CDL flags to the new place.

Verified on the 4 MB SoE image, including a room that has recorded CDL flags.

**Constraint:** the engine reads room pointers through the `$80-$BF` mirror, which only
maps `$8000-$FFFF` of each bank. A room must start at `$xx8000` or above in its bank
(for example `$F08000`, not `$F00000`), or `room_XX-$400000` points at a non-ROM address.
It also must not cross a bank (`writeRoomAt` enforces the same).

Strings work the same way: `str_<index>` labels, and the key table entry is
`dl strkey(str_XXXX)|$800000` (the `|$800000` marks a compressed string). Each string's end
is where the next one starts; the last string per 32 KB chunk has no known end until a
string decompressor exists (`STEPS.md` reports how many).

### 8.2 In the C port: addresses become IDs

In the port, ROM data stops being addressed by bus addresses:

1. **Lifted:** `rom16(0x9FFDE7 + id*4)` reads the original ROM image.
2. **Extracted:** the asset step dumps every room blob to `assets/rooms/NN.bin`; a
   generated `rooms.c` holds `const RoomAsset rooms[127]`. The C code indexes `rooms[id]`.
3. **Data-driven:** the room count comes from the asset directory at load time.

After step 2, "where stuff is" in ROM no longer matters. A table cannot overflow a bank
because there are no banks. Parallel tables keyed by room id (pointer, music, palette,
name, per-room flags) merge into one `struct Room`.

### 8.3 Widening an index: the census

The hard limit is not storage but **width**: everywhere the id is stored, passed or
computed. Before changing it, list every place the id appears:

1. **WRAM home.** `$0ADB`. Use `ram.asm`: its readers, writers and the values seen.
2. **Data flow.** Follow every reader: where is the value copied (other WRAM slots,
   registers, stack, save data)? Each copy has its own width.
3. **Arithmetic.** `ASL : ASL` on an 8-bit accumulator wraps at 64; with 16-bit `A` it
   does not. The CDL M flag at that instruction says which one happens.
4. **Sentinels.** Does `$FF` (or `$7F`) mean "no room"? Widening silently breaks a
   sentinel comparison.
5. **Script bytecode.** `CHANGE MAP` (`0x22`) already carries a 16-bit map id
   ([map_transitions.md](script-format/map_transitions.md)); the engine and the reference
   only use the low byte. Audit every other opcode that takes a room id.
6. **Save data (SRAM).** If the current room is saved, the save format needs a version
   bump.
7. **Per-room tables.** Every table indexed by room id must grow too.

Then change the type (`uint8_t` → `uint16_t`) in every place the census found.

### 8.4 The order matters: verify first, extend second

Widening `room_id` changes WRAM, so the lockstep diff against the original ROM cannot pass
any more. So:

1. Finish stages 4–5 **in compat mode** (globals mapped onto the original WRAM layout).
2. Tag that build as the frozen reference.
3. Add an **extended mode** in which globals become ordinary C structs and ids are wide.
4. The new oracle for extended mode is the *compat C build*: replaying a vanilla movie,
   both builds must agree on everything that has a meaning (room, position, HP, flags),
   compared by field, not by address.
5. New content (room 128+) gets its own recorded movies as regression tests.

Extending before verification means you can no longer tell bugs apart from intended
changes.

---

## 9. Legal shape

Like zelda3/sm: the repository ships code only. The port reads the user's own ROM at
startup to extract assets (§8.2 step 2). Never commit extracted graphics, audio, scripts,
or ROM bytes.

## 10. What exists today vs. what is missing

| Piece | Status |
|---|---|
| CDL recorder, merge library, M/X per instruction, xrefs | ✅ v0.156.0 |
| Byte-exact Asar export + `ram.asm` | ✅ v0.156.0 |
| Headless snes9x frame stepping, WRAM/VRAM read-out | ✅ (headless boot harness) |
| Room decompression / encoders in JS/Python | ✅ (map editor), these are the first leaf routines to verify |
| Known regions seeded before CDL: header, 127 rooms → `rooms/*.bin`, map table + string key table as label expressions, 3002 strings `str_<index>` | ✅ v0.158.0 |
| Export folder build: `build.sh` → ROM + `.cdl` (flags follow labels), `STEPS.md` export log | ✅ v0.158.0 |
| Shiftable export (all pointer forms symbolised) + padding test | partial: room and string pointers only |
| 65816 → C lifter with M/X specialisation | ✅ via snesrecomp, seeded from the CDL (`recomp.sh`, v0.159.0); SoE run in v0.159.1, see §5.0 |
| Replace a routine with hand-written C | available in snesrecomp (`hle_func`); none written yet |
| SoE booting in snesrecomp (host / frame driver) | ❌, the next milestone (§11) |
| Lockstep two-machine frame diff + divergence report | ❌ |
| Asset extractor (ROM → `assets/`) | partial (rooms) |

---

## 11. Does the current path reach the goal? (assessment, 2026-10-06)

The goal has two parts, and the path reaches them differently.

### 11.1 ROM goal: move content, add rooms. **Yes, first milestone reached.**

The Asar export rebuilds byte-identically. Rooms and strings are named blobs, and the map
table and string key table are label expressions, so moving a room or adding rooms up to
256 works now (§8.1.1, verified). Two parts are still open:

- **Moving code or growing WRAM structs:** only room and string pointers are symbolic.
  Code pointers, bank bytes, jump tables and WRAM addresses are still raw (§4).
- **More than 256 rooms:** the room id is 8-bit in WRAM (`$0ADB`) and in the loader's
  index math. That needs readable code at every place the id is used (§8.3), which is the
  C goal below.

### 11.2 C goal: readable C. **Only half of the way.**

The snesrecomp output is **machine C, not a decomp**:

- functions like `func_C08650_M0X0(CpuState *cpu)`, with registers and flags as state;
- 346k lines, **regenerated from scratch on every run**.

Editing or refactoring it by hand is a dead end: the next regeneration discards it.

Its real role is **runtime and test rig**. snesrecomp can replace any single generated
function with hand-written C (`hle_func`) while everything else stays generated. That is
the zelda3 method of §6, with the recompiled game as machine B. Readable C grows one
verified function at a time, and the generated C shrinks accordingly.

### 11.3 What blocks progress, in order of impact

1. **Nothing runs yet.** Today the output is a static library. Until SoE boots in
   snesrecomp, no replaced function can be checked against the original. The host
   (frame driver, snesrecomp's `game_rtl.c` step) is the next hard milestone, more
   important than more seeds.
2. **Coverage.** 94.7 % of the ROM is untouched by the CDL, and only 3 rooms were ever
   loaded, so most of the Asar export is still `incbin rom.bin`. Coverage limits the
   disassembly, the seeds and the lockstep check alike.
3. **Indirect jumps.** 376 of 1084 function variants stay interpreter-only, mostly behind
   jump tables. The 46 observed sites are in the cfgs as comments (§5.0).

### 11.4 Next steps

1. **Raise coverage:** long sessions, every room, menu, boss and death. Optional: feed
   snesrecomp's statically found functions (`generated/program_manifest.json`) back into
   the Asar export as code, so less of it stays `incbin`.
2. **Boot SoE in snesrecomp:** write the host and frame driver, then set up the per-frame
   RAM diff against the embedded emulator (or snesrecomp's `wram_diff.py`).
3. **First `hle_func` replacements where the semantics are already known:** the LZSS and
   Markov decoders and the room blob layout are ported and verified for the map editor
   (`src/maps/`). The room loader (`$908F6A`) is also where the room id will be widened.
4. **Widen the room id:** verify in compat mode first, then extend (§8.4).
5. **In parallel, on the ROM side:** symbolise more pointer forms (§8.1) with the padding
   test (§4) as the check. This is what moving code and data beyond rooms and strings needs.

