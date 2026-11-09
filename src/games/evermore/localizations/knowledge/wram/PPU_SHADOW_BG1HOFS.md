---
addr: $7E:010E
name: PPU_SHADOW_BG1HOFS
type: u16
tags: [widescreen, widescreen.scroll]
confidence: verified
evidence: ["cdl", "disasm"]
---
BG1 horizontal scroll offset shadow; low byte written to $210D, high byte written to $210D.

## Widescreen notes

Written by `screen_shake_sync_window_coordinates` ($90:9A98) as `$59` (BG1HOFS = BG2HOFS) in the default camera mode; other entries of the camera-mode table `$90:8E68` (indexed by `$7E:241F`) may write their own values. Also read back by the tilemap streamer `$90:98FA` (`>> 4` = left metatile column of the streamed window). Widescreen: the PPU's per-line hScroll is the phase source (framework rule P1), this shadow only the frame value (asm read 2026-11-09).
