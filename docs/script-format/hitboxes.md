# Hitboxes

> Status: **solved** for the body — the box entities bump into.
> `src/maps/character-record.ts`. Attack and hurt boxes are a separate
> question and are **not** covered here.

There was no research on this before. It came out of one trace:
`walking_against_flower.txt`, in which the Boy walks into a Wimpy Flower
from the west, the north and the east. That is the whole ground truth, and
it is a good one — the game decides "can I stand here?" on every frame, so a
few seconds of walking into something produces hundreds of labelled
examples.

## Where the size lives

**Character record `+0x0D`** — the field `characterdata.h` calls
`unknown0d`. It is a radius in pixels.

Finding it took one grep. Across the trace, only nine character-record fields
are read at all, and `+0x0D` is read 1819 times — more than any other:

```
1819 $8E000D,X     <- this one
 791 $8E0003,X     ; an AI script index: LDA; TAX; JMP ($CBE0,X)
 440 $8E0032,X     ; anim_stand
 350 $8E0034,X     ; anim_walk
 310 $8E0015,X     ; aggro chance
 213 $8E0013,X     ; aggro range
```

## The rule

`$8FB46D` is called by the move routine with the position the entity wants to
occupy in `$46`/`$48`. It loads the mover's radius, then walks the entity
list and calls `$8FB4AB` per candidate:

```
8FB472  LDA $8E000D,X    ; the mover's radius -> $16
8FB476  BEQ $8FB495      ; a mover with no body never collides

8FB4AE  LDA $8E000D,X    ; the candidate's radius
8FB4B2  BEQ $8FB4FC      ; zero: no body at all, walk through it
8FB4B5  ADC $16          ; sum of the two radii -> $18
8FB4B7  STA $18
8FB4B9  LDA $001C,Y      ; candidate Y
8FB4BD  SBC $48          ; - the Y being tested
8FB4C1  DEC / EOR #$FFFF ; |dy|
8FB4C5  ASL              ; ...doubled
8FB4C6  CMP $18
8FB4C8  BCS $8FB4FC      ; >= the sum: miss
8FB4CA  LDA $001A,Y      ; candidate X
8FB4CE  SBC $46          ; - the X being tested
8FB4D2  DEC / EOR #$FFFF ; |dx|, not doubled
8FB4D6  CMP $18
8FB4D8  BCS $8FB4FC      ; >= the sum: miss
```

So two entities collide when

```
|dx| < r1 + r2      and      2 * |dy| < r1 + r2
```

It is an **axis-aligned box, twice as wide as it is tall** — the usual
top-down squash, the same 2:1 the game's perspective uses everywhere. One
character's own body is therefore `2r` wide and `r` tall, centred on its
position, which is the point its sprite is anchored at.

Two entities meet at the *sum* of their radii, so a drawn box is only half
the story: the Boy's radius is 8, so he stops `r + 8` pixels away
horizontally and `(r + 8) / 2` vertically.

## Two more conditions

Passing the distance test is not enough:

```
8FB4DA  LDA $001E,Y      ; the candidate's second coordinate
8FB4DE  SBC $03,S        ; - the mover's, pushed at $8FB47D
8FB4E6  CMP #$0230       ; must be within $230
8FB4E9  BCS $8FB4FC
8FB4EB  LDA $0018,Y      ; the candidate's plane
8FB4EE  BIT #$0040       ; plane-transparent: always collide
8FB4F1  BNE $8FB4FD
8FB4F3  EOR $44          ; otherwise the planes must match
8FB4F5  BEQ $8FB4FD
```

**The plane test** is the elevation plane this project already decodes:
`$44` is loaded from the mover's `$0018` before the move (`$8FAF48`) and the
value itself comes from the destination tile's collision word, masked with
`AND #$0030` at `$8FA914` — which is `PLANE_MASK` in
[`src/maps/collision.ts`](../../src/maps/collision.ts). Bit `0x40` is
`PLANE_TRANSPARENT`, and here it means "collide regardless of plane". So
entities on different elevations pass through each other.

**`+0x1E`** was 0 for every entity in all 1966 reads of this trace, so its
meaning is not confirmed. The movement code integrates it with `+0x20` as a
velocity (`$8FAFF5`), and `$8FD9FB` compares the same field with a limit of
`$0140`, both of which fit a height above the ground — but nothing here
proves it.

## Already overlapping

If the test hits, the game checks the mover's **current** position with the
same rule (`$8FB4FD`–`$8FB520`). Already inside the box means the move is
allowed anyway — otherwise anything that spawned on top of you would trap
you. Only a move that would newly enter a box is refused, with `CLC` for
"blocked" at `$8FB52A`.

## The radii in this ROM

| Radius | Characters |
|---|---|
| 0 | `PLACEHOLDER`, Statue, Bridge, both Stone Cobras, Rimsala — **no body at all** |
| 5 | Spark, Face, Bomb |
| 6 | Frippo, Widowmaker, spiders, both Mosquitoes, Death Spider |
| 8 | 45 characters — the Boy and every villager |
| 10 | 34 characters — Oglin, Hedgadillo, the slimes, Barker |
| 12 | Rocks, Camellia, the White Queen, Tiny, Gore Grub, Maggot |
| 14 | the three flowers, Skullclaw, FootKnight, Bone Buzzard |
| 16 | the Dog, Bad Dawg, Fan, Speaker, Dark Toaster |
| 18 | the Rimsalas |
| 20 | 13 big ones — Timberdrake, Sterling, Magmar, Megataur, the Raptors |
| 24 | Thraxx's and Coleoptera's four claws |
| 30 / 32 / 40 | Salabog, Mungola, Aegis |

135 of the 141 named characters have a body; six do not.

## How it is checked

`checkHitboxes` in `tests/memory/map-parity.test.js` replays the traced
approach. The parse of the trace produced **925 collision tests** with the
game's own verdict on each, and this rule agrees with **all 925** — no
disagreements, including the 451 that blocked.

The boundaries fall exactly where the rule says:

| Approach | Blocked up to | Free from |
|---|---|---|
| west | \|dx\| = 21 | \|dx\| = 22 |
| east | \|dx\| = 21 | \|dx\| = 22 |
| north | \|dy\| = 10 | \|dy\| = 11 |

22 is `14 + 8`, the flower's radius plus the Boy's, and 11 is half of it.

## Where a spawn actually stands

The chain from the script to those pixels is checked too, and it settled a
smaller question on the way. Every entity coordinate in the trace is
**exactly 8 times a spawn coordinate** from room `0x38`'s enter script:

| Script | Entity |
|---|---|
| Mosquito at x=17 | `$0088` = 136 |
| Mosquito at x=59 | `$01D8` = 472 |
| Wimpy Flower at (73, 121) | (584, 968) — the one the Boy walked into |
| Wimpy Flower at (107, 129) | y = `$0408` = 1032 |

So a spawn's position is the map unit itself, not the middle of that unit's
cell. The Rooms tab used to add half a unit when placing a sprite, which put
every enemy 4 px down and to the right of where the game puts it.

## Not covered

- **Attack and hurt boxes.** Whatever decides that a sword swing connects is
  a different routine; `+0x0D` is only the body. `$8FDA10` does use it —
  halved, plus 5 — as part of an enemy's approach logic, which corroborates
  its meaning but is not a weapon reach.
- **Tile collision.** Walls come from the collision word, which
  [`src/maps/collision.ts`](../../src/maps/collision.ts) already decodes; the
  move routine checks that first (`$909815`, `$8FA946`, `$909561`) and only
  then asks about entities.
