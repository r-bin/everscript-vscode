---
addr: 80F6E3
end: 80F752
size: 112
kind: table
category: 📋
name: tbl_mode7_flight_horizon_pitch_curve
title: Mode 7 flight horizon pitch and deceleration trajectory lookup table (56 words)
confidence: confirmed
tags: [mode7, flight, horizon, pitch, camera, table]
evidence: ["disasm: 112 bytes at $80:F6E3..$80:F752 containing 56 signed 16-bit word offsets; indexed by scene transition / flight progress step $7E:14BA by mode7_flight_compass_needle_and_heading_update"]
see: [ram/7e14ba.md, routines/tbl_80F693.md, routines/tbl_80F753.md]
---
Mode 7 perspective horizon pitch and trajectory curve lookup table holding 56 signed 16-bit words (decaying from 30 down to -14). Indexed by flight progress counter `$7E:14BA` to smoothly tilt the horizon and settle the aircraft pitch angle during Mode 7 takeoff, flight, and landing transitions.
