---
addr: 80E0D9
size: 78
end: 80E126
kind: code
category: 🎮
name: scene_transition_enqueue_vram_tile_block
title: Enqueue VRAM pattern block DMA transfer request ($80:E0D9)
confidence: confirmed
evidence: ["disasm: checks staging request slots at $7E:67F1 and $7E:6805; unpacks length, source address, and VRAM target from pointer <$26..$28; callers: scene graphics load $80:BC7A"]
see: ["routines/mode7_flight_scene_bootstrap_and_audio_init.md"]
tags: ["vram","dma","staging","transition"]
---
Enqueues VRAM pattern transfer request block into staging queue at `$7E:67F1` or `$7E:6805`. Unpacks length, source address, and destination pointer from stream pointer `<$26..$28>`.
