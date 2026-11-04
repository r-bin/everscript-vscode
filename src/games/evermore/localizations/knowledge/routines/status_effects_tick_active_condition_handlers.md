---
addr: 91BC32
end: 91BDC3
size: 402
kind: code
category: 🧠
name: status_effects_tick_active_condition_handlers
title: Master per-frame active status condition effect processors and poison/plague damage ticks
confidence: confirmed
tags: [status, effects, combat, poison, plague, timer]
evidence: ["disasm: updates active condition handlers at $91:BC32..$91:BDC3; processes status flags in $7E:0B83, applies periodic damage ticks for Poison/Plague/Corrosion, restores processor state via REP #$30; RTL at $91:BDC3"]
see: [routines/status_effects_timer_decrement_and_cleanse_loop.md, routines/status_effects_tick_all.md, routines/ambient_weather_particles_init.md]
---
Core status condition simulation handler executed every game frame:
- Checks active ailment bitmask in `$7E:0B83` (Poison, Confound, Plague, Corrosion, Defender, Atlas, etc.).
- Calculates periodic damage increments for debilitating conditions and restores entity parameters when timers expire.
- Restores 16-bit register modes (`REP #$30`) and exits via `RTL` at `$91:BDC3`.

