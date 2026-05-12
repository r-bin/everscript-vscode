# Map Loading

This note records the room-loading behavior that is grounded enough to ship today, and separates that from what is still unknown.

## Evidence level

- Confirmed from traced data: room pointer, room size, trigger-table offsets, `LDA [$8B],Y` stream read, truncation behavior.
- Confirmed from in-repo notes and parser behavior: trigger tables begin after a 13-byte header, and each trigger record is 6 bytes wide.
- Partially mapped: bytes 0 and 1 of the header behave like trigger-origin offsets.
- Still unknown: header bytes 2 through 12, the payload codec, the final destination-buffer layout, and the exact split between art and collision decode phases.

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

The first 13 bytes are definitely header / metadata bytes, but only the first two have names that are grounded well enough to publish.

For Strong Heart exterior, the addresses are known, but the actual byte values were not captured in the current evidence bundle. That means the table below can safely name offsets and RAM mappings, but not invent missing values.

| Blob offset | ROM address (room 0x33) | Current name | RAM / use | Strong Heart value | Confidence |
|---|---|---|---|---|---|
| `0x00` | `0xADB50C` | `trig_off_x` | copied to `0x7E0F86` | not yet captured | high on meaning, low on exact value |
| `0x01` | `0xADB50D` | `trig_off_y` | copied to `0x7E0F88` | not yet captured | high on meaning, low on exact value |
| `0x02` | `0xADB50E` | unknown | header byte consumed before triggers | not yet captured | low |
| `0x03` | `0xADB50F` | unknown | header byte consumed before triggers | not yet captured | low |
| `0x04` | `0xADB510` | unknown | header byte consumed before triggers | not yet captured | low |
| `0x05` | `0xADB511` | unknown | header byte consumed before triggers | not yet captured | low |
| `0x06` | `0xADB512` | unknown | header byte consumed before triggers | not yet captured | low |
| `0x07` | `0xADB513` | unknown | header byte consumed before triggers | not yet captured | low |
| `0x08` | `0xADB514` | unknown | header byte consumed before triggers | not yet captured | low |
| `0x09` | `0xADB515` | unknown | header byte consumed before triggers | not yet captured | low |
| `0x0A` | `0xADB516` | unknown | header byte consumed before triggers | not yet captured | low |
| `0x0B` | `0xADB517` | unknown | header byte consumed before triggers | not yet captured | low |
| `0x0C` | `0xADB518` | unknown | last metadata byte before `step_len` | not yet captured | low |

What this table is saying:

- We know where every header byte lives.
- We know bytes `0x00` and `0x01` are meaningful trigger-origin fields.
- We do not yet know what bytes `0x02` through `0x0C` mean.
- We also do not yet have the raw Strong Heart header dump in this repo, so the value column must stay blanked as `not yet captured`.

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
| Header | 13 metadata bytes | first 2 bytes are trigger-origin related | bytes 2-12 meanings |
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

- The exact meanings of header bytes `0x02..0x0C`.
- The exact codec commands used in the payload.
- Whether graphics and collision are interleaved or split into separate decode phases.
- The exact destination-buffer layout used before the room is shown.