# The animation format

> Status: **solved.** `src/maps/characters.ts`. **139 of 141** enemy walks
> now end on the script's own loop command, so the whole idle cycle is read
> rather than a prefix of it.

This is the one thing the encoder could not answer — it is engine behaviour
with no compiler counterpart. `animate(entity, mode, id)` emits opcode
`0x78` with a small animation id, a different space from `anim_stand`. A
Mesen trace of spawning a Mosquito settled it after five wrong guesses.

## The chain

```
8FC50A  LDA $8E0032,X [$8ED754] = $4A36   ; anim_stand, character record +0x32
8FC50F  JSL $90817B
90817B    LDA $C40000,X [$C44A36] = $0CFA  ; -> a 24-bit animation script pointer
```

| Step | Where |
|---|---|
| Character record | `$8EB678 + id * 74` |
| Idle animation | record `+0x32` (`anim_stand`) |
| Animation script | 24-bit pointer at `$C40000 + anim_stand` |
| Sprite command | first masked opcode in `0x22..0x2b` |
| Sprite pointer | `((cmd + 0xA8) << 16) \| <u16 operand>` |
| Palette | record `+0x09`, an address within bank `$90` |

## Bit 7 means "end of frame", not a different opcode

The dispatch makes this explicit — **both paths index the same table with
`(cmd & 0x7f) * 2`**:

```
9080F0  LDA [$5D]        ; the command
9080F2  ASL              ; carry = bit 7, A = (cmd & 0x7f) * 2
9080F9  TAX
9080FA  BCC $9080EC      ; bit 7 clear: dispatch and keep going
9080FC  JSR ($8000,X)    ; bit 7 set: dispatch, then...
908100  DEC $0005,X      ; ...tick the entity's frame timer and return
```

So `0xa4` is command `0x24` — a set-sprite — that also ends the frame.
Reading the high opcodes as distinct commands is what made the Wimpy Flower
look undecodable.

## `0x2d` is where a script loops

Its handler is five instructions long and says so outright:

```
90877D  REP #$20
90877F  LDA $0003,Y     ; the script's start, saved when the animation was chosen
908782  STA $0000,Y     ; ...becomes the running pointer again
908785  STA $5D
908789  RTS
```

`$0003,Y` is written by `$90817F` when an animation is selected, so this is
a jump back to the first command. **A walk that reaches `0x2d` has seen the
entire cycle**, and a walk that steps over it runs into whatever script was
assembled next in the bank. That was the Wimpy Flower's bug: its idle is one
held frame followed by `0x2d`, and reading past it played two frames of its
attack.

`0x53` can do the same thing conditionally — `$9083C7 BNE $90840D` lands on
the identical restart when the entity is in state `$0100` — but on the 157
occasions it was traced it fell through as an ordinary one-byte command.

## How long a frame lasts

The frame timer is entity `+0x05`, and the end-of-frame path is the whole
story:

```
908100  DEC $0005,X      ; the frame timer
908103  BEQ $908108      ; still counting? then...
908107  RTL              ; ...leave the saved pointer where it was
908108  LDA #$01
90810A  STA $0005,X      ; expired: back to one
90810F  LDA $5D
908111  STA $0000,X      ; ...and only now step past the command
```

So a frame-ending command is **re-executed from the same point every game
frame** until the timer runs down; only then does the script advance. A hold
command is what loads that timer (`$90836C` stores the opcode itself into
`+0x05`, `$90835A` stores its operand), and the timer starts at 1
(`$908192`) and returns to 1 whenever it expires.

Two consequences, both visible on screen:

- A bit-7 command with no hold before it shows its sprite for exactly **one**
  frame — not for however long the last hold was.
- A script can end a frame several times without changing the sprite, so
  frames that repeat a sprite are merged, including across the loop point.
  The Wimpy Flower's idle merges to a single 102-frame still, which is what
  the game shows.

## Command classes, from the dispatch table

