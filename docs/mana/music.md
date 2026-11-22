# Secret of Mana — Sound & Music Subsystem (AKAO Architecture)

Detailed architectural analysis of Secret of Mana's audio subsystem, reconstructed from the game's ROM disassembly (Bank `$C3`), WRAM tables, and the uploaded SPC700 audio driver binary.

---

## 1. Subsystem Architecture Overview

Secret of Mana uses an early Super Famicom / SNES revision of Square's proprietary **AKAO** sound driver (programmed by Minoru Akao, with compositions and sound design by Hiroki Kikuta).

Unlike later Square titles where songs are monolithic blocks, Secret of Mana features a **dynamic sample management architecture** with an on-demand LRU cache in SNES WRAM and ARAM, allowing 33 shared instrument sample banks to be dynamically allocated, compacted, and streamed between songs without resetting the SPC700 driver.

### Memory & Execution Architecture

| Subsystem | Location | Role |
|---|---|---|
| **65816 Sound Engine** | Bank `$C3` (`$C3:0000`–`$C3:0707`) | Bootloader handshake, APU streaming, song switching, and dynamic sample cache |
| **Master Song Table** | `$C3:3D39` | 64 entries (3-byte far pointers to sequence bytecodes in Banks `$C4` and `$C5`) |
| **Sample Descriptors** | `$C3:3DF9` | 33 entries (3-byte far pointers to BRR sample blocks in Bank `$C3`) |
| **Song Instrument Sets**| `$C3:3F22` | Per-song lists of required sample IDs (up to 16 words per song) |
| **Sample Metadata** | `$C3:3E5C`, `$C3:3E9E`, `$C3:3EE0` | Sample loop points, ADSR envelopes, and pitch tuning multipliers |
| **SPC700 Driver Code** | `$C3:0748` → ARAM `$0200` | 5,016 bytes of SPC700 code handling sequence parsing, 8-voice DSP mixing, and SFX |
| **Sample Directory** | ARAM `$1900` | 4 bytes per sample (start word, loop word); DSP register `DIR = $19` |
| **Sequence Destination**| ARAM `$1A00` | Target buffer for the currently playing song sequence |

---

## 2. Boot & Initial Driver Upload (`$C3:0000`)

At console reset, the 65816 CPU runs the audio boot routine at `$C3:0000` (executed during NMI across frames 25–58):
1. Polls port `$2140` for the standard SPC700 IPL bootloader response (`$BBAA`).
2. Uploads the audio engine in 6 discrete blocks:

| Block | ROM Offset | Size | ARAM Dest | Contents |
|---|---|---|---|---|
| **0** | `$C3:0748` | `0x1398` (5,016 B) | `$0200`–`$1597` | SPC700 AKAO driver binary & command interpreter |
| **1** | `$C3:2137` | `0x1C00` (7,168 B) | `$2C00`–`$47FF` | Working sound buffer & echo delay memory |
| **2** | `$C3:1AE2` | `0x05F1` (1,521 B) | `$4800`–`$4DF0` | Universal sound effect BRR sample blocks |
| **3** | `$C3:20D5` | `0x002C` (44 B) | `$1900`–`$192B` | DSP Sample Directory table (`DIR = $19`) |
| **4** | `$C3:2103` | `0x0018` (24 B) | `$1880`–`$1897` | Master voice configuration & ADSR presets |
| **5** | `$C3:211D` | `0x0018` (24 B) | `$1800`–`$1817` | Channel volume attenuation & stereo panning defaults |

3. The driver jumps to ARAM `$0200`, initializes zero-page state, sets DSP `DIR = $19`, clears echo, and enters its main polling loop at `$0279`.

---

## 3. Dynamic Sample Cache & Streaming

Secret of Mana does not store sample packages alongside songs. Instead, 33 instrument samples reside in Bank `$C3` (`$C3:4782`–`$C3:E38B`), and the 65816 engine dynamically manages their presence in SPC RAM:

### SNES WRAM Allocation Tracking
- `$7E:1E28`–`$1E47`: Table of currently resident sample IDs in ARAM (up to 16 slots, 2 bytes each).
- `$7E:1E48`–`$1E67`: Base ARAM destination addresses for each resident sample.
- `$7E:1E6A`–`$1E89`: Byte lengths for each resident sample.
- `$7E:1EAA`–`$1EC9`: Working list of sample IDs required by the incoming song.

### Song Load Process (`$C3:0198`)
1. **Cache Comparison**: The engine looks up the song's sample set in `$C3:3F22`. For each required sample, it searches `$7E:1E28`.
   - If already loaded in ARAM, it keeps the sample in place.
   - If missing, it adds it to the upload queue (`$7E:1ECA`).
