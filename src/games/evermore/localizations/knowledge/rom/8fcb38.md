---
addr: 8FCB38
end: 8FCBDF
size: 168
kind: table
category: 📋
name: tbl_segment_ease_deceleration_curve
title: Segment ease deceleration curve table (84 entries × 2B)
confidence: confirmed
tags: [motion, physics, easing, deceleration, table]
evidence: ["disasm: 168 bytes at $8F:CB38..$8F:CBDF containing 84 16-bit word offsets forming an easing deceleration curve companion to SEGMENT_EASE_DISTANCE_SHARE ($8F:CB18)"]
see: [routines/SEGMENT_EASE_DISTANCE_SHARE.md, rom/8fca70.md]
---
Kinematic easing deceleration curve table holding 84 16-bit words (`0x0505, 0x047E, 0x040B, 0x03A8...`). Interpolated by camera pan and entity position interpolators to smoothly damp velocity to zero upon reaching target coordinates.

