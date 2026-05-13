# Map Loading

This note records the room-loading behavior that is grounded enough to ship today, and separates that from what is still unknown.

## Evidence level

- Confirmed from traced data: room pointer, room size, trigger-table offsets, `LDA [$8B],Y` stream read, truncation behavior.
- Confirmed from in-repo notes and parser behavior: trigger tables begin after a 13-byte header, and each trigger record is 6 bytes wide.
- Confirmed from the Strong Heart trace: bytes `0..3` of the header are room origin plus map dimensions, and bytes `4..7` feed room display/color setup.
- Confirmed from cross-map payload analysis: the payload is an opcode/script stream, not a flat bitmap. The first command is a tile-set load list; a shared sentinel separates it from a position table.
- Still unknown: header byte `0x08`, the 16-bit field at bytes `0x09..0x0A`, the role of bytes `0x0B..0x0C`, the compressed middle section of the payload, the final destination-buffer layout, and the exact split between art and collision decode phases.

## Confirmed Strong Heart exterior example

Room `0x33` / `Prehistoria - Strong Heart's Exterior`:

```text
data     = 0xADB50C
size     = 0x0455
step_len = ROM16[0xADB519] = 0x000C = 2 entries
b_len    = ROM16[0xADB527] = 0x0000
payload  = 0xADB529 .. 0xADB960
```

Grounded observations from that blob:

- The room blob is variable-size and ends where the next room begins.
- The first 13 bytes are room metadata.
- At offset `0x0D`, the blob switches to trigger tables.
- Step-on entries are 6 bytes each.
- After the step-on table comes `b_len` and then the B-trigger table.
- The remaining bytes are still-observed room payload.

## First 13 bytes: current header map

The first 13 bytes are definitely header / metadata bytes. The Strong Heart trace now gives a useful split: bytes `0..3` are clearly room origin and size, bytes `4..7` are room display/color setup, and bytes `8..12` are still only partially understood.

The trace window is:

```text
908F80  LDA [$8B],Y [$ADB50C] = $041E   Y:0000
908F86  STA $0F86                       A:001E
908F89  LDA [$8B],Y [$ADB50D] = $1404   Y:0001
908F8F  STA $0F88                       A:0004
908F92  LDA [$8B],Y [$ADB50E] = $1014   Y:0002
908F98  STA $08EE                       A:0014
908FB5  LDA [$8B],Y [$ADB50F] = $1710   Y:0003
908FBB  STA $08F0                       A:0010
909019  LDA [$8B],Y [$ADB510] = $17     Y:0004
90901F  STA $0F80                       A:0017
909022  LDA [$8B],Y [$ADB511] = $00     Y:0005
909028  STA $0F81                       A:0000
90902B  LDA [$8B],Y [$ADB512] = $00     Y:0006
909031  STA $0F82                       A:0000
909034  LDA [$8B],Y [$ADB513] = $02     Y:0007
90903A  STA $0F83                       A:0002
90903D  LDA [$8B],Y [$ADB514] = $00     Y:0008
909040  STA $7E241F                     A:0000
909046  LDA [$8B],Y [$ADB515] = $0000   Y:0009
90904A  STA $0F84                       A:0000
90904D  INY                            Y:000B
90904E  INY                            Y:000C
90904F  LDA [$8B],Y [$ADB519] = $000C   Y:000D
```

| Blob offset | ROM address (room 0x33) | Strong Heart value | Current meaning | Primary store / effect | Confidence |
|---|---|---|---|---|---|
| `0x00` | `0xADB50C` | `0x1E` | `trig_off_x` | copied to `0x7E0F86` | high |
| `0x01` | `0xADB50D` | `0x04` | `trig_off_y` | copied to `0x7E0F88` | high |
| `0x02` | `0xADB50E` | `0x14` | map width in 16px tiles | copied to `0x7E08EE`, then expanded to pixel/scroll values | high |
| `0x03` | `0xADB50F` | `0x10` | map height in 16px tiles | copied to `0x7E08F0`, then expanded to pixel/scroll values | high |
| `0x04` | `0xADB510` | `0x17` | display/layer config byte | copied to `0x7E0F80`, written to `TM ($212C)` | medium |
| `0x05` | `0xADB511` | `0x00` | display/subscreen config byte | copied to `0x7E0F81`, written to `TS ($212D)` | medium |
| `0x06` | `0xADB512` | `0x00` | color math config byte | copied to `0x7E0F82`, written to `CGADSUB ($2131)` | medium |
| `0x07` | `0xADB513` | `0x02` | color window / math select byte | copied to `0x7E0F83`, written to `CGWSEL ($2130)` | medium |
| `0x08` | `0xADB514` | `0x00` | unknown setup byte | copied to `0x7E241F` (cleared to `0` here); later read by room-loader code at `909531` / `90987E` | low on meaning, medium on sink |
| `0x09..0x0A` | `0xADB515..0xADB516` | `0x0000` | unknown 16-bit field | copied to `0x7E0F84` | low on meaning, medium on sink |
| `0x0B..0x0C` | `0xADB517..0xADB518` | not isolated in this slice | unknown trailing header bytes | no direct write seen here; the loader advances over them via `INY` at `90904D` / `90904E` before reading `step_len` | low |

