---
addr: 9098ED
size: 13
end: 9098F9
kind: code
category: 🎮
name: screen_flash_effect_timer_tick
title: Screen flash / color tint effect timer tick ($90:98ED)
confidence: verified
evidence:
  - "[\"disasm: checks direct-page timer <$C9; if non-zero, decrements; if reaching zero, branches to $90:988E to terminate and restore palette registers; callers: frame tick $8E:E41E\"]"
  - "Reconstructed in `reconstructed-c/90/9098ED_screen_flash_effect_timer_tick.c` (SOE_BIND); passes Gate G1 differential verification (34/34 reference states, 544/544 fuzzed states, mutation caught: yes (fuzzed), 3 / 86 ROM/C instructions per call)."
see: ["routines/screen_shake_stop.md","routines/per_frame_field_tick.md"]
tags: ["vfx", "flash", "screen", "palette", reconstructed-c, g1-pass]
---
Decrements the screen flash/tint duration counter in direct-page `<$C9`. When the timer expires (`DEC` results in zero), jumps to `$90:988E` to restore standard palette/brightness levels and clean up visual effect flags.
