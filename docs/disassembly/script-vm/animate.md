# Script Opcode 0x78: Animate an Entity

**Handler:** `$8C:E0B0`–`$8C:E0FF`\
**Dispatch table:** `$8C:E100`–`$8C:E10B` (six little-endian targets)\
**Confidence:** direct control flow and writes confirmed; mode-10 helper effects unresolved

## Operand Order and Entity Gate

The handler evaluates the entity expression first (`$8C:EC8E`), reads the following
animation word directly through `[$82]` and advances `$82` twice, then evaluates the mode
expression (`$8C:EA43`). The animation word is held while the mode is evaluated.

For an entity address below `$4E89`, the handler reads HP at `+$2A`. If HP is zero, it
skips the normal setup when either `+$10 & $0008` is nonzero or `$23D9` is zero. The skip
path clears `$23D9`, removes the saved animation word, sets carry, and returns. Addresses
at or above `$4E89`, or nonzero HP, proceed without this gate.

The normal path clears `$23D9`, writes `$0400` to `+$2E`, changes `+$10` to
`(old | $0040) & $DFFE` (sets `$0040`, clears `$2001`), and clears bits `$0300` at `+$12`.

## Mode Dispatch

`JMP ($E100,X)` uses the expression result as a byte offset. The six valid even offsets
and their ROM targets are:

| Mode | Target | Direct effect before the common start path |
|---:|---:|---|
| 0 | `$8C:E139` | None |
| 2 | `$8C:E115` | `+$12 |= $0200` |
| 4 | `$8C:E11D` | `+$12 |= $0100` |
| 6 | `$8C:E10C` | Clear words at `+$03` and `+$01` |
| 8 | `$8C:E125` | `+$10 |= $0001` |
| 10 | `$8C:E17B` | Separate helper-driven path; does not branch to the common animation start |

Targets `$E10C`, `$E115`, `$E11D`, and `$E125` branch to `$E139`. The bytes at
`$E130` set `+$10 |= $2000`, but `$E130` is not one of the six table targets and valid
even modes 0–8 branch around it. Do not attribute that write to a valid mode without
additional evidence. Odd modes read misaligned words; values above 10 read beyond this
six-entry table and are not reconstructed as defined behavior.

## Common Animation Start

At `$E139`, the saved animation word is removed into X. If its high bit is clear, the
handler reads the word at `$C4:3C92 + animation_word`. If the high bit is set, it masks
off `$8000`, adds the entity's word at `+$60`, and reads a word at `$8E:0032 + index`.
The selected word is passed in X to `$90:8124`; this helper's internal effects are not
inferred here. The common path sets carry and returns at `$E155`.

## Mode 10 Path

The `$E17B` target makes the following opaque calls, in order: `$8E:E56A`, `$80:8FEE`,
`$80:858C`, `$8C:AF23`, `$8C:B743`, and `$8D:8000`. It then clears `$0106`, writes
`$800F` to `$0B83`, fetches one additional word through `[$82]`, and uses that value as
an index for reads at `$8C:E1FF + index` and `$8C:E1FD + index`. The low byte of the
first read is stored at DP `$24`; the second word is stored at DP `$22`. When the second
word equals `$2234`, it writes `$60AC` to DP `$26`, `$00C4` to DP `$28`, and calls
`$80:B149`.

It then calls `$8D:82CB`, `$8E:E56A`, `$80:8FEE`, `$8C:AF23`, `$8E:E08B`, `$90:92C7`,
`$80:858C`, `$8C:AB10`, and `$8F:87FE` (with `$0F3E` in X), clears `$0106`, restores
`$0B83 = $800F`, executes `PLB`, sets carry, and returns at `$E1FC`. The meanings of
these helper calls and the indexed ROM data are unresolved. Unlike the common path, this
path does not visibly remove the saved animation word with `PLX`/`PLA`; the final `PLB`
and any opaque helper stack effects leave its stack/data-bank interaction unresolved. It
does not visibly load an animation id or call `$90:8124`; the enum label `PAUSE` for mode
`$0A` does not by itself establish the path's behavior.

## Reconstruction

The host-side control-flow model is in
[`reconstructed-c/8C/8CE0B0_opcode_78_animate.c`](../../../reconstructed-c/8C/8CE0B0_opcode_78_animate.c).
It represents direct memory writes and call order, while helper internals, data-bank
changes, CPU stack details, and invalid dispatch indices remain outside the model.

## Evidence and Boundaries

- `$8C:E0B0` is the opcode-table target; the indirect jump occupies `$E0FD`–`$E0FF`.
- Six words occupy exactly `$E100`–`$E10B`; `$E10C` begins the first target's code.
- `$E139` ends with `RTS` at `$E155`; `$E17B` ends with `RTS` at `$E1FC`.
- `$E1FD` and `$E1FF` are indexed by the mode-10 operand, but their table extent is not established here.
- The dispatch table and routine limits come from address-aligned VFS disassembly reads of the vanilla ROM.