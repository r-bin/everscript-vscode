---
addr: 7E4EAB
size: 2
kind: enum
name: BOY_FACING_DIRECTION
title: Player Boy 8-way facing direction enum
lifetime: room
confidence: confirmed
tags: [player, physics, sprite]
evidence: ["disasm: func_909040 reads entity +$22 ($7E:4EAB) to resolve sprite action animation bank and directional offsets", "disasm: joypad input translator maps d-pad bits into even values 0..14"]
see: [src/games/evermore/localizations/knowledge/ram/7e4e89.md]
---
Facing direction heading of the Boy (word offset `+$22` in entity record):
- `0`: North (0°)
- `2`: Northeast (45°)
- `4`: East (90°)
- `6`: Southeast (135°)
- `8`: South (180°)
- `10`: Southwest (225°)
- `12`: West (270°)
- `14`: Northwest (315°)

