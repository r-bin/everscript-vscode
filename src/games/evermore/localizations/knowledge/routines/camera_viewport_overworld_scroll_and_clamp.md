---
addr: 909E93
size: 57
end: 909ECB
kind: code
category: 🧠
name: camera_viewport_overworld_scroll_and_clamp
title: "Camera viewport: overworld scroll, dual-player midpoint tracking and clamp"
confidence: confirmed
tags: [system, widescreen, widescreen.camera]
evidence:
  - "docs/disassembly/engine-core/camera-viewport-scroll.md"
---

Coordinates overworld camera scrolling, stationary cutscene anchors (`$7E:242B`), dual-player / companion midpoint lead tracking (`$7E:0F42` & `$7E:143A`), and room boundary clamping against limits `$7E:23E9`..`$7E:23EF`.
Calls deadzone bounding box filter `camera_deadzone_window_filter` (`$90:9FC9`) and applies Mode 7 flight horizon bias (`$90:9ECC`).

## Widescreen notes

Verified: saves `$BF`/`$C1` to DP `$12`/`$14`, takes `$242B`/`$242D` when non-negative, else runs the deadzone filter on `$0F42` and `$143A`, applies the flight bias, clamps `$BF` to [`$23E9`, `$23ED` − 256] and `$C1` to [`$23EB`, `$23EF` − 224] with signed compares, and falls into `$90:9F21` (asm read 2026-11-09).
