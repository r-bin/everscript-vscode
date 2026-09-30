# Ingredient Icons — where they come from

> **Superseded.** The icons are found: they are ordinary sprites reached
> through a 162-entry table at `$CE8000`, one per ring-menu icon id, with a
> palette per entry. See [item-icons.md](item-icons.md). What is below is the
> earlier VRAM-side search, kept for its notes on the Formulas screen's
> blitter and the Mesen `[REG]` pitfall, which still hold.

The Rooms tab draws an ingredient icon on a loot trigger
([src/script/README.md](../src/script/README.md) explains how the reward
itself is read). Those icons come from a local assets folder, not the ROM,
which is why four ingredients have no picture and seven reward kinds — money,
charms, equipment — have none at all.

Neither reference implementation helps: SoEScriptDumper is a script
disassembler and SoETilesViewer has no item or menu tile handling. So unlike
the rest of `src/script/`, this is original reverse engineering.

## Traces used

| File | Covers |
|---|---|
| `ingredient_icons.txt` (152 MB, 1.26M instructions) | Alchemy Formulas screen, already open |
| `icons_2.txt` (300 MB, 2.49M instructions) | Opening the ring menu, so the screen's setup is captured |

Both were reconstructed with a streaming pass that rebuilds every DMA from the
CPU register state. **Mesen prints `[REG] = $x` as the address's prior
contents, not the value being written** — reading that as the write gives
nonsense source addresses. The value has to come from the register the store
names, at the width the M/X flags imply (`P:nvmxdizc`, lowercase = 16-bit).

## Settled

The menu's setup happens in one burst (icons_2.txt around line 1,549,900):

| Transfer | Meaning |
|---|---|
| `$C4:1F74` → VRAM `$2000`, `$1000` bytes | Background tileset — the mottled stone texture. Renders as dense noise in greyscale, which is correct, not a decode failure. |
| `$C4:2FF4` → VRAM `$0000`, `$700` bytes | Window frame / border tiles |
| `$C4:1EA4` and `$C4:1EEC` → CGRAM, 8 bytes each | This screen's palettes |
| `$C4:0000`, read as `LDA $C40000,X` | **The font**, stored 2bpp. Read 1802 times from `$8CA5AC` and `$8CA60C`, over `$00F2`..`$0C5B`. |

Other facts worth keeping:

- `OBSEL` is set to `$03` at `$8CB769`, so the sprite tile base is VRAM
  `$6000`. **Nothing uploads to `$6000` in either trace**, so the sprite
  graphics are already resident — loaded before the menu opens.
- Text and icons are **composited** into WRAM staging buffers by a bitplane
  blitter at `$8CA6AB`–`$8CA6C6` (read-mask-write on `$0000,Y`..`$0003,Y`),
  then DMA'd to VRAM. There is no direct ROM→VRAM copy for them, which is why
  searching for one found nothing.
- All ROMs on this machine are byte-identical at `$C4:1F74`, so none of this
  is an artefact of a patched ROM.

## Still open

The icon pixel source. It is **not** the font table at `$C4:0000`, and not
either of the two ROM→VRAM blocks. Since the sprite tile base is loaded before
the menu opens, the icons are most likely part of a resident sprite set.

## What would settle it

The remaining question is narrow enough to answer with a breakpoint rather
than another big trace:

1. Break on OAM writes while the Formulas screen is up and read the tile
   numbers the icon sprites use. With `OBSEL = $03` the tile base is VRAM
   `$6000`, so tile *n* lives at VRAM word `$6000 + n * 16`.
2. Break on VRAM writes to that address and trace back to the DMA, then to
   whatever filled its WRAM staging buffer.
3. The item→tile mapping should then fall out of the routine that builds the
   sprite list, the same way the text blitter indexes the font.

A trace from a save-load through opening the menu would also catch step 2,
since the resident sprite set has to be uploaded somewhere.

## Why it is worth doing

It removes the assets-folder dependency, covers every reward rather than the
22 with a bundled image, and uses the game's own artwork. Same shape of
problem as the object stamp format in
[map_objects.md](map-format/map_objects.md) §4b, which one trace turned from
guesswork into a solved format — see that file's note on why a trace beat more
statistics.
