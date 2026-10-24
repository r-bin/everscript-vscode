# Script Opcode 0x79: Animate Entity and Wait

**Handler:** `$8C:E156`\
**Operands:** entity expression, animation word, mode expression\
**Reachability:** 89 statically reachable instructions\
**Confidence:** confirmed

The handler calls opcode `0x78` at `$8C:E0B0` to start the requested animation. It then checks the entity's waiter field at `+$88`. If no waiter is registered, it associates the current script slot with the entity, sets that slot's state at `+$03` to `6`, sets entity `+$8A` and slot `+$05` to `$20`, and clears slot `+$09`. If a waiter already exists, it leaves the existing registration unchanged. Both paths return carry clear to yield.

The host-side model is [8CE156_opcode_79_animate_and_wait.c](../../../reconstructed-c/8C/8CE156_opcode_79_animate_and_wait.c), composed with the shared [opcode 0x78 model](../../../reconstructed-c/8C/8CE0B0_opcode_78_animate.c).

## Evidence

- Opcode table entry `$8C:E9AF` dispatches to `$8C:E156`.
- `$8C:E156` calls `$8C:E0B0`, then tests entity `+$88`.
- When `+$88` is zero, the handler stores the current slot at entity `+$88`, writes `6` to slot `+$03`, `$20` to entity `+$8A` and slot `+$05`, and zero to slot `+$09`.
- Both branches reach `CLC; RTS`.