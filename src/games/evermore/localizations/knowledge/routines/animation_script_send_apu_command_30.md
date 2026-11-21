---
addr: 9088F3
size: 46
end: 908920
kind: code
category: 🎮
name: animation_script_send_apu_command_30
title: Send standard audio command $30 to SPC700 sound engine ($90:88F3)
confidence: confirmed
evidence: ["disasm: reads command index from [<$5D]; advances script pointer <$5D by 2; dispatches APU command $30 via apu_command_handshake $8C:81FD", "reconstructed-c: 100% differential parity in G1 (19 real states, 79 fuzzed states)"]
see: ["routines/apu_command_handshake.md"]
tags: ["audio","apu","command","script","reconstructed-c","g1-pass"]
---
Sends standard sound effect / voice command `$30` to SPC700 from animation script. Reads command index from `[<$5D]`, advances script pointer by 2, and dispatches via `apu_command_handshake` (`$8C:81FD`).
Reconstructed C binding in `reconstructed-c/90/9088F3_animation_script_send_apu_command_30.c` verified via G1 differential testing.
