# Rendering sprites from the ROM

> Status: **decoder done and validated; one link still missing.**
> `src/maps/sprites.ts` decodes and composes all 5128 sprites in the ROM, and
> renders correctly the sprites a running game handed to its own renderer.
> The animation table is located. What remains is the base a frame offset is
> relative to.

## What works

A port of SoETilesViewer's `spriteblock.h` and `spriteinfo.h`, the only
implementation of this format anywhere. Three layers:

| Layer | Where |
|---|---|
| 16×16 block pointers | `$EC0000 + i*3`, data based at `$D90000` |
| 8×8 block pointers | `$D80000 + i*3`, data based at `$D10000` |
| Sprite infos (chunk lists) | from `$CA0003`, walked end to end |

Bit 23 of a block pointer marks its data compressed. The compression is a
bit-per-word skip list: one status byte per eight output words, a set bit
meaning "this word is zero and is not stored".

A chunk is five bytes — flags, signed x, signed y, 16-bit block id — and bit
0 of flags picks the pool (set = 16×16).

Verified by `checkSprites` in `tests/memory/map-parity.test.js`: the walk
finds **5128 sprites**, the same count the reference's own walk ends on. That
is a sharp check, because the walk chains on each entry's declared length —
one mis-sized sprite would desynchronise every one after it. 9 of the 5128
compose to nothing; those are padding between banks.

## The animation chain, from a trace

A Mesen trace of spawning a Mosquito (character 113, `anim_stand = 0x4a36`)
settled where the animation data lives. The decisive instruction:

```
8FC50A  LDA $8E0032,X  [$8ED754] = $4A36   ; anim_stand, record +0x32
8FC50E  TAX
8FC50F  JSL $90817B
90817B    LDA $C40000,X [$C44A36] = $0CFA  ; animation record, word 0
90818B    LDA $C40002,X [$C44A38] = $C8    ; ... byte 2
```

So **the animation table is at `$C40000`, indexed by `anim_stand` directly**.
That is the same bank as the menu font and palettes.

A record is a list of **4-byte frames**, `[spriteOffset:u16][u8][u8]`:

```
$C44A36  Mosquito    fa 0c c8 40 | 0f 0d c8 00 | 24 0d c8 00 | 39 0d c8 00
$C4495E  WimpyFlower 68 01 c7 00 | 74 01 c7 40 | a8 01 c7 00 | dc 01 c7 00
```

The Mosquito's offsets are 21 bytes apart, which is exactly a sprite with
`dataoff 1` and four chunks (`1 + 4*5`). The Flower's gaps are 12 and 52,
likewise sprite-sized. So the word is a **byte offset into sprite-info
data**, not an index.

## What is still missing: the base that offset is relative to

Not a global one. Scanning every base in `$C00000..$D00000` for one where
both characters' frame gaps match their sprites' declared sizes finds
**zero** candidates, so the base is per-character or per-room — which fits
what the draw routine does:

```
8096D8  LDA $000C,X   ; sprite pointer, low word, from the entity display list
8096DB  STA $26
8096E0  STA $27       ; ... and its bank
```

The pointer reaching the renderer is a full 24-bit address in banks
`$CA`–`$CE`, taken from an entity's display-list entry rather than computed
from a fixed base. Finding where that base is set is the remaining step.

## Decoder validated against live frames

The trace draws 11 distinct sprite pointers. Rendering all of them through
`src/maps/sprites.ts` produces correct, recognisable sprites — the dog, the
boy, villagers, NPCs. That is a stronger check than the walk count: these are
addresses the running game handed to its own renderer, decoded cold from the
ROM.

It does **not** identify which one is the Mosquito. Two of them
(`$CC5B38`, `$CC5B3F`, drawn 28 and 27 times alternating) are small winged
sprites and look the part, but they are 7 bytes apart — a one-chunk sprite —
while the Mosquito's animation record calls for four-chunk frames. So that
pairing is not established and is not claimed.

## What is missing: item icons

The consumable and ingredient icons are **not in this sprite set**. The
earlier menu trace ([ingredient-icons.md](ingredient-icons.md)) found they are
background tiles composited by a blitter at `$8CA6AB`–`$8CA6C6`, not OAM
sprites, and rendering the tail of the sprite list confirms it — the entries
there are effects and particles, not icons.

So the two asks need different work: enemies need the animation format, icons
need the menu tileset.

## What would settle the last step

Break on writes to an entity's display-list entry at `+0x0C..+0x0E` — that is
where the 24-bit sprite pointer is stored — and see what computes it. The
frame offset from the animation record has to be added to something there.

Worth checking first, as ever: the `everscript` encoder has `animate(entity,
mode, animation)`. If its compiler resolves an animation to a concrete
address, that is cheaper than another trace. Reading `add_enemy` answered the
spawn question outright when a trace looked necessary.
