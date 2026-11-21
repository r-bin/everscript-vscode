# Script Opcode 0x78: Animate an Entity

**Handler:** `$8C:E0B0`–`$8C:E0FF`\
**Dispatch table:** `$8C:E100`–`$8C:E10B` (six little-endian targets)\
**Confidence:** direct control flow and writes confirmed

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

`JMP ($E100,X)` uses the expression result as a byte offset. The six words at `$8C:E100` (`39 E1 15 E1 1D E1
30 E1 0C E1 25 E1`, read 2026-11-21; an older version of this page had modes 6, 8 and 10 wrong) are:

| Mode | Target | Compiler name | Direct effect before the common start path |
|---:|---:|---|---|
| 0 | `$8C:E139` | ONCE | None |
| 2 | `$8C:E115` | ONCE_FREEZE | `+$12 |= $0200` |
| 4 | `$8C:E11D` | LOOP | `+$12 |= $0100` |
| 6 | `$8C:E130` | FREEZE | `+$10 |= $2000` |
| 8 | `$8C:E10C` | — | `TDC`, then clear words at `+$03` and `+$01` |
| 10 | `$8C:E125` | PAUSE | `+$10 |= $0001` |

Every target ends at `$E139`: `$E10C`, `$E115`, `$E11D` and `$E125` branch there, `$E130` falls through. Modes
6 and 10 set again a bit the common path has just cleared (`& $DFFE`). Odd modes read misaligned words; values
above 10 read the code after the table. Open Evermore writes the modes as `characters/animation_modes/`.

## Common Animation Start

At `$E139`, the saved animation word is removed into X. If its high bit is clear, the
handler reads the word at `$C4:3C92 + animation_word`. If the high bit is set, it masks
off `$8000`, adds the entity's word at `+$60`, and reads a word at `$8E:0032 + index`.
The selected word is passed in X to `$90:8124`; this helper's internal effects are not
inferred here. The common path sets carry and returns at `$E155`.

## Reconstruction

The host-side control-flow model is in
[`reconstructed-c/8C/8CE0B0_opcode_78_animate.c`](../../../reconstructed-c/8C/8CE0B0_opcode_78_animate.c).
It represents direct memory writes and call order; `$90:8124`'s internals and invalid dispatch
indices remain outside the model.

## Evidence and Boundaries

- `$8C:E0B0` is the opcode-table target; the indirect jump occupies `$E0FD`–`$E0FF`.
- Six words occupy exactly `$E100`–`$E10B`; `$E10C` begins the first target's code.
- `$E139` ends with `RTS` at `$E155`.
- `$E17A`, once read as a mode-10 path, is opcode `0x7F`'s handler (the opcode table at `$8C:E9BB`), not a
  table target.
- The dispatch table and routine limits come from address-aligned VFS disassembly reads of the vanilla ROM.