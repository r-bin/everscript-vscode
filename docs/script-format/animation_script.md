# The animation script language

> Status: **mostly decoded.** Every opcode a character animation uses has a
> known width, and **823 of 845** distinct character scripts disassemble
> cleanly to their own loop command. The other 22 all stop on `0x57`, which
> is variable-length by design (two bosses only).
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
| Real opcodes | `0x00`–`0x66`. Past that the table's "handlers" point all over bank `$90` and `$8F`. That is the next block of data, not code |
| Animation records | `$C40000 + id`, 4 bytes each: `[scriptLow:u16][bank:u8][flags:u8]` |
| A character's animations | record `+0x32` stand, `+0x34` walk, `+0x36` run, `+0x38..+0x3E` attack 0–3, `+0x40` damage, `+0x42` death |
| Script banks | `$C4`–`$CE` |

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
| `57` | var | `?` | Calls `$8FCA02` with `X = +0x86`. That walks a list of its own and leaves `$5D` wherever it stopped. **Width is a runtime value** | `$90886D` | 22 |

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
| `42` | 2 | `step n` | Moves `(n + $0F36) / 4` px along the facing, capped by `+0x64`. Negative `n` moves backwards (`facing ^ 8`). Usually placed after a hold, so it runs every tick | `$90866C` | 1930 |
| `43` | 1 | `wait_landed` | Holds while height `+0x1E` / z-speed `+0x20` are non-zero | `$9086C3` | 25 |
| `44` | 1 | — | Compares `+0x1E`, may bump the frame timer | `$9086D4` | 16 |
| `45` | 3 | `hop v` | Word into `+0x20` (vertical speed) | `$9086E5` | 42 |
| `46` | 3 | — | Two paths, both consume a word | `$9086FE` | 2 |
| `5B` | 1 | `mark_position` | Copies position + a facing-table offset to `$0FCA..$0FCE` | `$9085C1` | 16 |

### Combat

| Op | Bytes | Mnemonic | Meaning | Handler | Census |
|---|---|---|---|---|---|
| `47` | 5 | `strike dx, dy, w, h` | Strike box centred at `(dx, dy)` from the feet, this frame only. See [attack_boxes.md](attack_boxes.md) | `$9087BA` | 303 |
| `4C` | 6 | `projectile $id, dx, dy, dz` | Spawn a projectile at an offset | `$908725` | 58 |
| `50` | 5 | `hurtbox x, y` | Move the hurt box (`+0x42`, `+0x44`) | `$9085A8` | 21 |
| `48` | 1 | — | Weapon counter reset/tick (bone-slash trace) | `$908810` | 108 |
| `49`, `4A` | 3 | — | A word; weapon sound / projectile trigger (bone-slash trace) | `$90882D`/`$908843` | 6 / — |
| `58`, `59` | 1 | — | Clear / start the weapon slash overlay (bone-slash trace) | `$90887B`/`$9088AE` | — |

### State and effects

| Op | Bytes | Mnemonic | Meaning | Handler | Census |
|---|---|---|---|---|---|
| `2E` | 2 | `sound n` | Probably a sound effect: `n` indexes `$8C8362` → `$8C82DC`. Skipped when off-screen. *Meaning unverified* | `$908921` | 294 |
| `2F` | 2 | `sound_maybe n` | Same as `2E`, but only when a random word has `$C000` set (≈75%) | `$90894E` | — |
| `3F` | 3 | — | If the word is non-zero, calls `$8C81FD` | `$9088BC` | 24 |
| `40` | 3 | — | A word, then `$8C81FD`. Aborts **without** advancing when off-screen | `$9088F3` | 115 |
| `4B` | 3 | — | A word, then `$90CD5C` | `$90885A` | 1 |
| `4D` | 3 | `mode n` | Word into `+0x16` (animation mode flags) | `$908485` | 557 |
| `4E` | 1 | — | Clears `+0x2E` and bit `$0200` of `+0x14` | `$908495` | 135 |
| `4F` | 1 | — | Clears bits `~$FB87` of `+0x12`, if `+0x2A` set and `+0x76` clear | `$9084A7` | 194 |
| `56` | 3 | — | A formula index; greys out a ring-menu icon via `$91CE38` | `$90878C` | — |
| `5A` | 2 | — | Byte into `+0x82` | `$908447` | 22 |
| `5D` | 1 | — | Sets bit 1 of `+0x26` | `$908C75` | — |

**Not decoded**: `3C`–`3E`, `51`, `55`, `5C`, `5E`–`66`. They have handlers,
but no character script uses them. `3C` reads at least four words and sets up
a DMA-like transfer, so it is not a small command.

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

## Census

Over every character, every animation field `+0x32..+0x42`, every facing:

| | |
|---|---|
| Distinct scripts | 845 |
| Reach their own `loop` | **823** |
| Stop on `0x57` (Tar Skull, Salabog) | 22 |
| Most-used commands | `42 step` 1930, `41 step0` 1599, `21 nop` 803 |

## Gaps

- **`0x57`** needs an emulation of `$8FCA02` or a trace of one of its two
  bosses animating.
- **`0x3B`** is an unconditional jump. A linear walk must follow it, not step
  over it. The decoder in `src/maps/character-animation.ts` deliberately has
  no width for it, so a walk stops there rather than reading the wrong bytes.
- **`0x39`/`0x3A`** fall through once a static walk reaches them, so a viewer
  plays a counted loop's body once, not `n` times.
- **Names marked unverified** (`sound`, `0x3F`, `0x40`, the `0x48`–`0x4A` and
  `0x58`/`0x59` weapon commands) describe what the handler calls, not a
  confirmed effect on screen.
