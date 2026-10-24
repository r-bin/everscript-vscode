# Script Opcode 0x29: Call a Script

**Routine:** `$8C:D3C9`\
**Range:** `$8C:D3C9`–`$8C:D3FC`\
**Confidence:** confirmed operand flow and scheduler handoff

## Behavior

The handler reads a packed 24-bit script pointer as a little-endian 16-bit low word followed by one high byte. It passes those bytes to the scheduler call helper, which represents `$8C:CF18` slot allocation and the handler's caller-link, child-wait, and run-list updates. The handler returns carry clear, suspending the caller while the callee runs.

The host-side model is [8CD3C9_opcode_29_call.c](../../../reconstructed-c/8C/8CD3C9_opcode_29_call.c). The allocation and thread-record mutations are intentionally delegated, matching the opaque scheduler boundary used by the existing opcode `0xA3` model.

## Evidence

- Vanilla VFS at `$8C:D3C9` reads two bytes through `[$82]` and stores them at DP `$26`, then reads/masks a third byte and stores it at DP `$28`.
- It calls `$8C:CF18`, copies caller context into the new slot, updates parent child-wait bookkeeping when applicable, appends the callee entry to `$7E:2F28`, rewinds DP `$80` by two, and returns `CLC; RTS`.
- Opcode table entry `$8C:E90F` maps `0x29` to `$8C:D3C9`; opcode metadata identifies a `u24` operand and call flow.