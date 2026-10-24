# Script Opcode 0x7F: Name Entry

**Handler:** `$8C:E17A`\
**Operand:** inline `u16` selector\
**Reachability:** 1 statically reachable instruction\
**Confidence:** setup and call sequence confirmed; native name-entry UI delegated

The handler prepares the field/cutscene state and calls `$8D:8000`, then fetches a selector word and reads the name-buffer pointer and descriptor bytes from ROM tables at `$8C:E1FD` and `$8C:E1FF`. When the selected pointer is `$2234` (the Dog's name buffer), it sets DP `$26 = $60AC` and `$28 = $00C4` and calls `$80:B149` to copy the default name. It then runs the name-entry and field-restoration call sequence, passing WRAM `$0F3E` to `$8F:87FE`, clears the `$0106` shadow word, restores `$0B83 = $800F`, and returns carry set.

The host-side model is [8CE17A_opcode_7f_name_entry.c](../../../reconstructed-c/8C/8CE17A_opcode_7f_name_entry.c). Calls into `$8D`, `$8E`, `$8F`, and `$90` routines remain explicit native boundaries; their UI and hardware internals are not reimplemented here.

## Evidence

- Opcode table entry `$8C:E9BB` dispatches to `$8C:E17A`; the selector is fetched inline from `[$82]` and `$82` advances twice.
- The handler reads ROM data at `$8C:E1FD,X` and `$8C:E1FF,X`, places the results in DP `$22` and `$24`, and branches on `$22 == $2234`.
- The Dog branch sets DP `$26/$28` to `$60AC/$00C4` and calls `$80:B149`.
- The handler calls `$8D:8000` and `$8D:82CB`, performs its final frame/UI handoffs, restores `$0106` and `$0B83`, and returns carry set.