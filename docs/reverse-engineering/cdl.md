# CDL recorder + Asar export (our approach)

The embedded snes9x core records what the game does while someone plays. A per-ROM library
merges every session, and the export turns it into a rebuildable Asar project and snesrecomp
input.

- How to use it: [cdl-export-build-recomp.md](cdl-export-build-recomp.md)
- Code and invariants: `src/platform/cdl/README.md`, skill `cdl-recorder` (§3 lists every recorded stream)
- Design history: [cdl-design-history.md](cdl-design-history.md) (§9 is what was built)
- Where it leads (C, room ids): [asm-to-c-port.md](asm-to-c-port.md)
- Files and formats: [formats.md](formats.md)

## 1. Strengths and limits

**Strengths.** It records facts no static tool can know: M/X width per instruction, DB/D, real
returns (call stack matched by S), observed jump-table and pointer targets, which bytes are
read as data, WRAM widths, values and strides, DMA sources and SPC700 coverage. Every field
merges commutatively, so sessions from many players add up. The export rebuilds the ROM
byte-identically.

**Limits.** It only knows what ran: 2 % of the vanilla ROM as code after 4.5 hours of play (§2.4).
It has no names of its own, and it records no context: a WRAM access in room `0x33` looks the same
as one in room `0x5C`.

## 2. State (2026-10-20, v0.319.0)

### 2.1 How data gets in

| Path | What it is | State |
|---|---|---|
| Live recording | CDL tab in the emulator (full extension, off by default) or the SNES CDL Recorder (always on); the webview drains changed chunks every 15 s, the host flushes 60 s after the last change | works; paused = idle |
| Replay of a movie | `node tools/cdl/replay.js <movie> <rom> --cdl <root>`: every `.evsmv` recording rebuilds its share of the library headless (7054 frames in ~4 s) | works; the movie is the source of truth, the library is derived |
| Recording bundle | a zip of one library + its replays (`cdl/bundle.ts`), exported by the SNES CDL Recorder, imported by either extension | works, see 2.3 |

The movies are worth more than the library: rerunning them refills every stream the recorder gains
later. What makes a movie trustworthy: WRAM CRC every 60 frames, other memory spaces every 600, the
core build in the header, a headless replay check while recording (`everscript.tas.verifyEveryMinutes`).
Since v0.316–v0.318 a movie can also carry save states (`Z|`, one per minute of hand play), rewinds
(`K|` / `L|`) and continued sessions (`# continued:`); `replay.js` handles all three
(`--from-frame`, `--rewinds calc|load`). Details: `src/core/emulator/tas/README.md`.

### 2.2 What is recorded

Everything in skill `cdl-recorder` §3: code/data per ROM byte with M/X, edges incl. returns through
pushed addresses, xrefs (PC, address, width, pointer, DMA), WRAM flags / byte values / 16-bit value
ranges, hit counts and cycles per instruction, return outcomes, DB / D / pointer bases, WRAM-executed
code, SPC700 ARAM coverage, bus mirror per ROM byte, I/O register values, SRAM reads / writes.
22 files per library; a vanilla library is ~41 MB (`word-ranges.bin` alone is a fixed 10.5 MB).

Of the wishlist this page used to keep, these now exist: word-sized WRAM values (`word-ranges.bin`),
cycles (per instruction, summed per function in `functions.json`; no inclusive / exclusive split),
a checksum oracle (WRAM every 60 frames in each movie, not every frame), movies and save states next
to the library. Still **not** recorded (each needs a merge rule and its own file, skill §2):

