---
addr: 8C831D
size: 11
end: 8C8327
kind: code
category: 🧠
name: apu_send_sfx_command
title: Dispatch SFX Command to APU Port Handshake
confidence: confirmed
tags: [audio, script]
evidence: ["disasm: $8C:831D loads Y from $0E4F, sets A to command $0004 (APU SFX trigger), and calls APU spinlock handshake $8C:81FD", "c: G1 passed (tools/c-to-rom/g1.mts, v0.399.40): 39/39 states and 624/624 fuzzed match ROM, mutation caught"]
see: [routines/play_sound_effect_direct.md, routines/play_sound_effect_with_package.md, routines/apu_command_handshake.md, audio/sfx-queue.md]
---
Dispatches sound effect playback commands to the SPC700 audio coprocessor:
- Loads sound descriptor parameter from `$0E4F` into index register `Y`.
- Sets command byte `0x0004` (play sound effect).
- Calls handshake and spinlock routine `$8C:81FD` to transmit the command across SNES communication ports `$2140`–`$2143`.
Full clean C decompilation: `docs/disassembly/audio/sfx-queue.md`.
