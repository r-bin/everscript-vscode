---
addr: 80C5FF
end: 80C5FF
size: 1
kind: code
category: 🧠
name: sub_80C5FF
title: Mode 7 Flight: Joypad handler exit stub ($80:C5FF)
confidence: confirmed
tags: ["code", "subroutine", "mode7", "flight", "exit"]
evidence: ["disasm: rts target for branch from $80:C5E4 when START button is not pressed in mode7_flight joypad handler"]
---

Simple `rts` exit stub terminating Mode 7 flight controller processing when START button is not pressed.
