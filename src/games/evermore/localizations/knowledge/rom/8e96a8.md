---
addr: 8E96A8
end: 8E9909
size: 610
kind: code
category: 🧠
name: ring_menu_options_and_targeting_subroutines
title: Ring menu option item handlers, target selection cursor math, and coordinate loaders
confidence: confirmed
tags: [ring-menu, options, targeting, ui, cursor]
evidence: ["disasm: 610 bytes at $8E:96A8..$8E:9909; handles ring menu options subroutines, targeting reticle coordinates for entity Y ($0F42) at $8E:98E6, exits via RTL"]
see: [rom/8e95a6.md, rom/8e9618.md, rom/8e990a.md]
---
Ring menu options handling and targeting coordinate calculation routines:
- Processes player options selection (stereo/mono audio, controller layout, window color customization).
- Loads 3D coordinates `(X, Y, Z)` from active target entity slot `$0F42` into `$44, $46, $48` and invokes targeting vector handler `$8F:C2E4`.
- Returns via `RTL`.
