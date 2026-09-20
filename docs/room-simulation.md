# Simulating a room's enter script

> Status: **not built.** The decoder now reports which NPCs an enter script
> *can* place; deciding which it *does* place needs the simulation described
> here. This note says what that requires and what is still unknown, so the
> work starts from evidence rather than from a guess.

## Why a simulation is the right tool here

Loot did not need one — a pickup writes its reward down as a literal, so
reading the bytes was enough ([src/script/README.md](../src/script/README.md)).
Room population is different. Rooms are reused: the same map id is entered at
several points in the story with different enemies, and the enter script picks
between them with `IF` on saved flags. There is no literal answer in the
bytes; the answer is *which branch runs*.

So the decoder currently reports the **superset**: every NPC placement
reachable by any branch. 734 of them across 103 rooms, 707 with a literal
position. That is honest and useful, but it is not the room.

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

## What is still unknown

### The NPC index does not name a character

The jungle (map `0x38`) spawns `npc 15` seven times, and the enemy that
appears there is the **Wimpy Flower**, which is character **109**. So the
index in the script is not a character-table index, and the indirection has
not been found.

Ruled out so far:

| Candidate | Result |
|---|---|
| Character table index | No — 15 ≠ 109 |
| The map blob's "extras" table | No — those are CHR descriptors ([map_encoding.md](map-format/map_encoding.md)) |
| SoETilesViewer's model | It reads characters and sprites but has no map→NPC relationship |

`$2433` is written immediately before each `0x3c`, with a different small
value per spawn (5, 6, 7, 9, 10 in the jungle). That is the strongest lead:
it is set per spawn, so it carries something the spawn needs.

**The character table itself is confirmed**: base `$8EB678`, stride 74 bytes,
and record 109 matches the editor exactly on palette (`0xb1ab`), HP (18),
aggro range (70) and `anim_stand` (`0x495e`). Porting it from
`SoETilesViewer/characterdata.h` is straightforward once the index is known.

### The coordinate space is not established

Spawn positions do not fit the trigger grid. Map `0x38` is 83×91 metatiles
with `offX 17, offY 11`, so triggers map as `(x - offX) * 2` into a 166×182
SVG. Spawn coordinates reach x 117, y 125, which overflows that mapping but
fits at least two others equally well (`svg = x`, or an unoffset half-scale).
Nothing distinguishes them yet, so positions are reported raw and **not drawn
on the map** — a marker in the wrong place is worse than no marker.

## What would settle both

The same approach that solved the object stamps and narrowed the icons: a
Mesen trace. Break on the routine `0x3c` calls and watch

1. what it reads to turn index 15 into a character — that gives the
   indirection and probably the meaning of `$2433`;
2. what it writes as the entity's position — comparing that against the
   screen position gives the coordinate space.

One trace of entering the South jungle should answer both, since the flowers
spawn on entry.

## Then: drawing them

`SoETilesViewer` already decodes sprites — `spriteinfo.h` (`SpriteChunk`:
flags, x, y, block), `spriteblock.h`, and `characterdata.h`'s animation
pointers (`anim_stand` and friends). So rendering an idle animation is a
**port**, not new reverse engineering, once the character is identified. That
is a separate piece of work from the simulation and should not be mixed into
it.
