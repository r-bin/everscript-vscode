---
name: map-entities
description: Characters, enemies and NPCs on a Secret of Evermore map — the character record, how a room's enter script places them (8px units, every branch a candidate), sprites, the 4-palette budget, depth against the canopy, the body/hurt/strike boxes, damage, and animation scripts. Read before changing src/maps/character-*.ts, sprites.ts, characters.ts, src/script/entities.ts/arrivals.ts/transition.ts, or anything that draws, places, sizes or fights an entity.
applyTo: "src/maps/character-*.ts,src/maps/characters.ts,src/maps/sprites.ts,src/maps/alchemy-model.js,src/script/entities.ts,src/script/arrivals.ts,src/script/transition.ts,docs/script-format/**,simulation/**"
---

# Map entities: rules

The detail, with every address and limit, is
`docs/script-format/entities-reference.md`; each section there links the page that
holds the evidence. This skill is what a change must not get wrong.

## 1. An entity is a character record plus a placement

- Record: `$8EB678 + 74·id` (`src/maps/character-record.ts`). Read fields through
  that module; the offsets are in the reference §1. `+0x0D` is the **radius**,
  the one number that sizes a character.
- Placement is **script, not room data**: the enter script's spawn opcodes
  (`0x3C`, `0xBA`, `0xA2`, `0xC2`). An enter script branches on story state, and
  the walk follows every branch, so a room's spawns are **candidates**. Label them
  that way; never present them as what a visit shows.
- Spawn coordinates are **8px map units**, and an entity stands at exactly `8·x`
  pixels, on the unit, not in the middle of a cell. (Adding half a unit put every
  enemy 4 px off once.)
- Every spawn faces **8 = south**.

## 2. Three boxes, never one

| | Body | Hurt box | Strike box |
|---|---|---|---|
| from | radius | radius | animation command `0x47` |
| test | `\|dx\| < r1+r2`, `2\|dy\| < r1+r2` | `2(\|d\| − r) < w/h`, no squash | per frame, per facing |

A character with radius 0 has no body. Contact damage goes through the body test
(`$8FB52C`), so "has no `0x47`" does not mean "harmless". Planes must match unless
one side is plane-transparent (bit 6). "The box hit" and "damage was dealt" are
separate questions.

## 3. Drawing

- **Depth comes from the tile under the feet**, every frame: gate nibble 8 hides
  the sprite; otherwise plane comparison, then collision bit 12 (`spriteDepth`,
  `src/maps/collision.ts`). Never lay the canopy over every sprite: 84% of tiles
  put the character in front.
- An entity on a bit-13 or bit-6 tile keeps the plane it walked in with, which the
  map cannot say: report `unknown`, do not guess.
- **Sprite palettes: 4 safe slots per room**, counted in distinct palettes, not
  characters. A fifth shares the slot alchemy effects steal. They never touch the
  map's colours (the other half of CGRAM).
- Sprite chunk flags are an OAM byte; bits 4–5 are a composition order, not the
  hardware priority. Honour the flip bits: symmetric sprites store one half.

## 4. Animation scripts

- Bit 7 of a command means **end of frame**, not a different opcode: dispatch is
  `(cmd & 0x7F)`.
- Command lengths come from a trace or the handler's disassembly, **never a
  guess**. `0x57` is still unknown; a walk that meets it stops and says so.
- `0x2D` loops: a walk that reaches it has seen the whole cycle.

## 5. Damage

Physical: modelled only as test helpers in `tests/memory/damage.test.js` (move it
to a module before building on it, `simulation/damage.md`). Alchemy:
`src/maps/alchemy-model.js`. Return distributions, not averages.

## 6. Doors and entrances

A room does not store its entrances. An entrance is a `CHANGE MAP` in some other
room's trigger script; `src/script/arrivals.ts` indexes them by destination. Like
spawns, these are a superset: a door behind a story flag is listed the same as
one that always works.
