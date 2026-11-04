---
addr: 7E14EE
size: 2
kind: var
name: WEATHER_PARTICLE_SLOT_INDEX
title: Active weather particle slot pointer offset
lifetime: frame
confidence: confirmed
tags: [weather, particles, visual]
evidence: ["disasm: func_91BDC4 ($91:BDC4) initializes active slot offset at $7E:14EE", "disasm: func_91BE05 ($91:BE05), func_91BE42 ($91:BE42), and func_91C0BA ($91:C0BA) index particle slot records using $14EE"]
see: [knowledge/wram/WEATHER_PARTICLE_PREV_Y.md, knowledge/wram/WEATHER_PARAMS_ALIGN_PAD.md, knowledge/wram/WEATHER_EFFECT_STATE.md, knowledge/wram/WEATHER_PARTICLES.md]
---
Active weather particle slot buffer offset pointer used by routines in bank $91 to update individual particle state coordinates and generate sprite OAM records.
