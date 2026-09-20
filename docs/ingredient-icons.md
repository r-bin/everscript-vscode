# Ingredient Icons — where they come from

> Status: **not solved.** This is a research note, not a format description.
> It records what one trace established so the next attempt starts further
> along. Nothing here is implemented.

The Rooms tab draws an ingredient icon on a loot trigger
([src/script/README.md](../src/script/README.md) says how the reward itself is
read). Those icons currently come from a local assets folder, not the ROM,
which is why four ingredients have no picture and seven reward kinds — money,
charms, equipment — have none at all.

Neither reference implementation knows where the icon graphics live:
SoEScriptDumper is a script disassembler and SoETilesViewer has no item or
menu tile handling. So unlike the rest of `src/script/`, this is original
reverse engineering rather than a port.

## What the trace showed

Source: a Mesen2 trace of opening the Alchemy Formulas / Ingredients menu
(1.26M instructions, ~70 frames). The screen lists formulas with their two
ingredient icons, so the icons are definitely on screen and being drawn.

| Question | Answer from the trace |
|---|---|
| Are icons sprites or background tiles? | **Background tiles.** No OAM path is involved. |
| How is the screen built? | A tilemap assembled in WRAM at `$7F:C800`, one 16-bit entry at a time |
| Which routine writes it? | `$8CAD56` — `STA $7FC800,X`, 446 times in the captured window |
| What does it write? | Tilemap words such as `$23B1`: a tile index plus palette/priority bits, **not** pixel data |
| How does it reach the PPU? | One DMA, `$7F:C800 → VRAM $0800`, length `$700` |
| Where does the palette come from? | ROM `$C4:1EA4`, 8 bytes, DMA'd to CGRAM via `$2121`/`$4310 = $2200` |
| Where do the tile graphics come from? | **Not in this window** — already resident in VRAM when the trace starts |

So an ingredient icon is a **tile index**, and two things are still missing:

1. the ROM address of the menu tileset, and
2. the table mapping an item id to its tile index.

Bank `$C4` is the strongest lead: it supplies this screen's palette, and menu
graphics usually sit beside their palette.

## What would settle it

A trace that spans the **menu opening**, not one taken with the menu already
up — the tileset upload happens before the captured window. Either:

- start the trace on the field and press the menu button while recording, or
- set a Mesen write breakpoint on VRAM in the tile range the tilemap points
  at (`$23B1 & 0x03FF` → tile `$1B1`, so VRAM word `$1B1 * 16`), and trace
  backwards from the DMA that fills it, or
- set a read breakpoint on ROM bank `$C4` and note which ranges are read as
  the menu opens.

With the tileset located, the item→tile table should fall out of the same
routine that builds the tilemap (`$8CAD3D`..`$8CAD5C` computes the index from
a value held in direct-page `$10`).

## Why this is worth doing

It removes the assets-folder dependency, covers every reward rather than the
22 with a bundled image, and gives the map view the game's own artwork. It is
the same shape of problem as the object stamp format in
[map_objects.md](map-format/map_objects.md) §4b, which a single trace turned
from guesswork into a solved format — see that file's note on why a trace beat
more statistics.
