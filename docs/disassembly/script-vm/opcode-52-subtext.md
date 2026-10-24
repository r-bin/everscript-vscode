# Script Opcode 0x52: Queue Subtitle Text

**Handler:** `$8C:D99E`\
**Operand:** `u16` string key\
**Confidence:** confirmed

Opcode `0x52` queues unwindowed subtitle text without stopping the running scene. If `$7E:23D3` is zero and bit 15 of `$7E:0B2B` is clear, the handler resets the cutscene dialogue queue and clears any active text window. It then reads the two-byte string key, resolves and decompresses the corresponding text through `$8C:CD33`, and enqueues the resulting 24-bit text pointer through `$8C:C521`. The handler returns carry set.

The host-side model is [8CD99E_opcode_52_subtext.c](../../../reconstructed-c/8C/8CD99E_opcode_52_subtext.c). Queue reset, key resolution, and enqueue behavior are delegated to their shared helper models.

## Evidence

- Opcode table entry `$8C:E961` dispatches to `$8C:D99E` with a 16-bit operand.
- `$8C:D99E` checks `$7E:23D3`, then bit 15 of `$7E:0B2B`, before optionally calling `$8C:C4F6`.
- It reads the key through `[$82]`, advances `$82` twice, calls `$8C:CD33` and `$8C:C521`, then executes `SEC; RTS`.
- Reachable examples are listed in the [VFS opcode record](soe://rom/assets/scripts/opcodes/52.md).