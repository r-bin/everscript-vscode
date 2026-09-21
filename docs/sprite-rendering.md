# Rendering sprites from the ROM

> Status: **decoder done, lookup missing.** `src/maps/sprites.ts` decodes and
> composes all 5128 sprites in the ROM. What is still missing is how to get
> from a character — or an item — to the right one.

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

## What is missing: character → sprite

The character table (`$8EB678`, stride 74, confirmed) holds animation
pointers, not sprite indices: `anim_stand`, `anim_walk`, `anim_atk0..3`,
`anim_damage`, `anim_death`, `anim_spoils`, `anim_block`. For the Wimpy
Flower (#109) `anim_stand` is `0x495e`.

These point into an **animation format nobody has decoded**. SoETilesViewer
shows the values but never resolves them; it has no character→sprite link
either.

Readings ruled out for `0x495e`:

| Reading | Result |
|---|---|
| Index into the sprite list | Out of range (5128 entries) |
| `$CA0003 + 0x495e` | count 242, dataoff 244 — not a sprite header |
| `$CA0000 + 0x495e` | Parses, but composes to unrelated fragments |
| `$90495E` | count 248, dataoff 119 — not a sprite header |
| `$7E495E` | WRAM; empty |

A useful clue from the everscript encoder's `ANIMATION` enum: its values are
the **low 16 bits of a 24-bit pointer**, with the bank written in the
comments — `MENU_CLOSE = 0x61a7` next to `[A7 61 7E]`, i.e. `$7E61A7`; and
`MENU_OPEN_BOY = 0xa8ed` next to `[ED A8 90]`, i.e. `$90A8ED`. So `anim_stand`
is very likely the low word of a pointer whose bank comes from elsewhere —
plausibly a per-character or per-bank field not yet identified.

## What is missing: item icons

The consumable and ingredient icons are **not in this sprite set**. The
earlier menu trace ([ingredient-icons.md](ingredient-icons.md)) found they are
background tiles composited by a blitter at `$8CA6AB`–`$8CA6C6`, not OAM
sprites, and rendering the tail of the sprite list confirms it — the entries
there are effects and particles, not icons.

So the two asks need different work: enemies need the animation format, icons
need the menu tileset.

## What would settle the animation format

A Mesen trace of an enemy's idle animation, breaking on reads near
`$8EB678 + 109*74 + 0x32` (where `anim_stand` lives) and following what the
game does with the value. That gives the bank and the record shape in one
step, the way `add_enemy` settled the spawn format.

Worth trying first, though: the `everscript` encoder has `animate(entity,
mode, animation)` and an `ANIMATION_ENEMY` enum. If its compiler resolves an
animation id to anything concrete, that is cheaper than a trace — reading the
encoder answered the spawn question outright when tracing looked necessary.
