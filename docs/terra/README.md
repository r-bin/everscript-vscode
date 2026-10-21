# Terranigma (Tenchi Souzou) — game facts

Reverse-engineering notes for *Terranigma* (Quintet / Enix, 1995, SNES), derived from the game's own code
(the headless emulator core with breakpoints and the CDL recorder, and the room loader run on
`src/platform/snes/cpu65816.ts`) and checked against the running game (§5). Addresses are SNES bus addresses
of the European base ROM unless a file offset is named. Nothing here comes from other projects.

Code: `src/games/terra/decoder` (pure TS), `terra://` (`src/games/terra/resources`), the Maps panel
(`src/games/terra/maps`).

## 1. Cartridge

* 4 MB, HiROM FastROM (map mode `$31`); banks `$C0-$FF` map the file linearly, `$80-$BF` (and `$00-$3F`)
  mirror the upper halves. File offset = bus & `$3FFFFF`. Header at file `$00FFC0`.

## 2. Releases

Terranigma had no North American release; the English European ROM is the base.

| Variant | Region | Header title | Destination | SHA-1 (unheadered) |
|---|---|---|---|---|
| `eu` (base) | Europe (English) | `TERRANIGMA P` | `$02` (PAL) | `911239b4b21106ae4a284454d345c55554985525` |
| `de` | Germany | `TERRANIGMA D` | `$09` (PAL) | `018701e5ce385e0b32e61b8f8bb2f9abf8abf8f0` |
| `de-rev1` | Germany (Rev 1) | `TERRANIGMA D` | `$09` (PAL) | `9a64ce79bea16d01ab71b58b11df0bcf0eedd889` |
| `fr` | France | `TERRANIGMA F` | `$06` (PAL) | `4f8a5771cb11757a31a026e5892b9434a3a405cb` |
| `es` | Spain | `TERRANIGMA S` | `$08` (PAL) | `1e1a85cf28bcb69cb34fc71f48347279d7cfea7e` |
| `jp` | Japan | `TENCHI-JPN` | `$00` (NTSC) | `f787672e766a43a73d9bd310fcb3c2cac024b227` |

Only `eu` is decoded (`isBaseTerraRom`): the other releases are recognised, their tables are elsewhere.

## 3. Rooms and their scripts

* **Room table** (`$86:959C`, file `$06959C`; earlier notes said `$0D:959C`, a LoROM reading that was wrong):
  1104 entries of 24-bit pointers, one per room, to the room's script. 903 are used; an unused slot holds
  `$000002`. Read by `$86:9010` at `$047E + $0480`.
* **Shared scripts** ("table B", `$86:A28C`): 24-bit pointers to scripts several rooms enter (a room's
  header jumps or calls into one, e.g. the graphics and palette of a set of interiors). Entered by
  `$86:9035` with X = entry × 3.
* **Room change** (`$8D:8717`): the next room id from `$047C` goes to `$047E` (`$7E:047E-$7E:047F`), and room × 2
  to `$0480` (`$7E:0480-$7E:0481`) — so the room table index `$047E + $0480` is room × 3, and `$0480` alone
  indexes word tables.
* **Room properties** (`$86:955C`): a word table at `$82:8000 + room × 2` (if 0, `$83:8000`) points into the
  same bank at a byte stream: `$FF` = none, else a flags byte (to `$048B`; bit 6 clears `$0646`) then a
  display mode (§3.3).
* **Script readers**: one byte at `[$62],Y` (`$86:9005`); a relative pointer — a word and a bank added to
  the script's own position — into a direct-page pointer (`$86:90E7` + `$86:9100`).

### 3.1 The header: sections

The room loader `$86:86ED` (JSL; also reached as `$C6:86ED`, the same bytes in the `$C0-$FF` mirror) reads the room's script and runs its header: a flag byte, and for each
set bit from the MSB (dispatch `$86:86F9`) one section, again until a `00` byte. Then a call deferred by an
`08 FA` command runs (`$047A`, a shared script), and the layer maps get their cell types (§3.4).

