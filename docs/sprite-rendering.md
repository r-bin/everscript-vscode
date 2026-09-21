# Rendering sprites from the ROM

> Status: **working for 121 of 141 enemies.** The chain from a character to
> its idle sprite and palette is solved and wired into the Rooms tab. The
> rest stop on animation commands whose length has not been measured yet.

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

## The animation chain — solved

A Mesen trace of spawning a Mosquito (character 113) settled the whole
chain. Three instructions carried it:

```
8FC50A  LDA $8E0032,X [$8ED754] = $4A36   ; anim_stand, character record +0x32
8FC50F  JSL $90817B
90817B    LDA $C40000,X [$C44A36] = $0CFA  ; -> a 24-bit animation script pointer
...
9080F0  LDA [$5D]                          ; the interpreter reads a command
9080F2  ASL
9080EC  JSR ($8000,X)                      ; dispatch through a table at $908000
908418    TXA; LSR; ADC #$A8               ; bank = cmd + 0xA8
908421    LDA [$5D] -> STA $0006,Y         ; ... and the 16-bit address after it
```

So:

| Step | Where |
|---|---|
| Character record | `$8EB678 + id * 74` |
| Idle animation | record `+0x32` (`anim_stand`) |
| Animation script | 24-bit pointer at `$C40000 + anim_stand` |
| Sprite command | first opcode in `0x22..0x28` while walking the script |
| Sprite pointer | `((cmd + 0xA8) << 16) \| <u16 operand>` |
| Palette | record `+0x09`, a 16-bit address within bank `$90` |

**Bit 7 of a command means "end of frame", not a different command.** The
dispatch makes this explicit — both paths index the same table with
`(cmd & 0x7f) * 2`:

```
9080F2  ASL              ; carry = bit 7, A = (cmd & 0x7f) * 2
9080FA  BCC $9080EC      ; bit 7 clear: dispatch and keep going
9080FC  JSR ($8000,X)    ; bit 7 set: dispatch, then...
908100  DEC $0005,X      ; ...tick the frame timer and return
```

So `0xa4` is command `0x24`, a set-sprite, that also ends the frame. Reading
the high opcodes as distinct commands is what made the Wimpy Flower look
undecodable — its idle sprite is reached through exactly that.

**Command lengths were measured, not guessed.** The interpreter reads each
command with `LDA [$5D]` at `$9080F0`, so the distance `$5D` moves between
consecutive reads is that command's length. A Mosquito spawn exercised
fourteen of them. An opcode with no measured length stops the walk, the same
rule the script decoder follows.

Result: **118 of 141 enemies resolve and render**, in their own palettes —
verified by eye against recognisable characters (blue mosquito, orange bee,
green chameleon, grey boulder, Fire Eyes, Horace in armour). The Mosquito's
own answer, `$CC5B1C`, sits beside the frames the running game drew in the
trace, which is the anchor the test pins.

## What is still missing

Twenty enemies stop on a command whose length has not been measured:
**`0x1e` (13 of them), `0x50` (4), `0x57` (2), `0x2d` (1)**. Getting those is
the same measurement again, from a trace in which they run — likely a boss or
a later-act room, since the two traces so far covered act-1 field enemies.

A caution learned here: pairing consecutive `$5D` reads only measures a
length correctly when **one** entity is animating. The Wimpy Flower trace had
several on screen, and the interleaving produced a wrong length for `0xa4`
(5 instead of 3) that happened to change nothing. The safe rule is to derive
lengths from single-entity stretches, and to re-check that a new length
changes no already-resolved sprite.

## What is missing: item icons

The consumable and ingredient icons are **not in this sprite set**. The
earlier menu trace ([ingredient-icons.md](ingredient-icons.md)) found they are
background tiles composited by a blitter at `$8CA6AB`–`$8CA6C6`, not OAM
sprites, and rendering the tail of the sprite list confirms it — the entries
there are effects and particles, not icons.

So the two asks need different work: enemies need the animation format, icons
need the menu tileset.

## Note on the encoder

`animate(entity, mode, id)` in the everscript compiler only emits opcode
`0x78` with a small animation id — a different space from `anim_stand`. So
this was one question the encoder could not answer and the trace had to.
