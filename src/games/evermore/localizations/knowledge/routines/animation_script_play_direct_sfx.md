---
addr: 908921
size: 45
end: 90894D
kind: code
category: 🎮
name: animation_script_play_direct_sfx
title: Play sound effect directly from animation script stream ($90:8921)
confidence: confirmed
evidence: ["disasm: validates entity range $3DE5..$4FE5; fetches 16-bit SFX ID from sound table $8C:8362,X; advances script pointer <$5D; plays sound via $8C:82DC"]
see: ["routines/play_sound_effect_direct.md"]
tags: [audio, sfx, script, animation, widescreen, widescreen.audio]
---
Plays direct sound effect from animation script stream `[<$5D]`. Validates entity bounds, fetches 16-bit SFX ID from sound table `$8C:8362,X`, advances script pointer, and dispatches sound via `Play_sound_effect_A_driver_effect_does_not_load_its_package_8C82DC` (`$8C:82DC`).

## Widescreen notes

For an entity slot (`$3DE5..$4FE4`) the sound is skipped when `+$14` bit `$20` is set (asm read 2026-11-09); what sets that bit (an off-screen flag?) was not found yet.
