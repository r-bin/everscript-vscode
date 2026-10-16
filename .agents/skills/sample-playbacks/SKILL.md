---
name: sample-playbacks
description: Sample playbacks — short stored vanilla input recordings (.evsmv) with known coverage. Use when proving a changed ROM (table hack, ExHiROM, a patch, a moved table) still plays like the original, when you need a headless run that reaches a given routine, room or table reader, or when recording a new sample playback.
---

# Sample playbacks

A sample playback is a short `.evsmv` recording of the clean US ROM, stored in `playbacks/` next to
this file, whose coverage is written down below. Use them as the input for any comparison of
"original vs changed ROM". They are short, deterministic and reach known code.

The user's own recordings (`globalStorage/rbin.everscript/tas-recordings/`) are long and their
coverage is unknown. Reach for them only when no sample playback covers what you test, and then
pick the one recording that does. Do not replay the whole folder.

## The playbacks

| File | Frames | What it is | Rooms (`$7E0ADB`) | Table readers reached (count, first frame) |
|---|---|---|---|---|
| `playbacks/attract-loop.evsmv` | 6224 (1:44) | Power-on with no input: intro, then the demo scenes. It is cut at the frame where the intro's first picture comes back (frame 66 at the start). | `55 00 61 31 18 0a 19 1a 10 54` | map table 8× @374; enter scripts 8× @413; script pointers 12× @3084; string keys 14× @3104 |

Each playback carries the movie's own WRAM checks: `S|` every 60 frames and `T|` (VRAM, CGRAM, OAM,
SRAM, ARAM) every 600. A replay on the clean ROM that misses a check has lost sync. The `# core:`
header names the core build (`tas/host.js coreId()`, the first 16 hex digits of the `.wasm`'s
SHA-256). After a core rebuild the checks may no longer hold: re-record the playback (below) and
update the table.

## What they are for

- **Proving a changed ROM plays like the original.** Run the original and the changed ROM on the same
  playback, then compare WRAM every frame and the screen every 60 frames. This is
  `tools/table-hack/prove.js` (`npm run table-hack:prove`): the attract loop checks all four moved
  tables in about 15 s. The same pattern fits `tools/exhirom/prove.js` and any Asar patch.
- **Reaching a routine headless.** Pick the playback whose coverage includes it. Set exec breakpoints
  (`M.addExecBreakpoint`, `M.onBreakpointHit` returning `false` to keep running) to count hits, or
  dump WRAM at a frame (`tools/table-hack/run.js --dump <frame> <file>`) to find the bytes two ROMs
  disagree on.
- **Screenshots of the vanilla game at known moments.** Use `tools/table-hack/run.js --shots
  <frames> <dir>`, e.g. the demo rooms of the attract loop. Screenshots stay in the scratchpad or
  `out/`, never in git.
- **A determinism control.** Run the original twice on the same playback; both traces must be
  identical before any other comparison means anything.

## Recording a new one

1. Write the recorder like `tools/playbacks/record-attract.js`:
   - boot at `AUDIO_RATE` (44100);
   - write `F|` lines plus `S|`/`T|` checks with `src/emulator/tas/movie.js`;
   - stamp the `coreId()`;
   - cut at a frame you can name.
2. Record the coverage while recording: rooms from `$7E0ADB`, and exec-breakpoint hits on the
   routines you care about.
3. Store the file in `playbacks/` and add a row to the table above (frames, what it is, rooms,
   readers).
4. Check it: a replay on the clean ROM ends `sync ok` (`tools/table-hack/run.js` prints the movie's
   own check result).

Re-record the attract loop with
`node tools/playbacks/record-attract.js --rom "<clean rom>"`. It takes about 10 s and prints the
coverage JSON.

Playbacks hold inputs and checksums only, no ROM bytes, so they may be committed. Screenshots,
traces, WRAM dumps and built ROMs may not (AGENTS.md rule 0.1).

## The everscript example

`tools/table-hack/evs/string-3003.evs` adds string #3003 and shows it when Brian's room is entered.
That is not a playback. It is a scripted check: `run.js --shots 900` on the built ROM shows the
text box. Two traps:

- A dialog string needs `[B]` at the end, or `55 CLEAR TEXT` removes it before any frame shows it.
- A room's `trigger_enter` needs `fade_in()` first, and `fade_in()` needs the persistent RAM range
  `<0x2272>..<0x2558>` in `#memory`.
