---
addr: 7E144D
size: 2
kind: var
name: dog_form_scent_radius
title: The Dog form's animation slot 14 (no code reader found)
lifetime: room
confidence: likely
tags: [dog, companion, animation]
evidence: ["disasm: dog_load_form ($8F:9505) copies form entry +$26 here", "rom: the bytes `4D 14` occur once in the code banks, the loader's own store (2026-11-25); the earlier claim of a reader at $8F:803C is not in the ROM's code", "rom: values $433A (Act 1, Act 0), $438A (Act 2), $44E2 (Act 3): animation record ids"]
see: [knowledge/wram/DOG_FORM_ANIM_9.md]
---
Slot 14 of the Dog's form, an animation record (the Sprites tab's "Bark"), not a scent radius (old name, to
be renamed `DOG_FORM_ANIM_14`). Nothing in the code reads it directly; an indexed read or a script is still
possible. Act 0 has its own bark (`$4526`, `animations/dog/act0_bark`) but its slot holds the wolf's.
