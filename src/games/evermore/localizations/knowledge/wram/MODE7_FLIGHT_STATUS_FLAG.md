---
addr: 7E237D
size: 2
kind: var
name: MODE7_FLIGHT_STATUS_FLAG
title: Mode 7 overworld flight active flag / matched destination landing zone ID
lifetime: room
confidence: confirmed
tags: [mode7, flight, vehicle]
evidence: ["disasm: func_80BC7A ($80:BC7A) writes $FFFF to $7E:237D upon entering Mode 7 flight scene", "disasm: $80:DFFF scans 5-byte landing zone bounding boxes at $80:E061 against ((MODE7_CENTER_X>>3)+1)&$7F and ((MODE7_CENTER_Y>>3)+1)&$7F, writing the matched landing ID (or $FFFF) to $7E:237D", "disasm: checked in $80:BD47 against current vehicle flight target record"]
see: [routines/mode7_flight_scene_bootstrap_and_audio_init.md, routines/mode7_flight_scene_hardware_init.md, routines/install_raster_irq_handler_at_df51.md, docs/disassembly/engine-core/mode7-overworld-engine.md]
---
Tracks the matched overworld landing zone ID during Mode 7 vehicle flight.
- Initialized to `$FFFF` by `$80:BC7A` when entering a Mode 7 scene.
- Updated by `$80:DFFF` (called from `$80:CD74` when pressing B/A to land) by testing tile coordinates
  `(($14A0 >> 3) + 1) & $7F`, `(($14A2 >> 3) + 1) & $7F` against the 5-byte bounding-box table at `$80:E061`.
- Read by `$80:BD47` upon exit to trigger the destination room transition if a valid landing zone (`!= $FFFF`)
  was selected.
