---
addr: 7E242B
end: 7E242E
kind: var
name: CAMERA_SCRIPTED_TARGET_X
title: Fixed camera target (x, y), or follow an entity
lifetime: room
confidence: likely
tags: [widescreen, widescreen.camera, widescreen.cutscene]
evidence: ["disasm: $90:94AB uses x = $242B + $80, y = $242D + $70 when $242B is not negative; otherwise follows the entity at $0F42 (REA/Ghidra spike, v0.201.7)", "disasm: $90:8E90 sets both words to $FFFF on room reset"]
see: [knowledge/wram/CAMERA_TARGET_ACTOR_PTR.md]
---
Two words that pin the camera to a fixed map point (x at `$242B`, y at `$242D`, top-left of
the view). `$FFFF` (negative) means "no fixed point": the camera follows an entity instead.
Rooms start in follow mode; presumably scripts set a point for cutscenes.

## Widescreen notes

Negative = follow the actors; otherwise the camera target `$BF` is set to it directly ($90:9EA1). A non-negative value is a cheap sign that a script owns the camera (asm read 2026-11-09).
