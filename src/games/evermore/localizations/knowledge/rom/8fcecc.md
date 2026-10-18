---
addr: 8FCECC
kind: code
category: 🧠
name: player_human_control_dog
title: Human Player Control & Movement Dispatcher (Dog)
confidence: confirmed
evidence: ["disasm: $8F:CECC checks B-button $0800 in $0EB8, verifies Dog stamina $4F65 >= 0x0400, drains 3 stamina per tick via ADC #$FFFD, maps D-pad to directional heading, and arbitrates attack bite and ring menus"]
see: [rom/8fcd88.md, rom/8fd0b0.md, engine-core/player-movement.md]
---
Core per-frame human movement and controller input handler for the companion Dog when manually controlled (via SELECT toggle or in Dog-first chapters):
- Checks B-button sprint hold (`$0EB8 & $0800`).
- Gated by full stamina gauge: requires Dog stamina `$4F65 >= 0x0400` (1024 points).
- Drains 3 stamina units per frame while running (`ADC #$FFFD`).
- Decodes D-pad bits `$0105 & $000F` into 16-way directional heading.
- Dispatches Dog attack bite animation and Ring Menu triggers.
Full clean C decompilation: `docs/disassembly/engine-core/player-movement.md`.
