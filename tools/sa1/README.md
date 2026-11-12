# tools/sa1 — Evermore as an 8 MB SA-1 image

Turns the clean US ROM into an SA-1 cartridge that plays exactly like the original. The S-CPU still runs
everything; the SA-1's own CPU stays in reset. The why, the evidence and the next steps are in
[docs/sa1/port.md](../../docs/sa1/port.md); this page is about the code.

```sh
npm run sa1                      # → out/soe-sa1.sfc, from the base ROM of the ROM library
npm run sa1 -- --listing         # … and print the boot block as assembly
npm run sa1:measure              # boot timing in MesenCE: must equal the original's (~10 s)
npm run sa1:measure -- --fit     # … and search REFRESH_FIT if it doesn't
npm run sa1:prove -- --boot-frames 6000 --max-movies 4 --max-frames 15000   # full comparison (~4 min)
```

`npm run sa1 -- rom.smc out.sfc --upper mesen --fill db` picks the source, the output, what the 4th MB answers
(`hardware` | `mesen` | `snes9x2005` | `fill`) and the byte for unused space.

## What the image is

```
file      bus the S-CPU uses       contents                                         written by
0x000000  $00-$1F:8000+ (bank $00) SA-1 header, vectors, vector entries             header.mts
0x100000  $20-$3F:8000+            unused                                           —
0x200000  $80-$9F:8000+            HiROM $80-$9F:8000-FFFF, 32 KB per bank   ┐ code  layout.mts
0x300000  $A0-$BF:8000+            HiROM $A0-$BF:8000-FFFF; boot block $B8:8000 ┘     layout.mts, boot.mts
0x400000  $C0-$FF                  the whole HiROM 4 MB, linear              — data   layout.mts
```

The same game bytes are there twice. Code runs from `$80–$BF`, which the SA-1 maps LoROM-style (32 KB per bank),
so blocks 2–3 hold the HiROM upper halves packed that way. Data is read through `$C0–$FF`, which the SA-1 maps
linearly from the blocks named in its bank registers CXB–FXB, set to 4–7 by the boot block. Every address the game
uses therefore reads what it read on the HiROM cartridge, and no game code is rewritten.

## The files

| File | Job | Change it when |
|---|---|---|
| `convert.mts` | Runs the steps below in order, plus the command line | adding a step or an option |
| `layout.mts` | Which block holds what; bus address → file offset; fills both views | moving blocks, changing CXB–FXB values |
| `header.mts` | Bank `$00`: header fields, vector table and entries, checksum, MesenCE's header scoring | changing header fields (BW-RAM size, title, …) |
| `boot.mts` | The boot block, as instructions; its padding; the listing | adding SA-1 setup, moving the block |
| `asm.mts` | The few 65816 instructions the boot block uses, each with its cycle cost; decoding the original code | the boot block needs an instruction form not there yet |
| `measure.mts` | Times the boot block against the original in MesenCE | — (run it) |
| `prove.mts` | Builds release, `mesen` and trap images and compares their play with the original in MesenCE | adding checks or probes |
| `mesen.mts` | Runs MesenCE headless, each run under its own ROM name (no battery save carried over) | — |

`tools/exhirom/convert.js` provides the vector-entry walker, the cartridge mirror and the checksum.

## Recipes

**Set more SA-1 registers at power-on** (e.g. start the SA-1 CPU, map BW-RAM differently): add instructions to
`sa1Setup()` in `boot.mts`, built from the helpers in `asm.mts` (`LDA16(0x…)`, `STA16(0x22xx)`). The padding is
recomputed. Then:
1. `npm run sa1 -- --listing` and read the block;
2. `npm run sa1:measure -- --fit`; if it names another `REFRESH_FIT`, put that in `boot.mts`;
3. `npm run sa1:prove`. A failure at frame 4 means the timing is off (step 2), a later one something else.

The added code runs at FastROM speed, and the block has about 130 master clocks of NOPs to spare. If the padding
solver throws ("no NOP padding…"), the block got too slow: there is nothing left to pay with.

**Change where a view lives**: edit `BLOCK` / `BANK_VALUES` in `layout.mts`. Keep bit 7 of the bank values clear,
or the LoROM views follow the registers too and the two arrangements collide.

**Move the boot block**: `BOOT` in `boot.mts`. It must be in `$80–$BF` (FastROM) and in bytes nothing else reads
through that view. `$B8:8000` is the LoROM view of the HiROM 4th MB, which the game reads only at `$B0:E653+`.

**Change a header field**: `header.mts`. `convert()` refuses an image whose header MesenCE would not pick.

**Patch game code**: write the change into *both* copies, the LoROM one for code in `$80–$BF` (`loRomFile()`) and
the linear one for anything read through `$C0–$FF` (`LINEAR + HiROM file offset`). Code runs only from the
LoROM copy, so a pure code patch needs only that one.

## Timing model (why the boot block is exact)

`asm.mts` counts master clocks per bus cycle: an instruction byte fetched from slow ROM costs 8, from FastROM 6;
an internal cycle or I/O-register access 6; a stack access 8 (MesenCE's `GenerateMasterClockTable`). The original
stretch `$80:802D–$810E` is 2,266 clocks by this model, and MesenCE measures 2,346 (+80, two DRAM refresh stalls of
40). The boot block, padded to the same 2,266, gets the same two stalls, so `REFRESH_FIT` is 0. A changed block
can catch a stall at another cycle boundary; `sa1:measure -- --fit` finds the value that makes up for it.

Images and reports go to `out/`, never committed: they are game data, and the reports quote ROM bytes.
