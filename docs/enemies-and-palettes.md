# Enemies and palettes: how they load, and how the table hack adds more

How an enemy goes from a script's `add_enemy` to the screen, and how the two kinds of palette travel
from ROM through WRAM into CGRAM. Then what `tools/table-hack` changes so that there can be more
enemies, more background palette families and new sprite palettes, and how that was checked.

Facts are marked *(disasm)*, *(test)* (measured headless in the bundled snes9x core, v0.223.0) or
*(to verify)*. Addresses are bus addresses unless a file offset is named.

## 1. Enemies

### 1.1 From a script id to a record

1. A script spawns an enemy with `0x3C`, `0xBA`, `0xA2` or `0xC2` and an `ENEMY` id
   ([enemy_spawns.md](script-format/enemy_spawns.md)).
2. The spawn handler (`$8C:DC9A`, `$8C:DCC3`, `$8C:DCD9`, `$8C:DCEC`) reads `lda.l $8EB55A,x` with
   X = id·2 *(disasm)*. That is the **enemy index**:
   - 143 words, right before the character table;
   - each word is the 16-bit address of a character record (`knowledge/rom/8eb55a.md`).
3. The record is 74 bytes ([character_table.md](script-format/character_table.md)). The engine
   keeps the record's 16-bit address, and every reader takes the record as `$8E00xx,X`: the field
   offset is the operand and X is the record address.

The Boy and the Dog are the exception:

- Index entries 0 and 1 are `$0A26` / `$0A70`, so their records live in WRAM.
- `$8F:803C` fills them on a new game with `mvn $8E,$8E`, copying records 0–1 (`$94` bytes) from
  `$8E:B678` (`knowledge/rom/8f803c.md`).
- Readers reach the WRAM copies through the WRAM mirror at `$8E:0000–1FFF`.

### 1.2 What limits the count

| | Vanilla | Limit | Why |
|---|---|---|---|
| enemy ids | 143 | 256 | `0xBA`/`0xC2` take a one-byte id |
| records | 141 | 254 in their own bank | Records must keep their 16-bit addresses. From `$B678` to the end of a bank there is room for 254. |

In vanilla, other data follows both tables directly, so neither can grow in place.

## 2. Sprite palettes

### 2.1 The path

| Step | Where | What |
|---|---|---|
| ROM | `$90:xxxx`, 32 bytes | Record `+0x09` (and `+0x0B`, a second palette) is a 16-bit address in bank `$90`. Word 0 is not copied; words 1–15 are the colours. Every vanilla palette is at `$8000` or above. |
| slot | `$7E1278`, 8 words | `$90:CD80` picks a slot. First it reuses a slot that already holds the same address (offsets 8, 10, 0, 2, 4). Then it takes a free one (8, 10, 0, 2). Otherwise it steals offset 4. Offsets 12 and 14 are the Boy's and the Dog's ([palettes.md](script-format/palettes.md)). |
| WRAM | `$7E6187 + 32·(8 + offset/2)`, colours from `+2` | `$90:CF3A` copies the 15 colours into the CGRAM shadow (§4) with DB = `$90` (`phb : phk : plb`) *(disasm)*. |
| CGRAM | colour `128 + 16·(offset/2) + 1` | `$90:CFB8` points a DMA at the **ROM** palette, not the WRAM copy: `$26` = address + 2, `$28` = `#$0090` at `$90:CFD2`. `$C0:85FA` uploads 30 bytes *(disasm)*. |

Measured on the test ROM (§6) at frame 440 *(test)*:

- `$7E1278` = `0000 0000 0000 0000 B34B 0100 AD6B AE0B`;
- the vanilla Mosquito's colours are at `$7E6309+` (sprite palette 4) and the new palette's at
  `$7E6329+` (sprite palette 5);
- CGRAM's sprite palettes 4 and 5 hold the same colours.

The slots are still empty at frames 380–420, before the room's enter script spawns anything.

### 2.2 Why new sprite palettes need code

Bank `$90` has no free space, and its lower half is not ROM. Both readers take bank `$90` from the
code itself: `phk` in the loader and the immediate `#$0090` in the upload. So a new palette cannot
be placed anywhere they can reach without changing them. The Boy's and Dog's low-HP flash
(`$8F:9583`, `$8F:95EB`, `$8F:966E`, `$8F:96D6`) and `$90:8A2F` also hard-code bank `$90`. They
read the party's own palettes, never an enemy's (`knowledge/rom/90cf3a.md`).

## 3. Background (map) palettes

| Step | Where | What |
|---|---|---|
| room | blob `payloadOffset` | A count byte, then 16-bit family ids (up to 7 load), [map_palette_extraction.md](map-format/map_palette_extraction.md). |
| ROM | `$9C:C322 + 32·family` | The loader `$90:D05C` computes the source as `id·32 + #$C322` and the bank as `#$9C`. These two immediates are its only reference to the block *(disasm, scan)*. Vanilla has 365 families; in place the block could hold 486. |
| WRAM | `$7E61A7 + 32·i` | DMA through `$2180`: family `i` becomes background palette `1 + i` in the CGRAM shadow. |
| CGRAM | from CGADD `$10` | `$C0:85FA` uploads N·32 bytes **from the WRAM shadow**. |

