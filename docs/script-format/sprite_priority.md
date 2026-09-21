# Sprite priority: which characters the scenery covers

> Status: **solved**, except for one input the map does not hold.
> `spriteDepth()` and `spawnDepth()` in `src/maps/collision.ts`; the Rooms
> tab draws the two groups on either side of the canopy. From
> `walking_against_flower.txt`, `add_enemy__mosquito.txt`, and the handler at
> `$8FC773`.

A character does not have a fixed depth. Every frame, the engine reads the
**collision word of the tile it is standing on** and picks an OAM priority
from it: the plane the character carries against the plane of that tile,
and, if those match, bit 12.

## Where the word comes from

Entity `+0x3C` holds that word, and `$8FAFE5` fills it in from the tile
under the entity:

```
8FAFE5  LDX $003A,Y          ; the tile the entity stands on
8FAFE8  LDA $7F0000,X        ; -> that tile's metatile record
8FAFED  LDA $7F0004,X        ; -> the record's collision word
8FAFF1  STA $003C,Y
```

`$7F0004 + record` is the same metatile collision table `src/maps/room.ts`
decodes, so the word the engine tests is one this repo already has. Four
entities in `walking_against_flower.txt` pin that: the words the trace loads
are exactly `collisionWords[y >> 4][x >> 4]` in room `0x38`.

| Entity | `$001A` / `$001C` | Tile | `$003C` | Decoded |
|---|---|---|---|---|
| Wimpy Flower | `$0248`, `$03C8` | 36, 60 | `$0010` | `0x0010` |
| — | `$0358`, `$0408` | 53, 64 | `$0010` | `0x0010` |
| — | `$0314`, `$0304` | 49, 48 | `$0013` | `0x0013` |
| — | `$0229`, `$03E6` | 34, 62 | `$0010` | `0x0010` |

## What `$8FC773` does with it

```
8FC780  LDA $003C,Y      ; the tile's collision word
8FC783  TAX
8FC784  EOR #$0800
8FC787  BIT #$0F00
8FC78A  BNE $8FC793
8FC78C  TDC / STA $08 / STA $0084,Y / RTL   ; gate nibble 8: not drawn at all
8FC793  AND #$0030       ; the tile's plane
8FC798  LDA $0018,Y / AND #$0030 / CMP $12
8FC7A0  BEQ $8FC7A9      ; same plane -> the bit decides
8FC7A2  BMI $8FC7C1      ; below the tile's plane -> priority 3
8FC7A4  LDA #$CC20       ; above it -> priority 2
8FC7A9  TXA
8FC7AA  BIT #$1000
8FC7AD  BNE $8FC7C1      ; -> LDA #$CC30, priority 3
8FC7AF  EOR #$0400 / BIT #$0F00 / BEQ $8FC7BC
8FC7B7  LDA #$CC20       ; priority 2
8FC7BC  LDA #$FC20       ; priority 2, different attribute mask
8FC7C1  LDA #$CC30       ; priority 3
8FC7C4  STA $06
```

In order:

| Test | OAM priority | Result in Mode 1 |
|---|---|---|
| bits 8–11 = `8` | none | the sprite is not queued at all |
| character's plane **below** the tile's | 3 | in front of every background pixel |
| character's plane **above** the tile's | 2 | behind `BG1.1` and `BG2.1` |
| same plane, bit 12 set | 3 | in front of every background pixel |
| same plane, bit 12 clear | 2 | behind `BG1.1` and `BG2.1` |

Mode 1's order is `OBJ.3 > BG1.1 > BG2.1 > OBJ.2 > BG1.0 > BG2.0`, so
"priority 2" means exactly the priority half of whichever layer won — what
`renderRoomForeground` renders and the Rooms tab calls the canopy.

## The plane the character carries

The comparison uses `$0018,Y`, and that is **not** always the plane of the
tile underneath. `$8FA914` refuses to update it on a tile with bit 13 or bit
6 set:

```
8FA914  BIT #$2040       ; forced-walkable | plane-transparent
8FA917  BNE $8FA91F      ; -> leave the plane alone
8FA919  AND #$0030 / STA $44
```

So a character resting on a plane-transparent tile keeps the plane it walked
in with, which the map cannot say. `spawnDepth` answers `unknown` for that
case and the Rooms tab draws those in front rather than burying them: in a
room with one plane there is nothing to be unsure about, and only **13 of
the 1402 vanilla spawns** are in a multi-plane room on such a tile. Room
`0x3b`'s Rock at (89, 61) is one — tile `$0061`, plane 2 and transparent —
and treating it as plane 2 hid it completely under the rock face.

## In front is the normal case

**84.4% of the 390584 vanilla tiles set bit 12.** Across the 1402 vanilla
spawns the whole rule gives 1069 in front, 311 behind, 9 never drawn and 13
unknown. A viewer that lays the foreground over every character is therefore
wrong about three quarters of them — enemies disappear under walls and
bridges they should be standing on. The Rooms tab sorts its spawns into two
groups and puts the canopy between them.

The two agree with the artwork, which is the cross-check the trace cannot
give: in room `0x76` every spawn marked *in front* has no priority pixels
anywhere near it, and the ones marked *behind* are the ones standing in
foliage.

Nine vanilla spawns stand on a nibble-8 tile and are not drawn at all; the
tab dims those rather than hiding them, since the point of the view is to
find them.

Bit 12 has a second use because of this. It is the only statement in the ROM
about **which priority art is a canopy and which is just floor** — rooms put
plain ground on the priority half of a layer all the time, purely so the art
layers nicely. `hiddenTileMask` in `src/maps/render.ts` uses it for exactly
that, and without it a third of room `0x06` looks covered when none of it
is.

## What this does not cover

- **A moving character.** The word is re-read every frame, so an enemy that
  walks from a bit-12 tile to one without changes depth mid-step. The tab
  shows the spawn point only.
- **The plane a spawn is created with.** Every entity in the three
  `add_enemy` traces carries `+0x18 = $0010`, but each is also standing on a
  plane-1 tile, so the traces cannot separate "set from the tile" from
  "initialised to 1". Answering it needs a trace of a room where the two
  differ — room `0x3b` would do.
- **`$0010,Y` bit 10.** When it is set, `$8FC773` takes a different input
  entirely (`$23C1`) and skips the tile. Nothing traced has that bit set.
- **`#$FC20` versus `#$CC20`.** Both are priority 2; the high byte is the
  mask `$809433` ANDs the chunk attribute with, so it changes which chunk
  fields survive, not the depth.
