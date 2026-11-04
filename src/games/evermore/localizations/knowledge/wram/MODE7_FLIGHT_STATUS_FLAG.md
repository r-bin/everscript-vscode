---
addr: 7E237D
size: 2
kind: var
name: MODE7_FLIGHT_STATUS_FLAG
title: Mode 7 overworld flight active flag / destination landing index
lifetime: room
confidence: confirmed
tags: [mode7, flight, vehicle]
evidence: ["disasm: func_80BC7A ($80:BC7A) writes $FFFF to $7E:237D upon entering Mode 7 flight scene", "disasm: checked in $80:BD47 against current vehicle flight target record"]
see: [routines/mode7_flight_scene_bootstrap_and_audio_init.md, routines/mode7_flight_scene_hardware_init.md]
---
Status flag tracking Mode 7 vehicle flight scene activation.
Initialized to `$FFFF` by `func_80BC7A` when taking off into the Mode 7 world map, and tested during flight updates and landing triggers.
