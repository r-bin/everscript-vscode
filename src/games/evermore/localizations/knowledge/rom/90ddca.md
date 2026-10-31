---
addr: 90DDCA
kind: code
category: 🎮
name: projectile_motion_step_relative_target
title: Calculate projectile trajectory step relative to target entity ($90:DDCA)
confidence: confirmed
evidence: ["disasm: loads lifetime from $90:0012,X into +$24,Y; reads velocity params from $90:000E,X; computes coordinate deltas relative to target $0F42 (+1A - +14, +1C - +16); scales to 16.16 fixed-point; dispatches trajectory math $90:DFDF"]
see: ["rom/90dfdf.md"]
tags: ["projectile","trajectory","physics","target"]
---
Projectile linear trajectory step calculation. Reads lifetime timer from `$90:0012,X` into `+$24,Y`, reads velocity parameters from `$90:000E,X`, computes delta position relative to target `$0F42` (`+$1A,X - +$14,Y`, `+$1C,X - +$16,Y`), shifts left 4 bits to 16.16 fixed-point, and calls trajectory solver `func_90DFDF` (`$90:DFDF`).
