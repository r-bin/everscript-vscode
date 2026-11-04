---
addr: 7E2363
size: 2
kind: var
name: DOG_FORM_INDEX
title: Current active Dog form ID
lifetime: save
confidence: confirmed
tags: [dog, companion, form]
evidence: ["disasm: func_CF946B ($8F:9471) stores active form request index into $7E:2363 before loading stats from tbl_dog_form_pointers ($8F:945D)"]
see: [knowledge/wram/ROOM_METATILE_DESCRIPTOR_PTR.md, knowledge/wram/ENTITY_COMPANION_DOG.md]
---
Stores the Companion (Dog) active form ID across room loads and save states.

Values correspond to form table indices:
- `0`: Default
- `2`: Prehistoria Wolf
- `4`: Wolf with stick
- `6`: Antiqua Greyhound
- `8`: Gothica Poodle
- `$0A`: Podunk Dog
- `$0C`: Omnitopia Toaster Dog

When `DOG_FORM_REQUEST` (`$7E:2443`) is processed upon entering a new map, `func_CF946B` stores the new form index here and updates all dog combat attributes, hitboxes, and scent detection radius accordingly.

