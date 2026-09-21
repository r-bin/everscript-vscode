# The animation format

> Status: **mostly solved.** `src/maps/characters.ts`. Idle sprite for
> **121 of 141** enemies; a multi-frame animation for those whose script
> walks far enough.

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

## Command classes, from the dispatch table

Grouping the 128 entries at `$908000` by handler address gives the families
directly, which is better evidence than measuring one opcode at a time:

| Handler | Commands | Meaning |
|---|---|---|
| `$90836C` | `0x01`–`0x1e` | Hold the current frame for `cmd` ticks |
| `$90835A` | `0x20` | Hold for the **next byte's** ticks (2 bytes) |
| `$908418` | `0x22`–`0x2b` | Set sprite; bank = `cmd + 0xA8` (3 bytes) |
| `$90878A` | `0x00` | No-op |

Other lengths were measured from the trace: `0x2c`:4, `0x2e`:2, `0x41`:2,
`0x4d`:3, `0x52`:1, `0x53`:2, `0x54`:3, `0x5a`:2. A command with no known
width stops the walk rather than being skipped by a guess.

## Measuring lengths correctly

The interpreter reads its next command with `LDA [$5D]` at `$9080F0`, so the
distance `$5D` moves between consecutive reads is that command's length.
Two rules make that sound, and both were learned by getting them wrong:

1. **Pair reads for the same entity.** The trace line carries `Y`, the
   entity pointer. Without grouping by it, interleaved animations invent
   widths — this produced 5 instead of 3 for `0xa4`.
2. **Never measure from a command with bit 7 set.** It ends the frame, so
   the next read happens a game-frame later and the gap stops being a width.
   This is what made `0x42` look like 4 or 5 when it is 2.

Applying both across three traces takes the ambiguous count from three to
**zero**. `0x42` is the one exception, resolved from structure instead:
reading it as 2 makes the following bytes a set-sprite and yields exactly
the two frames the game was traced drawing for a Mosquito.

And always re-check that a new length alters no already-resolved sprite.

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

The `0x40` form is by far the common one, and missing it is why most NPCs
were drawn in their first pose — which happens to be north-facing.

**Entity `+0x22` holds the facing, and south is 8.** Both the spawn routine
(`$8FB0CD`) and the FACE SOUTH opcode (`$8CDEFC`) write 8, so an unposed
enemy already faces the camera — which is why the non-directional ones
looked right before any of this was understood.

Confirmed against the game: a Viper (character 92) made to face south draws
`$CD2C66`, and `anim_stand + 2*8` resolves to exactly that. Reading its
record without the facing gives `$CD2CF5`, a different pose.

## Placement: sprites anchor at their feet

Chunk offsets are signed around an origin that is **not** the sprite's
centre — a 32×32 Wimpy Flower has its origin at y=25. Placing a sprite by
its centre therefore drops it about a tile low, and frames of different
sizes jitter against each other.

`renderCharacterFrames` blits every frame into one box large enough for all
of them, aligned on that origin, so a caller positions by the origin alone
and the animation stays still while it plays.

## Coverage

**122 of 141** characters resolve to a sprite; **36** have a real animation
(more than one distinct sprite). The Mosquito flaps between `$CC5B38` and
`$CC5B3F` — the exact pair the game was traced drawing, 28 and 27 times
alternating.

## Still missing

Twenty enemies stop before any sprite command, on `0x1e`-adjacent unknowns:
**`0x32` (13), `0x42` (9), `0x47` (5), `0x50` (4), `0x21` (5), `0x57` (2),
`0x2d` (1), `0x46` (1)**. Multi-frame walks stop sooner than single-frame
ones, so only a handful animate today.

Both traces so far covered act-1 field enemies. A trace of a boss or a
later-act room would extend the table — ideally with **one** entity
animating, for the reason above.
