# Map Loading

This note records the room-loading behavior that is grounded enough to ship in the Docs tab today.

## Confirmed Strong Heart exterior example

Room `0x33` / `Prehistoria - Strong Heart's Exterior`:

```text
data     = 0xADB50C
size     = 0x0455
step_len = ROM16[0xADB519] = 0x000C = 2 entries
b_len    = ROM16[0xADB527] = 0x0000
payload  = 0xADB529 .. 0xADB960
```

Grounded observations from the room blob:

- The room blob is variable-size and ends where the next room begins.
- The first 13 bytes are room metadata.
- Bytes 0 and 1 act as `trig_off_x` and `trig_off_y` in traced rooms.
- At offset `0x0D`, the blob switches to trigger tables.
- Step-on entries are 6 bytes each.
- After the step-on table comes `b_len` and then the B-trigger table.
- The remaining bytes are still-observed room payload.

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

5. The loader consumes metadata first.
6. It then consumes the trigger-table lengths and entries.
7. It then continues into the remaining room payload.

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

What is still open:

- The exact codec commands.
- Whether graphics and collision are interleaved or stored in separate phases.
- The exact destination-buffer layout used before the room is shown.