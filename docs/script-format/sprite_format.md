# Sprites

How the game stores and draws a sprite, read from its own code. The code is
`src/games/evermore/maps/sprites.ts`; the knowledge entries cited hold the evidence.

## Which sprites exist

Nothing lists them. An entity's sprite is set by its animation script: opcodes `0x22`-`0x2B`
take a word and put the sprite in bank `$A8 + opcode` (`$CA`-`$D3`), `0x2C` and the long forms
carry a 24-bit address (`rom/908418.md`). So the sprites are the ones the animation scripts name:
`spriteAddresses()` walks every animation record (`$C4:0000`) and collects them. A record with no
chunks (`$CA:0001`) is the empty frame.

## A sprite record

`$80:9033` draws the record at `[$26]` (`rom/809033.md`):

| byte | |
|---|---|
| 0 | chunk count (0 draws nothing) |
| 1 | offset of the first chunk from the record |
| 2-5 | when the count is 3 or more: a box, x:s8 y:s8 width height, used only to skip a sprite that is off screen |
| then | `count` chunks of 5 bytes |

A chunk is `flags`, `x:s8`, `y:s8`, `block:u16`. Flags bit 0 picks a 16×16 block (else 8×8);
bits 1-3 are the palette, 4-5 the priority, 6 and 7 the horizontal and vertical flip, as in the
OAM attribute byte. The attribute word in `$06`/`$07` decides which of the chunk's bits survive
(`rom/809433.md`).

## Blocks

A block id indexes 3-byte entries at `$EC:0000` (16×16) and `$D8:0000` (8×8): a 16-bit address and
a bank byte, the bank being `$D9` / `$D1` plus its low 7 bits; bit 7 marks a compressed block
(`rom/809751.md`). A 16×16 block is 128 bytes, an 8×8 one 32: 4bpp tiles. Compressed, the bytes
come in groups of 16: a mask byte whose bits, lowest first, say which of the group's 8 words are
zero, then the other words. The NMI puts a 16×16 block's first 64 bytes on its OBJ tile row and
the next 64 one row down, so its tiles are top-left, top-right, bottom-left, bottom-right.

## Drawing order

Chunks become OAM entries in list order. The PPU shows a lower OAM index in front of a higher one,
priority deciding first, so the first chunk is on top. `composeSprite()` paints back to front.
