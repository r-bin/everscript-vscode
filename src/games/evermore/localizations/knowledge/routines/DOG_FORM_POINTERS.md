---
addr: CF945F
end: CF946A
size: 12
kind: table
category: 📋
name: DOG_FORM_POINTERS
title: Companion dog breed form attribute pointer table ($CF:945F)
confidence: confirmed
tags: ["dog", "table", "companion", "breed", "stats"]
evidence: ["disasm: func_CF946B ($8F:9471) stores active form request index into $7E:2363 before loading stats from tbl_dog_form_pointers ($8F:945D/$CF:945F); docs/disassembly/engine-core/rom-tables.md: struct DogBreedAttributes tbl_dog_form_pointers[4], 14 bytes per era form"]
---

Companion dog breed form base attribute pointers in Bank $CF (`tbl_dog_form_pointers`, 6 words).

Points to the 14-byte `DogBreedAttributes` attribute record for each historical era's dog form:
- Prehistoric Wolfhound (`$9395`)
- Antiquity Greyhound (`$93BD`)
- Medieval Poodle (`$93E5`)
- Omnitopia Toaster Dog (`$940D`)
- Additional dog form variants (`$936D`, `$9435`)

Unpacked into companion active fields and WRAM (`DOG_FORM_ANIM_9` / `$7E:2363`) by `func_CF946B` whenever the Dog transforms upon arriving in a new historical era.
