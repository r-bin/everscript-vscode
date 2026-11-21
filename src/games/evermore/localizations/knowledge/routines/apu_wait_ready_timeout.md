---
addr: 8c81d4
size: 41
end: 8C81FC
kind: code
category: 🧠
name: apu_wait_ready_timeout
title: SPC700 ready state polling loop with 65,536-cycle timeout recovery
confidence: verified
tags: [audio, spc700, spinlock, timeout, recovery, reconstructed-c, g1-pass]
evidence: ["disasm: polls port $2142 against sequence byte DP $9F for 65,536 iterations; re-synchronizes DP $9F on timeout; saves and restores APU lock $7E:0E65", "trace: invoked between audio block commands and music track start", "g1: 20/20 real states match ROM (100%), 18/18 snes9x oracle agreement, 320/320 fuzzed states match ROM, mutation caught: yes, rated ed37cca5dfe13a1c"]
see: [docs/disassembly/audio/spc-block-uploader.md, routines/spc700_ipl_bootloader_handshake_block.md, routines/apu_command_handshake.md]
---
APU readiness polling loop and timeout fallback handler.
Spins on port `$2142` comparing with expected sequence counter DP `$9F` for up to 65,536 cycles.
If the SPC700 fails to acknowledge in time, recovers by reading the raw value at `$2142` directly,
updating DP `$9F` to re-synchronize the communication channel without crashing the main CPU loop.
Full disassembly and clean C reconstruction: `docs/disassembly/audio/spc-block-uploader.md`.

## Reconstructed C
Source: [`reconstructed-c/8C/8C81D4_apu_wait_ready_timeout.c`](../../../../../../reconstructed-c/8C/8C81D4_apu_wait_ready_timeout.c).
Differential parity: Verified with Gate G1 against clean ROM on live 8,414-frame reference states.
