---
addr: 80CDDA
kind: code
category: 🎮
name: camera_pan_velocity_accel_step_b
title: Calculate camera pan acceleration step towards target velocity B ($80:CDDA)
confidence: confirmed
evidence: ["disasm: checks current velocity $14B2; if negative or below speed target $1474, adds step acceleration $1476 to $14B2; otherwise clamps to speed ceiling $1474; callers: camera pan $80:CBD1"]
see: ["rom/80cbd1.md"]
tags: ["camera","pan","velocity","accel"]
---
Camera pan acceleration calculation variant B (counterpart to `$80:C659`). Adds acceleration `$1476` to velocity `$14B2` clamping at speed ceiling `$1474`.
