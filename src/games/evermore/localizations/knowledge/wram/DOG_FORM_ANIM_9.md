---
addr: 7E1443
size: 2
kind: var
name: DOG_FORM_ANIM_9
title: The Dog form's animation slot 9 (an animation record the Dog's AI starts)
lifetime: room
confidence: confirmed
tags: [dog, companion, animation]
evidence: ["disasm: dog_load_form ($8F:94DE) copies form entry +$1C here", "disasm: read as an animation record id in bank $C4: `ldx $1443 : jml anim_start_record` ($8F:D054), and as the first of a pair with DOG_FORM_ANIM_10 handed to $90:8260, which starts slot 10 when the Dog's +$64 byte is set and slot 9 otherwise ($8F:D00E, $8F:D04A, $8F:D129: the sniff command and the companion AI; `ldx` also at $8F:D133)", "rom: values $425E (Act 1, Act 0), $435A (Act 2) — record offsets in $C4:3E3A-$5999, not stats"]
see: [routines/dog_load_form.md, wram/DOG_FORM_ANIM_10.md]
---
Slot 9 of the Dog's current form (`routines/dog_load_form.md`): an animation record, played while the Dog
heads for or works a sniff spot. Earlier text here called it an attack stat; the values are animation
record ids and every reader starts them as animations. Act 0 (Podunk) borrows the Act 1 wolf's record.