| Bit | Handler | What it does (operands) |
|---|---|---|
| `$80` | `$86:876E` | graphics: a compressed block streamed into VRAM (`$86:84E1`); operands give the VRAM address and a cache slot (`$0430`, `$0436`) |
| `$40` | `$86:8903` | palette: 3 bytes (start, end, destination in colours) and a relative pointer; copied into the palette buffer `$7F:0600` |
| `$20` | `$86:8930` | metatiles: 3 bytes (start, end, destination in 64-byte units), a flag byte (bit 0 table of layer 0, bit 1 of layer 1, bit 7 a second path, `$86:8A32`, seen loading a `$200`-byte block — one byte per metatile, the cell-type table of §3.4) and a relative pointer to a compressed block |
| `$10` | `$86:8A7D` | layer maps: a flag byte (bit 0 layer 0, bit 1 layer 1) and a relative pointer per layer; the block starts with the width and height in 256 px units, then the compressed map (`$86:8AD8`) |
| `$08` | `$86:8C17` | a command byte: `00` display mode, `FA` call a shared script after this header (word), `FF` jump to a shared script (word), `FC` / `FD` / `F8` / `F9` conditional forms (not decoded), others skip 2 bytes |
| `$04` | `$86:8E9B` | not seen running |
| `$02` | `$86:8F37` | music: two bytes and a relative pointer; uploads to the sound CPU and waits for its answers |
| `$01` | `$86:8FAA` | not seen running |

A cache (`$86:9145`, slots `$0430-$0450`) skips a block the previous room already loaded from the same pointer.

### 3.2 The compression

`$86:83BE` (into WRAM `$BB:$B9`) and `$86:84E1` (the same, streamed into VRAM through a ring buffer at
`$7E:5000-$6FFF`). The block: a byte (count of extra chunks), a word (size), then LZ77 data read MSB-first
as flag bits: `1` = copy a literal byte; `00` + 2 bits + a byte = copy 2-5 bytes from 1-256 back;
`01` + a big-endian word = a 13-bit distance and a 3-bit length (+2), or, when the length bits are 0,
a length byte (+1); a length byte of 0 ends the chunk.

### 3.3 Display mode and layer layout

`$86:8C61` sets the screen from a 6-bit mode: `$99:C2AE` holds per mode the main / sub screen
(`$212C/$212D`, also the window copies), colour math (`$2130/$2131`) and a layout byte;
`$86:8DE9` takes one of four layouts from `$86:8E5B` (16 bytes each: `$2101`, `$210B/$210C` character
bases, window registers, then the WRAM words `$083C`, `$0834`, `$0836`, `$0838`). Layout 0 puts layer 0's
map at `$7E:A000` on VRAM `$3800`, layer 1's at `$7E:E000` on `$3C00`; layout 1 puts layer 1's at `$7E:B000`.
A room whose properties set no mode keeps the previous room's. Ark's house (room `$00F`) shows BG mode 1,
BG1 = layer 1 (light from the windows, added by colour math to BG2), BG2 = layer 0.

After the load the room change copies colour 32 (`$7F:0640`) into colour 0, the backdrop (`$8D:8C52`).

### 3.4 WRAM after a load

| Address | What |
|---|---|
| `$0826/$0828` | layer 0/1 width in pixels (0 = no such layer); `$082A/$082C` height |
| `$082E/$0830` | layer 0/1 cell count |
| `$0832/$0834` | layer 0/1 map (bank `$7E`), one word per 16 px cell, row by row |
| `$0836/$0838` | layer 0/1 VRAM tilemap word address (which BG shows it) |
| `$083A/$083C` | layer 0/1 metatile table: 512 metatiles × 4 SNES tile words (TL, TR, BL, BR) |
| `$084E/$0850` | layer 0/1 cell-type table in bank `$7F` (one byte per metatile) |
| `$7F:0600` | the palette (256 colours) the frame upload copies to CGRAM |

The power-on routine `$86:B8D6` clears WRAM and writes a table of (address, word) pairs from `$86:B93F`
(up to a negative address): the addresses above, `$0402` (a `PHB; MVN; PLB; RTS` stub whose banks
`$0404/$0405` the copy routine `$86:927E` patches), and others.

**A map word** is the metatile (bits 0-8) and a 7-bit value `$86:9332` copies from the cell-type table:
bits 9-13 are the **cell type** the movement code reads (`$80:DA28` returns `(word >> 9) & $1F`;
`$80:D772` tests types 6 and 7), bit 14 is not decoded, bit 15 is set while a character stands on the
cell (`$80:BEC2` sets it, `$80:BF42` clears it). What each type does to a move: §3.6.

### 3.5 Rooms that keep what was loaded before

Of the 903 used rooms, 22 load no map of their own, and 873 of the other 881 load their background
characters, palette, metatiles and display mode themselves. The other 8 keep what the room before them left
(the game has whatever room the player came from): `$004`, `$041-$044`, `$0FD-$0FF`. Background characters
are VRAM below word `$3800` (the BG tilemaps start there); a section `$80` can also load sprite graphics
(from word `$4000`) or the font (`$7000`) — rooms `$03C-$040` load only sprites and the font. Many rooms
decompress their characters into WRAM and send them to VRAM by DMA instead of streaming them (`$86:84E1`).

