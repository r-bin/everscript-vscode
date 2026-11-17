# AKAO vs. the Evermore (Wolfgang v3) sound format — and could Evermore's music move to AKAO?

Research note, 2026-11-17. Scope: Square's SNES sound driver family ("AKAO") against Evermore's
SPC700 driver. Evermore facts come from this repo (verified, with the evidence named in the linked
notes). **AKAO facts come from web summaries and my own background knowledge. Nothing about AKAO was
checked against an AKAO ROM here, so every AKAO row is "secondary" until someone does.**
The summaries disagreed with each other on several points; these are listed in §2.

Related: [soundbank-streamer.md](soundbank-streamer.md), [spc-handshake.md](spc-handshake.md),
[wolfgang-sequence-events.md](wolfgang-sequence-events.md), `docs/todo/audio-and-music.md`,
everscript `docs/audio_music_sound_formats.md` (protocol, packages, ARAM budget).

---

## 1. Answer in short

| Question | Answer |
|---|---|
| Can the samples move? | **Yes.** BRR is the S-DSP's native format, so every driver reads it. Loop points and per-instrument tuning/ADSR must be re-expressed in the target's instrument record. |
| Can the notes move? | **In principle yes, with work.** Both are 8-voice note/duration/command byte streams. Two routes (§4): decode Wolfgang fully and transcode it, or re-sequence from recorded DSP events. Today the first is blocked (opcode table mostly undecoded). |
| Can the driver move? | Only by **replacing it**: the 65816 side (bank `$8C`), all 90 sound effects and the package/upload scheme change with it. |
| Worth it? | **No, not as a goal in itself.** The cost is a driver swap plus an SFX rewrite for no musical gain, and the driver itself cannot be committed here (§5). Better routes in §6. |

---

## 2. What AKAO is (secondary sources — unverified here)

- Square's in-house SNES sound driver, credited to Minoru Akao. Used in Final Fantasy IV–VI,
  Chrono Trigger (a derivative), Romancing SaGa, Super Mario RPG and others. It is a **family of
  revisions**, not one format: FF4, FF5 and FF6 differ in opcode tables.
- The name comes from the `AKAO` magic of the **PlayStation** sequence containers. A web summary
  claimed the SNES data also carries that magic; I believe it does not (unverified; conflicting).
- **Secret of Mana is probably not AKAO.** The user brief grouped it with AKAO; sources conflict
  (one says "Kikuta's own driver", one says "N-SPC variant"). Our own notes show only that the Mana
  boot code uploads its driver in 6 blocks to ARAM `$0200` and starts it there (`docs/mana/rom.md`,
  `$C3:0000`). **Open, cheap to settle:** dump Mana's and a FF6 ARAM driver and compare opcode
  dispatch tables (the approach used in §3 for Evermore). Do not generalise Mana facts from FF6
  (AGENTS rule 4).
- FF6-family sequence layout (secondary): a song is one blob with a small header, a pointer per
  channel (8 voices, plus further tracks that the sound-effect side uses), then a byte stream per
  channel. Note bytes `$00`–`$B3` encode **pitch and a length-table index in one byte**; bytes from
  `$B4` up are commands (rest, tie, volume, pan, vibrato, tremolo, tempo, octave, instrument, ADSR
  parts, echo/noise/pitch-mod enables, loop begin/end, jump). Instruments are a per-song table of
  sample + ADSR + tuning. Community tools round-trip it through text MML.
  The exact byte values from the summaries (`$C4`, `$DC`, `$E2`/`$E3` …) were contradictory; they
  are not recorded here as facts.

---

## 3. What Evermore's driver is (verified in this repo)