What this table is saying:

- We know where every header byte lives.
- We now have raw Strong Heart values for bytes `0x00..0x0A` from the trace.
- Bytes `0x00..0x03` are the room origin plus map width/height.
- Bytes `0x04..0x07` are room display/color setup bytes, but their bit-level meaning is still not fully decoded.
- Byte `0x08` is at least known to seed `7E241F`, even though the meaning of that state word is still unclear.
- Bytes `0x09..0x0A` seed `0x7E0F84`.
- Bytes `0x0B..0x0C` are still only weakly mapped; in this trace slice they are skipped rather than copied to an obvious named destination.

## Cross-map comparison of bytes `0x04..0x08`

Comparing all 127 headers listed in `research/maps/maps2.txt` is enough to say that bytes `0x04..0x08` are not random leftovers. They form a small set of recurring room-mode signatures.

### Byte `0x04`

- `0x17` is the default value in 126 of 127 known maps.
- `0x16` appears only in `Antiqua - Oglin cave`.

This makes byte `0x04` look like a top-level room render preset. Oglin cave is the only known map that switches away from the normal `0x17` mode.

### Byte `0x05`

- `0x00` appears in 67 maps and is the most common outdoor / neutral setting.
- `0x11` appears in 32 maps, including `Prehistoria - Strong Heart's Hut`, `Prehistoria - Village Huts and Blimp's Hut`, `Antiqua - Nobilia, Inn`, several Ebon Keep / Ivor interior rooms, and many Omnitopia interiors.
- `0x01` appears in 26 maps, including `Prehistoria - Bugmuck exterior`, `Prehistoria - Top of Volcano`, `Antiqua - Between 'mids and halls`, `Antiqua - East of Crustacia`, `Antiqua - Outside of 'mids`, and other cave / path / transition-heavy areas.
- `0x12` appears only in `Antiqua - Nobilia, Inside palace (Horace cutscene)`.
- `0x05` appears only in `Antique - Aquagoth Room`.

Byte `0x05` looks like a broad room-class selector: neutral outdoor, indoor/interior, and cave/special-transition modes cluster cleanly here.

### Byte `0x06`

- `0x00` appears in 67 maps and matches the common baseline outdoor group.
- `0x02` appears in 34 maps, including huts, inns, boss rooms, and several Omnitopia interiors.
- `0x42` appears in 23 maps, including `Antiqua - Between 'mids and halls`, `Antiqua - Crustacia exterior`, `Antiqua - Outside of 'mids`, `Gothica - Ebon Keep sewers`, and `Intro - Podunk 1995`.
- `0x92` appears only in `Antiqua - Oglin cave` and `Antiqua - Nobilia, Arena (Vigor Fight)`.
- `0x41` appears only in `Antiqua - Nobilia, Inside palace (Horace cutscene)`.

Byte `0x06` is the strongest candidate for a color-math or darkness family selector. The rare `0x92` value is especially suspicious because Oglin cave's always-on darkness effect should be visible somewhere in this header, and `0x92` is almost unique.

### Byte `0x08`

- `0x00` appears in 118 maps and is the default.
- `0x02` appears in exactly 6 maps: `Prehistoria - South jungle / Start`, `Prehistoria - East jungle`, `Prehistoria - North jungle`, `Antiqua - Act2 Start Cutscene - waterfall`, `Gothica - Dark Forest`, and `Intro - Podunk 1965`.
- `0x01` appears only in `Antiqua - Oglin cave`.
- `0x04` appears only in `Antiqua - Nobilia, Arena (Vigor Fight)`.
- `0x05` appears only in `Prehistoria - Top of Volcano`.

