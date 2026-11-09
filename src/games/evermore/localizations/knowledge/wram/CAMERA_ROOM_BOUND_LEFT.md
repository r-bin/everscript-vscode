---
addr: 7E23E9
end: 7E23F0
kind: struct
name: CAMERA_ROOM_BOUND_LEFT
title: Camera bounds of the room (pixels)
lifetime: room
confidence: confirmed
tags: [camera, map, room, widescreen, widescreen.camera, widescreen.room_bounds, widescreen.limits]
evidence: ["disasm: the room header reader $90:8F80 sets $23E9 = $23EB = 0, $23ED = width x 16, $23EF = height x 16 (v0.369.0)", "disasm: $90:94AB clamps the camera view between $23E9 and $23ED - 256, $23EB and $23EF - 224 (docs/disassembly/engine-core/camera-system.md)", "script: enter scripts write them as pairs (opcode tile pair), e.g. Strong Heart's hut outside $94:E611 (0, 0) and $94:E618 (320, 256), the room's own size"]
see: [routines/room_header_reader_to.md, routines/camera_center_and_clamp.md]
---
| offset | size | name | meaning |
|---|---|---|---|
| `$23E9` | 2 | `MAP_X_START` | left edge the camera can show, in room pixels |
| `$23EB` | 2 | `MAP_Y_START` | top edge |
| `$23ED` | 2 | `MAP_X_END` | right edge (the view stops at `end - 256`) |
| `$23EF` | 2 | `MAP_Y_END` | bottom edge (the view stops at `end - 224`) |

Every room load resets them to the whole map. Scripts narrow them for a scene or a part of
the room and widen them again later. Room pixels are the room picture's: the same as a spawn's
`8 * x`, with no header origin taken off.

## Widescreen notes

The target camera `$BF` is clamped to [this, `$23ED` − 256] with signed compares ($90:9EE1); `$90:94CD` does the same on a snap (asm read 2026-11-09).

## Widescreen notes

These are the active **camera limits**, not only the room size: enter scripts narrow them to one part of a map (`MAP_X_START`/`MAP_Y_START`/`MAP_X_END`/`MAP_Y_END`). Example, room `0x51` (Fire Eyes' village huts, 800 x 896 px): one 256 x 288 box per hut, e.g. (0,0)-(256,288), (272,0)-(528,288), (544,0)-(800,288), (0,304)-(256,592), chosen by `HUT_HOUSE_TO_ENTER` (enter script, read 2026-11-09). A widened view must clip its margins to this box, not to the room: outside it lies the neighbouring hut. The Scripts tab lists every room's writes (`scripts-tab/model/rooms.ts` cameraBounds).
