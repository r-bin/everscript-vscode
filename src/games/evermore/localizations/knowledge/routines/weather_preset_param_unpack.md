---
addr: 80A305
size: 76
end: 80A350
kind: code
category: 🧠
name: weather_preset_param_unpack
title: Weather preset parameter block copy into $7E:72DB..$7E:72EB
confidence: provisional
tags: [weather, preset, graphics]
evidence: ["disasm: soe://rom/code/80A305?asm=1 shows sequential lda $00xx,y / sta $7E72xx,x copying parameters from [$AA],y into weather parameter buffer $7E:72DB..$7E:72EB", "caution: previous claims of particle simulation with $7E:2439/$7E:243D in 80A305_weather_particles.c were an AI hallucination and do not exist in the ROM"]
see: [docs/disassembly/engine-core/weather-particles.md, docs/disassembly/engine-core/weather-preset.md, routines/load_weather_preset_parameters.md]
---
Unrolls sequential word copies from parameter block into the active weather/sprite staging buffer (`$7E:72DB..$7E:72EB`).

> [!CAUTION]
> Reconstructed C `80A305_weather_particles.c` and `weather-particles.md` were hallucinated in commit `2bdcbb93` and describe a fictional particle simulation loop. The actual ROM code is a parameter unpacker and must be rechecked and rewritten.