| Aspect | Evermore "Wolfgang v3" |
|---|---|
| Driver | `$81:80DC`, 6,112 bytes of SPC code (`$17E0` loaded), uploaded to SPC `$0700` through the IPL. Not Square's. |
| Songs | 70 music ids, 71 packages (`$81:9903`, 24-bit pointers; music `M` = package `M+1`). A package = list of `[len][src][dest]` records: BRR samples, sample directory (`$1F00+`, 4 bytes each), instrument/SFX pointer tables (`$2000`–`$2350`), a pointer at `$2E00+`, and the sequence near the top of the sample area. |
| Sequence | Track count, then 2-byte pointers per track (Main Title: 8). Each track is read byte by byte through a computed jump (SPC `$1A44`–`$1A4D`). Commands `$F2 $F3 $F5 $F6 $FA` are partly decoded (`$F6` = 10-byte phrase/repeat record). Opcode table **not decoded**. |
| Notes / duration | Observed on two Main Title tracks: a pitch-state byte (`$9C`, `$D3`) is followed by a **separate duration byte** loaded as ticks into a per-track countdown (`$B4+track`). So duration is an explicit tick count, not a length index packed into the note. Observed only; no general table. |
| Clock | Timers `$FA=$FB=$A0`, `$FC=$20`; timer 0 ticks at 50 Hz. Which one drives tempo is unverified. |
| Voices | 8, shared by music and SFX. Per-voice owner (`$6C+v`: SFX/music/free); the driver keys voice *v* with SRCN = *v* and rewrites directory entry *v* (`$0200`) before each key-on. |
| SFX | 90 driver effects (62 in the base bank = package 0, 28 in 21 packages), command `$04`, pitch offset command `$30` (1/20 semitone), per-call pan/attenuation from the game (`audio_spatial_panning_and_attenuation`). |
| Host protocol | CPU ↔ SPC through `$2140`–`$2143`: `$02`, `$04` sfx, `$06` music, `$0E` re-enter IPL for upload, `$1A`/`$1C`, `$28` volume, `$30`… Each music change is a **full IPL re-upload** of the song package. |
| ARAM | Song package budget 36,674 B (with 10 KB echo) or ~46 KB without; largest vanilla package 27,738 B. |

---

## 4. Feature comparison and mapping

| Feature | AKAO (FF6 family, secondary) | Wolfgang v3 | Mapping effort |
|---|---|---|---|
| Voices | 8 for music; SFX share/steal | 8 shared, owner byte per voice | direct |
| Note encoding | pitch + length index packed in one byte | pitch byte + explicit tick byte (observed) | durations must be quantised to AKAO's length table; odd tick values (e.g. 30, 10 at 50 Hz timing) need ties/splits |
| Loops / phrases | loop begin/end with counts, jumps | `$F6` repeat-phrase record (10 bytes, partly understood) | needs full `$F6` semantics |
| Instruments | per-song instrument table | package sample directory + pointer tables; tuning/base note per sample **unknown** | must measure tuning per sample (from DSP pitch at key-on) |
| Expression | volume, pan, vibrato, tremolo, portamento, echo, noise, pitch-mod | unknown commands beyond the 5 above | anything not decoded is lost or approximated |
| Tempo | tempo + slide commands | timer-based; command unknown | decode first |
| Echo | global reverb setups | `ESA=$D4`, EDL up to 5 | choose nearest AKAO preset or give up exact echo |
| SFX | sequences in the same format on the SFX tracks | 90 effects, pitch variants, per-play pan/attenuation injected by the game | **rewrite all 90**, plus a way to pass pan/pitch per call |

### Transcoding routes

1. **Decode-and-transcode.** Finish the Wolfgang opcode table
   (`docs/todo/audio-and-music.md` §1.3), parse each track to a note/command IR, emit AKAO bytes.
   Exact (loops kept), but blocked on the decoder.
2. **Re-sequence from DSP events.** Run the ROM's own driver (we already have the SPC engine and a
   driver-independent note list: KON bit, pitch registers, sample from `$0200` entry, KOF/next KON
   — see §7 of the everscript note). Convert key-ons to AKAO notes, detect repeats to rebuild loops.
   Works without decoding the opcodes; loses structure and subtle modulation, and every pitch bend
   or vibrato becomes either dropped or a sequence of notes.

