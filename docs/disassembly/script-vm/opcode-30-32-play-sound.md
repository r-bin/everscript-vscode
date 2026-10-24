# Script Opcodes 0x30, 0x31, and 0x32: Play a Sound

**Routine:** `$8C:D6A7`\
**Range:** `$8C:D6A7`–`$8C:D6D5`\
**Confidence:** confirmed

## Behavior

The shared handler reads `$7E:243B` and sends it as the payload for APU command `$0030` through `$8C:81FD`, then clears `$7E:243B`. It consumes one sound-ID byte and uses that byte directly as an offset into the signed word table at `$8C:8362` (the index is not doubled). A negative table entry is silent; otherwise the value is passed to `$8C:82DC` for playback. The handler returns carry set.

The host-side model is [8CD6A7_opcode_30_32_play_sound.c](../../../reconstructed-c/8C/8CD6A7_opcode_30_32_play_sound.c). Opcodes `0x30`, `0x31`, and `0x32` share this implementation.

## Evidence

- Vanilla VFS at `$8C:D6A7` reads `$7E:243B`, sends command `$0030` through `$8C:81FD`, and clears `$7E:243B`.
- It fetches one byte through `[$82]`, masks it to one byte, transfers it directly to X, and reads `$8C:8362,X`; the negative-result branch skips `$8C:82DC`.
- The handler ends with `SEC; RTS`. Opcode table entries `$8C:E91D`, `$8C:E91F`, and `$8C:E921` all point to `$8C:D6A7`.