2. **Space Check & Compaction**:
   - Calculates the total byte size required for all missing samples.
   - If the new samples fit above the highest resident sample in ARAM, they are appended.
   - If ARAM space is exceeded, the engine performs **garbage collection**:
     - Sends APU command `$07` to the SPC700.
     - Relocates surviving samples to compact ARAM memory.
     - Invalidates unused sample slots.
3. **APU Block Transfer**:
   - Sends APU command `$03` (`$C3:0400`).
   - Streams 3 bytes per handshake cycle across `$2141`, `$2142`, `$2143` paced by counter `$2140`.
4. **DSP Sample Directory Update**:
   - Re-writes the 4-byte entries (start address and loop address) into the DSP directory at ARAM `$1900` (`$C3:0570`).

---

## 4. Sequence Bytecode Format

The song sequence is uploaded to ARAM `$1A00`.

### 4.1 Sequence Header
- **Bytes 0–1**: Total sequence byte length (16-bit word).
- **Bytes 2–17**: 8 16-bit pointers addressing the start of each channel track relative to `$1A00` (tracks 0 through 7).

### 4.2 Single-Byte Note Encoding (`$00`–`$D1`)

Unlike MIDI or flat command streams, AKAO encodes **Pitch** and **Duration** in a single byte using base-15 modulo arithmetic:

$$\text{Note Byte} = (\text{Pitch Index} \times 15) + \text{Duration Index}$$

Upon reading a byte $N < \text{\$D2}$ at SPC `$03BD`:
```assembly
03bd 8d 00      MOV Y, #$00
03bf cd 0f      MOV X, #$0F
03c1 9e         DIV YA, X       ; A = N / 15 (Pitch), Y = N % 15 (Duration)
03c4 f6 2c 15   MOV A, $152C+Y  ; Lookup tick duration from table $152C
03c7 d4 3c      MOV $3C+X, A    ; Load channel tick countdown timer
```

#### Duration Lookup Table (ARAM `$152C`)
Clocked at standard 48 ticks per quarter note (192 ticks per whole note):

| Remainder ($N \pmod{15}$) | Ticks | Note Length |
|---|---|---|
| **0x0 (0)** | 192 (`$C0`) | Whole note |
| **0x1 (1)** | 144 (`$90`) | Dotted half note |
| **0x2 (2)** | 96 (`$60`) | Half note |
| **0x3 (3)** | 64 (`$40`) | Half note triplet |
| **0x4 (4)** | 72 (`$48`) | Dotted quarter note |
| **0x5 (5)** | 48 (`$30`) | Quarter note (1 beat) |
| **0x6 (6)** | 32 (`$20`) | Quarter note triplet |
| **0x7 (7)** | 36 (`$24`) | Dotted 8th note |
| **0x8 (8)** | 24 (`$18`) | 8th note |
| **0x9 (9)** | 16 (`$10`) | 8th note triplet |
| **0xA (10)**| 12 (`$0C`) | 16th note |
| **0xB (11)**| 8 (`$08`) | 16th note triplet |
| **0xC (12)**| 6 (`$06`) | 32nd note |
| **0xD (13)**| 4 (`$04`) | 32nd note triplet |
| **0xE (14)**| 3 (`$03`) | 64th note |

#### Pitch Calculation
- Quotient $N / 15$ specifies the semitone note offset within the current octave.
- Multiplied by 12 semitones per octave and added to the channel's octave base register.

### 4.3 Special Notes & Modifiers (`$B4`–`$C2`)
Bytes in range `$B4`–`$C2` are handled as note modifiers:
- **Rest**: Advances channel timer by duration without key-on.
- **Tie**: Sustains the previous note's pitch without retriggering the envelope attack.

---

## 5. Sequence Control Opcodes (`$D2`–`$FF`)

When a sequence byte $\ge \text{\$D2}$ is read, the driver subtracts `$D2` and dispatches through the jump table at ARAM `$1428` with parameter lengths defined at `$1484`:

