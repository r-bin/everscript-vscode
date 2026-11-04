---
addr: 90CE78
size: 26
end: 90CE91
kind: code
category: 🎮
name: palette_cache_bind_slot_6
title: Cache and upload sprite palette to CGRAM slot 6 ($90:CE78)
confidence: confirmed
evidence: ["disasm: sets DB to $7E; compares input palette against cache slot $7E:127E; if changed, writes cache and commits via load_sprite_palette $90:CF3A with slot X=6; callers: VFX setup $90:882D"]
see: ["routines/load_sprite_palette.md","routines/animation_script_bind_palette_slot_6.md"]
tags: ["palette","cgram","sprite","cache"]
---
Caches and loads CGRAM palette for slot 6. Compares input palette index in A against cache slot `$7E:127E`. If changed, updates cache, sets target slot `X = $06`, and commits via `load_sprite_palette` (`$90:CF3A`).
