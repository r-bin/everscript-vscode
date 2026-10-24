# Script Opcode 0x33: Change Music

**Routine:** `$8C:D6D6`\
**Range:** `$8C:D6D6`–`$8C:D71E`\
**Confidence:** confirmed

## Behavior

The handler consumes one music-ID byte, sends APU command `$1A` with parameter zero, disables interrupts by writing zero to `$4200`, then sends commands `$2A` with parameter `$00A0` and `$2C` with parameter zero. It uses the operand byte directly as a byte offset into the signed word table at `$8C:8442`; a negative result skips music dispatch, while a nonnegative result is passed to `$8C:828F`. Finally, it restores `$4200` from `$7E:0E6B` and returns carry set.

The host-side model is [8CD6D6_opcode_33_change_music.c](../../../reconstructed-c/8C/8CD6D6_opcode_33_change_music.c).

## Evidence

- Vanilla VFS at `$8C:D6D6` fetches one byte through `[$82]` and increments `$82`.
- Calls `$8C:81FD` for `$1A/0`, `$2A/$00A0`, and `$2C/0`, in that order.
- Writes `$4200=0` after the first APU command and restores it from `$0E6B` after the lookup and optional dispatch.
- `LDX` receives the fetched byte; `LDA $8C8442,X` performs the table read without scaling the index. `BMI` skips `$8C:828F` for negative entries.
- The handler ends with `SEC; RTS`.