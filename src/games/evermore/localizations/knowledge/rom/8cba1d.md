---
addr: 8CBA1D
kind: code
category: 🎨
name: dialogue_choice_cursor_draw
title: Dialogue multiple-choice prompt cursor animator and blitter ($8C:BA1D)
confidence: confirmed
evidence: ["disasm: multiplies tile X (+$16,Y) by 8 (ASL 3) and adds subpixel fine X (+$00,Y) to DP $02; multiplies tile Y (+$14,Y) by 8 (ASL 3), adds fine Y (+$02,Y) and font line pitch $0B3D to DP $04; sets priority $0036 in DP $06; steps animation record Y=$0858 via $90:80D2; blits sprite via $90:81BD; caller: $8C:B81D"]
see: [rom/9080d2.md, rom/9081bd.md]
tags: [ui, dialogue, cursor, sprites]
---
Computes screen pixel coordinates and draws the animated selection cursor for dialogue choices and prompts. Multiplies window column tile offset `+$16,Y` by 8 and adds fine X into direct page `$02`; multiplies row tile offset `+$14,Y` by 8, adds fine Y and font pitch `$0B3D` into direct page `$04`. Sets priority layer `$0036`, steps cursor animation bytecode via `$90:80D2` using record `Y = $0858`, and blits the sprite to OAM via `$90:81BD`.
