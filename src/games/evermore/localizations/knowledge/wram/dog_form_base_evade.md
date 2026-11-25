---
addr: $7E:1449
name: dog_form_base_evade
type: u16
tags: [dog, animation]
confidence: verified
evidence: ["cdl", "disasm: dog_load_form ($8F:94F3) copies form entry +$22 here; read only as an animation record: the companion idle cycle enters state $0B with a 60-315 frame timer and starts it ($8F:D166)"]
---
The Dog form's animation slot 12, not a stat (old name, to be renamed `DOG_FORM_ANIM_12`): the first pose
of the idle cycle when the Dog waits beside the Boy. The Sprites tab labels the slot "Sit" (Act 1: `$4302`).
