# Script Opcode 0xA3: Call a Global Script

**Handler entry:** `$8C:D3A0`\
**Opcode table entry:** `$8C:EA03`\
**Operand:** one-byte global script ID\
**Confidence:** ID consumption, address calculation, table reads, slot handoff, and carry-clear return confirmed

## Control Flow

The handler reads one byte through the script pointer at DP `$82`. It forms the index
offset from the ID times three, the word at `$92:8008`, and the word at `$92:8000`:

`offset = id * 3 + word[$92:8008] + word[$92:8000]`

It reads a 24-bit target address from `$92:8000 + offset`: the first two bytes are the
target PC and the third byte is the target bank. It then calls `$8C:CF18` to allocate a
script slot, copies the caller return context into the new slot, updates the parent/child
slot bookkeeping and `$7E:2F28` run list, and returns carry clear. The slot allocation
and thread-record mutations remain behind an opaque host-side helper.

For the US ROM, the word at `$92:8008` is `$1677`. The disassembly's long reads at
`$92:8000,X` and `$92:8002,X` are relative to the calculated entry offset; this differs
from the room-trigger table addressed at `$92:8000` alone.

## Reconstruction

The host-side model is in
[`reconstructed-c/8C/8CD3A0_opcode_a3_call_global.c`](../../../reconstructed-c/8C/8CD3A0_opcode_a3_call_global.c).

## Evidence

- `$8C:D3A0` reads the ID and increments DP `$82`; `$8C:D3A4` masks it to one byte.
- `$8C:D3A9`–`$8C:D3B0` calculate `id * 3` and add the two header words.
- `$8C:D3B5` reads the target PC; `$8C:D3BB` reads and masks the target bank byte.
- `$8C:D3DA` calls `$8C:CF18`; `$8C:D3E1`–`$8C:D3E7` copy return PC and bank;
  `$8C:D3F4` updates the `$2F28` run list and `$8C:D3F9` updates DP `$80`.
- `$8C:D3FB` clears carry before return.