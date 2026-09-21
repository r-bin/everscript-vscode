# Attack boxes and hurt boxes

> Status: **solved** for the geometry. `src/maps/character-animation.ts`.
> From `hit_flower.txt`, a trace of the Boy swinging his sword into a Wimpy
> Flower. The body it bumps into is [hitboxes.md](hitboxes.md).

## Is the attack box the same as the collision box?

**No — and there are three different boxes, not two.**

| | Collision box | Hurt box | Strike box |
|---|---|---|---|
| What it is | what you bump into | what a weapon can land on | what a swing sweeps |
| Where it comes from | character record `+0x0D` | character record `+0x0D` | animation command `0x47` |
| Size | `2r` wide, `r` tall | `2r` wide, **`2r` tall** | whatever the command says |
| Centre | the entity's position | position + `$0042`/`$0044` | attacker's position + the command's offset |
| Decided by | `$8FB4AB` | `$8FB63D`–`$8FB672` | the same test |
| Per character? | yes, one number | yes, the same number | no — **per animation frame and per facing** |

So `+0x0D` is the one number that says how big a character is, and both tests
read it. But **they use it differently**: moving squashes the vertical by half
(`$8FB4C5 ASL` applies to `|dy|` alone), while a strike doubles both axes
equally, so the same radius describes a flat box for walking and a square one
for being hit.

And the third box is not a character property at all. A strike is data in the
animation, so a character's reach changes frame by frame as it swings, and
each facing has its own numbers because each facing is its own script.

## The strike command: `0x47`

Five bytes: `47 <dx:s8> <dy:s8> <w:u8> <h:u8>`. The handler at `$9087BA`
reads them and hands the result to the hit test:

```
9087BC  LDA [$5D]        ; the two offset bytes at once
9087BE  STA $46
9087C0  XBA              ; high byte = dy, sign-extended at $9087C8
9087CB  ADC $001C,Y      ; + the attacker's Y   -> $48
9087CE  STA $48
9087E0  ADC $001A,Y      ; + the attacker's X   -> $46
9087E5  LDA $0018,Y      ; the attacker's plane -> $44
9087EA  LDA $001E,Y      ; and its height       -> $4A
9087F5  LDA [$5D],Y      ; third byte  -> $3E, the width
9087FD  LDA [$5D],Y      ; fourth byte -> $40, the height
908807  JSL $8FB5E6      ; swing it
```

The Boy's east-facing sword swing is `47 1E 00 17 11`: a **23 × 17** box
centred **30 px east** of him. That is exactly what the trace shows in
`$46`/`$3E`/`$40` at the moment of the hit.

## The hurt box

`$8FB5E6` walks the entity list and tests each candidate:

```
8FB63D  LDA $001C,Y      ; the target's Y
8FB641  ADC #$0010       ; + 16
8FB644  ADC $0044,Y      ; + its own Y adjust
8FB648  SBC $48          ; - the strike centre
8FB64C  DEC / EOR #$FFFF ; |dy|
8FB651  SBC $8E000D,X    ; - the target's radius
8FB655  ASL              ; doubled
8FB656  CMP $40          ; ...against the strike's height
8FB658  BPL $8FB692      ; too far: next candidate
8FB65A  LDA $001A,Y      ; and the same for X, with $0042,Y
8FB66B  SBC $8E000D,X
8FB66F  ASL
8FB670  CMP $3E
```

In other words a hit needs

```
2 * (|dx| - r) < w      and      2 * (|dy| - r) < h
```

which is the strike box grown by the target's radius on every side — the
Minkowski sum again, as in the movement test, but with no 2:1 squash on the
target's half of it.

**`$0042`/`$0044` move the hurt box.** They are set by animation command
`0x50`, so a character can lean its hurt box out of place for a few frames.
Their resting value comes from `0x52`, the reset command that starts nearly
every animation script:

```
908470  STZ $0042,X
908473  LDA #$FFF0
908476  STA $0044,X      ; -16
```

