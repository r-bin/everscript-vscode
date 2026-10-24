# Script Opcode 0x55: Close Default Text Window

**Handler:** `$8C:D988`\
**Operands:** none\
**Confidence:** confirmed

Opcode `0x55` closes the default text window at `$7E:034D` through `$8C:ADE5`, then activates the next queued dialogue through `$8C:C55D`. It returns carry set, continuing the script in the same VM turn.

The host-side model is [8CD988_opcode_55_text_end.c](../../../reconstructed-c/8C/8CD988_opcode_55_text_end.c). Window close and queued-dialogue activation are delegated to named helpers.

## Evidence

- Opcode table entry `$8C:E967` dispatches to `$8C:D988` with no operands.
- `$8C:D988` loads `$034D` into Y, calls `$8C:ADE5`, preserves the descriptor offset across `$8C:C55D`, restores it, and executes `SEC; RTS`.