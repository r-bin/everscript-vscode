# TODO: decode the music sequence, then show it in the Music tab

The Music tab (`src/music/`) shows voices, instruments, sound effects and ARAM, but not the song
itself. The Wolfgang v3 sequence bytecode is not decoded, so there is nothing honest to name yet.
This file is the plan; nothing below is verified unless marked.

## What is known (verified)

- Each music package writes a 2-byte pointer at `$2E00+` to its sequence.
  - Main Title: `$2EB8` → `$C231`.
- The sequence starts with a track count and that many 2-byte track pointers.
  - Main Title: `08`, then `$C242 $C269 $C2A7 $C2E6 $C2FC $C319 $C349 $C373`.
  - The tracks run up to the end of the package's last record (`$C3A9`).
- The driver reads sequence bytes on its timer ticks. A capture of Main Title read 1,983
  sequence bytes in 30 s (everscript `docs/audio_music_sound_formats.md` §7).
- A key-on (DSP `$4C`), the voice's pitch (`$x2/$x3`) and its sample (directory entry at
  DIR·256 + SRCN·4) give a driver-independent note list. That's how the mockup's piano roll was
  made (https://claude.ai/artifact/QHt9cxWViSqToKoiHRjRwr).

## Not known

- `// TODO:` The opcode table. Track bytes look like command bytes `≥ $F0` with operands
  (`F2 xx`, `F5 xx`, `F6 lo hi`, `FA xx`) and note/duration pairs below `$F0`, but none of that
  is confirmed.
- `// TODO:` Which track drives which voice (the driver allocates voices; sound effects take
  some).
- `// TODO:` Tempo, and which timer drives it. The driver sets `$FA = $FB = $A0` and `$FC = $20`;
  timer 0 ticks at 50 Hz.
- `// TODO:` Each instrument's base note, to turn pitch into note names.

## Plan

1. **Find the sequence interpreter in the driver.**
   - Run the tab's engine (or everscript's `tools/dump_spc.py` interpreter) with a trace of SPC
     PCs that read the sequence range.
   - The CDL recorder already marks SPC700 code/reads (`cdl-spc.c`), so a CDL session while a
     song plays narrows the code to a few hundred bytes.
2. **Disassemble the dispatch.** The read loop should index a jump table with the command
   byte. Document every handler in everscript `docs/audio_music_sound_formats.md` (new §8), with
   the routine address as evidence, before naming anything.
3. **Check against the DSP.** Decode a track, predict its key-ons and pitches, and compare them
   with the captured DSP writes of the same song. The decoder is right when they match tick for
   tick.
4. **Then visualize** (Music tab):
   - a track lane per sequence track, with notes as bars (from the decoder, so it shows what
     comes next);
   - the driver's read position per track (live, from ARAM reads or the driver's track pointers
     in zero page);
   - commands as labelled chips;
   - jumps and loops as arcs.
   Before step 3 is done, a raw byte view with the live read position is the only honest option.
