---
addr: 80C6D2
size: 145
end: 80C762
kind: code
category: 🧠
name: mode7_flight_aircraft_sprite_animation_tick
title: Ticks Windwalker aircraft sprite animation bytecode and schedules updated banking tiles for VRAM DMA
confidence: confirmed
tags: [mode7, aircraft, animation, oam, flight]
evidence: ["disasm: executes aircraft banking animation update at $80:C6D2..$80:C762; loads banking angles LDX #$543A / LDX #$5442, dispatches animation script VM via JSL $90:80CE, restores data bank (PLB) and exits via RTS at $80:C762"]
see: [rom/80c681.md, rom/80c763.md, rom/9080ce.md]
---
Ticks Windwalker aircraft sprite animation bytecode and schedules updated banking tiles for VRAM DMA during Mode 7 flight. Evaluates aircraft banking angle and heading, dispatches animation script VM handlers at `$90:80CE`, restores caller data bank (`PLB`), and returns via `RTS`.
