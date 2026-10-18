---
addr: 90CDAF
end: 90CE91
kind: code
category: 🧠
name: palette_free_slot_search
title: Search loaded sprite palettes for asset deduplication or empty slot
confidence: confirmed
tags: [sprites, palettes, search, cgram]
evidence: ["disasm: scans slots 2..7 in $7E:0DE0; pass 1 checks if target asset ID is already loaded (deduplication match); pass 2 checks for unassigned empty slot (ID == 0); on match returns slot index in X with Carry Clear (CLC); if all dynamic slots occupied returns Carry Set (SEC)", "trace: internal search loop of sprite palette allocator"]
see: [docs/disassembly/entities/palette-allocator.md, rom/90cd80.md]
---
Scans dynamic sprite palette slots 2..7 in `$7E:0DE0` in a two-pass algorithm:
re-uses an already loaded palette group if identical (deduplication), or allocates
the first empty slot, returning `CLC` on success or `SEC` when exhausted.
Full disassembly and clean C reconstruction: `docs/disassembly/entities/palette-allocator.md`.
