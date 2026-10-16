# 3. A placed NPC and everything attached to it

> Status: **partly built.** The tab already resolves a spawn's character
> record, palette, hitbox, disposition flags and depth. What it does not
> carry is the *behaviour*: the scripts that run for it.

## What a placement already carries

From [character_table.md](../docs/script-format/character_table.md) and the
spawn opcodes:

| | Source | Shown today |
|---|---|---|
| character record | `ENEMY` enum → record id | yes |
| stats, HP, defences | record fields | partly |
| palette | record `+0x09` | yes, as a slot budget |
| collision box | record `+0x0D` | yes |
| attack boxes | animation command `0x47` | in the model |
| disposition flags | record `+0x05`, overridden per spawn | yes |
| depth | tile collision word | yes |

**`INVINCIBLE` (bit 1)** is the flag the user singled out, and it is already
decoded: set on all 39 townspeople and no monster, overridable per spawn by
opcodes `0x3c`/`0xa2`. A simulated fight must respect it — an invincible
target ends the fight window with "cannot be killed", not a large number.
`INACTIVE` (bit 5) likewise means the entity is placed but not running.

## What is missing: the attached scripts

A spawn is not just a record. Three more things decide what it does, and
none is modelled:

**1. The entity's own script.** Some spawn opcodes carry or imply a script
pointer, and NPCs run one on contact or on B. `src/script/entities.ts`
decodes the placement; resolving what it runs afterwards is the gap. Start
by listing, across all 1606 spawns, which of them reference a script at all
— that number decides whether this is a small job or a large one.

**2. Global scripts the room installs.** The enter script calls prepare
routines and installs handlers that outlive it; `arrivals.ts` already reads
the names of some of them. A placed NPC's behaviour can live entirely in one
of those, so the model needs the set of globals a room has active, not just
what its enter script placed.

**3. The animation script.** Already walked by
[`character-animation.ts`](../src/maps/character-animation.ts) for the idle
pose. The same walker gives the attack timing a fight needs — command `0x47`
is where the strike happens, and the frame timer says when.

## Shape

One record per placement, produced by the same pass that produces a
scenario:

```ts
interface PlacedEntity {
    scenario: string;         // which branch placed it
    character: number;
    x: number; y: number;     // spawn units, as today
    flags: number;            // resolved: spawn's, else the record's
    invincible: boolean;
    inactive: boolean;
    depth: SpriteDepth;
    script: number | null;    // what it runs — the gap
    globals: number[];        // handlers active in this room
}
```

The tab already builds most of this in
[`src/rooms/data/room-scripts.js`](../src/rooms/data/room-scripts.js). Moving
it into `src/simulation/` and adding the last two fields is the work.

## How we would know it is right

- Every field that exists today keeps its current test floor in
  `map-parity.test.js` after the move.
- For the script fields: pick one NPC with obvious behaviour, trace the
  game, and check the script the model attributes to it is the one that
  runs. One confirmed case is worth more than a plausible-looking table.
