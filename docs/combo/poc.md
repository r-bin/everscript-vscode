# Combo POC: Evermore and Mana on one SA-1 image, Start switches the game

Status: ✅ **POC works in MesenCE (2026-11-15), Start stable.** One 8 MB SA-1 image boots Evermore. A new
Start press freezes the running game and starts or resumes the other one. Each game comes back with its screen,
WRAM, VRAM, CGRAM, OAM and interrupt set-up. `npm run combo:stress` presses Start at random points in both games'
playbacks; its runs pass without a failure (§5). Built by `npm run combo`, shown by `npm run combo:demo` (code:
[tools/combo/](../../tools/combo/README.md)). The design and the open questions
are in [README.md](README.md). The SA-1 port it builds on ([../sa1/port.md](../sa1/port.md)) is unchanged.

Labels as in [README.md](README.md): *(MesenCE)* = measured there, *(disasm)* = read in the user's ROM,
*(to verify)*.

---

## 1. What the player sees

- Power-on: Evermore, as on its own cartridge.
- **Start**: the screen goes black, and Mana appears (the first time from its own power-on, after that where it
  was left). Start again goes back to Evermore where it was, and so on.
- **Select + Start**: the game's own Start (menus, the title screens).
- A press is acted on at the game's next point where it can be stopped (§3). That is the same frame almost always.
  It can be later in two places: Evermore's first ~320 frames after power-on, before its sound driver is loaded,
  and Mana's first ~35 frames, while its driver is uploaded.
- Music: each game's sound driver is loaded again on every switch. Evermore plays the track it last asked for
  again, from the start. Mana starts its next song when the game asks for one (§6).
- A switch takes about 0.3 s into a fresh Mana, about 1.2 s back into Mana and about 6 s back into Evermore.
  Most of that is Evermore's own sound start: its loader needs ~3 s before it accepts the driver *(MesenCE: 20,
  69 and 358 frames)*.

## 2. The image

The block layout of [README.md](README.md) §3, as built:

| Block | Holds |
|---|---|
| 0 | Mana's banks `$00–$1F:8000–FFFF`, LoROM-arranged; the combo header (SA-1, 8 MB, 256 KB BW-RAM) and vector table at `$00:FFB0–FFFF` |
| 1, 7 | Mana's first and second MB, linear |
| 2, 3 | Evermore's code view, as in the SA-1 port; the SA-1 boot block at `$B8:8000`, **the combo code at `$B8:9000`** (~2.7 KB) |
| 4–6 | Evermore's 3 MB, linear (block 7 would be its 4th MB, which only `$B0` reads, through block 3) |

