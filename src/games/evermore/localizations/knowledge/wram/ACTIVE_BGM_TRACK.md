---
addr: 7E0E44
end: 7E0E45
kind: var
name: ACTIVE_BGM_TRACK
title: Active background music track index loaded into SPC700
lifetime: room
confidence: confirmed
tags: [audio, bgm, spc700]
evidence: ["reconstructed-c: 8C8328_positional_audio.c defines active_bgm_track at $7E:0E44", "reconstructed-c: 8C8236_soundbank_streamer.c checks active track before uploading soundbanks"]
see: [docs/disassembly/engine-core/wram-map.md]
---
16-bit word storing the identifier of the active background music track currently playing or resident in SPC700 ARAM:
- Consulted in `func_8C828F` before triggering audio fade-outs and soundbank stream uploads; skips redundant IPL transfers if the requested track uses the same resident instrument soundbank.
- Used in 2D positional audio calculations (`func_8C8328`) to determine soundbank package offsets in ROM Bank `$81`.

