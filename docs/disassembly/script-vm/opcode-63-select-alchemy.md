# Script Opcode 0x63: Alchemy Selection Screen

**Handler:** `$8C:DF75`\
**Operands:** none\
**Reachability:** 50 statically reachable instructions\
**Confidence:** confirmed call sequence

The handler temporarily switches its data bank to `$80`, leaves field mode, initializes and draws the full-screen selection menu, writes `$0000` to `$0106` and `$800F` to `$0B83`, and calls `$8D:B98F` to run the alchemy-selection UI. It then restores field/menu state through the observed engine routines, waits for an NMI frame, restores camera behavior using entity `$0F3E`, repeats the two WRAM writes, restores the prior data bank, and returns carry set.

The host-side model is [8CDF75_opcode_63_select_alchemy.c](../../../reconstructed-c/8C/8CDF75_opcode_63_select_alchemy.c). UI, field, and camera engine routines remain named external boundaries; the model preserves the disassembled call order rather than reimplementing those subsystems.

## Evidence

- Opcode table entry `$8C:E983` dispatches to `$8C:DF75`.
- The routine saves DBR, loads DBR `$80`, and calls `$8E:E56A`, `$80:8FEE`, `$80:858C`, `$8C:AF23`, `$8C:B743`, and `$8D:B7D6` before setting `$0106 = 0`, `$0B83 = $800F`, and calling `$8D:B98F`.
- The return path calls `$8E:E56A`, `$80:8FEE`, `$8C:AF23`, `$8E:E08B`, `$90:92C7`, `$80:858C`, and `$8C:AB10`; it loads `$0F3E` into X for `$8F:87FE`, repeats the two WRAM writes, restores DBR, and returns carry set.