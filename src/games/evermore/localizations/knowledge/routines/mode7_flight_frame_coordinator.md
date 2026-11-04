---
addr: 8EB200
size: 48
end: 8EB22F
kind: code
category: 🧠
name: mode7_flight_frame_coordinator
title: Mode 7 flight frame execution loop and rendering coordinator
confidence: confirmed
tags: [mode7, overworld, engine]
evidence: ["disasm: calls minimap_overlay_dispatcher ($90:9876), mode7_flight_pitch_heading_math ($8E:B33D), update_entity_physics ($80:96BB), and mode7_vehicle_cockpit_overlay_sprites ($8F:C61E)", "trace: primary frame execution loop during overworld flight"]
see: [docs/disassembly/engine-core/flight-horizon.md, docs/disassembly/engine-core/mode7-flight.md, routines/mode7_flight_horizon_perspective_math.md, routines/mode7_vehicle_cockpit_overlay_sprites.md]
---
Coordinates the execution pass for each Mode 7 flight frame: updates the minimap blip radar,
computes trigonometric heading/pitch deltas, integrates actor physics, and renders cockpit
overlay sprites.
Full disassembly and clean C reconstruction: `docs/disassembly/engine-core/flight-horizon.md`.