Grouping the 128 entries at `$908000` by handler address gives the families
directly, which is better evidence than measuring one opcode at a time:

| Handler | Commands | Meaning |
|---|---|---|
| `$90836C` | `0x01`–`0x1e` | Hold the current frame for `cmd` ticks |
| `$90835A` | `0x20` | Hold for the **next byte's** ticks (2 bytes) |
| `$908418` | `0x22`–`0x2b` | Set sprite; bank = `cmd + 0xA8` (3 bytes) |
| `$90878A` | `0x00`, `0x21` | No-op, one byte — a bare frame boundary |
| `$90877D` | `0x2d` | Restart the script |
| `$9087BA` | `0x47` | **Strike**: a box at an offset (5 bytes) — [attack_boxes.md](attack_boxes.md) |
| `$908725` | `0x4c` | Throw a projectile at an offset (6 bytes) |
| `$9085A8` | `0x50` | Move the hurt box (`$0042`/`$0044`, 5 bytes) |
| `$908453` | `0x52` | Reset: clears the sprite and puts the hurt box back |

## Measuring lengths

The first method — pairing consecutive `$5D` reads — needed two correction
rules and still threw away every pair that crossed a frame boundary. Its
survivors gave `0x53` a width of 2 that the game does not use.

**The interpreter states each length directly instead.** A command is read at
`$9080E3` (first of a frame) or `$9080F0` (the rest), and the trace line
prints the *effective address*. When the command ends the frame, `$90810F
LDA $5D` prints where execution resumes. So:

- length = the gap between two printed addresses inside one call;
- for a frame-ending command, the gap to the pointer `$90810F` saved.

Nothing has to be discarded, and nothing can be contaminated by another
entity, because one call serves one entity from start to end. Across the
three traces this yields **29 opcodes, each with exactly one observed
width**.

```
0x00:1  0x01-0x1e:1  0x1f:3  0x20:2  0x21:1  0x22-0x26:3  0x2c:4  0x2e:2
0x41:1  0x42:2  0x47:5  0x4d:3  0x4e:1  0x4f:1  0x52:1  0x53:1  0x54:3
```

## Lengths the handler gives, where no trace runs the command

Five opcodes stopped the last enemies and appear in no trace. They still do
not have to be guessed: the interpreter advances `$5D` by one for the opcode,
and each handler advances it for its own operands, in plain sight.

| Cmd | Handler | What it does | Length |
|---|---|---|---|
| `0x44` | `$9086D4` | compares `$001E,Y`, may bump the frame timer | 1 |
| `0x45` | `$9086E5` | reads a word into `$0020,Y`, then `LDX $5D; INX; INX` | 3 |
| `0x46` | `$9086FE` | two paths, both reaching the same `INX INX` | 3 |
| `0x50` | `$9085A8` | `LDA [$5D]` twice, 16-bit, `INX INX` after each | 5 |
| `0x5a` | `$908447` | `LDA [$5D]; STA $0082,Y; INC $5D` | 2 |

Every path through each handler was followed to its `RTS`; none of the
advances is conditional. `0x5a` is the check on the method — the trace
measured it at 2 as well.

**`0x57` is genuinely variable** and is left unknown. It calls `$8FCA02`,
which walks a list of its own through `$5D` and writes back wherever it
stopped (`$8FCA4D STY $5D`). Only the two segmented bosses use it.

Seven more came from the same reading, for the **attack** animations, which
idle scripts never reach:

| Cmd | Handler | What it does | Length |
|---|---|---|---|
| `0x32` | `$908B00` | a byte, then a word, stored through `($12),Y` | 4 |
| `0x38` | `$908B6C` | one byte, written twice through `($12),Y` | 2 |
| `0x40` | `$9088F3` | a word, then `JSL $8C81FD` | 3 |
| `0x43` | `$9086C3` | holds while `$001E`/`$0020,Y` are non-zero | 1 |
| `0x4b` | `$90885A` | a word, then `JSL $90CD5C` | 3 |
| `0x4c` | `$908725` | a word and three signed bytes — a projectile | 6 |
| `0x5b` | `$9085C1` | stores the entity's position for its facing | 1 |