| Opcode | Handler | Args | Function |
|---|---|---|---|
| **`$D2`** | `$0668` | 1 | Set channel volume |
| **`$D3`** | `$0674` | 2 | Set channel tempo / slide |
| **`$D4`** | `$06B4` | 1 | Instrument / Program change (assigns sample slot & ADSR) |
| **`$D5`** | `$06E4` | 2 | Set channel panning & stereo position |
| **`$D6`** | `$0720` | 2 | Vibrato depth and rate |
| **`$D7`** | `$0737` | 3 | Pitch slide / portamento |
| **`$D8`** | `$0749` | 0 | Disable pitch modulation |
| **`$D9`** | `$074d` | 3 | Tremolo rate and depth |
| **`$DA`** | `$075f` | 0 | Disable tremolo |
| **`$DB`** | `$0763` | 2 | Pan sweep / stereo LFO |
| **`$DC`** | `$07b4` | 0 | Disable pan sweep |
| **`$DD`** | `$0831` | 1 | Set master volume |
| **`$DE`** | `$07f5` | 0 | Octave decrease (`<`) |
| **`$DF`** | `$081d` | 0 | Octave increase (`>`) |
| **`$E0`** | `$083f` | 0 | Clear channel transpose |
| **`$E1`** | `$0856` | 0 | Set channel transpose |
| **`$E2`** | `$07ce` | 0 | Echo disable |
| **`$E3`** | `$07e5` | 0 | Echo enable |
| **`$E4`** | `$07ca` | 1 | Echo volume / feedback |
| **`$E5`** | `$07c0` | 0 | Reset echo FIR filter |
| **`$E6`** | `$07c6` | 0 | Set echo FIR filter preset |
| **`$E7`** | `$072f` | 1 | Set noise clock |
| **`$E8`** | `$072b` | 1 | Enable noise on channel |
| **`$E9`** | `$09b0` | 1 | Pitch fine tune offset |
| **`$EA`** | `$0866` | 1 | Set envelope decay rate |
| **`$EB`** | `$0890` | 1 | Configure DSP ADSR 1 register (`$x5`) |
| **`$EC`** | `$08be` | 1 | Configure DSP ADSR 2 register (`$x6`) |
| **`$ED`** | `$08d1` | 1 | Configure DSP Gain register (`$x7`) |
| **`$EE`** | `$08e3` | 1 | Direct DSP register parameter write |
| **`$EF`** | `$08f3` | 0 | Reset channel ADSR to instrument default |
| **`$F0`** | `$0944` | 1 | Set channel volume fade |
| **`$F1`** | `$096b` | 0 | Loop return / repeat step |
| **`$F2`** | `$09bc` | 0 | End of track |
| **`$F3`** | `$0620` | 1 | Set voice pitch bend coarse |
| **`$F4`** | `$062d` | 2 | Set voice pitch bend fine |
| **`$F5`** | `$06b3` | 1 | Set voice detune |
| **`$F6`** | `$06b0` | 2 | Set voice detune slide |
| **`$F7`** | `$0733` | 2 | Vibrato delay & fade-in |
| **`$F8`** | `$0665` | 1 | Volume multiplier |
| **`$F9`** | `$0917` | 3 | Loop start with repeat counter |
| **`$FA`** | `$0905` | 2 | Unconditional relative branch / jump |
| **`$FB`** | `$0995` | 2 | Call sequence subroutine |
| **`$FC`** | `$093a` | 0 | Return from sequence subroutine |
| **`$FD`** | `$09b4` | 1 | Set channel pitch transpose |
| **`$FE`** | `$09bc` | 0 | End of sequence track |
| **`$FF`** | `$09bc` | 0 | End of sequence track |

---

## 6. Comparison: Secret of Mana (AKAO) vs. Secret of Evermore (Wolfgang v3)

| Architectural Feature | Secret of Mana (AKAO) | Secret of Evermore (Wolfgang v3) |
|---|---|---|
| **Driver Lineage** | Square in-house (Minoru Akao / Hiroki Kikuta) | Brian Schmidt Productions / Wolfgang |
| **Driver Location** | Uploaded once at boot to ARAM `$0200` (5,016 B) | Re-uploaded on every music change from `$81:80DC` (6,112 B) |
| **Song Packages** | Independent sequence tracks; dynamic sample pool | Monolithic package per song (`.spc`-like full dump) |
| **Sample Management** | **Dynamic LRU cache**; individual BRR streaming | **Full upload per change**; wipes all non-base samples |
| **Sample Directory** | Standard DSP format at ARAM `$1900` (`DIR = $19`) | Per-voice virtual table at `$0200` re-written before key-on |
| **Note Encoding** | Packed: single byte $= (\text{Pitch} \times 15) + \text{Duration}$ | Unpacked: Pitch byte followed by explicit tick-count byte |
| **Duration Quantization**| Standard 15-entry duration table (48 ticks/beat) | Explicit raw timer countdown ticks per event |
| **Branching / Loops** | Subroutines (`$FB`/`$FC`), loops (`$F9`), jumps (`$FA`) | 10-byte repeat record (`$F6`), opcode table mostly custom |
| **Audio Stalls** | Smooth transitions; only missing samples uploaded | Stalls game execution while streaming full sample package |

