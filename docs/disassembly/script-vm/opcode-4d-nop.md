# Script Opcode 0x4D: No-Op

**Routine:** `$8C:D87E`\
**Range:** `$8C:D87E`–`$8C:D87F`\
**Confidence:** confirmed instruction sequence; carry meaning follows the VM dispatcher contract

## Behavior

The handler consists of `SEC; RTS`. It consumes no operands and makes no memory accesses or calls. It returns with carry set, which the VM dispatcher interprets as permission to continue executing the current script thread in the same turn.

The host-side model is [8CD87E_opcode_4d_nop.c](../../../reconstructed-c/8C/8CD87E_opcode_4d_nop.c). Its `true` return represents the carry-set result; it does not model instruction-pointer advancement, which is handled by the surrounding VM.

## Evidence

- Vanilla VFS disassembly at `$8C:D87E`: `SEC` at `$8C:D87E`, followed by `RTS` at `$8C:D87F`.
- [Dispatcher documentation](dispatcher.md): carry set means the opcode completed synchronously and the VM continues in the same frame turn.