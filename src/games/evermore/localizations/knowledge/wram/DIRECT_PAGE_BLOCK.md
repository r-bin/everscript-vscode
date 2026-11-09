---
addr: 7E0000
size: 256
kind: struct
name: DIRECT_PAGE_BLOCK
type: DirectPageBlock
title: SNES Direct Page continuous register scratchpad
lifetime: boot
confidence: confirmed
tags: [direct-page, math, registers, widescreen, widescreen.camera]
evidence: ["disasm: CPU register D is set to $0000 across core engine routines in banks $80..$9F", "disasm: direct page operations span $7E:0000..$7E:00E1 contiguously"]
see: [knowledge/wram/PPU_FRAME_COUNTER_LOW.md]
---
Continuous 256-byte (`$7E:0000`..`$7E:00FF`, size 0x0100) SNES Direct Page register scratchpad.

Internal functional partitions:
- `$7E:0000`..`$7E:0007`: Screen coordinate translation, camera scroll offsets, and coordinate math operands.
- `$7E:0008`..`$7E:0021`: General-purpose function parameters, return values, and inner loop counters.
- `$7E:0022`..`$7E:0028`: Long 24-bit source/destination memory pointers (dialogue streams, metasprites).
- `$7E:002E`..`$7E:0044`: Active palette indices, DMA channel settings, and metatile address offsets.
- `$7E:0046`..`$7E:0056`: Active actor entity loop index pointers and collision test registers.
- `$7E:007E`..`$7E:0086`: Script VM thread execution registers (active slot pointer, thread status, PC, bank).
- `$7E:008B`..`$7E:00DC`: Audio driver handshake parameters and sprite rendering coordinates.
- `$7E:00DD`..`$7E:00E1`: Hardware multiplication/division operands and sprite tile indices.
- `$7E:00E2`..`$7E:00FF`: Stack / Direct Page margin bytes.

## Camera fields (asm read 2026-11-09)

- `$59`/`$5B` (`camera_x`/`camera_y`): the **rendered** camera, top-left of the 256 × 224 screen in
  room pixels: target + shake, clamped to [0, `$7E:08F6`] / [0, `$7E:08F8`] by `$90:9F21`. Every
  world-to-screen conversion subtracts it (sprite depth `$8F:C773`, sleep/wake `$8F:C40F`, spawner
  `$8F:DDBB`, targeting `$8C:8658`, damage popups `$8C:888F`); camera mode 0 copies it into the BG
  scroll shadows (`$90:9A98`).
- `$BF`/`$C1` (`camera_target_x`/`_y`): where the camera wants to be: the scripted target
  `$7E:242B`/`$242D` when that is non-negative, else the deadzone filter on the camera actor
  `$7E:0F42`; clamped to the camera limits `$7E:23E9..$23EF` (`$90:9E93`).
- `$C5`/`$C7` (`shake_offset_x`/`_y`): screen shake added on top of the target.
- `$E0`/`$E1` are OAM assembler counters; nothing uses `$E2`/`$E4` as a camera (a recomp note
  once claimed so). Behaviour outside the screen: `docs/entities/off-screen-behaviour.md`.

Immediately followed at `$7E:0100` by the PPU Shadow Register mirror block.
