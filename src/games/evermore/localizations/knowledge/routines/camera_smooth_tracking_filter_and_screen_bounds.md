---
addr: 909F21
size: 168
end: 909FC8
kind: code
category: 🧠
name: camera_smooth_tracking_filter_and_screen_bounds
title: Camera smooth tracking filter, velocity rate-limiting and viewport frustum bounds
confidence: confirmed
tags: [system, widescreen, widescreen.camera]
evidence: ["disasm: at $90:9F21, unpacks camera velocity configuration from $7E:242F into whole pixels (>> 4) and sub-pixel fractional rate (& 0x0F); accumulates fractional rate into $7E:0F38 adding whole pixel carry on overflow; clamps horizontal delta DX = BF - 12 and vertical delta DY = C1 - 14 against max panning speed; superimposes screen shake offsets from DP $C5 and $C7 with zero underflow clamping; computes active 256x224 frustum bounding box into $7E:2401..$7E:2407 (docs/disassembly/engine-core/camera-smooth-tracking.md)"]
---
Applies sub-pixel fractional velocity integration and rate-limiting to overworld camera pan delta. Unpacks speed parameter from `$7E:242F`, accumulates fractional 1/16th pixel carry into `$7E:0F38`, and clamps horizontal ($\Delta X$) and vertical ($\Delta Y$) camera motion against the maximum frame velocity. Superimposes signed screen shake offsets from Direct Page `$C5` and `$C7` (clamped against negative underflow) and commits the active 256×224 viewport bounding rectangle into `$7E:2401`..`$7E:2407` for actor and particle frustum culling.

## Widescreen notes

Verified: rate-limits the move of `$BF`/`$C1` by `$242F` (with a 4-bit sub-pixel accumulator `$0F38`), then writes the **rendered** camera DP `$59` = clamp(`$BF` + `$C5`, 0, `$08F6`) and `$5B` = clamp(`$C1` + `$C7`, 0, `$08F8`) (`$C5`/`$C7` = shake), and the viewport box `$2401..$2407` from `$BF`/`$C1`. `$59`/`$5B` is what every world-to-screen conversion subtracts (asm read 2026-11-09).