The `0x02` group is notable because it includes maps already known or suspected to have stronger layer interplay or parallax-style presentation, such as `Prehistoria - South jungle / Start` and `Prehistoria - East jungle`. That does not prove byte `0x08` alone means "parallax", but it makes it a good candidate for a small per-room presentation modifier layered on top of bytes `0x04..0x07`.

## Common byte `0x04..0x08` signatures

The five-byte block `header[4..8]` groups maps more clearly than any single byte.

| Header bytes `4..8` | Count | Example maps | Current reading |
|---|---:|---|---|
| `17 00 00 02 00` | 61 | `Prehistoria - Strong Heart's Exterior`, `Prehistoria - Raptors`, `Antiqua - Nobilia, Market`, `Antiqua - Quicksand Desert` | default outdoor / neutral group |
| `17 11 02 02 00` | 24 | `Prehistoria - Strong Heart's Hut`, `Prehistoria - Village Huts and Blimp's Hut`, `Antiqua - Nobilia, Inn`, many Ebon Keep / Ivor / Omnitopia interiors | indoor/interior group |
| `17 01 42 02 00` | 14 | `Antiqua - Between 'mids and halls`, `Antiqua - East of Crustacia`, `Antiqua - Outside of 'mids`, `Gothica - Ebon Keep sewers` | cave / transition-heavy group |
| `17 01 02 02 00` | 9 | `Antiqua - Act2 Start Cutscene`, `Antiqua - Waterfall`, `Antiqua - Halls main room`, `Gothica - Timberdrake room in forest` | alternate special-area group |
| `17 11 42 02 00` | 8 | `Prehistoria - Pipe maze`, `Antiqua - Crustacia exterior`, `Gothica - Ivor Tower Sewers` | interior + cave / sewer hybrid group |
| `17 00 00 02 02` | 6 | `Prehistoria - South jungle / Start`, `Prehistoria - East jungle`, `Prehistoria - North jungle`, `Gothica - Dark Forest` | likely parallax / layered-background modifier group |
| `16 01 92 02 01` | 1 | `Antiqua - Oglin cave` | unique darkness-style group |
| `17 01 92 02 04` | 1 | `Antiqua - Nobilia, Arena (Vigor Fight)` | unique effect-heavy arena group |
| `17 01 02 02 05` | 1 | `Prehistoria - Top of Volcano` | unique volcano variant |
| `17 05 42 02 00` | 1 | `Antique - Aquagoth Room` | unique boss / special-room variant |
| `17 12 41 02 00` | 1 | `Antiqua - Nobilia, Inside palace (Horace cutscene)` | unique cutscene / palace variant |

The standout result is Oglin cave. Its signature is the only one with:

- `byte 4 = 0x16` instead of `0x17`
- `byte 6 = 0x92` in combination with `byte 8 = 0x01`

That is exactly the sort of header-level uniqueness expected for a map with an always-on visual effect.

The second-most-interesting one-off is `Antiqua - Nobilia, Arena (Vigor Fight)`, which shares the unusual `byte 6 = 0x92` family with Oglin cave but keeps `byte 4 = 0x17` and uses `byte 8 = 0x04` instead. That suggests:

- byte `0x06` selects a rare effect family,
- byte `0x04` may switch between major variants of that family,
- and byte `0x08` may be a small per-room modifier inside the chosen family.

## Derived geometry from header bytes `0x02` and `0x03`

The screenshot-backed RAM meanings are:

- `7E08EE..7E08EF` = map width in tiles
- `7E08F0..7E08F1` = map height in tiles
- `7E08F2..7E08F5` = map dimensions in pixels
- `7E08F6..7E08F9` = map scroll capacity after subtracting screen size (`256x224`)

For Strong Heart:

| Source byte | Value | Direct RAM store | Derived RAM stores | Meaning |
|---|---:|---|---|---|
| `header[2]` | `0x14` = `20` | `7E08EE..7E08EF = 0x0014` | `7E08F2..7E08F3 = 0x0140`, `7E08F6..7E08F7 = 0x0040` | width = 20 tiles = 320 px, horizontal scroll = 64 px |
| `header[3]` | `0x10` = `16` | `7E08F0..7E08F1 = 0x0010` | `7E08F4..7E08F5 = 0x0100`, `7E08F8..7E08F9 = 0x0020` | height = 16 tiles = 256 px, vertical scroll = 32 px |

The loader math visible in the trace is:

```text
map_w_tiles = header[2]
map_h_tiles = header[3]

map_w_px = map_w_tiles * 16
map_h_px = map_h_tiles * 16

scroll_w_px = map_w_px - 256
scroll_h_px = map_h_px - 224
```

