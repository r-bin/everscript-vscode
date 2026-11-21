---
addr: 9088BC
size: 55
end: 9088F2
kind: code
category: 🎮
name: animation_script_send_panned_sfx_command
title: Send stereo-panned sound effect command to SPC700 from script ($90:88BC)
confidence: confirmed
evidence: ["disasm: reads Boy X position $7E:4EB7; computes stereo panning parameter; loads SFX ID from [<$5D]; dispatches command $30 via apu_command_handshake $8C:81FD; advances script pointer <$5D by 2", "reconstructed-c: 100% differential parity in G1 (3 real states, 209 fuzzed states)"]
see: ["routines/apu_command_handshake.md"]
tags: [audio, sfx, panning, apu, script, widescreen, widescreen.audio, reconstructed-c, g1-pass]
---
Sends panned sound effect command to SPC700 from animation script. Reads Boy screen position `$7E:4EB7`, calculates stereo panning parameter, reads SFX index from `[<$5D]`, and issues APU command `$30` via `apu_command_handshake` (`$8C:81FD`).
Reconstructed C binding in `reconstructed-c/90/9088BC_animation_script_send_panned_sfx_command.c` verified via G1 differential testing.
