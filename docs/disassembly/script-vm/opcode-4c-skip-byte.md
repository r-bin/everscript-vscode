# Script Opcode 0x4C: Skip One Byte

**Routine:** `$8C:D87C`\
**Range:** `$8C:D87C`–`$8C:D87F`\
**Confidence:** confirmed instruction sequence; pointer width follows the VM entry state

## Behavior

The handler executes `INC $82; SEC; RTS`. The VM dispatcher runs with 16-bit A/X, so the direct-page increment advances the 16-bit script-pointer low word at `$82` by one. The bank byte at `$84` is not part of this increment. Carry is set on return, so the dispatcher continues the current thread in the same turn.

The host-side model is [8CD87C_opcode_4c_skip_byte.c](../../../reconstructed-c/8C/8CD87C_opcode_4c_skip_byte.c). It accepts the pointer low word explicitly and returns `true` for the carry-set continuation result.

## Evidence

- Vanilla VFS disassembly at `$8C:D87C`: `INC $82` at `$8C:D87C`, `SEC` at `$8C:D87E`, and `RTS` at `$8C:D87F`.
- [Dispatcher documentation](dispatcher.md): the opcode loop uses 16-bit A/X and interprets carry set as synchronous completion followed by same-turn continuation.