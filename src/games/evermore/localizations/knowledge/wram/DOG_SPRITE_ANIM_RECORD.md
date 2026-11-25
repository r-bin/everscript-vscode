---
addr: $7E:143E
name: DOG_SPRITE_ANIM_RECORD
type: u16
tags: ["companion", "dog", "menu"]
confidence: verified
evidence: ["cdl", "disasm: dog_load_form ($8F:947C-$948A) copies form entry +0..+2 here and into $1440 (a 24-bit sprite: $CB1867, $CB32B7, $CB43AC, 0 for Act 0, $CB5755)", "disasm: $8D:883E draws it with direct_sprite_draw_oam ($26/$28 = $143E/$1440) on the menu page that sets the Dog's attack mode ($0B0D picks the row)"]
---
The Dog form's picture on the Dog's behaviour menu page: a sprite info (metasprite) in `$CA-$D3`, low word
here, bank at `$1440`. Act 0 (Podunk) has none (0): a form used outside Podunk needs one.
