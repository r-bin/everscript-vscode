---
addr: 91C179
end: 91C2AC
size: 308
kind: code
category: 🧠
name: weather_wind_gust_oscillation_and_drift_update
title: Ambient weather wind gust oscillation, velocity acceleration, and drift simulation
confidence: confirmed
tags: [weather, wind, particles, physics, drift]
evidence: ["disasm: updates wind parameters at $91:C179..$91:C2AC; configures wind oscillation base $14CE and velocity $14D0, applies wind vector deltas to particle buffer $7E:67F0, returns via RTL at $91:C2AC"]
see: [rom/91c15b.md, rom/91c2ad.md, ram/7e14ce.md]
---
Simulates dynamic wind gusts for ambient weather particles (rain, ash, snow):
- Updates wind force registers `$7E:14CE` and `$7E:14D0` using sine oscillation.
- Accelerates particle horizontal velocities and handles screen-wrap boundaries across the active viewport.
- Returns via `RTL` at `$91:C2AC`.

