# Map transitions: where a door leads

> Status: **solved.** `src/script/transition.ts`.

Most triggers in the game are doors, and they share a shape:

```
WRITE <room state>             optional — set up the destination
CALL "Fade-out / stop music"   optional
CALL "Prepare room change? …"  optional — which edge you leave by
PLAY MUSIC <track>             optional
CHANGE MAP = 0x40 @ [ x | y ]  the transition itself
END
```

Only the last line is required, so the extractor keys on `CHANGE MAP`
(`0x22`) and treats everything before it as context. A trigger that prepares
the room unusually still reports where it goes.

`CHANGE MAP`'s operands are `[x >> 3][y >> 3][mapId:16]`, and the reference
keeps only the **low byte** of that 16-bit id.

## Results

**605 transitions across the ROM, every destination named**, 497 with
preparation calls, 17 starting music. All 605 land on a room the vanilla
catalogue lists, so the Rooms tab renders each destination as a link that
opens that room — no dead links and no fallback path to maintain.

## Two details worth keeping

**A `CHANGE MAP` closes a transition and resets the context.** A branching
trigger with two exits therefore does not report one door's fade as the
other's.

**Writes to the four loot addresses are excluded** from a transition's "room
state". They belong to the pickup system, and leaving them in made every
sniff spot look like it was preparing a room change.