| # | Record | Why it matters |
|---|---|---|
| 1 | **Context tags**: room id, game mode, NMI vs main per access / function hit | turns "accessed" into "used by rooms X, Y in mode Z": WRAM lifetimes, per-room scratch, what runs in NMI |
| 2 | **Data lineage**: the ROM offset behind each byte written by DMA, `MVN`/`MVP` or a decompressor | ties decompressed assets to ROM blobs; labels ROM regions by what they become |
| 3 | **DMA destination detail**: B-bus register, VRAM address / increment, CGRAM / OAM target | graphics vs tilemaps vs palettes vs sprite tables |
| 4 | **Register snapshots at function entry / exit** (A/X/Y ranges, P, S depth) | calling conventions for readable C and `hle_func` |
| 5 | **Read values of ROM table reads** | table formats and enums without decoding by hand |
| 6 | **SPC700 BRR sample origins, DSP writes** | the audio asset map |
| 7 | SA-1 / coprocessor buses | snes9x2005's SA-1 core is separate and unhooked |

HDMA hooks exist but SoE never uses HDMA in sampled frames, so they are verified by review only.

### 2.3 Sharing and merging

Bundles were checked end to end on a real 7054-frame library (v0.319.0): export, import into the
same library, delete + import (every file back byte for byte, and the Asar export identical), import
at another install, forwarding A → B → C, merge order, an older export after playing on, bundles from
before v0.319.0. Before v0.319.0 the summed streams (hits, cycles) doubled on a self-import and on
forwarding; they are now one counter per install, max-merged (`src/platform/cdl/README.md`). Regression
test: `tests/debugger/recorder.test.js`.

Not covered: the Mesen export (`mesen/rom.cdl`, `labels.mlb`) goes out only, there is no importer.
The two extensions keep separate libraries (`rbin.everscript/cdl-library`,
`rbin.snes-cdl-recorder/cdl-library`); nothing merges them except a bundle.

### 2.4 Coverage on this machine

Measured from the libraries in VS Code's global storage (code = executed bytes, any = code or data):

| Library | ROM | Code | Code or data | WRAM seen |
|---|---|---|---|---|
| vanilla US, full extension (`79e77386`) | 3 MB | 2.1 % | 24.5 % | 63 % |
| vanilla US, SNES CDL Recorder (`79e77386`) | 3 MB | 1.2 % | 8.9 % | 35 % |
| map-editor test ROM (`66513fd3`) | 4 MB | 1.3 % | 7.1 % | 37 % |
| map-editor test ROM (`5eabc0e1`) | 4 MB | 0.5 % | 1.4 % | 8 % |

Recordings: 141 in the full extension, 10.2 hours, 4.5 of them on the vanilla ROM. 7 are marked
synced, 2 desynced, the rest were never replayed. The two vanilla libraries have never been merged.
(A fifth folder, `3ea4cdaa…`, has no manifest: a leftover, not a library.)

"Code or data" is high because graphics and other DMA sources count as read; code is what the
recompilation and the decompilation need, and it is still small.

### 2.5 What each goal gets today

- **Rebuildable Asar project:** works for any library (byte-identical build).
- **snesrecomp:** seeds from the library run the game in the field (`docs/recomp/README.md`: its own repository); unknown
  dispatch targets and PHA/PEA+RTS sites stay the limit until more code is covered.
- **RAM / ROM map:** `ram.asm`, `structs`, `enums`, `tables` grow with coverage; context tags (2.2 #1)
  would make WRAM lifetimes possible.
- **Decomp / SA-1:** `functions.json` has widths, DB/D, callers, WRAM ranges, cycles and SA-1 blockers
  per function; names still come from people.

## 3. Next steps, by return

1. **Coverage.** Replay every vanilla recording into one library (`replay.js --cdl`), merge the
   recorder's library in with a bundle, and record the parts of the game nobody has played yet
   (rooms, menus, bosses, deaths). Static fill from Ghidra ([ghidra.md](ghidra.md)) covers the rest,
   marked `static`.
2. **Replay the unreplayed recordings** once, so each is marked synced or desynced and the movie
   archive can be trusted as the source of truth.
3. **Context tags** (2.2 #1), then data lineage and DMA detail (#2, #3) for the RAM and ROM maps.
