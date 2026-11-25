---
addr: $7E:144B
name: dog_form_base_hit_rate
type: u16
tags: [dog, animation]
confidence: verified
evidence: ["cdl", "disasm: dog_load_form ($8F:94FA) copies form entry +$24 here; read only as an animation record: the idle cycle's state $0C with a 10-73 frame timer starts it ($8F:D1AF)"]
---
The Dog form's animation slot 13, not a stat (old name, to be renamed `DOG_FORM_ANIM_13`): a later pose of
the idle cycle (states `$0B` → `$0D` → `$0C`). Unlabelled in the Sprites tab (Act 1: `$4312`).
