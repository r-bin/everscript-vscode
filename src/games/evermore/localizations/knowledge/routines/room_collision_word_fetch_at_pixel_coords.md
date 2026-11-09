---
addr: 9099FB
end: 909A80
size: 134
kind: code
category: 🧠
name: room_collision_word_fetch_at_pixel_coords
title: Reads the 16-bit room collision word at specified pixel coordinates from the active collision matrix
confidence: guess
tags: [unverified, rea-partial-read, widescreen, widescreen.streaming]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Reads the 16-bit room collision word at specified pixel coordinates from the active collision matrix.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Queries the terrain collision properties at exact room coordinates.
The routine converts pixel X and Y coordinates into 16x16 tile offsets, indexes the active room collision word matrix in WRAM at `$7E:95A5`, and returns the 16-bit collision attribute word defining passability, elevation, and terrain flags.

## Callers
- `$90:9BDD` (`func_909BDD`)

## Callees
- None

## Variables and memory (hypotheses)
- `$7E:95A5` (Active room terrain collision word matrix in WRAM)
- `$02`, `$04` (Input query pixel coordinates)

## Widescreen notes

Read whole (2026-11-09): builds one tilemap **column** (left, or right = left + `$0FAC` − 1) of 15 cells into the ring buffer at `$2E` and queues it (VMAIN `$81`). Not a collision fetch.
