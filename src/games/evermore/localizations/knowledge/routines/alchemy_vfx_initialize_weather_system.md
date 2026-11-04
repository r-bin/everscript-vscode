---
addr: 91A078
size: 17
end: 91A088
kind: code
category: 🎮
name: alchemy_vfx_initialize_weather_system
title: Initialize ambient weather simulation subsystem from effect script ($91:A078)
confidence: confirmed
evidence: ["disasm: invokes weather system bootstrap $91:C2AD; advances effect script PC +$14,Y by 2 bytes"]
see: ["routines/weather_system_reset_parameters.md"]
tags: ["alchemy","weather","vfx","bootstrap"]
---
Initializes ambient weather simulation subsystem via `func_91C2AD` (`$91:C2AD`) and advances effect script PC `+$14,Y` by 2 bytes.
