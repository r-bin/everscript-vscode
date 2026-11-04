---
addr: 90CD1B
size: 65
end: 90CD5B
kind: code
category: 🧠
name: palette_slot_allocator
title: Dynamic Character Palette Slot Allocator
confidence: confirmed
tags: [entity, graphics, ppu]
evidence: ["disasm: $90:CD1B compares character record palette address +0x09 with active slots and reuses matching loaded slots or streams to a free palette via $90:CF3A"]
see: [routines/character_records.md, routines/palette_cgram_buffer_commit.md]
---
Allocates dynamic PPU palette slots for entities:
- Compares requested 16-color palette address (`record +0x09`) against currently loaded palette slots in Bank `$90`.
- Reuses slots that already contain the palette to conserve CGRAM sub-palettes.
- If missing, streams the 16 colors via `$90:CF3A`.
