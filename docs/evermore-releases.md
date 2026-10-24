# Secret of Evermore releases compared with the US version

Which Secret of Evermore ROMs exist, how to tell them apart, and how each one differs from the
**US release**. Everscript, the CDL library, the ROM map and every address in this repo assume the US release.

Everything below was measured on the files listed in §1 (October 2026). §7 says how. Addresses are
SNES bus addresses written the way the game uses them (`$Cx:xxxx` lower half, `$8x:xxxx` upper half; see
`../everscript/wiki/rom/Rom-Map.md` §2.1). "File" means the offset in an unheadered `.sfc`.

---

## Summary

| Release | Language | Video | Header region | Header version | Layout family | Intro run (frames → seconds) |
|---|---|---|---:|---:|---|---|
| **USA** (reference) | English | NTSC 60 Hz | `$01` | `$00` | US | 2090 → **34.8 s** |
| Europe | English | PAL 50 Hz | `$02` | `$00` | A (Europe, Germany) | 2100 → **42.0 s** |
| Germany | German | PAL 50 Hz | `$09` | `$00` | A | 2043 → **40.9 s** |
| France | French | PAL 50 Hz | `$06` | `$00` | B (France, Spain) | 2042 → **40.8 s** |
| Spain (Rev 1) | Spanish | PAL 50 Hz | `$08` | `$00` | B | 2043 → **40.9 s** |
| Spain (Rev 2) | Spanish | PAL 50 Hz | `$08` | `$02` | B | 2043 → **40.9 s** |
| Prototype, chip 1 of 6 | — (no text on this chip) | — | — (no header on this chip) | — | earlier build | — (can't boot) |

*Intro run* is the title sequence: from the first lit frame in room `0x61` to the fade-out before room
`0x31` (§3).

1. **The PAL games run about 17% slower than the US game.** Every PAL build takes about as many *frames*
   as the US one for the same scene, and a PAL console shows 50 frames per second, not 60. None of the
   builds reads the PPU's region bit (`$213F`), so the game cannot adjust its speed on purpose. §3.
2. **Content is complete in every release.** All 141 character records (HP, attack, defence, rates,
   procs) are identical and sit at the same address (`$8E:B678`). All releases have 71 songs. Nothing
   suggests a cut room or a cut feature. §4.
3. **The PAL games are re-built, not patched.** Only about 77% of the US ROM's 32-byte blocks appear
   anywhere in a PAL ROM, and almost nothing lines up byte for byte. The text system was rebuilt for the
   longer European translations: the string key table moved from `$91:D000` to `$92:8000` and holds
   about 3080 keys instead of 3002, and the decompressor is a different routine. So the event scripts,
   room table and graphics all sit at other addresses. **No US address can be used on a PAL ROM.** §5.
4. **There are two PAL build families.** Europe and Germany share one layout; France and both Spanish
   revisions share another. Inside a family, about 70–80% of the bytes match; across families, about 40%. §5.
5. **Spain Rev 2 fixes 9 strings** and re-packs a large share of the graphics data, compared with Rev 1. §6.
6. **The prototype chip is a different, earlier game build.** It has a debug and cheat system, an older
   character format and balance, and two fewer songs. It has its own page:
   [soe-prototype-chip1.md](soe-prototype-chip1.md).

---

## 1. The files

| File | Size | SHA-1 | Header checksum | Notes |
|---|---:|---|---|---|
| `Secret of Evermore (USA).sfc` | 3 MB | `79e7738630fff5699217ef58ecc421bc8fcbcd89` | `$33CC` | Same file as `Secret of Evermore (U) [!].smc` used everywhere in this repo |
| `Secret of Evermore (Europe).sfc` | 3 MB | `ae17166919fdfdf26cc5771f83cfd19eaf71806c` | `$0B1C` | |
| `Secret of Evermore (Germany).sfc` | 3 MB | `5e5c2082526690d05f962c3ffbd7e080c681bfa4` | `$E68E` | |
| `Secret of Evermore (France).sfc` | 3 MB | `8a430c9d6a3dcef974252fe8d946a0d619bb1a61` | `$262A` | |
| `Secret of Evermore (Spain) (Rev 1).sfc` | 3 MB | `4363ce4b19e76261f9325ac9a0cce27d97490df2` | `$7813` | |
| `Secret of Evermore (Spain) (Rev 2).sfc` | 3 MB | `c29fe997740bd9b54a07fba7b2b5442a49245aac` | `$8477` | |
| `Secret of Evermore (prototype) (chip 1).sfc` | 512 KB | `4bce54dc1568f40d2c0fd9e584842fc64e73c0d2` | — | One EPROM of six: file `0x080000–0x0FFFFF` of the prototype cart |

The checksum is the header word at `$00:FFDE`. Each retail file's computed sum matches its own header.

On the maintainer's machine the retail ROMs are in a local `evermore variants/` folder and the prototype chip is in
`~/Downloads/`. **No ROM goes into the repo.**

There is no Japanese release: Secret of Evermore was made by Square's US studio for the Western market.
There is also no separate English UK release besides "Europe".

### How to tell them apart

All six retail ROMs have the same header title (`SECRET OF EVERMORE`), map mode (`$31`, HiROM FastROM),
cartridge type (`$02`), declared ROM size (`$0C`) and SRAM size (`$03`, 8 KB). They differ in:

- **Region byte** `$00:FFD9`: `$01` USA, `$02` Europe, `$06` France, `$08` Spain, `$09` Germany.
  Emulators pick NTSC or PAL from this byte. In snes9x every value except `$00`, `$01` and `$0D` means
  PAL (`memmap.c`, bundled core).
- **Version byte** `$00:FFDB`: `$00` on all except Spain Rev 2 (`$02`). No Spain `$01` is known.
- **SHA-1 / checksum**, table above.

A tool that needs the US layout should check the SHA-1 or, at least, the region byte (`$01`), and
refuse other releases instead of reading garbage at US addresses.

---

## 2. What is the same everywhere

| Item | Value | Evidence |
|---|---|---|
| ROM size | 3 MB, HiROM FastROM | header + file size |
| Character records | 141 × 74 bytes at `$8E:B678`, identical stats | Bytes `+0x0D..+0x2F` of all 141 records, compared in place |
| Song count | `0x46` at `$81:9900` (songs `0x00`–`0x46`) | same byte, same address |
| Intro sequence | the same rooms in the same order: `0x00` → `0x61` → `0x31` → `0x12` | headless boot, `$7E:0ADB` (§3) |
| WRAM room id | `$7E:0ADB` | reads the expected room ids in all six |

The character table's upper half (`$8E`) is the part of the ROM that lines up best: 63% of its bytes match
the US one at the same address. Upper halves `$80` and `$91` reach about 35%; everywhere else it's 1–12%.

---

## 3. Frame rate and speed

A PAL SNES draws 50 frames per second, an NTSC SNES about 60. A game that counts in frames runs 5/6 as
fast on PAL unless it adjusts its timers, movement speeds and animation holds.

**Evermore does not adjust.** Measured with the bundled snes9x core (`snes9x2005-wasm-vanilla`), which
chooses PAL from the region byte, no input, from power-on:

| Release | Title appears (frame) | Title fades (frame) | Title on screen |
|---|---:|---:|---|
| USA | 482 | 2572 | 2090 frames = 34.8 s |
| Europe | 509 | 2609 | 2100 frames = 42.0 s |
| Germany | 509 | 2553 | 2044 frames = 40.9 s |
| France | 509 | 2551 | 2042 frames = 40.8 s |
| Spain Rev 1 | 509 | 2552 | 2043 frames = 40.9 s |
| Spain Rev 2 | 509 | 2552 | 2043 frames = 40.9 s |

- The scene has about the same length *in frames* (±2%: the translated text has a different length) and
  is therefore **17–20% longer in seconds** on PAL. Gameplay counts in frames the same way, so walking,
  combat timers, alchemy charge and animations are slower too.
- **No build reads `$213F`** (the PPU register whose bit 4 tells 50 Hz from 60 Hz). The code can't know
  which console it is on, so there's no hidden speed-up.
- **Music plays at the same tempo.** The SPC700 has its own clock and the sound driver sets the same timer
  values in every release. Music and visuals therefore drift apart in scenes timed to the music.
- Running a PAL ROM with the emulator forced to NTSC runs it at US speed. This was not tested for side
  effects (raster timing, sound sync).

---

## 4. Completeness

No release is missing anything that was checked:

- **Characters / balance:** identical in all six (§2). The PAL builds didn't re-balance anything.
- **Music:** 71 songs everywhere. The PAL builds carry **another build of the sound driver**: its first
  bytes differ, and it has an ASCII driver/version tag the US driver lacks. Song count and timer setup
  are the same.
- **Text:** every release has a full translation (§5). The PAL key tables hold about 3080 keys against
  the US's 3002; the extra keys appear to come from the changed dictionary scheme (common words such as
  articles stand as plain keys), not from extra dialogue.