Measured on the test ROM *(test)*: family 365 sits at `$7E61A7+`, i.e. background palette 1.

## 4. The CGRAM shadow `$7E6187`

`$7E6187–$7E6386` holds all 256 colours, 512 bytes, in CGRAM order: palette `p` at
`$7E6187 + 32·p`. Background families land at `p = 1…7` and sprite palettes at `p = 8…15`. CGRAM
uploads run from it, except the sprite palette upload in §2.1, which reads ROM directly. Code that
changes colours on the fly works on this copy (`$8F:95C1` reads `$7E6187 + $1C2`)
(`knowledge/ram/7e6187.md`).

## 5. What the table hack changes

| Move | New place | What changes in the code | Limit afterwards |
|---|---|---|---|
| enemy index | `$B8:8000` (file `0x388000`) | 4 × `lda.l $8EB55A,x` | 256 ids |
| character records | `$B8:B678` (file `0x38B678`), same 16-bit addresses | 131 operands `$8E00xx` → `$B800xx` and `$CE00xx` → `$F800xx`, plus `mvn $8E,$8E` → `mvn $8E,$B8` at `$8F:8046` | 254 records |
| map palettes | `$B9:8000` (file `0x398000`) | `adc #$C322` → `#$8000` (`$90:D065`), `lda #$9C` → `#$B9` (`$90:D079`) | 1024 families |
| sprite palettes (hook) | `$FA:0100–$7FFF` (file `0x3A0100`) | `$90:CF3A` and `$90:CFD2` jump to code at `$BA:8000`. That code reads an address below `$8000` as bank `$FA`, and anything else as `$90`. | 1016 new palettes |

Some choices follow from the WRAM mirror and from bus speed:

- **Records go in `$B8`, not `$F8`.** The `$8E00xx` readers must stay in a `$80–$BF` bank, so that
  X = `$0A26` / `$0A70` still reaches the Boy's and Dog's WRAM records.
- **The `$CE00xx` readers only ever reach ROM records**, so they become `$F8`.
- **Every new bank is a FastROM bank, like the old one.** That keeps every cycle count the same.

The old copies are wiped with `$FF`. A reader the scan missed would then read garbage and show up
in the proof. That is how the `mvn` was found: the Boy's record at `$7E0A26+` filled with `$FF`.

Hits that were left alone (listed in the proof report):

- 8 byte patterns in data banks (`$8A`, `$A0+`) that only look like `$8E00xx` operands;
- 17 operands with a full record address (`$8E:B6xx–DFxx`) in code the CDL never recorded *(to
  verify)*.

New palette address `0` is never used: a slot holding 0 is empty.

### 5.1 The hook and the RNG

The hook makes every palette load, vanilla ones included, about 56 CPU cycles longer. The game
steps its RNG while it waits for the next frame *(to verify: the routine)*. From frame 374 of the
attract loop the random state (`$7E0133–$013A`) differs, and with it random effects: the intro's
lightning is drawn differently. Nothing breaks, but a ROM with the hook no longer matches vanilla
frame for frame.

Table moves keep their cycle counts and do match. That is why `prove.js` reports images with the
hook as "timing differs (hook)" instead of failing them (sample-playbacks skill). Alternatives that
keep identity:

- reuse vanilla palettes for new enemies;
- free room inside bank `$90`. No table there could move out with operand rewrites alone.

## 6. How it was checked

- **Proof:** `npm run table-hack:prove`. The attract-loop playback (6224 frames, all readers reached:
  enemy index 63×, records 296×, map palettes 54×, sprite palettes 49×) on every image. Each table
  move alone and all of them together match the original: same WRAM every frame, same screen every
  60.
- **Test ROM:** compile `tools/table-hack/evs/enemy-143.evs` (tools/table-hack/README.md), then

  ```sh
  npm run table-hack -- --rom <clean rom> --ips <everscript.ips> --add-enemy 113 --recolor-room 0x15 \
      --out out/table-hack/soe-tables-mosquito-test.sfc
  ```

  Brian's room then shows enemy `$8F` next to a vanilla Mosquito (`0x0F`):
  - `$8F` is record 141, a copy of the Mosquito (record 113), with a red/blue-swapped palette at
    `$FA:0100`;
  - the room uses family 365, a red/blue-swapped copy of its family 21, so its orange lights turn
    blue.

  CGRAM and the WRAM shadow hold both Mosquito palettes (§2.1).

## 7. Open

- Teach the everscript compiler and the plugin's decoders the moved addresses. `add_enemy(0x8f, …)`
  only works today because the id is a plain number.
- The 17 untested full-address operands (§5).
- Which routine steps the RNG while waiting for the next frame (§5.1).
