---
addr: 80B51A
end: 80B522
size: 9
kind: code
category: 🧠
name: wait_frames_timed_delay
title: Timed delay loop waiting for N vertical blank frames specified in direct page
confidence: confirmed
tags: [timing, vblank, delay, nmi]
evidence: ["disasm: loop: JSL $80:858C (wait_for_nmi); DEC $12; BNE loop; RTL at $80:B51A..$80:B522 (bytes 22 8C 85 80 C6 12 D0 F8 6B)"]
see: [rom/80858c.md, rom/80b506.md, rom/80b523.md]
---
Executes a synchronous delay loop blocking execution for the number of vertical blanking frames specified in direct page counter `$12`. On each frame, spins on `wait_for_nmi` (`$80:858C`), decrements `$12`, repeats until zero, and returns via `RTL`.