- **Rooms, scripts, sprites, map graphics** were not compared one by one: the PAL builds put them at
  different addresses (§5), so a fair comparison needs the PAL tables found first. The intro, which runs
  room loads, scripts, sprites and music, plays through identically.

The **prototype chip** is the exception: an earlier build with fewer characters (136 records), no Confound
status, swapped final-boss HP, 69 songs instead of 71, and a locked debug/cheat system. See
[soe-prototype-chip1.md](soe-prototype-chip1.md).

---

## 5. How the PAL builds differ in layout

### 5.1 Nothing lines up

Byte-for-byte, a PAL ROM differs from the US one in 82–97% of all bytes. Most of that is *displacement*,
not new content. The same data sits elsewhere, and every pointer to it changes with it:

| Measure | Europe | France | Germany | Spain 1 | Spain 2 |
|---|---:|---:|---:|---:|---:|
| Bytes different from US at the same offset | 96.5% | 82.5% | 96.6% | 82.0% | 82.0% |
| US 32-byte blocks found *anywhere* in the ROM | 77.3% | 77.4% | 77.2% | 77.5% | 77.5% |

Blocks with embedded pointers count as "not found" even when only the pointer changed, so 77% is a lower
bound for shared content. US banks with the lowest share found are the strings (`$C0–$C2`, 31–50%:
re-translated), the engine code banks (`$8D`, `$8E`, `$8F` halves of `$CD–$CF`, 19–28%: same code, moved
operands) and `$CC` (43%).

