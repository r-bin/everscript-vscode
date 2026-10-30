---
addr: 8EB0CF
end: 8EB19B
kind: code
category: 🗺️
name: mode7_flight_descent_step
title: Mode 7 flight altitude descent step handler
confidence: likely
tags: [mode7, flight, altitude, math, projection]
evidence: ["disasm: plays flight thrust SFX $0001 via $8C:82DC; sets target altitude offset $0619 = $FC; computes perspective 3D coordinate projection using hardware 16-bit multiplication ($4202/$4216) and division ($4204/$4206); dispatches sprite positioning via $8E:B33D (REA dossier 0x8eb0cf)"]
---
Handles vehicle altitude decrease (descent) during Mode 7 overworld flight. Plays engine sound, adjusts camera pitch and flight elevation in $0619, and recalculates perspective projection math.
