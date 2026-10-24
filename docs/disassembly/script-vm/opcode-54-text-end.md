# Script Opcode 0x54: Close Text Window and Continue Dialogue

**Handler:** `$8C:D97C`\
**Operand:** `u8` window index\
**Confidence:** confirmed

The handler resolves the selected window record using `$8C:D967`, closes that window through `$8C:ADE5`, then activates the next queued dialogue through `$8C:C55D`. It returns carry set and does not yield, so the current script continues in the same turn.

The host-side model is [8CD97C_opcode_54_text_end.c](../../../reconstructed-c/8C/8CD97C_opcode_54_text_end.c). It delegates window resolution, close behavior, and queued-dialogue activation to named helpers.

## Evidence

- Opcode table entry `$8C:E965` dispatches to `$8C:D97C` with one byte operand.
- `$8C:D967` reads the operand through `[$82]`, advances `$82`, and computes the descriptor offset from base `$034D` with a `$2C`-byte stride.
- `$8C:D97C` calls `$8C:D967`, passes the selected descriptor to `$8C:ADE5`, calls `$8C:C55D`, restores the saved descriptor offset, and executes `SEC; RTS`.