---
addr: 80C95B
end: 80C95C
size: 2
kind: code
category: 🧠
name: sub_80C95B
title: Mode 7 flight terrain collision decompression 8-bit accumulator entry stub ($80:C95B)
confidence: confirmed
tags: ["code","subroutine","cdl", "mode7"]
evidence: ["disasm: $80:C95B executes SEP #$20 to configure 8-bit accumulator mode for PPU registers before falling directly through into sub_80C95D ($80:C95D); callers: scene transition jump tails $80:C6B5 and $80:C6BC"]
see: [routines/sub_80C95D.md, routines/sub_80C985.md, routines/scene_transition_timer_decrement_or_loop.md]
---

8-bit accumulator entry point stub for Mode 7 flight scene terrain collision decompression and VRAM update. Switches accumulator to 8-bit mode (`SEP #$20`) and falls through into `sub_80C95D` (`$80:C95D`). Jumped to by scene transition tails at `$80:C6B5` and `$80:C6BC`.
