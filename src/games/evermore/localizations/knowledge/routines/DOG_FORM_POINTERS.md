---
addr: CF945F
end: CF946A
size: 12
kind: table
category: 📋
name: DOG_FORM_POINTERS
title: The Dog form pointers seen from $CF:945F (same table as dog_form_entries)
confidence: confirmed
tags: ["dog", "table", "companion"]
evidence: ["disasm: func_CF946B ($8F:9471) stores active form request index into $7E:2363 before loading stats from tbl_dog_form_pointers ($8F:945D/$CF:945F); docs/disassembly/engine-core/rom-tables.md: struct DogBreedAttributes tbl_dog_form_pointers[4], 14 bytes per era form"]
---

The same words as `routines/dog_form_entries.md` (`$8F:945D`, word 0 = no form), seen from `$CF:945F`. Each
points at a 40-byte form entry in bank `$8F` (header and 15 animation records, `routines/dog_load_form.md`), not
at a stat record: the earlier "14-byte DogBreedAttributes" reading was wrong.

The forms belong to the Dog character (`soe://rom/assets/characters/01/`). Open Evermore explodes the six entries
as the `dog_forms` kind, `characters/dog_forms/<form>.json` (v0.472.0): in table order `act1` (`$9395`),
`act1_stick` (`$93BD`), `act2` (`$93E5`), `act3` (`$940D`), `act0` (`$936D`, Podunk) and `act4` (`$9435`).
