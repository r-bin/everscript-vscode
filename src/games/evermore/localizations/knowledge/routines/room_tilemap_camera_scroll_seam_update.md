---
addr: 9093AA
end: 90945F
size: 182
kind: code
category: 🧠
name: room_tilemap_camera_scroll_seam_update
title: Calculates dirty 16x16 tile column and row seams for VRAM tilemap streaming as the camera scrolls
confidence: likely
tags: [unverified, rea-partial-read, widescreen, widescreen.streaming]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Calculates dirty 16x16 tile column and row seams for VRAM tilemap streaming as the camera scrolls.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Manages seamless background tilemap streaming during room camera panning.
When camera position variables (`$0112`, `$0114`) cross 16-pixel tile seams, the routine computes boundary row/column indices and enters newly revealed room tile descriptors into VRAM DMA staging buffers at `$0F98` and `$0F9A`.

## Callers
- `$90:94AB` (`FUN_9094ab`)

## Callees
- None

## Variables and memory (hypotheses)
- `$0112` (Camera world horizontal scrolling coordinate)
- `$0114` (Camera world vertical scrolling coordinate)
- `$0F98`, `$0F9A` (VRAM dirty seam streaming buffer entries)

## Widescreen notes

Read whole (2026-11-09): the **full-window** BG tilemap upload, not a seam update. For BG2 (VRAM `$0400`, metatile layer word `+2`; BG1 enters at `$90:93DF` with 0/0) it clears the 32x32 map by a fixed-source DMA from `$7F:8000`, then writes `$0FAC` cells x 15 rows from the room grid `$7F:0000` straight to `$2118`, wrapping at 32 columns. Only this window is drawn; the rest of the VRAM ring stays blank.
