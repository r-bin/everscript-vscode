---
addr: $7E:1447
name: dog_form_base_magic_def
type: u16
tags: [dog, animation]
confidence: verified
evidence: ["cdl", "disasm: dog_load_form ($8F:94EC) copies form entry +$20 here; read only as an animation record (`ldx $1447 : jsl/jml anim_start_record`): $8F:CFE6 when the player steers the Dog and holds no direction, $8E:E2DC, $8F:D2B6"]
---
The Dog form's animation slot 11, not a stat (the name is an old guess, to be renamed `DOG_FORM_ANIM_11`
with the `wram` kind). The Dog plays it standing still: steered by the player with no direction held,
and in two companion routines. The Sprites tab labels the slot "Sleep" (Act 1: record `$42EE`, one facing).
