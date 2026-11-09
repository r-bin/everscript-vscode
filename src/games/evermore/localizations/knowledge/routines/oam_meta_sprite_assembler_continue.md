---
addr: 80904D
end: 8090F7
size: 171
kind: code
category: 🧠
name: oam_meta_sprite_assembler_continue
title: Secondary iteration loop for packing subsequent sub-cels in multi-cel OAM meta-sprite descriptors
confidence: likely
tags: [unverified, rea-partial-read, widescreen, widescreen.oam, widescreen.cull]
evidence: ["disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Secondary iteration loop for packing subsequent sub-cels in multi-cel OAM meta-sprite descriptors.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Serves as the internal continuation loop for `$80:9040`.
After initial bank setup and header decoding, this entrypoint iterates through the remaining sub-cels defined in a multi-part sprite descriptor.

It unpacks relative X/Y offsets, cel dimension flags, and base tile indices, applying mirroring transformations and assembling OAM attribute words into WRAM buffer memory.

## Callers
- Internal branch from `$80:9040` (`oam_meta_sprite_assembler_with_clipping`)

## Callees
- `$80:96FE` (`obj_16x16_tile_allocate`)
- `$80:A4B5` (`obj_tile_allocate`)

## Variables and memory (hypotheses)
- `$26` (Pointer to current sub-cel record in sprite definition)
- `$AB00..$AC00` (OAM low table staging area)
- `$9726..$9727` (OAM high table staging area)

## Widescreen notes

Read whole (2026-11-09): a sprite with 3 or more chunks has a box (`+2` x s8, `+3` y s8, `+4` w, `+5` h). Signed tests against screen [0, 256) x [0, 224): a box fully inside goes to the fast emitter `$80:92EB` (8-bit coordinates), a box crossing an edge goes to the clipping emitters `$80:90F8`/`$80:91FD`, a box fully outside is skipped. Widescreen must widen this window and the emitters' windows together (framework rules P7/P8).
