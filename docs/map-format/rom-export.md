# Export ROM

The map editor's **Export ROM…** action (⋯ menu, custom maps only) writes a
playable ROM. It starts from the vanilla ROM, moves the custom map into Brian's
Test Ground's slot (`0x15`), and makes the game start there.

Code: `src/maps/encode.ts` (a port of `everscript/tools/encode_room.py`),
`src/maps/custom-room.ts`, `src/rooms/rendering/rom-export.js`,
`src/rooms/webview/map-editor-rom-export.js`. Tests:
`tests/memory/rom-export.test.js`.

## What gets written

| # | Where | What | Source of the convention |
|---|---|---|---|
| 1 | `0x300000..0x3FFFFF` | ROM grows from 3 MB to 4 MB, filled with zeroes. The header already says 4 MB (`$FFD7 = 0x0C`). | everscript `linker.py`: extension = `0x300000..0x3fffff` |
| 2 | `0x3D8000` = `$BD:8000` | The room blob, up to 32 KB | `encode_room.write_room_into_rom(at_offset=…)` |
| 3 | `$9FFDE7 + 0x15*4` | Room 0x15's map pointer, set to `$BD8000` | the map pointer table |
| 4 | `0x3C8000` = `$BC:8000` | `A3 36 00`: `fade_in(); end` | core `fade_in()` = `call_id(0x36)` |
| 5 | `$92801B + 0x15*5` | Room 0x15's enter-script pointer (packed), set to `$BC8000` | `linker.py` `MapData.trigger_enter` |
| 6 | `$92E0CA` | `22 x y 15 00 00`: `load_map(0x15, x, y); end` | `ADDRESS.INTRO_FIRST_CODE_EXECUTED`, the practice ROM's `intro_skip()` |
| 7 | `$FFDC..$FFDF` | Header checksum recomputed | |

`x` and `y` are in 8px units, the unit opcode `0x22` takes. The export uses
the centre of the Boy's start marker: `2·tile + 1`.

**Why Brian's enter script needs replacing.** Its vanilla pointer is 0, which
resolves to `$928000`. That address is the head of the script pointer table,
not a script. Without a fade-in, the room stays black.

**Why upper bank halves.** All 127 vanilla blobs sit at `$8000..$FFFF` of a
`$9C..$AD` bank. `0x800000 | offset` is a ROM address only there, so
`writeRoomAt` refuses the lower half. Like upstream, it also refuses a blob
that crosses a bank boundary.

**Why `$BC`/`$BD`.** These banks are clear of what the everscript repo puts in
the extension: `$B0` (strings, extension scripts), `$BE` (`debug_menu`,
`scale_enemies`) and `$BF` (`hotkeys`, `_hook_input`).

## How the map becomes a blob

`buildCustomRoomBlob` takes every cell's three words (Layer 1, Layer 2,
collision) from the editor:

- **Dictionary:** one entry per distinct word triple, numbered by first
  appearance, row by row. That is the one order the Markov encoder always
  accepts (see `map_encoding.md`).
- **Block 1:** the donor's tile list, then the donor's animated tiles as
  ordinary tiles, then the draft's adopted graphics. This is exactly the slot
  numbering the editor drew with (`tiles.count` includes animated tiles).
  Section 2 is left empty, so the donor's animation is dropped. A custom map
  never drew it.
- **Families:** the draft's own, or the donor's when the draft has none.
- **Header:** the donor's display registers, the map's size, and trigger
  origin 0.
- **Empty:** triggers, objects, and cuttable grass (Section 4 = `[0x00]`).

## Verification

Before a ROM is handed back, the export decodes it again. The result must
show room 0x15 at the draft's size with every cell's words matching. The
enter script must decode as `CALL 0x36; END`, and the intro as
`CHANGE MAP 0x15` at the marker. The tests also confirm, for all 127 rooms,
that the ported encoder reproduces upstream's `--verify` (byte-exact
container) and `--verify-rebuild` (re-encoded blocks decode back).

Also checked by hand for v0.65.0:

- Upstream `tools/dump_room.py --rom <export>` decodes room 0x15 correctly.
- The bundled snes9x core boots the export straight into the custom map,
  with the Boy on his marker.

## Not exported (yet)

- Triggers, objects, and the placed constructs' attachments.
- Entrances other than the start marker.
- Drafts over a vanilla room. That room's slot is its own, and writing one
  into Brian's slot raises different questions.
