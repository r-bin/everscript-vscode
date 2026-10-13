# Audio & Music Subsystem — Open Tasks & Roadmap

> Domain: SPC700 Audio Engine & Music Radar (`src/music/`, emulator audio)
> Status key: 🟡 research / feature gap · 🟢 designed, not yet built

---

## 1. Wolfgang v3 Music Sequence Bytecode Decoder

The Radar's **Music** tab (`src/music/`) visualizes voices, instruments, sound effects, and ARAM, but not the active song sequence itself. The Wolfgang v3 sequence bytecode interpreter needs reverse engineering to accurately display upcoming notes and track playback.

### 1.1 Verified Knowledge
- Each music package writes a 2-byte pointer at `$2E00+` to its sequence (e.g. Main Title: `$2EB8` → `$C231`).
- The sequence starts with a track count followed by 2-byte track pointers (e.g. Main Title: `08`, then `$C242 $C269 $C2A7 $C2E6 $C2FC $C319 $C349 $C373`).
- Tracks run up to the end of the package's final record (`$C3A9`).
- Driver reads sequence bytes on timer ticks (~1,983 bytes in 30s during Main Title playback).
- Key-on events (DSP `$4C`), voice pitches (`$x2/$x3`), and sample directory pointers give driver-independent note events.

### 1.2 Open Reverse Engineering Questions
- **Command Opcode Table:** Track bytes `≥ $F0` act as commands with operands (`F2 xx`, `F5 xx`, `F6 lo hi`, `FA xx`), and bytes `< $F0` represent note/duration pairs. Full opcode dispatch table remains unmapped.
- **Track-to-Voice Allocation:** How the driver dynamically assigns tracks to hardware DSP voices (taking sound effect interruptions into account).
- **Tempo & Timing:** Which hardware timer drives sequence advance. The driver configures `$FA = $FB = $A0` and `$FC = $20`; timer 0 ticks at 50 Hz.
- **Instrument Base Notes:** The base frequency tuning per instrument sample needed to convert raw DSP pitch values into musical note names (e.g. C-4, F#5).

### 1.3 Execution Plan
1. **Locate Driver Interpreter:** Trace SPC program counters reading the sequence address range using the CDL recorder (`cdl-spc.c`), narrowing code to the sequence read loop.
2. **Disassemble Command Dispatch:** Document the command jump table in `docs/audio_music_sound_formats.md` with routine addresses as evidence.
3. **Verify Against DSP Log:** Decode an offline track, predict key-on times and pitches, and verify tick-for-tick match against captured DSP writes.

---

## 2. Music Tab Sequence & Piano Roll Visualization

Once the sequence bytecode is decoded, extend the Radar Music panel:

- **Track Lanes (Piano Roll):** Multi-lane view of the 8 DSP voices showing past, active, and upcoming notes as horizontal bars.
- **Live Playhead Indicator:** Highlight the exact sequence byte currently read by the SPC driver in real time (via zero-page track pointers or ARAM read telemetry).
- **Control Flow Visuals:** Display sequence command chips, track loop points, and branch jumps as visual arcs connecting loop boundaries.
- **Interactive ARAM Map:** 64 KB memory grid highlighting active driver code, sample tables, and active sound buffers with glowing phosphor fades on access.
