# CDL recorder + Asar export (our approach)

The embedded snes9x core records what the game does while someone plays. A per-ROM library
merges every session, and the export turns it into a rebuildable Asar project and snesrecomp
input.

- How to use it: [cdl-export-build-recomp.md](cdl-export-build-recomp.md)
- Code and invariants: `src/platform/cdl/README.md`, skill `cdl-recorder`
- Design history: [cdl-design-history.md](cdl-design-history.md) (§9 is what was built)
- Where it leads (C, room ids): [asm-to-c-port.md](asm-to-c-port.md)
- Files and formats: [formats.md](formats.md)

## 1. Strengths and limits

**Strengths.** It records facts no static tool can know: M/X width per instruction, DB/D, real
returns (call stack matched by S), observed jump-table and pointer targets, which bytes are
read as data, WRAM widths, values and strides, DMA sources and SPC700 coverage. Every field
merges commutatively, so sessions from many players add up. The export rebuilds the ROM
byte-identically.

**Limits.** It only knows what ran: about 5 % of the ROM today, with 3 rooms loaded (see
asm-to-c-port.md §11.3). It has no names of its own, and it records no context: a WRAM access in
room `0x33` looks the same as one in room `0x5C`.

## 2. What the emulator could record to make the output more useful

All of these are within reach of the core, which already sees every access. They are ordered by
how much they help the top goals (G1 RAM/ROM map, G2 named recomp + assets).

| # | Record | Why it matters | Goal | Cost |
|---|---|---|---|---|
| 1 | **Context tags**: room id, game mode (field / menu / battle / cutscene) and NMI-vs-main for every recorded access and function hit (a small bitset per byte / PC) | Turns "accessed" into "used by rooms X, Y in mode Z": WRAM lifetimes (`room` / `map` / `save`), per-room scratch layouts, which code runs in NMI (important for recomp threading) | G1, G2 | low, set-union merge |
| 2 | **Data lineage**: for every WRAM/VRAM byte written by DMA, `MVN`/`MVP` or a decompressor store, the ROM offset it came from | Ties decompressed assets back to ROM blobs and classifies ROM regions by what they become (tiles, tilemap, palette, script). Closes ROM-map gaps without decoding by hand | G1, G2 assets | medium |
| 3 | **DMA destination detail**: B-bus register, VRAM address / increment mode, CGRAM/OAM target per DMA, plus the source | Tells graphics from tilemaps from palettes from sprite tables; the ROM tab can label regions by use | G2 assets | low |
| 4 | **Register snapshots at function entry and exit** (A/X/Y value ranges, P, S depth, DB, D) | Calling conventions and arguments, needed for readable C and `hle_func` signatures | G3 | medium |
| 5 | **Read values for ROM table reads** (index → value seen), word-wise | Table formats and enums without decoding by hand; which entries are dead | G1, G2 | low |
| 6 | **Word-sized WRAM values** (today values are split into bytes) and value histograms | Real enums and counters instead of byte noise | G1 | low |
| 7 | **Cycles per function** (inclusive / exclusive) | SA-1 candidates and the performance map | G4 | medium |
| 8 | **Per-frame WRAM hash log** with input | Ready-made oracle for the lockstep diff against snesrecomp | G2, G3 | low |
| 9 | **SPC700: BRR sample origins, DSP writes** | The audio asset map (samples ↔ ROM) | G2 assets | medium |
| 10 | **Input movie + save state per room** next to the library | Replays raise coverage unattended and make every finding reproducible | G1 | low (harness) |

Items 1–3 give the biggest return for the RAM and ROM maps. Each needs a merge rule before it
ships (skill `cdl-recorder` §2) and its own optional library file.

## 3. Coverage is the bottleneck

Every consumer (Asar export, seeds, Ghidra, RAM map) is limited by the ~5 % coverage. The
headless harness (memory note *headless boot*) can run scripted inputs from save states for
every room, menu, boss and death and merge the results into the library. That is the single
most effective next step for G1. Static fill from Ghidra ([ghidra.md](ghidra.md)) covers the
rest of the code, marked `static`.