which cancels the `+16` above exactly. So by default the hurt box is centred
on the entity's own position, the same point its sprite is anchored at and
the same point its collision box is centred on.

## What else has to be true

Geometry is the last of the filters, not the first. Before it,
`$8FB61E`–`$8FB638` drop a candidate that

- is on the attacker's own side — `$0010,Y EOR <attacker's PARTY bit> AND #$5006`,
- has no HP left (`$002A,Y`),
- is invulnerable right now (`$0016,Y & $0020`),
- was already hit by this same attacker (`$0036,Y`), or
- is in a dying or otherwise closed state (`$0014,Y & $070D`).

And after it, two more: the heights must be within `$0460` (`$001E,Y` plus
the attacker's), and the planes must match unless either side is
plane-transparent — the same `$0018` / bit `0x40` rule the movement test
uses, from the tile's collision word.

## Contact damage uses the collision box

Not every attack is a swing. `$8FB52C` — the handler the **movement**
collision calls when a move is blocked — can deal damage too:

```
8FB52C  LDA $0016,X      ; the mover's state
8FB52F  BIT #$C000       ; ...must be charging
8FB534  LDA $002E,X
8FB537  CMP #$0400       ; ...and fast enough
        (then the same filters: $0016 & $21, $0010 & $5022, $0014 & $070D,
         pending damage, HP, already-hit-by-this-one)
8FB572  LDA $8E0030,X    ; the attacker's attack proc
8FB579  JSR ($7AB6,X)    ; ...dispatched exactly as a strike would be
```

So a charging enemy hurts you through the **collision box**, with no strike
box involved, which is why plenty of enemies have no `0x47` anywhere. Of the
141 named characters:

| | |
|---|---|
| declare at least one strike box | **45** |
| have no attack animation at all | 54 |
| have attack animations but no `0x47` | 42 |

## What a hit does

Once a candidate passes, `$8FB6A5` dispatches through record `+0x30`, the
field `characterdata.h` calls `attack_proc` — so the character decides what
its hit *does*. The default lands in `$8FB75A`, which rolls to-hit from the
target's evade (`+0x1F`) against the attacker's hit rate (`+0x21`), then
`$8FC067` computes damage from attack (`+0x19`) and defence (`+0x1B`) and
adds it to `$0076,Y`. `$8FC237` subtracts that from HP on the target's own
next turn.

The traced swing connected and did **zero** damage — the flower's defence of
28 swallowed it, and its HP stayed at 17 — which is a useful reminder that
"the box hit" and "it took damage" are different questions.

## The strike boxes in this ROM

| Character | Strikes |
|---|---|
| Boy, sword, facing east | 23 × 17 at (+30, 0) |
| Mosquito | 17 × 16 at (0, −3) |
| Wimpy Flower | 22 × 19 at (−1, +16), then 19 × 27 at (−2, +34) |
| Viper | 15 × 14 at (−14, +7), then 9 × 9 at (−24, +10) |
| Megataur | 59 × 34 at (+1, +1) |

The flower's two boxes are its lunge: a short one as it rears, a long one
reaching a full two tiles south as it bites.

## Seven more command lengths

Reaching the attack animations at all needed seven widths that idle scripts
never exercise — `0x32`, `0x38`, `0x40`, `0x43`, `0x4b`, `0x4c`, `0x5b` —
taken from their handlers the same way as the others; see
[animation_format.md](animation_format.md). Adding them changed **no** idle
walk (all 141 give byte-identical frames), and dropped the attack walks that
stop early from 39 to 5.

`0x4c` is worth naming: six bytes, a word and three signed bytes, and it
calls `$90DCA4` with a position offset — the command that throws a
projectile. The 42 characters with attack animations but no `0x47` are
mostly shooters and chargers.

## How it is checked

`checkStrikeBoxes` in `tests/memory/map-parity.test.js` pins the Boy's swing
at `$C71468` to the exact box the trace shows the game computing, and the
flower, Mosquito and Viper to theirs. The strongest of those is the Boy's:
the address came out of the trace and so did all four numbers.
