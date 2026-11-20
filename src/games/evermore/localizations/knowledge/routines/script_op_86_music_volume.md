---
addr: 8CE27B
size: 26
end: 8CE294
kind: code
category: 🧠
name: script_op_86_music_volume
title: Script opcode 0x86: set the music volume
confidence: verified
tags: [script-vm, audio, spc700, reconstructed-c, g1-pass]
evidence: ["disasm: evaluates E via $8C:EA43, masks to low byte, writes word to DP $9A, passes volume in Y with command $0028 to $8C:81FD with DB=$80, restores caller DB, returns Carry Set via RTS", "trace: the game ran 3 distinct instructions with this opcode (tests/script-vm/goldens.json)", "g1: 37/37 real states match ROM (100%), 37/37 snes9x oracle agreement, 369/369 fuzzed states match ROM, mutation caught: yes, rated 589c9ea48c6a2d8e"]
see: [docs/scripts/vm.md, docs/scripts/opcodes.md, docs/disassembly/script-vm/opcode-86-music-volume.md]
---
Handler of script opcode [0x86](soe://rom/assets/scripts/opcodes/86.md). Evaluates an inline script expression through `$8C:EA43`, clamps the result to an 8-bit volume level, and stores the 16-bit word at DP `$9A` (clearing fade step `$9B`). Sets data bank register DB to `$80`, sends APU master volume command `0x0028` through `$8C:81FD`, restores the caller's data bank, sets Carry, and returns via `RTS`.

The wrapper's control-flow reconstruction is in [opcode-86-music-volume.md](../../../../../../docs/disassembly/script-vm/opcode-86-music-volume.md) and `reconstructed-c/8C/8CE27B_opcode_86_music_volume.c`.

## Addresses
Read from the handler's code (direct calls only; data bank tracked, default `$7E`):
- Operand expressions: `$8C:EA43` (`$8C:EC8E` for an entity: the result also goes to DP `$4C`)
- Calls: `$8C:81FD` APU handshake / `$2140` spinlock
- Opcode table entry: `$8C:E9C9` (0x86)

## Reconstructed C
Source: [`reconstructed-c/8C/8CE27B_opcode_86_music_volume.c`](../../../../../../reconstructed-c/8C/8CE27B_opcode_86_music_volume.c).
Differential parity: Verified with Gate G1 against clean ROM on live 8,414-frame reference states (37/37 real states, 369/369 fuzzed states, 100% parity).