## Trigger-table layout

The first currently grounded structural layout is:

| Blob region | Start offset | End offset for room 0x33 | Meaning |
|---|---|---|---|
| Header | `0x00` | `0x0C` | 13-byte metadata block |
| `step_len` | `0x0D` | `0x0E` | byte length of step-on table |
| Step-on table | `0x0F` | `0x1A` | `step_len` bytes, here 2 records |
| `b_len` | `0x1B` | `0x1C` | byte length of B-trigger table |
| B-trigger table | `0x1D` | `0x1C` | empty in room `0x33` because `b_len = 0` |
| Payload | `0x1D` | `0x0454` | remaining room data |

For Strong Heart specifically:

```text
0xADB50C .. 0xADB518  header
0xADB519 .. 0xADB51A  step_len = 0x000C
0xADB51B .. 0xADB526  two 6-byte step-on records
0xADB527 .. 0xADB528  b_len = 0x0000
0xADB529 .. 0xADB960  payload
```

## Step-on entries: what 6 bytes means

Current working entry format:

| Byte inside record | Meaning |
|---|---|
| `+0` | `y1` |
| `+1` | `x1` |
| `+2` | `y2` |
| `+3` | `x2` |
| `+4` | low byte of `script_id` |
| `+5` | high byte of `script_id` |

This means each record is:

```text
[y1][x1][y2][x2][script_id_lo][script_id_hi]
```

And that is why `0x000C` bytes means exactly 2 step-on entries for Strong Heart.

## Does that match the SoE tiles viewer C++ code?

The honest answer is: it matches our current model, but I did not freshly verify it against the external SoE tiles viewer C++ source in this workspace.

What we can say safely:

- The in-repo notes already describe the records as 6 bytes.
- The in-repo trigger parser treats the exported `script_all` coordinates as `x1,y1:x2,y2` for display.
- That display order is not the same thing as the raw ROM byte order.
- There is no evidence in the current repo that the step-on record is wider than 6 bytes.

So the likely source of confusion is not a missing 7th byte. It is the distinction between:

- raw ROM order: `y1,x1,y2,x2,sid16`
- printed / parsed display order: `x1,y1:x2,y2`

If the external tiles viewer C++ prints `x` first, that does not contradict the 6-byte ROM layout. It only means the tool reorders fields for readability.

## Blob contents: current map

The full blob contents are best described at the level of known sections, not yet individual codec commands.

| Region | What it contains | What we know | What we do not know |
|---|---|---|---|
| Header | 13 metadata bytes | bytes `0..3` are origin plus map dimensions; bytes `4..7` are display/color setup | bytes `8..12` meanings |
| Step-on table | trigger rectangles plus script IDs | 6-byte records, count from `step_len` | whether any room-specific flags are encoded elsewhere |
| B-trigger table | interact / B-button rectangles plus script IDs | same 6-byte record structure | same caveat as above |
| Payload front | early decode commands / setup | consumed after triggers | exact opcode boundaries |
| Payload middle | room art / collision decode stream | contributes to visible room and collision | exact command meanings |
| Payload tail | late decode data | deleting it removes collision first, then bottom-right room output | exact tail semantics |

## Loader model

Current grounded model:

1. Resolve the room `data` pointer from the map table.
2. Pass that pointer to the room loader.
3. The loader streams bytes from the blob through the pointer held in `$8B`.
4. The breakpoint at `0x908F80` confirms the stream read:

```text
908F80  B7 8B          LDA [$8B],Y
$8B = current room blob pointer
Y   = current byte offset inside that blob
```

5. The loader consumes header bytes first.
6. It then consumes trigger-table lengths and entries.
7. It then continues into the remaining payload stream.

Header-only pseudocode from the Strong Heart trace:

```text
trig_off_x = header[0]
trig_off_y = header[1]

map_w_tiles = header[2]
map_h_tiles = header[3]

map_w_px = map_w_tiles * 16
map_h_px = map_h_tiles * 16

scroll_w_px = map_w_px - 256
scroll_h_px = map_h_px - 224

display_cfg_0 = header[4]
display_cfg_1 = header[5]
color_math_cfg = header[6]
color_window_cfg = header[7]

unknown_flag = header[8]
unknown_word = read16(header + 9)

skip header[0x0B]
skip header[0x0C]

step_len = read16(header + 0x0D)
```

