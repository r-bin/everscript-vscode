# The animation script language

> Status: **mostly decoded.** The ROM's own catalogue is known: **783
> animations** (1,752 records) in one table, plus the 212-entry id table
> `animate()` reads. Run tick by tick, **1,713 of the 1,752** record scripts
> come back round or end cleanly. The rest stop on `0x57`, which is
> variable-length by design, or on `0x3C`.
>
> Code: `src/maps/animation-opcodes.ts` (the one width table, disassembler),
> `src/maps/animation-vm.ts` (interpreter, record and id tables). The Sprites
> tab's **Animations** mode lists every record and shows each script.
>
> How the decoder uses this — idle frames, holds, strike boxes — is in
> [animation_format.md](animation_format.md). This page is the language
> itself: the machine, the encoding, every opcode, and a notation for writing
> scripts down.

Yes, it is a language. Everscript's `animate(entity, mode, id)` (opcode `0x78`)
only *chooses* an animation. The animation is then a separate bytecode
program, run by its own small interpreter at `$9080D0`, one script per entity,
once per game frame. Everscript has no source form for these programs, so this
page defines one (see [Notation](#notation)).

## Where scripts live

| What | Where |
|---|---|
| Opcode dispatch table | `$908000`, 2-byte handler pointers indexed by `(cmd & 0x7f) * 2` |
| Real opcodes | `0x00` up to about `0x65`. The entry for `0x66` already points into data, and every entry after it scatters across banks `$90`/`$8F` |
| Animation records | `$C40000 + record`, 4 bytes each: `[scriptLow:u16][bank:u8][flags:u8]`, from **`$C43E3A` to `$C45999`** |
| Global animation ids | `$C43C92 + id`, 212 words, ending where the record table starts |
| A character's animations | record `+0x32` stand, `+0x34` walk, `+0x36` run, `+0x38..+0x3E` attack 0–3, `+0x40` damage, `+0x42` death |
| Script banks | `$C4`–`$CE` |

## The catalogue

**The record table** is one unbroken run of valid records from `$C43E3A` to
`$C45999`. Read it in order, taking 8 records for a head with flags bit 7, 4 for
bit 6, and 1 otherwise. It splits into **783 animations** and lands exactly on
the table's end:

| Facings | Animations |
|---|---|
| 1 | 488 |
| 4 | 274 |
| 8 | 21 |

The sibling records of every group have flags `0`. All 314 distinct character
and weapon references land on a group head, never on a sibling.

**The id table.** `animate(entity, mode, id)` resolves its id here:

```
8CE139  PLX              ; the id
8CE13A  BMI $8CE142      ; bit 15 set: a field of the character's own record
8CE13C  LDA $C43C92,X    ; otherwise: the global id table
8CE142  TXA / AND #$7FFF / ADC $0060,Y / LDA $8E0032,X   ; record + 0x32 + (id & 0x7fff)
8CE150  JSL $908124      ; then pick the facing, as for any record
```

Of the 207 global ids named in `index.json`, 206 land on a group head. The
other one, Dog `ACT1_STICK_RUNNING` (`0x30`), lands on `$42DA`. That is the
west record of the 4-facing group at `$42CE`, used as a one-pose animation.

**`$910000` is not this table.** It is font glyph bitplanes, and an earlier
decoder read ids through it. Not one of the 140 ids tried there landed on a
record head. The one that seemed to work, `MAGMAR_ENTER`, was a coincidence.
The real record is `$4DD2`, among Magmar's own records (`$4DCA`–`$4DE6`).

295 of the 783 animations are referenced by no character field, weapon field
or global id. Something else may still reach them (alchemy and object
scripts are unexamined), so the Sprites tab lists them as "no known owner"
and draws them in the Boy's palette as a guess.

## Facing

**Facing 0 is north and 8 is south.** The mover's and the projectiles' direction
tables (`$8FAF18`, `$90DD88`) move facing 0 up the screen and 8 down. The art
agrees: the Boy's idle at facing 0 shows his back, and at 8 his front. Facing 4 is
east and 12 west; the odd steps are the diagonals (2 NE, 6 SE, 10 SW, 14 NW).
Characters with four poses round the diagonals to a neighbour through
`$90815B`. The Sprites tab's compass uses these labels; until v0.130.0 its "S"
button showed facing 0.

The record's flags pick the facing. Bit 7 means 8 directional records, bit 6
means 4 through the table at `$90815B`. See
[animation_format.md § Facing](animation_format.md#facing).

## The machine

Each animating entity carries its own interpreter state in its WRAM slot:

| Entity field | Role | Written by |
|---|---|---|
| `+0x00..+0x01` | **Resume pointer**: where the next tick starts reading | hold, frame-end, jumps |
| `+0x02` | Script bank | animation start (`$90818F`) |
| `+0x03..+0x04` | **Restart point**: where `loop` jumps to | animation start, `restart_here` |
| `+0x05` | **Frame timer**, in ticks | hold commands; reset to 1 |
| `+0x06..+0x0A` | Current sprite (`+0x06` address, `+0x08` bank); second slot `+0x09/+0x0A` | `sprite`, `sprite2` |
| `+0x16` | Animation mode flags | `mode`; cleared by `reset` |
| `+0x42`, `+0x44` | Hurt-box offset | `hurtbox`; `reset` puts back `0, -16` |
| any other field | Script **variables**: the `0x31`–`0x3A` family addresses fields by byte offset | variable ops |

So a "variable" is just a byte offset into the entity's own slot. Scripts
mostly use `$7E` and `$09` as scratch.

### One tick

```
9080D6  LDX $0000,Y      ; resume pointer
9080E3  LDA [$5D]        ; command
9080E5  ASL              ; carry = bit 7 (end of frame), A = (cmd & 0x7f) * 2
9080EA  BCS $9080FC
9080EC  JSR ($8000,X)    ; bit 7 clear: run it, read the next one
9080FC  JSR ($8000,X)    ; bit 7 set: run it, then end the tick:
908100  DEC $0005,X      ;   count the timer down
908103  BEQ $908108      ;   not zero: return, resume pointer unchanged
908108  LDA #$01 / STA $0005,X ; zero: timer back to 1,
90810F  LDA $5D / STA $0000,X  ;   and resume after this command
```

Commands run back to back until one has **bit 7 set**. That one runs too, and
then the tick is over. Bit 7 is not part of the opcode: `0xA4` is `0x24`
(`sprite`) and then end of frame.

### Holds are checkpoints

This is what makes movement and timing fit together. Every hold handler does
two things: it loads the timer **and saves the resume pointer to just after
itself**.

```
90836C  TXA / LSR        ; the opcode itself, 0x01..0x1e
90836E  STA $0005,Y      ; -> frame timer
908371  LDA $5D
908373  STA $0000,Y      ; resume here next tick
```

So for a frame written as

```
sprite $cc5b38
hold 2
step 2!
```

the first tick runs all three commands. Each later tick restarts *at `step`*
and runs only `step 2!`, until the timer reaches zero. Commands before the
hold run once per frame. Commands between the hold and the frame end run
**every tick** of the hold. That is how a walk cycle moves the entity
smoothly while its sprite changes only every 12 ticks.

With no hold in a frame, the timer is 1 and the frame lasts one tick.

## Notation

One command per line. Mnemonic, then operands. A trailing **`!`** means bit 7
is set: the frame ends after this command. Addresses are written `$bbaaaa`.
`var[$xx]` is entity field `+$xx`.

```
reset                     ; 52
mode $0004                ; 4d 04 00
sprite $cc5b38            ; 24 38 5b    bank = 0x24 + 0xA8 = $CC
hold 2                    ; 02
step 2!                   ; c2 02
```

To encode it back: set bit 7 on the opcode byte of any command marked `!`.

## Opcode reference

**Evidence**: *trace* = width measured in a Mesen trace of the interpreter.
*handler* = read from the handler's own `$5D` advances (every path followed to
`RTS`). *census* = how many of the 845 distinct character scripts (all
characters, all animation fields, all facings) use it.

### Timing and frames

| Op | Bytes | Mnemonic | Meaning | Handler | Census |
|---|---|---|---|---|---|
| `00`, `21` | 1 | `nop` | Does nothing (`RTS`). Written `nop!` it is a bare frame boundary | `$90878A`/`$90878B` | 216 / 803 |
| `01`–`1E` | 1 | `hold n` | Timer = `n` (the opcode itself); checkpoint | `$90836C` | ~2900 |
| `1F` | 3 | `hold_random r, base` | Timer = `base + rand(0..r-1)` (`$4202` multiply of `r` by a random byte, high byte); checkpoint | `$90837C` | 93 |
| `20` | 2 | `hold n` | Timer = next byte, for holds over 30; checkpoint | `$90835A` | 16 |

### Sprites

| Op | Bytes | Mnemonic | Meaning | Handler | Census |
|---|---|---|---|---|---|
| `22`–`2B` | 3 | `sprite $bbaaaa` | Main sprite. Bank = `op + 0xA8` (`$CA`–`$D3`), then a u16 address | `$908418` | ~2700 |
| `2C` | 4 | `sprite2 $bbaaaa` | Second sprite slot (`+0x09/+0x0A`), usually the shadow; 24-bit address | `$90842F` | 223 |
| `52` | 1 | `reset` | Clears sprite, mode `+0x16`, `+0x82`; hurt box back to `0, -16`. Opens nearly every script | `$908453` | 837 |

### Control flow

| Op | Bytes | Mnemonic | Meaning | Handler | Census |
|---|---|---|---|---|---|
| `2D` | 1 | `loop` | Jump to the restart point (`+0x03`). Where every cycle ends | `$90877D` | 823 |
| `30` | 1 | `restart_here` | Restart point = here. Ring-menu icons use it ([item-icons.md](../item-icons.md)) | `$908AE0` | — |
| `39` | 4 | `dec_jnz var[$f], $target` | `var[$f]` (u16) −1. If still non-zero, jump to `target` (same bank) | `$908BBE` | 8 |
| `3A` | 4 | `jump_pos var[$f], $target` | Jump if `var[$f]` is > 0 (signed). Otherwise fall through | `$908BE4` | — |
| `3B` | 3 | `jump $target` | Unconditional jump, same bank | `$908BB5` | 4 |
| `53` | 1 | `end_check` | End-of-cycle hook, just before `loop` in almost every script. State `$0100` in `+0x12` restarts the script here. Otherwise it updates the entity's AI flags (`+0x10`) | `$9083AC` | 825 |
| `54` | 3 | `jump_if_linked $target` | If the linked entity (`+0x80`) has `$0010&0x100` and `$0016&0x40`, jump; else skip | `$908C09` | 91 |
| `5E` | 25 | `sprite_aim $a, … $h` | Eight 24-bit sprite addresses. `$919932` picks one by angle, so it shows where the entity aims | `$9089C8` | 5 |
| `5F` | 4 | `sprite_long $bbaaaa` | A sprite by full 24-bit address, drawn at once through `$809033` | `$908984` | 3 |
| `57` | 2+4g | `segments N: K×$sprite, …` | A segmented body (Tar Skull, Bone Snake): N segments, then groups of `[count K][24-bit sprite]` until all N have one, written into the 14-byte segment list at `+0x86` (`$8FCA02`). The width is read from the operand | `$90886D` | 24 |

All jump targets are a u16. The bank stays whatever the script is in.

### Variables (entity fields)

| Op | Bytes | Mnemonic | Meaning | Handler | Census |
|---|---|---|---|---|---|
| `31` | 3 | `set8 var[$f], n` | Byte store | `$908AEB` | — |
| `32` | 4 | `set var[$f], n` | Word store | `$908B00` | 8 |
| `33` | 5 | `set24 var[$f], $bbaaaa` | Byte at `f`, then word at `f+1` (a long pointer) | `$908B1A` | — |
| `34` | 6 | `poke $bbaaaa, n` | Word store to any 24-bit address | `$908B3C` | — |
| `35` | 3 | `add8 var[$f], n` | Byte add | `$908B81` | — |
| `36` | 4 | `add var[$f], n` | Word add | `$908B99` | — |
| `37`, `38` | 2 | `clear var[$f]` | Word = 0 (`37` one 16-bit store, `38` two 8-bit stores) | `$908B5A`/`$908B6C` | — / 25 |

The `—` entries are in the table and have handlers, but no character
animation uses them. They are presumably for effects and menu scripts.

### Movement and physics

| Op | Bytes | Mnemonic | Meaning | Handler | Census |
|---|---|---|---|---|---|
| `41` | 1 | `step0` | When `+0x3C` has bit `$2000`, calls the mover with distance 0 | `$9086A9` | 1599 |
| `42` | 2 | `step n` | Moves `(n + f) >> 2` px along the facing, where `f` is a dither (0, 3, 1, 2), so n/4 px per tick on average. Capped by `+0x64`. Negative `n` moves backwards (`facing ^ 8`). See [Movement and height](#movement-and-height) | `$90866C` | 1930 |
| `43` | 1 | `wait_landed` | Adds a tick to the frame timer while height `+0x1E` or z-speed `+0x20` is non-zero, so the frame lasts until the entity lands | `$9086C3` | 25 |
| `44` | 1 | `hover_hold` | +1 tick while height ≥ `$0E96`, a hover height `$8FDC46` rolls as `$100 + rand(0..$1F0)` (16–47 px). The interpreter uses the middle, `$1F8` | `$9086D4` | 16 |
| `45` | 3 | `hop v` | z-speed (`+0x20`) = `v`, unless height is already ≥ `$640` | `$9086E5` | 42 |
| `46` | 3 | `hop_maybe v` | When on the ground, sets z-speed = `v` on a coin toss (a random bit from `$0E94`) | `$9086FE` | 2 |
| `5B` | 1 | `mark_position` | Copies position + a facing-table offset to `$0FCA..$0FCE` | `$9085C1` | 16 |

### Combat

| Op | Bytes | Mnemonic | Meaning | Handler | Census |
|---|---|---|---|---|---|
| `47` | 5 | `strike dx, dy, w, h` | Strike box centred at `(dx, dy)` from the feet, this frame only. See [attack_boxes.md](attack_boxes.md) | `$9087BA` | 303 |
| `4C` | 6 | `projectile $id, dx, dy, dz` | Throws projectile record `$90:id` from `(x+dx, y+dy, height+dz·16)`. See [Projectiles](#projectiles) | `$908725` | 58 |
| `50` | 5 | `hurtbox x, y` | Sets the hurt offset `+0x42/+0x44`, which the hit test does use (`$8FB63D`). The Skullclaw's `0, −22` raises its region while flying. The Boy's and Dog's scripts set values like −132/−144 that cannot be offsets, so the tab keeps their default | `$9085A8` | 21 |
| `48` | 1 | — | May switch the entity to another animation (`$8FB8F0`, then `$90828E` and a pointer reload) | `$908810` | 108 |
| `49`, `4A` | 3 | — | A word through `$90CE78` / `$90CE92`. `49` stores the result in `+0x0C`, the palette slot, so this is a palette change, not a sound | `$90882D`/`$908843` | 6 / — |
| `58` | 1 | `segment_step` | Eases every segment one tick (`$8FC905`), then copies the head's position into the hurt offset `+0x42/+0x44` (`$908886`). Scripts run it after a hold, so it runs every tick | `$90887B` | — |
| `59` | 7 | `segment #k, dx, dy` | Retargets segment `k`: a byte offset into the list (`4 + 14k`), its depth (`+3`), x/y countdowns (`+4`, `+5`), then the signed x/y target (`+0x0C/+0x0D`). The segment eases there (see below). Always 7 bytes (`$8FC8DE`) | `$9088AE` | — |

### State and effects

| Op | Bytes | Mnemonic | Meaning | Handler | Census |
|---|---|---|---|---|---|
| `2E` | 2 | `sound n` | Probably a sound effect: `n` indexes `$8C8362` → `$8C82DC`. Skipped when off-screen. *Meaning unverified* | `$908921` | 294 |
| `2F` | 2 | `sound_maybe n` | Same as `2E`, but only when a random word has `$C000` set (≈75%) | `$90894E` | — |
| `3F` | 3 | — | If the word is non-zero, calls `$8C81FD` | `$9088BC` | 24 |
| `40` | 3 | — | A word, then `$8C81FD`. Aborts **without** advancing when off-screen | `$9088F3` | 115 |
| `4B` | 3 | — | A word, then `$90CD5C` | `$90885A` | 1 |
| `4D` | 3 | `mode n` | Word into `+0x16`. **Bit `$20` makes it invulnerable**: the hit test skips a target with `$0016 & $0020` (`$8FB61E`) | `$908485` | 557 |
| `4E` | 1 | — | Clears `+0x2E` and bit `$0200` of `+0x14` | `$908495` | 135 |
| `4F` | 1 | — | Clears bits `~$FB87` of `+0x12`, if `+0x2A` set and `+0x76` clear | `$9084A7` | 194 |
| `56` | 3 | — | A formula index; greys out a ring-menu icon via `$91CE38` | `$90878C` | — |
| `5A` | 2 | — | Byte into `+0x82` | `$908447` | 22 |
| `5D` | 1 | — | Sets bit 1 of `+0x26` | `$908C75` | — |
| `3D` | 5 | — | Two words, then `$90CFB8` | `$908A8A` | — |
| `3E` | 9 | — | Four words, then `$90D408` | `$908AA7` | 3 |
| `51` | 1 | — | Player slot only (`Y = $4E89`): `$8FB28D` | `$908C67` | 16 |
| `55` | 1 | — | Every 64 frames, `$8FC143` with a random 3–6 | `$908C4D` | — |
| `5C` | 1 | — | Copies the linked entity's position to `$44..$48`, then `$8FC2E4` | `$908C30` | — |

### HUD commands

`60`–`64` draw sprites straight to fixed **screen** positions through `$809033`,
picking one from an inline table of 24-bit sprites by some game state. They are
not part of the entity. Record `$56DE`, which no character owns, is one: a
`hud_bar`. A preview shows the first table entry.

| Op | Bytes | Mnemonic | What it draws | Handler |
|---|---|---|---|---|
| `60` | 49 | `hud_bar` | full segments (entry 0), then one of 16 partials, from an entity ratio | `$908D79` |
| `61` | 13 | `hud_column` | four sprites stacked at x 22, y 92 / 103 / 114 / 125 | `$908C7E` |
| `62` | 28 | `hud_gauge` | one of 9, by `$0B15`, at (224, 16) | `$908CEE` |
| `63` | 13 | `hud_icon` | one of 4, by `$7E2348`, at (232, 20) and (96, 162) | `$908D2D` |
| `64` | 52 | `hud_meter` | one of 17, by `$0E45`, at (128, 202) | `$908E09` |

The handler for `65` is data, so the opcode range ends at `64`. `3C` is 9 bytes:
four words, then a colour transfer via `$90D34C`/`$8085FA`.

**With these, all 1,752 record scripts run to completion.**

Census counts in the sprite and control-flow tables cover the 845 character
scripts. Counts for `3E`, `51`, `5E` and `5F` cover all 1,752 record scripts.

## Decoded scripts

Disassembled straight from the ROM (US). Columns: address, bytes, notation.

### Mosquito, stand: a flapping hover that drifts

```
c80d24  52              reset
c80d25  4d 04 00        mode $0004
c80d28  24 38 5b        sprite $cc5b38
c80d2b  02              hold 2
c80d2c  c2 02           step 2!          ; runs on both ticks of the hold
c80d2e  24 3f 5b        sprite $cc5b3f
c80d31  01              hold 1
c80d32  c2 02           step 2!
c80d34  42 02           step 2
c80d36  d3              end_check!
c80d37  21              nop
c80d38  2d              loop
```

The two sprites `$CC5B38`/`$CC5B3F` are the pair a Mesen trace saw the game
draw, alternating.

### Wimpy Flower, stand: one held frame

```
c70168  52              reset
c70169  4d 00 08        mode $0800
c7016c  a4 3b 4f        sprite $cc4f3b!  ; a one-tick frame...
c7016f  20 64           hold 100
c70171  80              nop!             ; ...then the same sprite for 100
c70172  d3              end_check!
c70173  2d              loop
```

All three frames show the same sprite, so a viewer merges them into one still.

### Boy, walk south: movement every tick

```
c80efa  52              reset
c80efb  4d 04 00        mode $0004
c80efe  50 7c ff 70 ff  hurtbox $ff7c, $ff70
c80f03  24 23 5f        sprite $cc5f23
c80f06  0c              hold 12
c80f07  c2 05           step 5!          ; 12 ticks of stepping per pose
c80f09  24 3d 5f        sprite $cc5f3d
c80f0c  0c              hold 12
c80f0d  c2 05           step 5!
c80f0f  24 57 5f        sprite $cc5f57
c80f12  0c              hold 12
c80f13  c2 05           step 5!
c80f15  24 6c 5f        sprite $cc5f6c
c80f18  0b              hold 11
c80f19  c2 05           step 5!
c80f1b  42 05           step 5
c80f1d  d3              end_check!
c80f1e  21              nop
c80f1f  2d              loop
```

### Flowering Death, attack 0: a counted loop

```
c701dc  52              reset
c701dd  4d 10 08        mode $0810
c701e0  2e 34           sound $34
c701e2  24 09 51        sprite $cc5109
c701e5  06              hold 6
c701e6  80              nop!
c701e7  47 ff 10 16 13  strike -1, 16, 22, 19
c701ec  24 2d 51        sprite $cc512d
c701ef  06              hold 6
c701f0  80              nop!
c701f1  32 7e 02 00     set var[$7e], 2
c701f5  47 fe 22 13 1b  strike -2, 34, 19, 27     ; <- loop body
c701fa  24 94 52        sprite $cc5294
c701fd  06              hold 6
c701fe  80              nop!
c701ff  24 bd 52        sprite $cc52bd
c70202  06              hold 6
c70203  80              nop!
c70204  39 7e f5 01     dec_jnz var[$7e], $c701f5 ; twice in all
c70208  24 7f 51        sprite $cc517f
c7020b  09              hold 9
c7020c  80              nop!
c7020d  4e              op_4e
c7020e  d3              end_check!
c7020f  2d              loop
```

### Stone Cobra: a random wait and a conditional branch

```
c94026  4f              op_4f
c94027  54 75 00        jump_if_linked $c90075
c9402a  52              reset
c9402b  4d 01 08        mode $0801
c9402e  2e 08           sound $08
c94030  27 13 20        sprite $cf2013
c94033  1f 28 28        hold_random 40, 40   ; 40..79 ticks
c94036  80              nop!
c94037  4f              op_4f
c94038  d3              end_check!
c94039  21              nop
c9403a  2d              loop
```

### The invisible helpers: a script that draws nothing

`$C70080`, shared by `PLACEHOLDER`, `FAN_ENTITY`, `SPEAKER_ENTITY` and the
tentacle / Thraxx-arm stand-ins:

```
c70080  d2              reset!
c70081  1e              hold 30
c70082  80              nop!
c70083  d3              end_check!
c70084  2d              loop
```

## Movement and height

**x and y.** `step n` (`$90866C`) calls the mover `$8FAD51` with a distance of
`(n + f) >> 2` px, computed in 8 bits. `f` is `$0F36`, which the per-frame
entity update sets to `$8FB090[f]` (`$8FAFCA`). That table is `3, 2, 0, 1`, so
`f` cycles 0, 3, 1, 2: a dither, which makes `step n` move exactly n/4 px per
tick on average. A negative `n` moves `-n` the other way (`facing ^ 8`). The
mover's direction table at `$8FAF18` is the same as the projectiles':

| Facing | 0 | 2 | 4 | 6 | 8 | 10 | 12 | 14 |
|---|---|---|---|---|---|---|---|---|
| (dx, dy) | (0, −d) | (+d, −d) | (+d, 0) | (+d, +d) | (0, +d) | (−d, +d) | (−d, 0) | (−d, −d) |

The mover caps `d` at entity `+0x64` and then runs collision. Neither is
modelled. The Boy's walk is `step 5` on every tick: 1.25 px per tick, 60 px
per 48-tick cycle.

**Height.** Height is entity `+0x1E` in 1/16 px; projectile spawn heights add
`dz × 16` to it. z-speed is `+0x20`. The per-frame update integrates them at
`$8FAFF5`:

```
8FAFF5  LDA $0020,X      ; v
8FAFF8  DEC              ; v - 1   (gravity: 1 per tick)
8FAFFA  ADC $001E,X      ; + h
8FAFFD  BEQ / BPL        ; at or below 0: landed
8FB001  STZ $0020,X / STZ $001E,X
8FB009  STA $001E,X      ; otherwise h = h + v - 1
8FB00C  DEC $0020,X      ;           v = v - 1
```

`hop v` sets `v`. `wait_landed` keeps a hold going while `h` or `v` is
non-zero. Together they make a jump frame last exactly its airtime:

```
c91152  sprite $cd2aa0
c91155  hop 32           ; Skelesnail attack
c91158  hold 1
c91159  wait_landed      ; +1 tick while airborne
c9115a  step 2!          ; and it keeps lunging forward every tick
```

That frame lasts 64 ticks and peaks at 496/16 = **31 px**. The attack lunges
54 px in all.

**What the interpreter assumes:** physics runs once per tick, after the
script (the order inside a tick is not traced, and it moves results by at
most one tick); the dither starts at 0; `hop_maybe` is taken; and `0x44`,
which compares height with the global `$0E96`, never adds a tick. The second
sprite slot is drawn on the ground as a shadow while height lifts the main
sprite. That fits the Skelesnail, whose second slot is set before its hop, but
the engine's draw order for it is not traced.

## Projectiles

`projectile $id, dx, dy, dz` (`0x4C`, `$908725`) puts the spawn point at
`(x + dx, y + dy, height + dz × 16)` relative to the thrower, then calls
`$90DCA4` with `$06 = id`. Everything after that reads one **24-byte record
at `$900000 + id`**:

| Field | Read at | Meaning |
|---|---|---|
| `+0x00` | `$90DC83` → `$90819A` | **Animation record**, started with the thrower's facing (`$90DC51` copies `+0x22`). Every id in use points at a group head |
| `+0x02` | `$90DC93` → `$90CD80` | **Palette** in bank `$90`. `0` keeps the thrower's palette (`$90DC57`) |
| `+0x08` | `$90DCB7` | Movement routine, an index into `$90D967` |
| `+0x0C` | `$90DCB0` | → entity `+0x26` |
| `+0x0E` | routines 2 and 4 | **Speed**, in 1/16 px per tick (positions are kept ×16, `$90DD61`) |
| `+0x10` | `$90DCA9` | → entity `+0x1E` |
| `+0x12` | routines 2 and 4 | → entity `+0x24` |
| `+0x14` | `$90DC7C` | → entity `+0x2A` |
| `+0x16` | `$90DC6B` | **Power**. `0` means derived from the thrower (`$8FC02B`) |

Records run every 24 bytes from `$90D9A6` to `$90DB86` (21 slots). 13 are
thrown by animation scripts; two slots have no animation and are used
elsewhere, if at all.

### How a projectile lives

A projectile is an entity of its own. `$90DE5E` walks the pool
`$6387..$64E7` every tick and dispatches on entity `+0x26` (record `+0x0C`)
through **the same table at `$90D967`** that record `+0x08` used to set it up.
So `+0x08` is the setup and `+0x0C` the per-tick behaviour:

| `+0x0C` | Handler | Every tick |
|---|---|---|
| `0x0E` | `$90DE9C` | z-speed −1, height += z-speed, **gone below 0**; move by velocity |
| `0x12` | `$90DE88` | lifetime (`+0x1E`, record `+0x10`) −1, **gone below 0**; height fixed; move |
| `0x1A` | `$90DE80` | as `0x12`, on the thrower's plane |
| `0x10` | `$90DF44` | lifetime −1; angle +1; on an ellipse (the boomerang, below) |

All four end the same way, and this is **where projectile damage comes from**.
No projectile animation contains a `strike`. Instead, every tick the projectile
lives, it hands the hit test a **16×16 box** centred on itself at its own
height (`$90DED5`: `$3E = $40 = $10`, then `JSL $8FB5F2`), with power `+0x28`.
So a projectile can damage on every tick it is alive.

| `+0x08` setup | Handler | Velocity |
|---|---|---|
| 2, 4 | `$90DD58`, `$90DD61` | speed along the facing (table below) |
| `0x16` | `$90DDCA` | toward the target (`$0F42`): `4 × distance / (speed / 4)` (`$90DFDF`), so it arrives after about `speed` ticks |
| `0x18` | `$90DE11` | toward the target, at `speed` (`$80AEAC`/`$80B01D`, whose angle quantisation is not modelled) |
| 6 | `$90DEF7` | the ellipse: start angle `(facing ^ 8) × 16` of 256, lifetime `$100` |

Routines 2, 4, `0x16` and `0x18` also copy record `+0x12` into the z-speed.

**The boomerang** (Vigor's attack 1, `$DA4E`: setup 6, behaviour `0x10`).
Setup puts the centre of an ellipse so that the thrower's spawn point lies on
it. Every tick the angle advances by one step of 256:

```
x = cx + $808923[angle] × 8      ; ×16 positions, so ±128 px
y = cy + $8088A3[angle] × 4      ; half: ±64 px, the top-down squash
```

Its lifetime is exactly one lap (256 ticks), so it returns to where it was
thrown. Thrown east, it runs along the top of the ellipse, curves down and
back, and passes 128 px behind the thrower on the way.

**Aimed** (`0x16`, `0x18`). Vigor's attack 0 (`$DA36`) and Magmar's lobs
aim at the controlled character. In the Sprites tab, they aim at the target
character.

**Routines 2 and 4 fly straight.** Routine 4 (`$90DD61`) puts the speed into
x and y velocity by facing, from its table at `$90DD88`. Routine 2 sets the
power from `$0A3F` and jumps into routine 4.

| Facing | 0 | 2 | 4 | 6 | 8 | 10 | 12 | 14 |
|---|---|---|---|---|---|---|---|---|
| (vx, vy) | (0, −s) | (+s, −s) | (+s, 0) | (+s, +s) | (0, +s) | (−s, +s) | (−s, 0) | (−s, −s) |

Diagonals are not normalised.

That table also says which way facings point on screen: **facing 8 moves +y,
down the screen**. Throw offsets agree. The four facing records of the spear
throw `$411E` spawn at `dy −4`, `dx +29`, `dy +11` and `dx −31` for facings
0, 4, 8 and 12. This bears on the open question of whether facing 0 or 8 is
south.

**Example: the spears' level-2 attack** (`$411E`, shared by all four spears)
throws `$D9D6` on tick 16, 29 px ahead and 19 px up. It is animation `$5772`, a
40×8 energy streak, flying at 5 px per tick (speed `0x50`). Its palette is `0`,
so it takes the Boy's, and for the spears that is the weapon palette below.

**The Boy's weapon palette.** Weapon record `+0x04` (`$AD6B`, `$AD8B`, …) is a
full 16-colour Boy palette in bank `$90`. Across all 15 weapons it keeps his
skin and outline (slots 1, 2, 4, 5, 15) and always replaces slots 12–13, which
his own palette (`+0x09`) leaves as placeholder green. The replacements are
the weapon's colours: bone for Bone Crusher, lavender for the spears, gold for
Crusader Sword. *The code that loads it is not traced*; this rests on the data
alone. The Sprites tab draws the Boy, and what he throws, in the equipped
weapon's palette.

### Consumed or piercing

Record `+0x14` becomes the projectile's attack proc (`$0E9A`). On a hit,
`$8FB6A5` dispatches through `$8FB6AE`:

| Proc | Handler | On a hit |
|---|---|---|
| 0 | `$B6CC` | the melee default: to-hit roll, damage |
| 2 | `$B6E0` | damage, then `LDX $0E9E / STZ $0010,X`: **the projectile is deleted** |
| 4 | `$B724` | damage, then `SEC; BRA $B6FC`, skipping the delete: **it pierces** |
| 6 | `$B73C` | damage by `$8FC07E`, then deleted |

Most thrown projectiles are proc 2. The spears' level-3 wave and Tiny's
juggle are proc 4. A target already hit by the same attacker is skipped
(`+0x36`) until its cooldown runs out, so a contact counts once.

## Hitting something

The hit test (`$8FB5F2`; melee strikes enter at `$8FB5E6`) compares a strike
box (centre `$46`/`$48`, size `$3E`×`$40`, height `$4A`) with each candidate:

```
8FB5F4  LDA #$0280 / SBC $4A / STA $4A            ; $4A = $280 − attack height
8FB63D  target y + 16 + (+0x44) − $48, |..| − radius (+0x0D), ×2  <  $40
8FB65A  target x + (+0x42) − $46,      |..| − radius,          ×2  <  $3E
8FB674  target height + $4A  <  $0460  (unsigned)
```

- **The hurt region is centred on the feet.** `+0x44` rests at −16
  (`reset`), cancelling the +16, so the target's region is a box of
  half-size `radius` around its feet. The strike reaches it when the boxes
  overlap. The Sprites tab draws it that way, not standing up from the feet.
- **Height is its own axis.** The target must be no more than 40 px below
  the attack, and **less than 30 px above it**. A character whose height is
  30 px or more cannot be hit by a ground-level attack. The tab dashes its
  hurt region grey and says "out of reach". A melee strike's height is the
  attacker's own height; a projectile's is the projectile's.
- **`hurtbox` (`0x50`) is not applied.** The handler stores its two words
  in `+0x42`/`+0x44` exactly as written. But the Boy's walk sets −132/−144,
  which as offsets would move his hurt region 132 px away. Until that is
  explained, the default (`0, −16`) is used.

## Segmented bodies

The Tar Skull and Salabog are lists of segments (`0x57`), each 14 bytes at
`+0x86 + 4 + 14k`: sprite, depth, x/y countdown, x/y position in 8.8, x/y
velocity, x/y target. `segment` (`0x59`) only sets a **target**; the draw
routine `$8FC86C` puts the sprite at the **current** position, and
`segment_step` (`0x58`, `$8FC905`) moves current toward target, per axis,
every time it runs:

```
count < 3:  position = target, velocity = 0
otherwise:  count −= 1
            step = (CB18[count] · (target − position)) >> 8
                 + (CA50[count] · velocity) >> 8          ; Mode 7 multiplier, middle 16 bits
            position += step                              ; 8.8 fixed point
            velocity = ((step >> 3) + 1) >> 1             ; ≈ step / 16
```

`$8FCB18` is the share of the remaining distance to cover at each countdown,
and `$8FCA50` the share of last tick's velocity to keep: an ease with
follow-through. The Tar Skull's script retargets one segment every 4 ticks
with a countdown of 60 and runs `segment_step` every tick, so a wave travels
down the body. It rises out of a pile over its first 60 ticks, then sways in a
120-tick cycle. Segment 0 is the head; the list is drawn in order, so the head
is in front.

## Scripts that set no sprite, fliers, invulnerability

- **The shared damage script** (`$3E6A`, used by about 80 characters) has no
  `reset` and no `sprite`. It knocks the character back (`step −16, −12, −8, −4`)
  and keeps whatever it was showing. The interpreter takes an initial sprite;
  the Sprites tab passes the character's standing sprite for the facing.
- **Fliers** (Skullclaw, Bone Buzzard, Gargon, Dragoil) and the Tumble Weed are
  still in the air at `loop`. The game simply carries on from there, so the
  interpreter does too, until the whole state (height included) repeats. It
  reports `loopFrom`, where the repeating part starts, and playback loops to
  there. The Skullclaw climbs, then hovers between about 25 and 40 px.
- **Charging = contact damage.** Mode bits `$4000`/`$8000` make a moving body
  deal damage when it runs into another (`$8FB52C`), with full stamina, once per
  charge. That is how Rimsala, Magmar's roll and the slimes hurt you without a
  `strike`. Details: [entities-reference.md § 6](entities-reference.md).
- **Knock-backs are not invulnerable.** The damage script's `mode $0005` does not
  set bit `$20`, and applying damage (`$8FC0D3`) only raises the hurt state
  (`+0x12 |= $0438`). The one protection is per attacker: a hit writes the
  attacker into the target's `+0x36` and `$14` into `+0x38` (`$8FBA1B`), which
  counts down every tick, so **the same attacker cannot hit again for 21 ticks**
  while anyone else still can. The to-hit check for projectiles (`$8FB9F8`) uses
  the same cooldown, after refusing outright a target whose record `+0x07` has
  bit `$10`.
- **One-shots end at `end_check!`.** It hands the entity back to its AI, or
  retires it after a death. Death scripts are stored back to back, so running on
  plays every death in a row.
- **One-shots land.** Attacks, damage, death, spoils and casting end on
  `end_check!`, which hands the entity back to its AI. One still in the air at
  `loop` (the Widowmaker's leap) holds its last frame until it lands, and the
  run ends there. Only idles, walks and runs carry on through `loop`.
- **Invulnerable frames** are the ones with mode bit `$20`. Frames split when it
  changes. The weapon slot once labelled "Charge Attack" (`+0x16`) is a held pose
  with `mode $0020`: the dodge. The character field once labelled "Block"
  (`+0x46`, on the Boy, Bad Boy and Verminator) is **casting** an alchemy formula
  or using an item, invulnerable while it plays (`mode $0120`).

## The Dog's forms

The Dog changes with each act, as the Boy changes with his weapon. Six
40-byte entries in bank `$CF`, listed by the pointer table at `$CF945F`, each
hold a 10-byte header followed by 15 animation records. The header is a
24-bit pointer, a byte, `$CC3C`, **the palette** (`+6`, bank `$90`), and a
word.

| # | Entry | Form | Palette |
|---|---|---|---|
| 0 | `$CF9395` | Act 1 (Prehistoria) — the record the Dog's character entry stands in | `$AE0B` |
| 1 | `$CF93BD` | Act 1 with stick — walk and run become `$42CE`, the group `ACT1_STICK_RUNNING` lands in | `$AE0B` |
| 2 | `$CF93E5` | Act 2 (Antiqua) | `$AE2B` |
| 3 | `$CF940D` | Act 3 (Gothica) | `$AE4B` |
| 4 | `$CF936D` | Act 0 (Podunk); only stand/walk/run are its own | `$B54B` |
| 5 | `$CF9435` | Act 4 (Omnitopia), named by elimination and its metal palette | `$AE6B` |

Slots are named only where the record is one the Dog's character entry or
an `ANIMATION_DOG` id already names:

| Slot | 0 | 1 | 2 | 3 | 4 | 5–8 | 9 | 10 | 11 | 12 | 13 | 14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | stand | walk | run | ? | damage | attack 0–3 | ? | ? | sleep | sit | ? | bark |

*The loader is not traced.* The Boy's weapon loader at `$CF81C9` copies its
records into `$0A58..`, and the Dog's is presumably similar, but it was not
found.

## Running a script

`runAnimation()` in `src/maps/animation-vm.ts` is the machine above, tick by
tick. It differs from a linear read in three ways, all visible in the Sprites
tab:

- **Counted loops repeat.** Flowering Death's attack strikes twice.
- **A strike before a hold lasts one tick.** A linear read painted it across
  the whole hold. The Boy's Bone Crusher swing is 4 ticks, then **1 tick with
  the strike box**, then 6 without, and so on.
- **`step` counts every tick** of its hold. The Mosquito's first pose steps
  `2 + 2`.
- **Each `projectile` spawn is recorded** with its tick in the frame, so a
  viewer can launch it at the right moment.
- **x, y and height are tracked per tick** for the facing being played, so a
  walk carries the sprite and a jump lifts it (above). Height and z-speed are
  part of the loop-detection state; position is not, because a walk never
  repeats one.

**One-shots end on `end_check!`.** A death or vanish script ends with
`end_check!`, and the engine retires the entity there. The bytes after it are
whatever was assembled next. For example, `$C70099` is `d3`, then `6b`, which
is not an opcode. A run that meets an unknown byte right after `end_check!`
counts as finished.

It assumes the idle case throughout: the entity is on screen and not in state
`$0100`, there is no linked entity, unset variables read 0, and `hold_random`
takes the middle of its range. The frame reports the full range.

On the 142 character idles it agrees with the linear walk frame for frame on
137. The other 5 differ only because their strikes come before the hold.

## Census

Over every character, every animation field `+0x32..+0x42`, every facing:

| | |
|---|---|
| Distinct scripts | 845 |
| Reach their own `loop` | **823** |
| Stop on `0x57` (Tar Skull, Salabog) | 22 |
| Most-used commands | `42 step` 1930, `41 step0` 1599, `21 nop` 803 |

Over all 1,752 record scripts, run tick by tick:

| | |
|---|---|
| Come back round, or end on `end_check!` | **1,713** |
| Stop on `0x57` | 24 |
| Stop on `0x3C` | 2 |
| Stop on bytes past a script's real end (`0x60`–`0x6B`) | 13 |
| Draw nothing at all (invisible helpers) | 39 |

## Gaps

- **`0x57`** needs an emulation of `$8FCA02` or a trace of one of its two
  bosses animating.
- **The linear walker** (`src/maps/character-animation.ts`, used for room
  idles) stops at `0x3B` rather than follow it, and plays a counted loop's body
  once. The interpreter does both properly; the room view has not moved to it
  yet.
- **Names marked unverified** (`sound`, `0x3F`, `0x40`, the `0x48`–`0x4A` and
  `0x58`/`0x59` weapon commands) describe what the handler calls, not a
  confirmed effect on screen.