### 3.6 Cell types: collision

A character's move (`$80:D0F9`, by its velocity `$7F:0018/$001A`) checks the cell its leading edge enters on the
map at `$7E:A000` — layer 0 in every room (the loader always leaves `$0832` = `$A000`). The cell type indexes one
32-entry jump table per direction (`$80:DA31` / `$80:DDA0` horizontally, the same pattern vertically):

| Moving | Table | Open | Wall | Diagonal (types 6, 7) | Other |
|---|---|---|---|---|---|
| up | `$80:D542` | `$80:D3AC` | `$80:D3B6`, `$80:D3C0` | `$80:D440`, `$80:D4A0` | `$80:D506` (type 8) |
| down | `$80:D8E8` | `$80:D7A0` | `$80:D7AA`, `$80:D7B4` | `$80:D882`, `$80:D827` | — |
| left | `$80:DC60` | `$80:DB48` | `$80:DB52`, `$80:DB5C` | `$80:DBC9`, `$80:DC12` | — |
| right | `$80:DFDC` | `$80:DEBE` | `$80:DEC8`, `$80:DED2` | `$80:DF8E`, `$80:DF45` | — |

In line with one cell (`$0E` = 0) an open handler lets the move through (`CLC`) and a wall handler stops it at the
cell's edge (`$80:D3FD`). Straddling two cells the second-level tables (`$80:D582`, `$80:D5C2`, `$80:D602` and their
twins) take the other cell's type and either pass, stop, or nudge the character one pixel round the corner. Types 6
and 7 are also tested before the tables (`$80:D364`, `$80:D772`); on the maps they sit in a wall's upper inner
corners (6 at the left, 7 at the right: `e 6 . 7 e`), so they are the two diagonal corners. `$80:D506`: moving up into
type 8 is a wall unless bit 2 of `$097C` is set.

The base ROM's tables give: open in every direction 0, 1, 2, `$11-$14`, `$16-$18`, `$1D`, `$1E`; a wall in every
direction 3, 4, 5, 9, `$0A-$10`, `$15`, `$19`, `$1B`, `$1C`; `$1A` stops moves up and down only; `$1F` lets only a
move down through (a drop); 8 stops only a move up (gated). In Ark's house type 0 is the floor, `$0E` the walls, `$0C`
the furniture, 2 the door gap. Types 3, 9-`$0B`, `$17`, `$18`, `$1C` are on no map.

A second table, `$80:E11C` (a word per type), is read by `$80:D295` for characters without bit `$0400` of their
word +4: `$FFFF` they cannot enter (every type but 0, 1, 2, `$11`, `$16`), `$8000` (type 2, the door gap) only while
bit 15 of `$048A` is set, else they can; bit 0 of the word sets sprite priority `$3000`. Which characters those are
is not checked.

### 3.7 Exits

Every frame the main loop runs `$8D:8797` (data bank `$81`): unless bit 4 of `$097C` is set, it walks the room's
list at `$81:8000 + room × 2` — 12 bytes per exit up to an `$FF` byte: x, y, width, height in cells, a room word,
two style bytes, the arrival x and y in pixels. The first exit whose cell rectangle holds the player's cell
(`$0962`/`$0964`) and whose pixel rectangle holds the player's 16 px box (`$095E`/`$0960`, the box's top-left:
`$095E − x × 16 < width × 16 − 15`) is taken by `$8D:883E`: the room to `$047C`, the style bytes to `$0484` and `$0490`,
the arrival point to `$0492`/`$0494`; the room change (`$8D:8717`) loads it. The low nibble of `$0490` picks the
player's arrival script (3-byte pointers at `$8D:895B`, bank `$84`). `$8D:8756` is the same walk as a test (carry
clear: inside an exit), called from character scripts.

| WRAM | What |
|---|---|
| `$7E:095E` / `$7E:0960` | the player's 16 px box, top-left, in pixels (the character's position − 8, − 16) |
| `$7E:0962` / `$7E:0964` | the player's cell (the box's top-left / 16) |
| `$7E:0DEE` | the player character's record (bank `$7E`): word +0 x, +2 y (the box's bottom centre), +4 flags |
| `$7E:047C` | the next room (0: none); `$7E:0484`, `$7E:0490` the style bytes, `$7E:0492` / `$7E:0494` the arrival point |
| `$7E:097C` | state bits: 4 = no exits, 2 = type 8 passable moving up (§3.6) |

