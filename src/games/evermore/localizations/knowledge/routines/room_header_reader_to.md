---
addr: 908F80
size: 560
end: 9091AF
kind: code
category: 🧠
name: room_header_reader_to
title: Room header reader (to `$90:9050`)
confidence: confirmed
tags: [graphics, map, system, widescreen, widescreen.room_bounds, widescreen.camera]
evidence: ["legacy: migrated from functions.ts; how it was learned was not recorded (sources then: the everscript wiki ROM map, the ROM tab's points.ts)", "disasm: $90:8F80..$90:8FD1 stores origin x/y to $0F86/$0F88, width to $08EE (x2 $0F46, x16 $23ED), height to $08F0 (x16 $23EF), and 0 (TDC, D = 0) to $23E9 and $23EB (v0.369.0)"]
see: [knowledge/wram/CAMERA_ROOM_BOUND_LEFT.md]
---
Room header reader (to `$90:9050`). Reads the blob's first bytes: origin x and y, then the
width and height in 16 px tiles. It also resets the camera bounds (`ram/7e23e9`) to the whole
map: left and top 0, right width × 16, bottom height × 16. An enter script that writes those
same values changes nothing.

## Widescreen notes

Verified (2026-11-09): from the header it sets the room size `$08EE..$08F4`, the camera bounds `$23E9..$23EF` (0..size), the camera max `$08F6`/`$08F8` (size − 256 / − 224), the room-edge inset box `$0F48..$0F4E`, TM/TS/CGADSUB/CGWSEL, the camera mode `$241F` and the header flags `$0F84`.
