# Enemy spawns

> Status: **solved.** `src/script/entities.ts`. The format came from the
> encoder, not from tracing.

## Four opcodes place an NPC

`add_enemy` and `add_enemy_spawner` in the everscript compiler *emit* these,
so they define them:

```
code(0x3c, enemy * 2, flags, x, y)                      literal x,y with flags
code(0xba, enemy,     x, y)                             literal x,y, no flags
code(0xa2, enemy * 2, flags, calculate(x*8), calculate(y*8))
code(0xc2, enemy,     x, y)                             spawner; count in $2433
```

Three things follow directly:

**The index is an `ENEMY` enum value.** `enemy * 2` for the opcodes that
store an address, the bare value for the rest — so unshifting lands back on
the enum. Its comments carry the character record and the game's own name:

```
FLOWER_PURPLE = 0x0b, // #109, "Wimpy Flower"
MOSQUITO      = 0x0f, // #113, "Mosquito"
```

**Coordinates are the same space as `add_enemy(x, y)`** for `0x3c` and
`0xba`, because the encoder passes them straight through. That is 8-pixel
units — one SVG unit in the Rooms tab — so a ROM spawn and a source-defined
enemy plot identically. `0xa2` multiplies by 8 and takes expressions, so it
carries no literal position.

**`$2433` is `ENEMY_SPAWNER_QUANTITY`**, which is why it is written just
before a spawner. It is a count, not a character id.

## Results

**1606 spawns across the ROM, 100% named**, 1603 with a character record.
South jungle resolves to 7 Mosquitoes and 14 Wimpy Flowers.

## They are candidates, not contents

A room's enter script branches on save state — the same room is reused with
different enemies as the story moves on — and the walk follows every branch.
Deciding which one runs needs [a simulation](../room-simulation.md) that
does not exist yet, so the UI labels them accordingly.
