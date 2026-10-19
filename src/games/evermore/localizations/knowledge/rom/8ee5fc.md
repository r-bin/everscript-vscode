---
addr: 8EE5FC
end: 8EE631
kind: code
category: 🧠
name: audio_master_volume_fade_tick
title: Per-frame master volume interpolation tick helper
confidence: confirmed
tags: [audio, volume, fade, field-tick]
evidence: ["disasm: checks mute flag bit 7 of $7E:0106, reads target volume latch $7E:0B83, compares against current volume level, increments or decrements $7E:0106, and zeroes target latch when target reached", "trace: called every frame during per_frame_field_tick at $8E:E470"]
see: [docs/disassembly/maps/room-spawn-align.md, rom/8ee592.md]
---
Executes per-frame master audio volume interpolation. Runs during `per_frame_field_tick` (`$8E:E470`), smoothly incrementing
or decrementing the current volume `$7E:0106` towards target volume `$7E:0B83`. When target level is matched, clears the
fade latch to finalize volume stabilization.
Full disassembly and clean C reconstruction: `docs/disassembly/maps/room-spawn-align.md`.
