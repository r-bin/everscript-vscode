# Script Opcode 0x5B: Wait for Dialogue

**Handler:** `$8C:DE95`\
**Operands:** none\
**Confidence:** confirmed

The handler calls `$8C:C609` and returns carry set. The helper synchronously runs field-frame ticks through `$8E:E41E` while `$7E:0B79` bit `$80` remains set, then activates the next queued dialogue through `$8C:C55D`. If bit `$40` is set, it skips the wait/advance path. This is an internal blocking loop, not a VM yield.

The host-side opcode model is [8CDE95_opcode_5b_wait_dialogue.c](../../../reconstructed-c/8C/8CDE95_opcode_5b_wait_dialogue.c); the helper loop is delegated to `dialogue_wait_until_ready_and_advance`.

## Evidence

- Opcode table entry `$8C:E973` dispatches to `$8C:DE95` with no operands.
- `$8C:DE95` calls `$8C:C609`, then executes `SEC; RTS`.
- `$8C:C609` tests `$0B79 & $0040`, then `$0B79 & $0080`; it loops on `$8E:E41E` while bit `$80` remains set and calls `$8C:C55D` after the loop.