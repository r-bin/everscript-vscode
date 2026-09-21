# Sprite format

> Status: **solved.** `src/maps/sprites.ts`, ported from SoETilesViewer's
> `spriteblock.h` and `spriteinfo.h` — the only implementation of this
> format anywhere.

## Three layers

| Layer | Where |
|---|---|
| 16×16 block pointers | `$EC0000 + i*3`, data based at `$D90000` |
| 8×8 block pointers | `$D80000 + i*3`, data based at `$D10000` |
| Sprite infos (chunk lists) | from `$CA0003`, walked end to end |

**Blocks** are the pixels, 4bpp planar. A 16×16 block is four 8×8 SNES tiles
in the order top-left, top-right, bottom-left, bottom-right, 32 bytes each.
**Bit 23 of a block pointer marks its data compressed.**

**Compression** is a bit-per-word skip list: one status byte per eight
output words, a set bit meaning "this word is zero and is not stored".

**Chunks** place a block at a signed offset — five bytes: flags, x, y, and a
16-bit block id.

## The flags byte is an OAM attribute byte

SNES OAM byte 3 is `vhoopppn`: flip Y, flip X, two priority bits, three
palette bits, one name bit. Every field lines up with what the data does,
which is what identified it:

| Bits | OAM meaning | Here | Share of 37413 chunks |
|---|---|---|---|
| 0 | name-table bit | 16×16 block rather than 8×8 | 39% set |
| 1–3 | palette | 0 on 99.3%, 1 on 0.7% (not characters) | — |
| 4–5 | priority | **not** the hardware priority — see below | only 0 and 1 occur; 88% are 1 |
| 6 | **flip X** | mirror left-to-right | 31% |
| 7 | flip Y | mirror top-to-bottom | 4% |

Bits 4–5 are the one field that is *not* passed through. The OAM assembly at
`$809433` does `LDA $DF / AND $07 / ADC $06`, and `$07` is the high byte of
the attribute word the entity built (`$CC` or `$FC`) — so the chunk's
priority bits are masked out and the hardware priority comes from the
entity's own word, which `$8FC773` chose from the tile it stands on. Within
one sprite they still decide which chunk covers which, so they are kept as
a composition order. See [sprite_priority.md](sprite_priority.md).

The mirror bits matter more than their share suggests. Symmetrical sprites
store one half and mirror it: Strongheart's chunks 0 and 1 are the *same
block* at x=−7 and x=0, differing only in bit 6. Ignoring it draws one half
twice, which is exactly what a buggy-looking tile turned out to be.

## Draw order is not list order

These chunks become OAM entries, and the PPU draws a **lower OAM index in
front of a higher one**, with bits 4–5 deciding first. So the
correct painting order is priority ascending, and within a priority, index
descending — the first chunk ends up on top. SoETilesViewer's `frameview.cpp`
does exactly this (`for priority 0..3 { for i = n-1 down to 0 }`), and its
output is what the format was checked against.

Painting the list front to back instead leaves the *last* chunk on top. 1161
of the 5128 sprites reuse a cell across chunks, so this is visible: it is
what buried the Megataur's face behind its body.

**Sprite infos** are `[count][dataOffset]` followed by the chunks. Nothing
indexes them, so they are walked sequentially; a zero-length entry or one
near the end of a bank means the list continues in the next bank.

## How it is checked

Two ways, in increasing strength:

1. The walk finds **5128 sprites**, the same count the reference's walk ends
   on. Sharp, because it chains on each entry's declared length — one
   mis-sized sprite desynchronises everything after it. 9 of the 5128 are
   blank padding between banks.

2. **Against live frames.** A Mesen trace hands 11 distinct 24-bit sprite
   pointers to the game's own renderer; decoding all of them cold from the
   ROM produces correct, recognisable sprites. Those are addresses a running
   game chose.

Chunk offsets are signed and relative to an origin that is not a corner, so
`composeSprite` measures the extent first rather than assuming a canvas
size — several sprites reach well above and left of their origin.
