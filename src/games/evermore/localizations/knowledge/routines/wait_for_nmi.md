---
addr: 80858C
size: 11
end: 808596
kind: code
name: wait_for_nmi
title: Spin until the NMI handler has bumped the frame counter and jump to task loop
confidence: confirmed
tags: [engine, nmi]
evidence: ["disasm: LDA $0100 / CMP $0100 / BEQ back to the CMP, then JMP $8F85 to run frame tasks (bytes AD 00 01 CD 00 01 F0 FB 4C 85 8F at $80:858C..$80:8596)"]
see: [knowledge/wram/PPU_FRAME_COUNTER_LOW.md, routines/nmi_handler.md, routines/vram_oam_buffer_dma_commit_on_nmi.md]
---
The main loop's "wait for the frame": polls `$0100` until incremented by the NMI handler (`$80:823A`), then immediately executes `JMP $8F85` into the frame task runner (`run_frame_tasks`). Cycles spent in the spin loop are idle time, not work.

C: `reconstructed-c/80/80858C_wait_for_nmi.c`, a pass of the spin, bound in the recomp at `$858F`. No G1: the routine only ends on the NMI, so the proof is the recomp against MesenCE.

Every script thread yields here (85 `JSL $80:858C` call sites), and it goes on at `$80:8F85` once the NMI has
come, so `$8F85` is passed at the start of every frame between whole pieces of thread work. None of the sound
code in `$8C:8000-$82FF` yields, so no SPC700 command or upload is half done there; the combo POC switches games
at that point (docs/combo/poc.md §3). The main thread is rarely idle in the spin: in 20000 frames of a playback
the NMI stopped it inside `$858F-$8592` about 4 % of the time and at 1344 other places (MesenCE, 2026-11-15).
