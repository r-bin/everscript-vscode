---
addr: 80C5DB
end: 80C5FE
size: 36
kind: code
category: 🧠
name: sub_80C5DB
title: Mode 7 Flight: Normal cruise speed configuration and START button HUD toggle ($80:C5DB)
confidence: confirmed
tags: ["code", "subroutine", "mode7", "flight", "speed", "hud", "joypad"]
evidence: ["disasm: loads normal cruise speed $1478 into $1474; tests START button $1000, acknowledges via $80:8597, toggles HUD flag $0B1D, and initializes HUD slide animation step $0E7A with $1C (28 frames); exits via rts ($80:C5FE) or stub $80:C5FF"]
---

Configures normal flight cruise speed and handles HUD overlay toggle. Loads cruise maximum velocity `$7E:1478` into `MODE7_CAMERA_PAN_MAX_SPEED` (`$7E:1474`). At `$80:C5E1`, tests controller button `$1000` (START): if pressed, clears button via `joypad_acknowledge_or_clear_buttons` (`$80:8597`), toggles `MODE7_FLIGHT_HUD_VISIBLE` (`$7E:0B1D`), and sets transition animation slide step `$7E:0E7A` to `$001C` (28 frames) if HUD is opening or `$0000` if closing.
