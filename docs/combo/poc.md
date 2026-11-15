# Combo POC: Evermore and Mana on one SA-1 image, Start switches the game

Status: ✅ **POC works in MesenCE (2026-11-15).** One 8 MB SA-1 image boots Evermore. A new Start press
freezes the running game and starts or resumes the other one. Four switches were run in gameplay, and each
game came back with its screen, WRAM, VRAM, CGRAM and OAM. Built by `npm run combo`, shown by
`npm run combo:demo` (code: [tools/combo/](../../tools/combo/README.md)). The design and the open questions
are in [README.md](README.md). The SA-1 port it builds on ([../sa1/port.md](../sa1/port.md)) is unchanged.

Labels as in [README.md](README.md): *(MesenCE)* = measured there, *(disasm)* = read in the user's ROM,
*(to verify)*.

---

## 1. What the player sees

- Power-on: Evermore, as on its own cartridge.
- **Start**: the screen goes black, and Mana appears (the first time from its own power-on, after that where it
  was left). Start again goes back to Evermore where it was, and so on.
- **Select + Start**: the game's own Start (menus, the title screens).
- Music: each game's sound driver is loaded again on every switch, so music stops. Mana starts its next song
  when the game asks for one; Evermore plays its first package's music (§6).
- A switch takes about 0.3 s into a fresh Mana, about 1.1 s back into Mana and about 4.7 s back into Evermore,
  most of that Evermore uploading its driver and first package again *(MesenCE: 18, 66 and 281 frames)*.

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
| Evermore `$80:B3B0`, `$8E:E08B` | first 4 bytes of the two scene set-ups | remember which ran last |
| Mana `$7E:A6F1` (WRAM, before play) | `LDA $004218,X` | pad filter (pad 1 only) |
| Mana `$CF:FE34` (play) | `LDA $4218 / STA $0042` | pad filter |
| Mana `$7E:C133`, `$7E:C166` (WRAM) | `LDA $0002,Y / SEP #$20` in its register queue writer | copy each value into the combo's register shadow |
| Mana `$C0:27E0`, `$02:B5E7`, `$01:FD52`, `$02:AAB1` | first instructions of the title, PPU-reset, BG and screen set-ups | write the values they are about to set into the shadow |

The **pad filter** hides Start from the game unless Select is held. A new Start press calls the switch from
inside the game's own pad read. That is a point between two of the game's instructions, so the game resumes
there.

## 4. The switch

1. Push the game's registers on its own stack; NMI, IRQ, HDMA off; forced blank. Stack and direct page move
   to I-RAM.
2. **Sound out.** Evermore: command `$0E` through its port protocol (`$2143` command, `$2142` counter
   from its WRAM `$9F`). Mana: its driver's `$FE` upload writes 18 bytes of SPC700 code over its main loop at
   ARAM `$027C` (DSP soft reset, mute, no echo writes, all keys off, IPL ROM on, `JMP $FFC0`). The upload's end
   returns the driver straight into them. Then, through the IPL: `FLG = $E0` and restart the IPL, which
   shows `$BBAA`.
3. Save the game's DMA registers `$4300–$437F` (they can be read back).
4. **Memories.** WRAM (128 KB), VRAM (64 KB), CGRAM, OAM are swapped with BW-RAM `$40:4000–$43:4420` in
   1 KB chunks: chunk → I-RAM buffer (DMA), BW-RAM → chunk (DMA), buffer → BW-RAM (`MVN` from an I-RAM
   stub). The first switch only stores Evermore and zeroes WRAM for Mana.
5. Map the other game, load its DMA registers and stack pointer.
6. **Resume** (or, the first time, `JML $00:8004`, Mana's reset entry):
   - Evermore: `JSL $8C:8000` and `$8C:801F` (loader, then driver and first package); the reset's register
     constants and the last scene set-up's, decoded from the ROM at build time; `$212C/$212D/$2131/$2130`
     from `$0F80–$0F83`; `$4200` from `$0E6B`. Its NMI rewrites brightness, scrolls, windows and HDMA itself.
   - Mana: `JSL $C3:0000` (uploads its driver because the IPL answers); the register shadow; brightness
     `$0F`; IRQ line `$00C0`; `$4200` from `$7F:0090`.
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

## 6. Limits of the POC

- **MesenCE only.** Not run on bsnes/ares, a flashcart or a cartridge. 256 KB BW-RAM is the largest SA-1
  size, and hardware support is not checked *(to verify)*.
- **Music** restarts (and Evermore's resume plays its first package until the next music change); sound
  effects in flight are lost.
- **Mode 7.** Both games write the matrix directly in some scenes. Neither the shadow nor the tables cover it,
  and Mana's BG set-up assumes its non-mode-7 branch.
- **Brightness** on Mana's resume is set to full. Mana keeps no brightness shadow, so a switch in the middle of
  a fade ends the fade.
- **Only pad reads are switch points**, and a pad read can sit in the middle of game work. In Evermore it is in
  the NMI, so the main thread can be stopped anywhere. A multiply/divide waiting for its result or an SPC
  command waiting for its echo would see a changed machine on resume. No failure was seen in the runs above,
  but nothing rules it out.
- **Write-only registers** are restored from what the game is known to write: Evermore's set-up constants and
  shadows, Mana's shadow from the hooked writers. A scene set up by a writer not listed here comes back
  wrong.
- **Evermore is no longer cycle-identical** to its own cartridge (the hooks cost cycles, the I-RAM NMI stub
  is faster than slow ROM). The SA-1 port's lockstep proof does not apply to this image.
- Saves: each game's battery save lands in its own BW-RAM page; not exercised.
