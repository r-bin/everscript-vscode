# Simulating a room's enter script

> Status: **not built.** The decoder now reports which NPCs an enter script
> *can* place; deciding which it *does* place needs the simulation described
> here. The two things that *were* unknown — what the NPC index means and
> what its coordinates mean — are now settled; see below.

## Why a simulation is the right tool here

Loot did not need one — a pickup writes its reward down as a literal, so
reading the bytes was enough ([src/script/README.md](../src/script/README.md)).
Room population is different. Rooms are reused: the same map id is entered at
several points in the story with different enemies, and the enter script picks
between them with `IF` on saved flags. There is no literal answer in the
bytes; the answer is *which branch runs*.

So the decoder currently reports the **superset**: every NPC placement
reachable by any branch — 1606 across the ROM, all of them named. That is
honest and useful, but it is not the room.

A lesson worth keeping: two of the three unknowns here were answered by
reading the *encoder*, not by tracing the game. This repo sits between an
encoder and a decoder, and when the question is "what does this field mean",
the side that writes the bytes usually says so outright.

## What a simulation needs

**1. An expression evaluator.** `src/script/expression.ts` renders operands as
text; it does not compute them. Simulating a branch means evaluating the same
grammar to a value. The two must not drift, so either the evaluator lives
beside the renderer and is tested against it, or the renderer is rebuilt on
top of the evaluator.

**2. A defensible starting WRAM.** This is the hard part, and the reason
nothing has been built yet. "Base boy WRAM" is not a single state — a room
entered in act 1 and the same room revisited in act 3 differ. Options, in
increasing order of how much they can be trusted:

- all flags clear, i.e. a fresh game;
- a snapshot captured from an emulator at a known point;
- a set of named presets ("after Thraxx", "after Vigor"), each captured.

A simulation that silently picks one is the failure mode this project keeps
avoiding. Whatever it uses has to be visible in the UI and switchable.

**3. Honest handling of undecidable branches.** Some conditions will depend on
state the model does not carry. The result should count them and say so,
rather than picking a path.

## Settled — the encoder answered both

Both unknowns in the first version of this note were answered by reading the
sibling `everscript` compiler rather than by tracing. `add_enemy` is the
function that *emits* these opcodes, so it defines them:

```
fun add_enemy(enemy:ENEMY, x, y, flags:FLAG_ENEMY) {
    code(0x3c, enemy * 0x02, flags, x, y)      // literal x,y, with flags
    code(0xba, enemy,        x, y)             // literal x,y, no flags
    code(0xa2, enemy * 0x02, flags, calculate(x * 8), calculate(y * 8))
}
fun add_enemy_spawner(enemy:ENEMY, x, y, quantity) {
    MEMORY.ENEMY_SPAWNER_QUANTITY = quantity
    code(0xc2, enemy, x, y)
}
```

**The index is an `ENEMY` enum value.** `enemy * 2` for the opcodes that
store an address, the bare value for the rest — so unshifting lands back on
the enum. Its entries carry the character record and the in-ROM name in their
comments:

```
FLOWER_PURPLE = 0x0b, // #109, "Wimpy Flower", palette(...)
MOSQUITO      = 0x0f, // #113, "Mosquito", slash(1-3=fly right?)
```

All **1606 spawns in the ROM resolve to a name**, 1603 of them to a character
record. The earlier guess that the jungle's index 15 was the flower was
wrong: 15 is the Mosquito, and the Wimpy Flower is the `0xba` spawn at index
11.

**Coordinates are the same space as `add_enemy(x, y)`** — the encoder passes
those arguments straight into `0x3c` and `0xba`. The Rooms tab already plots
source-defined enemies at those values, one SVG unit each, so ROM spawns plot
identically. `0xa2` multiplies by 8 and takes expressions, so it still
carries no literal position.

**`$2433` is `ENEMY_SPAWNER_QUANTITY`**, which is why it is written just
before a spawn. It is the spawner's count, not a character id.

## What is still missing

Only the simulation itself: the expression evaluator and the starting WRAM
described above. Until then the Rooms tab shows the superset of reachable
spawns and labels it as such.

## Then: drawing them

`SoETilesViewer` already decodes sprites — `spriteinfo.h` (`SpriteChunk`:
flags, x, y, block), `spriteblock.h`, and `characterdata.h`'s animation
pointers (`anim_stand` and friends). So rendering an idle animation is a
**port**, not new reverse engineering. The character is now identified for
every spawn, so this is unblocked: `enemyName(index).character` gives the
record, and record 109's `anim_stand` is `0x495e`. It is a separate piece of
work from the simulation and should not be mixed into it.