`0x40` has a caveat: when the entity is outside the live range or
`$0014,Y & $0020` is set, the handler returns at `$908920` **without**
advancing `$5D`. That is a runtime abort, not a second encoding — the operand
is still in the script — so a static walk reads three bytes.

Adding all seven changed **no idle walk**: all 141 characters produce
byte-identical frames before and after, which is the check that a wrong width
would fail loudly.

## Facing

**Animations can come in a set, one per direction.** `$908124` decides:

```
908124  LDA $C40002,X    ; the record's bank + flags
908128  BMI $908150      ; bit 7 of flags: directional
908150  TXA
908152  ADC $0022,Y      ; + the entity's facing
908155  ADC $0022,Y      ; ... twice, so the stride is 2 per step
908139  LDA $C40000,X    ; the selected record
```

A record is `[scriptLow:u16][bank:u8][flags:u8]`, and **two** flag bits mean
"directional":

| Flags | Selection | Characters |
|---|---|---|
| bit 7 (`0x80`) | `anim_stand + 2 * facing` — eight poses | 7 |
| bit 6 (`0x40`) | `anim_stand + table[facing]`, table at `$90815B` — four poses | 85 |
| neither | one pose for every direction | 49 |

```
90812A  BIT #$4000
90812D  BEQ $908139      ; neither bit: use this record
908130  LDX $0022,Y      ; the facing
908134  ADC $90815B,X    ; + the table entry
```

The table at `$90815B` maps the sixteen facings onto four records —
`{0:0, 2:4, 4:4, 6:4, 8:8, 10:12, 12:12, 14:12}` — so these characters have
north, east, south and west and nothing between.

**Entity `+0x22` holds the facing, and south is 8.** Both the spawn routine
(`$8FB0CD`) and the FACE SOUTH opcode (`$8CDEFC`) write 8, so an unposed
enemy already faces the camera.

Confirmed against the game: a Viper (character 92) made to face south draws
`$CD2C66`, and `anim_stand + 2*8` resolves to exactly that. Reading its
record without the facing gives `$CD2CF5`, a different pose.

The 49 single-pose characters are bosses, statues, flowers and seated NPCs —
the ROM holds one drawing of each, and the game shows that one whichever way
the character is turned.

## Placement: sprites anchor at their feet

Chunk offsets are signed around an origin that is **not** the sprite's
centre — a 32×32 Wimpy Flower has its origin at y=25. Placing a sprite by
its centre therefore drops it about a tile low, and frames of different
sizes jitter against each other.

`renderCharacterFrames` blits every frame into one box large enough for all
of them, aligned on that origin, so a caller positions by the origin alone
and the animation stays still while it plays.

## Coverage

| | |
|---|---|
| Walks that end on the script's own loop | **139 / 141** |
| Characters that resolve to a sprite | **126 / 141** |
| Characters with more than one distinct sprite | **37** |

The 15 that draw nothing are not failures: 13 have an idle script that sets
no sprite at all — `$C70080` is `d2 1e 80 d3 2d`, a loop that holds nothing —
and they are the invisible helper entities (`PLACEHOLDER`, `FAN_ENTITY`,
`SPEAKER_ENTITY`, the tentacle and Thraxx-arm stand-ins). The game does not
draw them either.

The Mosquito flaps between `$CC5B38` and `$CC5B3F`, two frames each — the
exact pair the game was traced drawing, 28 and 27 times alternating.

## Still missing

`0x57`, and only for **BONE_SNAKE** and **SALABOG**. Its operand is a list
whose length is computed at run time, so it needs either an emulation of
`$8FCA02` or a trace in which one of those two bosses animates.
