---
addr: 8FCA70
end: 8FCB17
size: 168
kind: table
category: 📋
name: tbl_segment_ease_acceleration_curve
title: Segment ease acceleration curve table (84 entries × 2B)
confidence: confirmed
tags: [motion, physics, easing, acceleration, table]
evidence: ["disasm: 168 bytes at $8F:CA70..$8F:CB17 containing 84 16-bit word offsets forming an easing acceleration curve companion to SEGMENT_EASE_VELOCITY_SHARE ($8F:CA50)"]
see: [routines/SEGMENT_EASE_VELOCITY_SHARE.md, routines/tbl_segment_ease_deceleration_curve.md]
---
Kinematic easing acceleration curve table holding 84 16-bit words (`0x0C8D, 0x0CBA, 0x0CE2, 0x0D07...`). Interpolated by camera pan and cutscene entity movement easing routines to smoothly ramp velocity up from stationary positions.

