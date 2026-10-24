# Script Opcode 0x8C: Save Menu

**Handler:** `$8C:E39A`–`$8C:E404`\
**Opcode table entry:** `$8C:E9D5`\
**Operand:** one word string key\
**Confidence:** direct call order and WRAM accesses confirmed; helper effects are not modeled

## Control Flow

The handler preserves the current data bank, switches to bank `$80`, and performs the
following calls in ROM order:

1. `$8E:E56A`, `$80:8FEE`, `$80:858C`, `$8C:AF23`, `$8C:B743`
2. `$8D:CF1A`
3. Fetch a word through `[$82]`, advance `$82` twice, and pass that key to `$8C:CD33`
4. Clear `$0106`, set `$0B83 = $800F`, then call `$8D:D303`
5. `$8E:E56A`, `$80:8FEE`, `$80:858C`, `$8C:AF23`, `$8E:E08B`, `$90:92C7`, `$80:858C`, `$8C:AB10`
6. Clear `$143A`, call `$8F:87FE` with the word at `$0F3E` in X, clear `$0106` again,
   and set `$0B83 = $800F` again

Finally, it restores the preserved data bank, sets carry, and returns. The exact purpose of
the helper calls is not inferred beyond the labels present in the disassembly. In
particular, this model does not claim what the save-menu calls do internally or how the
string resolver uses the key after it is supplied.

## Reconstruction

The call-order and direct-memory model is in
[`reconstructed-c/8C/8CE39A_opcode_8c_save_menu.c`](../../../reconstructed-c/8C/8CE39A_opcode_8c_save_menu.c).
The bank-switch prologue and restoration are represented as explicit host abstractions;
the C model does not emulate the 65816 stack byte-for-byte.

## Evidence and Boundaries

- The opcode table at `$8C:E9D5` points to `$8C:E39A`.
- `$8C:E39A` begins with `PHB; PEA $8080; PLB; PLB`; `$8C:E402` restores the saved bank
  with `PLB`, then `$8C:E403` sets carry and `$8C:E404` returns.
- `$8C:E405` begins opcode `0x23`, confirming the handler boundary.
- Direct WRAM writes are to `$0106`, `$0B83`, and `$143A`; `$0F3E` is loaded into X for
  `$8F:87FE`.