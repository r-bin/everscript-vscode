---
addr: 80D7B0
end: 80D8A9
size: 250
kind: code
category: 🧠
name: mode7_sky_color_gradient_and_fade_cgram_dma
title: Pulses CGRAM color $C1 and renders the 11-sprite Mode 7 minimap and rotating compass HUD ($7E:AC92..$7E:ACBD)
confidence: confirmed
tags: [mode7, flight, hud, compass, oam, cgram]
evidence: ["disasm: $80:D7B0 pulses CGRAM color $C1 from $7E:0E7E via $80:85FA, copies 22 OAM word pairs from $80:E163 into $7E:AC92..$7E:ACBD (11 sprites), places the player position marker at ($14AC>>4)+$98, ($14AE>>4)+$28, and orbits the compass needle around ($B8,$48) using $80:88A3/$80:8923"]
see: [routines/hide_window_frame_sprites.md, routines/dialog_window_slide_transition_step.md, docs/disassembly/engine-core/mode7-overworld-engine.md]
---
Updates the Mode 7 overworld flight **minimap and compass rose HUD sprites** in Low OAM slots `45..55`
(`$7E:AC92..$7E:ACBD`) and pulses CGRAM palette entry `$C1` for the blinking map marker.

1. Every 8 frames (`$0100 & $0007 == 0`), toggles `$7E:0E7E` between `$0000` (black) and `$7FFF` (white)
   and enqueues a 1-word CGRAM DMA transfer to palette index `$C1` via `$80:85FA`.
2. If `$7E:14C6` (actually `$7E:14C4` HUD visibility flag at `$7E:14B6` checked in `$80:D786`) hides the HUD,
   returns early.
3. Copies 11 template OAM sprites (44 bytes) from ROM table **`$80:E163`** (`$80:E163..$80:E18E`) into
   `$7E:AC92..$7E:ACBD` and sets their High OAM size/X-msb bits in `$7E:ADE9..$7E:ADEB`.
4. Computes the player's world position marker sprite at `$7E:AC92`/`$7E:AC93`:
   - `X = ($7E:14AC >> 4) + $98`
   - `Y = ($7E:14AE >> 4) + $28`
5. Computes the rotating compass needle sprite at `$7E:AC96`/`$7E:AC97` using smoothed compass heading
   `$7E:14BC` (`($F8 - ($14BC >> 3)) & $FF`) and trig tables `$80:88A3` / `$80:8923` centered at `($B8, $48)`.

## Callers
- `$80:C1A2` (`$80:C25F` / `$80:C2BC`)
- `$80:C95B` (`$80:CA27` / `$80:CA87`)
