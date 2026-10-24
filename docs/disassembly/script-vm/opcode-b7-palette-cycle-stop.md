# Script Opcode 0xB7: Stop a Palette Cycle

**Handler entry:** `$8C:E88A`\
**Palette slot mapping/loading:** `$8C:E899`\
**Cycle-speed words:** `$7E:13D2 + X`\
**Opcode table entry:** `$8C:EA2B`\
**Operand:** palette expression\
**Confidence:** operand flow, indexed speed clear, and continuation confirmed

## Control Flow

The handler evaluates a palette expression and pushes the result before calling
`$8C:E899`. That helper transforms A to select/load the palette source, returning early
for values below `$08`. The caller then restores the original expression into X with
`PLX`, clears the word at `$7E:13D2 + X`, sets carry, and returns. The cycle-speed
index is therefore the raw expression value; it is not the helper's transformed palette
index.

## Model

[`reconstructed-c/8C/8CE88A_opcode_b7_palette_cycle_stop.c`](../../../reconstructed-c/8C/8CE88A_opcode_b7_palette_cycle_stop.c)
models the raw-expression indexed clear after the palette loader call.

## Evidence

- `$8C:E88A` evaluates and pushes the palette, calls `$8C:E899`, then clears
  `$13D2,X` and returns carry set.
- `$8C:E899` transforms A for palette-source selection, but B7 restores the original
  expression from the stack before indexing `$13D2`.