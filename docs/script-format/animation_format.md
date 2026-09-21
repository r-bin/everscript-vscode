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
distance `$5D` moves between consecutive reads is that command's length —
**but only when the reads belong to the same entity**. The trace line
carries `Y`, the entity pointer; pairing without grouping by it produced a
wrong length for `0xa4` (5 instead of 3). It happened to change nothing,
verified by diffing every enemy's resolved sprite before and after, but the
rule is: group by `Y`, and re-check that a new length alters no
already-resolved sprite.

## Facing

`anim_stand` is the default idle and the sprites it yields face the camera —
the flower, mosquito, bee, chameleon and villagers all render front-on. No
direction selection is implemented, and none was needed for these; whether
other directions live in separate animations has not been investigated.

## Still missing

Twenty enemies stop before any sprite command, on `0x1e`-adjacent unknowns:
**`0x32` (13), `0x42` (9), `0x47` (5), `0x50` (4), `0x21` (5), `0x57` (2),
`0x2d` (1), `0x46` (1)**. Multi-frame walks stop sooner than single-frame
ones, so only a handful animate today.

Both traces so far covered act-1 field enemies. A trace of a boss or a
later-act room would extend the table — ideally with **one** entity
animating, for the reason above.
