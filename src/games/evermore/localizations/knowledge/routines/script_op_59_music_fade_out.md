---
addr: 8CDC74
size: 19
end: 8CDC86
kind: code
category: 🧠
name: script_op_59_music_fade_out
title: Script opcode 0x59: fade the music out
confidence: verified
tags: [script-vm, audio, fade, reconstructed-c, g1-pass]
evidence: ["trace: the game ran 2 distinct instructions with this opcode; each ended where the decoder says (tests/script-vm/goldens.json)", "disasm: $9B = $F0, sets DB=$80, calls $8C:8619, restores DB=$7E, SEC, RTS", "g1: 1/1 real states match ROM (100%), 1/1 snes9x oracle agreement, mutation caught: yes, rated 3f94d28cfef0daf1"]
see: [docs/scripts/opcodes.md, routines/script_op_58_music_fade_in.md, routines/audio_music_fade_step.md, docs/disassembly/script-vm/opcode-58-59-music-fade.md]
---
Handler of script opcode [0x59](soe://rom/assets/scripts/opcodes/59.md). Sets music-volume fade step `$7E:009B` to `$F0` (signed `-16`), sets data bank `$80`, calls `$8C:8619` (`audio_music_fade_step`), restores data bank `$7E`, sets Carry, and returns `RTS`. The shared fade stepper updates volume and sends APU command `$28`. Host-side model: `docs/disassembly/script-vm/opcode-58-59-music-fade.md`.

Previously believed: a screen palette fade.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Calls: `$8C:8619`
- Opcode table entry: `$8C:E96F` (0x59)

## Reconstructed C
Source: [`reconstructed-c/8C/8CDC74_script_op_59_music_fade_out.c`](../../../../../../reconstructed-c/8C/8CDC74_script_op_59_music_fade_out.c).
Differential parity: Verified with Gate G1 against clean ROM on live 8,414-frame reference states.
