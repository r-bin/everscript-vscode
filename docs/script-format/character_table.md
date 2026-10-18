# Character records

The record the game builds an entity from, read from its own code. The field map and its evidence
are in the knowledge entry `rom/8eb678.md`; the code is `src/games/evermore/maps/character-record.ts`
and `src/games/evermore/sprites/character-model.ts`.

## Where they are

A script spawns an `ENEMY` id; the ENEMY table `$8E:B55A` turns it into a record address in bank
`$8E` (`rom/8eb55a.md`). In vanilla the ROM records follow the table, 74 bytes apart from
`$8E:B678`: 142 of them (the table reaches record 141). The Boy's and the Dog's records are in
WRAM (`$0A26`, `$0A70`). The new entity keeps the record address at `+$60` (`$8F:B094`), and the
game reads the record through it from then on.

## Fields

See `rom/8eb678.md` for every field with the code that reads it. In short: the name pointer
(`+$00`), behaviour (`+$03`), flags (`+$05`, `+$07`), two palettes (`+$09`, `+$0B`, addresses in bank
`$90`), the radius (`+$0D`), HP (`+$0F`), combat stats (`+$13`-`+$21`), experience, money and drop
chance (`+$23`-`+$29`), the charge limit and speed (`+$2C`, `+$2E`), what touching it does (`+$30`)
and the animation ids (`+$32`-`+$48`).

## Animations

An animation id is an offset into the 4-byte records at `$C4:0000`: `[script:u16][bank:u8][flags:u8]`
(`rom/908124.md`). Flags bit 7: the next eight records serve one facing each; bit 6: four (north,
east, south, west). The game picks among the record's ids by what the entity does: `+$32` still,
`+$34` moving, `+$36` running, `+$38`-`+$3E` attacking by charge (below `$400`, `$800`, `$C00`,
above), `+$40` knockback, `+$42` / `+$44` death without / with a drop, `+$46` casting, `+$48` the
dodge.

## Weapons and Dog forms

The Boy's weapon (`rom/8f81c9.md`) and the Dog's form (`rom/8f9471.md`) rewrite their WRAM records
from entries of their own: animations, palette and range.

## Collision

Two entities overlap when, with s their radii added, |dx| < s and 2·|dy| < s (`rom/8fb4ab.md`).
Radius 0 takes no part.