---

## 5. Downsides of porting to AKAO

1. **The driver is Square's code.** The repo may not hold ROM bytes (AGENTS rule 1; `npm run
   check:legal`). The AKAO driver would have to be read from the user's own FF/Mana ROM at runtime
   (one more ROM to require) or written clean-room, at which point it is no longer AKAO.
2. **A driver swap, not a data port.** The driver lives in the ROM (`$81:80DC`). Bank `$8C`'s whole
   audio path (commands `$02 $04 $06 $0E $1A $1C $28 $30`, volume fades, script opcodes `0x30/0x33`,
   `0x58`/`0x59`, `0x86`, `0x87`, positional audio, soundbank streamer) assumes Wolfgang's protocol.
   All of it is rewritten against AKAO's ports and semantics.
3. **All 90 sound effects.** Their definitions are Wolfgang instrument/SFX table entries and
   sequences, with pitch variations (`$30`) and the game's per-play pan and distance attenuation.
   AKAO has no such per-call parameters; the driver would need patching, which brings back (1).
4. **Lossy, unverifiable result.** Anything in Wolfgang with no AKAO counterpart (unknown
   commands, exact timer ticks, echo length, per-voice pitch offsets) is dropped or approximated.
   Proof of "sounds the same" is by ear and spectrogram only (the existing dumps already reach cosine
   0.92–0.999 against rips; a port will be lower).
5. **Hard prerequisite not done.** Route 1 needs the undecoded opcode table; route 2 needs per-sample
   tuning, still unmeasured.
6. **Memory.** AKAO's driver size and per-song sample limits are unknown to us. A different driver
   size moves every ARAM address the packages assume (driver at `$0700`, directory at `$1F00`, pointer
   tables at `$2000+`), so packages are rebuilt, not patched.
7. **Timing side effects (inference).** The CPU waits for port echoes on every command; a different
   driver changes frame timing. WRAM replays recorded on vanilla (`sample-playbacks` skill) may then
   diverge, which breaks the "ROM is only working if a replay works" check for audio-adjacent frames.
8. **Package re-upload stays.** Evermore re-uploads a whole package on every music change (the cause
   of load stalls, `the_sound_glitch.md`). Moving to AKAO does not remove it unless the loader is
   redesigned as well.
9. **Cost vs. gain.** Hacking-tool benefit (text MML round-trip for FF6-family tracks) is real but
   covers only the music, and the rest of the work is a rewrite of the audio stack.

Upsides, honestly: mature community tooling for the FF6 family, a documented opcode set, and (if the
driver is bound from another ROM) no need to finish decoding Wolfgang's driver internals. None of
these needs AKAO specifically.

---

## 6. Better routes to the same goals

| Goal | Route |
|---|---|
| Editable Evermore music | Finish the Wolfgang decoder, then write our own text-to-Wolfgang compiler (same ROM, same SFX, no driver swap). |
| Other games' music in Evermore | Re-sequence into Wolfgang (route 2 in reverse); or upload a whole foreign SPC through the existing IPL path (mechanically possible, not tested; loses SFX until the Evermore driver is re-uploaded). |
| A better/more flexible driver | Clean-room driver in `patches/*.asm` under our license, sharing the BRR/package layout. |
| Evidence for any of the above | Settle the open questions in §2 and measure sample tuning; both are small, ROM-only tasks. |

---

## 7. Open questions / next steps

1. Is Secret of Mana's driver AKAO? (Compare ARAM driver dispatch tables of Mana and FF6 with the
   method used for Evermore.)
2. Verify AKAO's note/length encoding and opcode table against a real FF6 ROM, in our own words.
3. Complete the Wolfgang opcode table, `$F6`'s last five bytes, and the tempo source.
4. Measure per-sample base pitch (DSP pitch at key-on for each instrument).
5. Size the AKAO driver and its per-song sample limits to confirm the ARAM fit.
