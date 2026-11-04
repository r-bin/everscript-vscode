---
addr: 7E24A7
size: 2
kind: var
name: SIMULATION_SCRATCH_A7
title: Current vertical trajectory velocity in subpixels (fixed-point 12.4)
lifetime: room
confidence: confirmed
tags: [scripts, physics, movement]
evidence: ["script: initialized in $94:AC56 as TRAJECTORY_VY = -signed TRAJECTORY_INITIAL_VY ($24B3)", "script: incremented by 1 per frame (gravity acceleration) in $94:AC56, $9A:BA0A, $98:B50D", "script: tested against terminal velocity TRAJECTORY_MAX_VY ($24B5) to terminate fall loops"]
see: [knowledge/wram/SCRIPT_CALL_ARG_1.md, knowledge/wram/SCRIPT_CALL_ARG_2.md, knowledge/wram/SCRIPT_CALL_ARG_3.md, routines/pipe_fall_trajectory.md]
---
Current vertical velocity component (subpixels per frame, 12.4 fixed-point format) used by in-flight trajectory and chute falling simulations.
Initialized with the negated launch speed (`-signed TRAJECTORY_INITIAL_VY`), then incremented each frame by 1 (`TRAJECTORY_VY = signed TRAJECTORY_VY + 1`) to simulate constant downward gravitational acceleration until reaching terminal speed `TRAJECTORY_MAX_VY` (`$7E:24B5`).

This is a purely transient simulation register; saving it to persistent save RAM provides no benefit and it belongs conceptually in `<0x2834>` (`temp[]`).

