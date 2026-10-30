---
addr: 8EB1DA
end: 8EB232
kind: code
category: 🗺️
name: mode7_flight_ascent_step
title: Mode 7 flight altitude ascent step handler
confidence: likely
tags: [mode7, flight, altitude, sound]
evidence: ["disasm: plays climb SFX $0002 via $8C:82DC; increments altitude register $0619 by +$0A; advances camera tilt angle in $061B by +$04; tests flight status flag $05AB bit 0 (REA dossier 0x8eb1da)"]
---
Handles vehicle altitude increase (climb/ascent) during Mode 7 overworld flight, updating elevation in $0619 and pitch in $061B with climb audio feedback.