A room word with bit 15 set points (bank `$81`) at choices instead (`$8D:8911`): 10 bytes each — an event flag,
the room, the two style bytes, the arrival x and y — ending with flag `$FFFF` (no exit). The first choice whose
flag is set is taken (clear, when bit 7 of the exit's byte 6 is set); flag 0 always matches. Event flags are bits of
`$7E:06C0` (flag n: byte n >> 3, bit n & 7), tested by `$80:BBA6` (`$80:BBC7` for long callers), set and cleared by
`$80:BB77`; both use the flag word's low 12 bits.

875 rooms have a list, 2087 exits in all (room `$002`, the world map, has 87) with 2123 targets; 2067 targets are
rooms with an exit back, 2029 arrive within 2 cells of it. 57 exits in 38 rooms with a map are choices by flag.

## 4. How the decoder gets a room

`loadRoom` runs `$86:86ED` on the platform's 65816 interpreter with a bus that holds the ROM and the
power-on WRAM table, after setting `$047E` / `$0480` as a room change does. Stand-ins: the vblank flag
`$4210` reads as set (the loader waits for vblank before a DMA), the music section is skipped (trap at
`$86:8F37`), the starting layout is layout 0. For a room that keeps parts from before (§3.5), the closest
earlier used rooms that load them (up to 16 back) are loaded first, oldest first; the UI says so.
Header-only runs (the decompressors trapped, their sources recorded) give the catalog in about a second:
which sections, sizes, palette and display registers each room has, and which rooms show the same picture
(same script bytes read, blocks, palette, display registers and context: this can over-split, never merge).

The picture: each layer drawn from its metatiles and its BG's characters, BG priority (BG1 high, BG2 high,
BG1 low, BG2 low), colour math with the sub screen or the fixed colour. A layer smaller than the map repeats
when it is on the main screen (a parallax background); on the sub screen only it is a screen effect
(light, haze) and is left out. Not drawn: sprites, BG3 (text), tile animation, windows, palette animation (§6).

## 5. Checked against the game

`node tools/terra/check-room.mts <room hex>` plays the opening headless, makes the first room load the given
room instead, and compares the screen with the render (`npm run build:ts` first). October 2026, base ROM:

| Room | Agree | Rest |
|---|---|---|
| `$006A` | 100% | — |
| `$0060` | 92.6% | sprites |
| `$0012` | 90.4% | sprites |
| `$000A` (Crysta) | 90.3% | sprites |
| `$004C` | 87.6% | sprites |
| `$000F` (Ark's house) | 61.9% | the dialogue box and two characters |
| `$0024` | 38% | a parallax room: the background scrolls at its own speed, so no one offset matches both layers |
| `$0047` | 29.5% | the game shows the room dark at that moment (an event) |

`node tools/terra/check-exit.mts <room hex> [exit] [--flag <hex>]` brings the room up the same way, stands the
player in an exit and prints the room the game goes to. October 2026: exits of `$00A` (#0, #3, #6, #8), `$00C`
(#0, #1, #3), `$012` (#0, #1), `$06A` (#0, #1) agree with the table; `$0D1` #0 goes to `$0BE`, with flag `$078` to
`$0D3`, with flag `$079` to `$0F0`, as its choices say. Room `$00F`'s opening event holds the player (the tool takes
no exit there); holding the position words with the event running, its exit #0 went to `$010`.

The loader on the interpreter leaves the same metatile tables, layer maps and VRAM background characters
as the emulator for room `$00F` (byte for byte, `$7E:2000-$3FFF`, `$7E:A000`, `$7E:E000`, VRAM `$0000-$5FFF`),
and the same display registers (`$2105=$09`, BG1 `$3C00`, BG2 `$3800`, main `$17`, sub `$12`, `$2130=$82`, `$2131=$21`).

## 6. Not decoded yet

* Bit 14 of a map word, which characters the ground table `$80:E11C` applies to, what `$097C` bit 2 and `$048A`
  bit 15 stand for, the style byte `$0484` and the high nibble of `$0490`.
* The `08` commands `FC`/`FD`/`F8`/`F9`, sections `$04`/`$01`.
* The rest of a room's script after the header (events, characters) and the room properties' flags.
* Tile animation and palette animation. Palette effects are records at `$7F:0100+` (source pointer `+$0A`,
  bank `+$04`, destination `+$0C`, length `+$0E`); `$8D:93B2` copies one frame per tick and moves the source on
  (Crysta, room `$00A`: palette 6 from `$9C:97C6`, palette 7 rotated by one colour). The pictures show the
  colours the loader leaves, so animated water can look wrong (Crysta's river is purple, not blue). What sets
  the records up (probably the room's event script) is not decoded.
* The world map (mode 7), room names.
