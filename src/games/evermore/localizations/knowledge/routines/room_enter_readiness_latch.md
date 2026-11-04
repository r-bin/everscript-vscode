---
addr: 8EE562
size: 5
end: 8EE566
kind: code
category: 🧠
name: room_enter_readiness_latch
title: Finalize room readiness and dispatch audio fadeout transition
confidence: confirmed
tags: [engine-core, room, lifecycle, transition]
evidence: ["disasm: reached when $7E:22EA has bits 3, 4, 5 simultaneously asserted, executes JSL $8E:E592 to fade out audio and reset DSP, and executes RTL back to main loop", "trace: transition gate between room loading and active gameplay loop"]
see: [docs/disassembly/maps/room-spawn-align.md, routines/room_enter_pre_roll_wait_and_entity_spawn.md, routines/room_transition_audio_fadeout_and_dsp_reset.md]
---
Room entrance completion gatekeeper. Reached once map tiles, character placement, and palette fade registers are confirmed
ready in `$7E:22EA`. Invokes `$8E:E592` to finalize audio transition and resets DSP echo, then executes `RTL` to transfer
control to the interactive main gameplay loop.
Full disassembly and clean C reconstruction: `docs/disassembly/maps/room-spawn-align.md`.