Cross-map pseudocode, based on the current grouping evidence:

```text
trig_off_x = header[0]
trig_off_y = header[1]
map_w_tiles = header[2]
map_h_tiles = header[3]

room_render_preset = header[4]
room_subscreen_preset = header[5]
room_effect_family = header[6]
room_effect_enable = header[7]   // currently always 0x02 in known maps
room_effect_variant = header[8]

unknown_word = read16(header + 9)
unknown_tail = header[0x0B..0x0C]
```

These names are still provisional, but they fit the comparison data better than treating bytes `0x04..0x08` as generic unknown metadata.

## What truncation tests prove

- Cutting bytes from the tail removes hitbox and collision first.
- Cutting more bytes removes the visible room from the bottom-right upward.
- Cutting still more bytes can leave a black square that is still walkable.

Those three observations strongly imply:

- The tail of the payload contributes to late-written decoded room data.
- The final room is not stored as a flat bitmap.
- Room logic and bounds can still exist when visual and collision payload is incomplete.

## How the payload becomes the room picture

What is safe to say now:

- The hut picture is produced by decoding the room payload after the trigger tables.
- The two step-on records describe the doorway transitions, not the hut art itself.
- Later payload bytes correspond to later-placed room output because bottom-right content disappears first when the tail is cut.

## Direct payload comparison across hut maps

To test whether reused hut art appears as obvious repeated raw tile rows or columns, three payloads were compared directly after the header and trigger tables:

| Map | Payload start |
|---|---|
| `0x33` `Prehistoria - Strong Heart's Exterior` | `0xADB529` |
| `0x51` `Prehistoria - Village Huts and Blimp's Hut` | `0xA9AFB4` |
| `0x01` `Prehistoria - Exterior of Blimp's Hut` | `0xA9E540` |

The first 64 payload bytes are already visibly different:

```text
0x33: 06 b9 00 ba 00 20 00 91 00 90 00 92 00 00 a4 00 ...
0x51: 07 3a 00 a5 00 95 00 be 00 61 00 a6 00 23 00 01 ...
0x01: 07 07 00 08 00 09 00 0a 00 0b 00 0c 00 0d 00 07 ...
```

Searching the first `0x400` payload bytes for exact common runs gave:

- `0x33` vs `0x51`: no shared run of length `>= 8`; longest observed shared run at threshold `>= 6` was only `0000000100ff` (6 bytes).
- `0x33` vs `0x01`: no shared run of length `>= 8`; longest observed shared run at threshold `>= 6` was only `300000000100ff` (7 bytes).
- `0x51` vs `0x01`: one shared 8-byte run `000006000c001200`, plus a 7-byte run `0054005a006000`.

This is a negative result, but a useful one:

- The raw payload order does **not** look like literal tile rows or columns for the shared huts.
- If the same hut art is reused, it is probably being reached through a decode stream with commands, local state, or references rather than by embedding long identical tile runs in the same order.
- The darker single-hut map (`0x01`) does not preserve long raw runs with Strong Heart exterior (`0x33`), which fits a palette- or mode-sensitive command stream better than a flat copied bitmap.

The negative result points in a specific direction: the payload has opcode-level structure, not literal tile rows. The next section documents what that structure looks like.

## Payload opcode stream

Cross-map analysis of the raw bytes immediately after the trigger tables gives strong evidence for a command/script encoding.

### Command 0: tile-set load list

Every map payload starts with a single count byte followed by exactly `count × 2` bytes of tile-set IDs. The count is the number of tile families needed for this map:

| Map | Offset | Count | IDs (hex) | Note |
|---|---|---|---|---|
| `0x33` Strong Heart exterior | `+0x00` | `06` | `b9, ba, 20, 91, 90, 92` | 6 tile families: trees, path, hut body, etc. |
| `0x51` Village Huts | `+0x00` | `07` | `3a, a5, 95, be, 61, a6, 23` | 7 tile families |
| `0x01` Blimp's Hut exterior | `+0x00` | `07` | `07, 08, 09, 0a, 0b, 0c, 0d` | 7 consecutive tile families starting at `0x07` |

Map `0x01` is the clearest case: its tile family IDs are a perfect sequential run `7, 8, 9, 10, 11, 12, 13`. That is not random data — it is a structured argument list.

The command block ends at byte `1 + count * 2`:
- `0x33`: ends at `+0x0d`
- `0x51`: ends at `+0x0f`
- `0x01`: ends at `+0x0f`

### Compressed middle section

