---
addr: 8C8619
size: 63
end: 8C8657
kind: code
category: 🧠
name: audio_music_fade_step
title: Master music volume fade stepper and APU volume latch
confidence: verified
tags: [audio, spc700, reconstructed-c, g1-pass]
evidence: ["disasm: checks DP $9B fade target, steps by rate $9A, on reaching max/min bounds clears $9B and sends APU master volume command $28 / $A9 ($8C:8657 RTL)", "docs/disassembly/audio/positional-audio.md", "g1: 34/34 real states match ROM (100%), 34/34 snes9x oracle agreement, 544/544 fuzzed states match ROM, mutation caught: yes, rated f4a69db8023514c0"]
see: [routines/apu_command_handshake.md, routines/audio_play_positional_sfx.md, docs/disassembly/audio/positional-audio.md]
---
Ticks the master music volume fade progression:
- Tests Direct Page `$9B` (signed fade target).
- Steps current level by rate `$9A` toward ceiling or floor using 8-bit `ADC $9A`.
- Once fade completes (`$9B = 0`), issues APU IPC Command `0x0028` across hardware port
  `$2140` to commit final volume.

## Reconstructed C
Source: [`reconstructed-c/8C/8C8619_audio_music_fade_step.c`](../../../../../../reconstructed-c/8C/8C8619_audio_music_fade_step.c).
Differential parity: Verified with Gate G1 against clean ROM on live 8,414-frame reference states and fuzzed inputs.
Full clean C decompilation: `docs/disassembly/audio/positional-audio.md`.
