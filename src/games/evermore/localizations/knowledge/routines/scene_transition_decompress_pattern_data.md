---
addr: 80C0B5
size: 27
end: 80C0CF
kind: code
category: 🎮
name: scene_transition_decompress_pattern_data
title: Decompress room pattern graphics to WRAM during transition ($80:C0B5)
confidence: confirmed
evidence: ["disasm: sets source $C5:1800 into <$36..$38 and target $7F:0000 into <$3A..$3C; invokes decompression_dispatcher_reads_sub_flag $8C:988D; callers: scene transition $80:BC00"]
see: ["routines/decompression_dispatcher_reads_sub_flag_jumps_th.md","routines/mode7_flight_scene_hardware_init.md"]
tags: ["decompression","graphics","transition","wram", "mode7"]
---
Decompresses room pattern/tile graphics during scene transitions. Configures source address `$C5:1800` into `<$36..$38>` and target WRAM buffer `$7F:0000` into `<$3A..$3C>`, then invokes `decompression_dispatcher_reads_sub_flag` (`$8C:988D`).
