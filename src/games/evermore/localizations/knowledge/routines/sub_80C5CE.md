---
addr: 80C5CE
end: 80C5DA
size: 13
kind: code
category: 🧠
name: sub_80C5CE
title: Mode 7 Flight: High-speed boost throttle check ($80:C5CE)
confidence: confirmed
tags: ["code", "subroutine", "mode7", "flight", "speed", "velocity", "joypad"]
evidence: ["disasm: tests controller bit $0040; if pressed, loads boost max speed $147A into $1474 and branches to $80:C5E1; otherwise falls through to normal speed $80:C5DB"]
---

Checks controller button mask `$0040` (B / Y). When asserted, sets camera pan maximum velocity ceiling `MODE7_CAMERA_PAN_MAX_SPEED` (`$7E:1474`) from boost speed parameter `$7E:147A`, then branches to START / HUD check at `$80:C5E1`. If not asserted, falls through to normal cruise speed configuration at `$80:C5DB`.
