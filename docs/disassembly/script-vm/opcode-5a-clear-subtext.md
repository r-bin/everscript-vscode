# Script Opcode 0x5A: Clear Subtitles and Wait

**Handler:** `$8C:DE8F`\
**Operands:** none\
**Confidence:** confirmed

The handler calls `$8C:C5E2` and returns carry set. That helper activates the cutscene pause guard (`$8C:C543`), resets the subtitle queue and clears its active window (`$8C:C4F6`), then runs field-frame ticks through `$8E:E41E` while bit `$40` of `$7E:0B79` indicates subtitle text is still moving. This is a synchronous wait inside the helper, not a VM yield.

The host-side opcode model is [8CDE8F_opcode_5a_clear_subtext.c](../../../reconstructed-c/8C/8CDE8F_opcode_5a_clear_subtext.c); the full field-frame loop is delegated to `dialogue_subtitle_clear_and_wait`.

## Evidence

- Opcode table entry `$8C:E971` dispatches to `$8C:DE8F` with no operands.
- `$8C:DE8F` calls `$8C:C5E2`, then executes `SEC; RTS`.
- `$8C:C5E2` calls `$8C:C543` and `$8C:C4F6`; it tests `$0B79 & $0040` and repeatedly calls `$8E:E41E` until the bit clears.