Immediately after the tile-set list, each map has a stretch of high-entropy bytes with no obvious repeating structure. This section has different lengths across the three maps and looks like a packed bitstream, possibly LZ or RLE compressed tile placement commands:

| Map | Compressed section | Approx length |
|---|---|---|
| `0x33` | `+0x0d` .. `+0xb2` | ~`0xa5` bytes |
| `0x51` | `+0x0f` .. `+0xdd` | ~`0xce` bytes |
| `0x01` | `+0x0f` .. `+0x63` | ~`0x54` bytes |

The length is roughly proportional to map complexity: the 8-hut village is longest, the single-hut vertical map is shortest.

### Sentinel: `00 00 00 01 00 ff`

This exact 6-byte sequence appears in **all three maps** and separates the compressed section from a structured position table:

| Map | Sentinel offset |
|---|---|
| `0x33` | `+0xb2` |
| `0x51` | `+0xdd` |
| `0x01` | `+0x63` |

The byte immediately before the sentinel in all three maps is `0x30`. That suggests the sentinel is not standalone — the preceding byte is part of the same terminating record.

### Command after sentinel: position table

The byte immediately after the sentinel is a count, followed by `count × 2-byte` positions. The positions are 16-bit values that form arithmetic sequences with a step of 6, matching a tile-row height of 6 tiles (96 px):

| Map | Count | Values (decimal) | Pattern |
|---|---|---|---|
| `0x33` | `0` | (empty) | no position table for single sparse-hut map |
| `0x51` | `25` | `0, 6, 12, 18, 24 … 144` | perfect step-6, 25 rows = 8-hut village |
| `0x01` | `12` | `0, 6, 12, 18, 29, 35, 41, 47, 63, 84, 90, 96` | step-6 with gaps where empty sections appear |

The gaps in map `0x01` are not random. The vertical map has empty stretches between the hut and the lower section. The gaps at positions `18→29`, `47→63`, and `63→84` match exactly the empty middle and bottom regions visible in the screenshot.

### Provisional opcode model

```text
[0]       COUNT                    — opcode 0: load N tile families
[1..]     N × 2-byte tile IDs      — tile family IDs for this map

[1+N*2..] compressed bitstream    — opcode stream (packed, high entropy)
                                     probably encodes tile placement,
                                     flips, palette selection

[..]      30 00 00 00 01 00 ff     — end-of-bitstream record + sentinel
[+7]      COUNT                    — opcode: N position entries follow
[+8..]    N × 2-byte positions     — row/column offsets, step=6 tiles

[..]      further commands ...     — not yet decoded
```

This model fits all three maps consistently. The key insight is that the hut art is not stored as literal repeated tile rows across maps — the same visual output is produced by a decode engine that reads tile family IDs and position offsets, and the shared art comes from the tile families themselves (in VRAM/CHR), not from repeated raw bytes in the map blob.

## How to make more progress

Yes: a second trace would help, especially if it is chosen to answer a specific header or payload question rather than just being another random room.

Best next trace target:

- A room that visibly includes hut / structure tiles and still has a simple trigger layout.
- Prefer a room with non-zero `step_len` and, if possible, non-zero `b_len` so both trigger tables are present.
- Prefer a room where the first 13 bytes can be dumped before the loader mutates any RAM mirrors.

What the trace should capture:

1. Raw bytes `0x00..0x0C` from the room blob before load begins.
2. Writes to `0x7E0F86` and `0x7E0F88` so bytes 0 and 1 are nailed down again in live execution.
3. The value of `$8B` and `Y` around `0x908F80` as the loader transitions from header into trigger tables and then into payload.
4. Any destination writes that start only after the trigger tables are skipped.
5. One trace with the full room and one truncation trace against the same room.

The most useful discriminating question for the next trace is not “what is the whole codec?” It is:

- which header bytes are copied directly into RAM,
- which header bytes gate later branches,
- and where the first payload byte starts affecting a destination buffer.

## Still open

- The exact bit meanings of header bytes `0x04..0x07`.
- The role of header byte `0x08`, the 16-bit field at `0x09..0x0A`, and the trailing bytes `0x0B..0x0C`.
- The compressed middle payload section: what opcode format it uses and what it encodes (tile placement, rotation, palette selection, or a mix).
- Whether the position table after the sentinel describes row positions, column positions, or some other coordinate axis.
- Whether graphics and collision are interleaved or split into separate decode phases.
- What further commands appear after the position table.
- The exact destination-buffer layout used before the room is shown.