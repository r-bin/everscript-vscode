# Audio & Music Subsystem — Open Tasks & Roadmap

> Domain: SPC700 Audio Engine & Music Radar (`src/games/evermore/music/`, emulator audio)
> Status key: 🟡 research / feature gap · 🟢 designed, not yet built

---

## 1. Wolfgang v3 Music Sequence Bytecode Decoder

The Scripts tab's **Music** view annotates a verified subset of track records and a few runtime-confirmed event values. It does not yet produce musical note names or a complete event stream; unknown bytes remain individual raw records, without inferred widths. The Radar Music tab still does not visualize the active sequence or its playhead.

### 1.1 Verified Knowledge
- Each music package writes a 2-byte pointer at `$2E00+` to its sequence (e.g. Main Title: `$2EB8` → `$C231`). Package P writes it at `$2EB6 + 2P`, for all 70 tracks; the header is the record uploaded to that address, each track its own record (`src/games/evermore/music/model/track-timeline.js` `trackSequence`, test `tests/memory/scripts-tab.test.js`).
- The Scripts tab's Music view shows those bytes with recognized commands, observed driver-state values, and unclassified high bytes styled separately, and plays the track silently in the tab's engine (notes read off the DSP envelopes per frame; the engine's view has no key-on bit, so a retrigger without a silent gap shows only as an envelope jump).
- The sequence starts with a track count followed by 2-byte track pointers (e.g. Main Title: `08`, then `$C242 $C269 $C2A7 $C2E6 $C2FC $C319 $C349 $C373`).
- Tracks run up to the end of the package's final record (`$C3A9`).
- Driver reads sequence bytes on timer ticks (~1,983 bytes in 30s during Main Title playback).
- Key-on events (DSP `$4C`), voice pitches (`$x2/$x3`), and sample directory pointers give driver-independent note events.
- The sibling `everscript/tools/dump_spc.py` interpreter was run in memory against the workspace ROM with reads filtered to Main Title track ranges. `$F2` and `$F5` are each fetched and dispatched as individual bytes; following bytes such as `$65` and `$40` are separately dispatched, so they are not decoded as operands here. `$F3` and `$FA` retain their observed one-byte-argument forms. The read loop is at SPC `$1A47`.
- `$F6` consumes a 10-byte record in observed retail tracks: opcode, two little-endian ARAM pointers, then five bytes. The first pointers identify a phrase start/end; repeated examples and prototype repacking evidence support its repeat-phrase role. The last five bytes are not fully interpreted. Runtime examples across several tracks confirmed the same width; do not infer count semantics from those bytes alone.
- Runtime trace of Main Title tracks 0 and 1 confirmed a narrow state pattern: `$9C` is dispatched through SPC `$188C` and leaves `Y=$3C`; `$D3` through the same path leaves `Y=$73`. The meaning of these transformed values is not yet proven; they are not presented as musical pitches or correlated to a specific DSP voice.
- The following `$1E` (track 0) or `$0A` (track 1) is dispatched through SPC `$18D4`; it is loaded into that track's timer (`$B4 + track index`) and counts down to zero before the next stream byte is read. Confirmed tick values in these examples are 30 and 10 respectively. These are observed values, not a complete duration encoding table.
- The decoder marks only `$9C` / `$D3` driver-state values and `$0A` / `$1E` timer values as runtime-observed events. Other bytes, including unclassified high values, remain individual raw stream records so later observed bytes stay visible; no unknown width is inferred. In the byte view, command styling marks only recognized command offsets.
- Detailed SPC address context and evidence limits: `docs/disassembly/audio/wolfgang-sequence-events.md`.

### 1.2 Open Reverse Engineering Questions
- **Command Opcode Table:** `$F2`, `$F3`, `$F5`, `$F6`, and `$FA` have partial structural decoding; other command meanings and operands remain unmapped. The observed pitch-state and timer values are not yet a general note/duration table.
- **Track-to-Voice Allocation:** How the driver dynamically assigns tracks to hardware DSP voices (taking sound effect interruptions into account).
- **Tempo & Timing:** Which hardware timer drives sequence advance. The driver configures `$FA = $FB = $A0` and `$FC = $20`; timer 0 ticks at 50 Hz.
- **Instrument Base Notes:** The base frequency tuning per instrument sample needed to convert driver pitch-state values into musical note names (e.g. C-4, F#5).

### 1.3 Execution Plan
1. **Complete Command Dispatch:** Trace each remaining high-byte command through the SPC interpreter and establish widths and effects, including variants of `$F6`.
2. **Decode Notes:** Map all pitch-state transforms and duration values; correlate the sequence cursor and command state with DSP key-ons, pitch registers, and instrument/sample directory writes.
3. **Verify Timing:** Decode representative tracks with loops, compare predicted events against captured DSP writes, and retain the current silent timeline as an independent cross-check.

---

## 2. Music Tab Sequence & Piano Roll Visualization

Once the sequence bytecode is decoded, extend the Radar Music panel:

- **Track Lanes (Piano Roll):** Multi-lane view of the 8 DSP voices showing past, active, and upcoming notes as horizontal bars.
- **Live Playhead Indicator:** Highlight the exact sequence byte currently read by the SPC driver in real time (via zero-page track pointers or ARAM read telemetry).
- **Control Flow Visuals:** Display sequence command chips, track loop points, and branch jumps as visual arcs connecting loop boundaries.
- **Interactive ARAM Map:** 64 KB memory grid highlighting active driver code, sample tables, and active sound buffers with glowing phosphor fades on access.