Bank `$C0` code sits 0x34C bytes later in every PAL build than in the US one. The same routines, in the
same order, were pushed down by the code inserted ahead of them.

Routines move but keep their code. Matching each of the 539 routines with a knowledge entry by its
first ~32 bytes, address operands masked (`src/games/evermore/resources/code-locate.ts`, v0.343.0):

| | Europe | Germany | France | Spain 1 |
|---|---:|---:|---:|---:|
| at the US address | 62 | 62 | 62 | 62 |
| moved, found by bytes | 424 | 424 | 428 | 428 |
| not found (code changed) | 53 | 53 | 49 | 49 |

In Germany 484 of the 486 found routines decode to the same instruction sequence as the US ones over
their first 12 instructions. Shifts seen: `$8C:D220` → `$8C:D609` (+$3E9), `$80:9033` → `$80:9032`
(−1), and the event-script routines of bank `$92` one bank later (`$92:9FA0` → `$93:9FA0`, §5.2).
`soe://rom/code/<name>/` shows each routine's place in the ROM read.

### 5.2 Text system

| | USA | PAL builds |
|---|---|---|
| String key table | `$91:D000`, 3002 × 3 bytes | `$92:8000`, ~3080 × 3 bytes |
| Built by the readers as | `lda #$0091 : sta $28 : ldy #$D000` | `lda #$0092 : sta $28 : ldy #$8000` (same 2 sites) |
| Decompressor | `$8C:CD90`, dictionary tables `$91:F32E..$91:F7D5` | a different routine (the US code doesn't match even with operands masked) |
| Plain (uncompressed) keys | 144, including the credits | 45–72; the credits are compressed too |
| Accented characters | none | used (French, German, Spanish) |

Because the key table took the start of `$92`, where the US keeps the **event scripts** (`$92:8000`: room
enter table and the global script table), the scripts, and the rooms behind them, moved too.
`tools/table-hack`, the ROM tab, the CDL library and the Everscript compiler all assume the US layout
and must not be run on a PAL ROM.

### 5.3 Localisation details

- **Europe** is an English build, separate from the US text: it has the PAL layout, and its strings
  aren't byte-identical to the US ones.
- **Germany** renames some characters (for example, Camellia Bluegarden has a German name).
- **Spain** leaves the name of the hometown in the opening, Podunk, in English.
- **France** and **Spain** keep their last string earlier in ROM (around `$C2:7880`) than English/German
  (around `$C3:0BE0`).

### 5.4 Two families

Share of bytes that differ, every pair (whole ROM, same offset):

| | USA | Europe | France | Germany | Spain 1 | Spain 2 |
|---|---:|---:|---:|---:|---:|---:|
| USA | — | 96.5 | 82.5 | 96.6 | 82.0 | 82.0 |
| Europe | 96.5 | — | 63.6 | **30.7** | 60.1 | 62.8 |
| France | 82.5 | 63.6 | — | 56.4 | **23.7** | **25.1** |
| Germany | 96.6 | **30.7** | 56.4 | — | 56.0 | 57.9 |
| Spain 1 | 82.0 | 60.1 | **23.7** | 56.0 | — | **17.8** |
| Spain 2 | 82.0 | 62.8 | **25.1** | 57.9 | **17.8** | — |

Europe + Germany form one family, France + Spain the other. France/Spain line up much better with the US
in the sprite banks (`$C5`, `$C7`, `$C9–$CC`, `$D1–$E0`: 45–80% different instead of 94–99%). So that
family kept more of the US graphics layout.

---

## 6. Spain Rev 1 → Rev 2

- Header version byte `$00` → `$02`.
- **9 strings changed** (keys 703, 715, 2028, 2354, 2481–2483, 2568, 2786); most keep their length, two
  lose one byte. A text fix.
- Larger byte changes in the lower halves `$C0–$C9` and `$D0–$EF` and in several upper halves (largest: `$8D`,
  `$90`, `$91`, `$92`, `$9C`, `$AF`). Most look like data shifted by the edited strings and graphics re-packed
  around them. Code changes were not looked for.

---

## 7. How this was measured

Scripts lived in the session scratchpad and are not checked in. To reproduce:

- **Header and identity**: read `$00:FFC0..$00:FFDF` (file `0xFFC0`); SHA-1 of the whole file.
- **Layout**: compare bytes at the same offset; index every 32-byte window of the target ROM and look up
  each 32-byte-aligned US block (§5.1).
- **String keys**: find the `lda #$00bb : sta $28 : ldy #$aaaa` sequences (`A9 bb 00 85 28 A0 aa aa`), read
  3-byte keys from there, convert `(v & $7FFFFF)` → `bank << 16 | (v & $7FFF)` and dump the plain ones
  (bit 23 clear) to identify the language.
- **Region check**: search for `LDA $213F` (`AD 3F 21`), `LDA $00213F` (`AF 3F 21 00`) and `BIT $213F`
  (`2C 3F 21`). None in any release.
- **Speed**: boot each ROM in `src/core/emulator/core/snes9x2005-wasm-vanilla` under node (load it with `vm.runInThisContext`,
  then `_startWithRom` and one `_mainLoop` per frame), no input, 3000 frames. Each frame, log whether the screen is
  dark and the room id at `$7E:0ADB`.
- **Characters**: compare bytes `+0x0D..+0x2F` of each of the 141 US records at `$8E:B678` (file
  `0x0EB678`) with every release.

### Open questions

- Where the PAL builds keep their event scripts, room table, sprite and map-graphic tables. Finding them
  is the first step to a room-by-room or script-by-script comparison.
- What the PAL decompressor's dictionary format is.
- Whether a PAL ROM forced to 60 Hz has any timing bugs.