The combo code sits in block 3. Neither game's mapping moves that block, so the code can be reached from
both. CXB–FXB = 4,5,6,7 for Evermore and 1,7,1,7 for Mana. BMAPS selects BW-RAM page 0 (Evermore's save) or
1 (Mana's). `$420D` is 1 for Evermore and 0 for Mana.

**Bank `$00` without the SA-1 CPU.** The research expected the SA-1's SNV/SIV registers to be needed
(README §4). The POC does without them: the vector table sends NMI and IRQ to `$00:3000`/`$3004` in
**I-RAM**, which is in bank `$00` and belongs to neither game. The switch writes a `JML` to the active game's
handler there. Reset uses the spare native vector slot `$FFE0–$FFE3`, which holds `JML combo_reset`. COP,
BRK and ABORT point to a `STP`. The SA-1 CPU stays in reset throughout. `combo_reset` allows the S-CPU to
write I-RAM (SIWP `$2229` = `$FF`, 0 after reset in MesenCE), writes the stubs, then runs Evermore's own
13-byte reset entry (copied from the ROM).

## 3. Hooks into the games

Each patch checks the original bytes first, so another ROM fails the build. Mana's WRAM code is unpacked at
boot and is not in its ROM byte for byte. Hooks into that code are put in by `mana_nmi` (every Mana NMI
passes through it via the I-RAM stub) once the expected bytes appear.

| Where | Replaces | Does |
|---|---|---|
| Evermore `$80:848F` (NMI) | `LDA $4218 / BRA $84A0` | pad filter, `JML $80:84A0` |
| Evermore `$80:8F85` | `LDA $D9 / BNE $8F8A` (`wait_for_nmi` going on after the NMI) | switch point (below), then the replaced code |
| Evermore `$80:B3B0`, `$8E:E08B` | first 4 bytes of the two scene set-ups | remember which ran last |
| Mana `$7E:A6F1` (WRAM, before play) | `LDA $004218,X` | pad filter (pad 1 only) |
| Mana `$CF:FE34` (play) | `LDA $4218 / STA $0042` | pad filter |
| Mana `$7E:C133`, `$7E:C166` (WRAM) | `LDA $0002,Y / SEP #$20` in its register queue writer | copy each value into the combo's register shadow |
| Mana `$C0:27E0`, `$02:B5E7`, `$01:FD52`, `$02:AAB1` | first instructions of the title, PPU-reset, BG and screen set-ups | write the values they are about to set into the shadow |

The **pad filter** hides Start from the game unless Select is held. A new press is kept (`PENDING`) until the game
is at a point where it can be stopped. Stopping it anywhere else can cut through something whose registers can't
be read back, so the resume can't restore it: a sound command or upload, a multiply/divide whose result is read
later, a stream through the WRAM port `$2180`. Those points:

| Game, phase | Pad read | Switches |
|---|---|---|
| Mana, in play | `$CF:FE34`, main loop (`$C0:B0AC`), between whole tasks | at once |
| Mana, before play | `$7E:A6E8`, inside its NMI | only if that NMI stopped the main thread in its idle loop `$7E:A29F–$A2A4` (`mana_nmi` records where it stopped) |
| Evermore | `$80:848F`, inside its NMI, which can stop the main thread anywhere (it idles in only ~4 % of frames) | never there: at the next frame yield `$80:8F85`, which every thread passes between pieces of work |

On top of that, the game's sound must be idle. Mana: port 1 isn't the boot ROM's `$BB` (before play its driver is
uploaded from the NMI over ~35 frames). Evermore: port 2 echoes its command counter `$9F`, so its driver has
answered the last command. That excludes the ~320 frames after power-on when only its loader runs, which looks
like the boot ROM (`$BBAA`) but isn't. The switch returns to where it was called, so the game resumes there.

## 4. The switch

1. Push the game's registers on its own stack. **Measure the interrupt set-up**: neither game keeps a reliable
   copy of `$4200` (Mana writes it directly at `$00:B061`, past its `$7F:0090` shadow), and HTIME/VTIME can't be
   read. For two frames the NMI stub counts NMIs instead of entering the game, and the IRQ timer flag `$4211` is
   polled with I set (the flag is set on a timer hit anyway). If there were hits, one more `WAI` (with I set it
   wakes on the timer without taking the IRQ) is followed by a counter latch (`$2137`). The latch lands 14 dots
   after the hit *(MesenCE)*, and gives H and V. Hits on every line mean H only; at H < 20, V only; otherwise
   H and V. Then NMI, IRQ, HDMA off; forced blank. Stack and direct page move to I-RAM.
2. **Sound out.** Evermore: command `$0E` through its port protocol (`$2143` command, `$2142` counter
   from its WRAM `$9F`). Mana: its driver's `$FE` upload writes 18 bytes of SPC700 code over its main loop at
   ARAM `$027C` (DSP soft reset, mute, no echo writes, all keys off, IPL ROM on, `JMP $FFC0`). The upload's end
   returns the driver straight into them. Then, through the IPL: a 32-byte routine at ARAM `$0200` sets
   `FLG = $E0` first, every other DSP register to 0, waits ~0.4 s and goes back to the IPL. Output ports 2 and 3
   are set to 0. The IPL resets neither. FLG goes first because a new echo start or length only counts once the
   echo pointer has run through the old buffer (up to 240 ms). With echo writes on in that time, they land at the
   new start plus the old offset: once that was over the routine itself. The wait lets the pointer get through. With Mana's echo start and length still
   in the DSP, the echo wrote over Evermore's driver data while that driver moved the DSP registers to its own
   values, and its next start never ended (`spc700_driver_boot_and_music_init` knowledge entry).
3. Save the game's DMA registers `$4300–$437F` (they can be read back).
4. **Memories.** WRAM (128 KB), VRAM (64 KB), CGRAM, OAM are swapped with BW-RAM `$40:4000–$43:4420` in
   1 KB chunks: chunk → I-RAM buffer (DMA), BW-RAM → chunk (DMA), buffer → BW-RAM (`MVN` from an I-RAM
   stub). The first switch only stores Evermore and zeroes WRAM for Mana.
5. Map the other game, load its DMA registers and stack pointer.
6. **Resume** (or, the first time, `JML $00:8004`, Mana's reset entry):
   - Evermore: counter `$9F` = 0 as at power-on; `JSL $8C:8000` and `$8C:801F` (loader, then driver and first
     package). `$8C:8000` clears the soundbank Evermore thinks resident (`$0E4B`), but the track `$0E4D` still
     counts as playing. A sound effect needing it then crashed the fresh driver, so the track is played again
     the way script opcode `$33` does it: `$1A`, `$2A`/`$A0`, `$2C`/0, `play_music_track` `$8C:828F`, then
     `$28` with the fader's volume `$9A`. Then the reset's register constants and the last scene set-up's,
     decoded from the ROM at build time, and `$212C/$212D/$2131/$2130` from `$0F80–$0F83`. Its NMI rewrites
     brightness, scrolls, windows and HDMA itself.
   - Mana: `JSL $C3:0000` (uploads its driver because the IPL answers); the register shadow; brightness `$0F`.
   - Both: `$4200`, HTIME and VTIME as measured in step 1.
7. Pull the registers and return into the game's pad read, with Start marked as held.

**VRAM read trap** *(MesenCE, matches the hardware descriptions)*: setting VMADD fills the read latch, and every
read refills it from the address *before* it moves on. So the first word read after setting the address
arrives twice. The swap does one dummy word read after each VMADD write. Without it, the restored VRAM is the
right data shifted by one word.

## 5. Proof

`npm run combo:demo` *(MesenCE, 2026-11-15)*: Evermore playback `…_2026-10-19_13-18-13` and Mana playback
`…_2026-10-16_09-26-07` replayed as input. A test byte (`$00:301E`: bit 0 gives Start to the game, bit 1
switches) lets the playbacks keep their own Start presses. A player never touches it.

| Frame | Event | Checked |
|---|---|---|
| 4200 | Evermore, room `$02` (night gate) → Mana, from its power-on | screenshot |
| 14218 | Mana, map `$80` (river) → Evermore | Evermore back in room `$02`, same screen; its playback goes on |
| 14629 | Evermore → Mana | Mana back on map `$80`, same screen |
| intro runs | three switches during both intros | WRAM equal but for each game's sound variables and the stack; VRAM, CGRAM, OAM equal byte for byte; PPU state equal (MesenCE `ppu.*`) except the mode-7 matrix |

**Stress runs** `npm run combo:stress` *(MesenCE, 2026-11-15, the same two playbacks)*: seeded random stretches of
each game's frames, then a switch. Every switch must start within 600 frames of the press and end within 900. It
must never reach the crash vector, must bring back the frozen game's memories, and must bring back its interrupt
set-up as MesenCE's own registers show it.

| Seeds | Frames between switches | Switches | Failures |
|---|---|---|---|
| 1, 2, 3 | Evermore 20–900, Mana 20–600 | 3 × 65 | 0 |
| 4, 5 | 1–120 | 361, 367 | 0 |
| 6 | 1–60 | 681 | 0 |
| 7 | Evermore 200–3000 over 40000 frames, Mana 20–400 | 38 | 0 |

At each resume, WRAM differs only in Evermore's counter `$9F`, the stack bytes below the frozen stack pointer
that the switch used, and Mana's sound state `$1E00–$1EFF` (cleared by its sound init). VRAM, CGRAM and OAM were
equal every time. The playbacks themselves drift from a run without switches after a while. A recording assumes
exact frame timing, and every switch shifts the games against the emulator's frames, so a menu press can land a
frame off. That's why drift is reported, not counted as a failure.

The failures these runs found, all fixed: Mana's `$4200` restored from its shadow left NMI off (§4 step 1).
Switches inside Evermore's NMI cut through its sound transfers (§3). Mana's driver upload ran in its NMI while
the main loop idled (§3). Evermore's frozen track no longer matched the fresh driver (§4 step 6). The DSP kept
Mana's echo set-up (§4 step 2).

## 6. Limits of the POC

- **MesenCE only.** Not run on bsnes/ares, a flashcart or a cartridge. 256 KB BW-RAM is the largest SA-1
  size, and hardware support is not checked *(to verify)*.
- **Music** restarts from the beginning (Evermore's track is played again, Mana waits for its next song);
  sound effects in flight are lost. Evermore's `$2A`/`$2C` settings come back as script opcode `$33` sets them,
  not as a script may have changed them since.
- **Mode 7.** Both games write the matrix directly in some scenes. Neither the shadow nor the tables cover it,
  and Mana's BG set-up assumes its non-mode-7 branch.
- **Brightness** on Mana's resume is set to full. Mana keeps no brightness shadow, so a switch in the middle of
  a fade ends the fade.
- **Switch points** are chosen from the code read so far (§3): Mana's field read is on its main thread, and no
  sound transfer spans an Evermore frame yield. A long stretch without such a point delays the switch; the stress
  runs saw none longer than Evermore's power-on sound start.
- **Write-only registers** are restored from what the game is known to write: Evermore's set-up constants and
  shadows, Mana's shadow from the hooked writers. A scene set up by a writer not listed here comes back
  wrong.
- **Evermore is no longer cycle-identical** to its own cartridge (the hooks cost cycles, the I-RAM NMI stub
  is faster than slow ROM). The SA-1 port's lockstep proof does not apply to this image.
- Saves: each game's battery save lands in its own BW-RAM page; not exercised.
