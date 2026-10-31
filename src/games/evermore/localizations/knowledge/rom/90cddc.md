---
addr: 90CDDC
kind: code
category: 🎨
name: entity_apply_palette_slot
title: Entity sprite palette loader and slot assignment ($90:CDDC)
confidence: confirmed
evidence: ["disasm: reads palette slot from entity +$75,Y; stores to active palette +$0C,Y and +$74,Y; checks for special slots $0C (Boy) and $0E (Dog); sets palette pointer in $7E:1278,X from $0A2F or $0A79; invokes $90:CF3A (load_sprite_palette)"]
see: [rom/90cf3a.md, ram/7e1278.md]
tags: [sprites, palette, entities]
---
Copies sprite palette index from entity record `+$75,Y` to active palette attribute `+$0C,Y` and base palette `+$74,Y`. When targeting player character slots (`$0C` or `$0E`), sets the sprite palette source descriptor at `$7E:1278,X` from WRAM `$0A2F` (Boy) or `$0A79` (Dog) and calls `load_sprite_palette` (`$90:CF3A`) to upload colors to CGRAM.
