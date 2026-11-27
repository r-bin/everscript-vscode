---
addr: 8F9471
size: 196
end: 8F9534
kind: code
name: dog_load_form
title: Load a Dog form's animations and palette into the Dog's record
confidence: confirmed
tags: [entities, dog, sprites]
evidence: ["disasm: $2363 = X; entry = $8F:945D[X] (bank $8F); +0/+1 → $143E, +3/+4 → $4FA5 (the HUD portrait's 24-bit sprite, +3..+5: $CC3C72 wolf, $CC3C79 greyhound, $CC3C80 poodle, $CC3C87 toaster, $CC3C8E Podunk: blocks $7CF-$7D3; v0.377.0), +6 (unless $23CF) → $0A79 (+$09), +8 → $0A83 (+$13), +$0A/+$0C/+$0E → +$32/+$34/+$36, +$10 → +$48, +$12 → +$40, +$14-+$1A → +$38-+$3E, +$1C-+$26 → $1443-$144D"]
see: [routines/character_records.md, routines/boy_load_weapon.md]
---
The Dog's counterpart of the weapon loader: each act gives the Dog a form (word 0 of `$8F:945D` is
no form; six follow), with its own palette, animations and HUD portrait (the face beside its HP,
drawn in the form's palette; the HUD setup `routines/hud_portraits_init.md` names the Boy's). Read by
`sprites/dog-forms.ts`.

**Other tables read by the form** (`DOG_FORM_INDEX`, 2026-11-25), each sized for vanilla's forms, so a new form
needs each one grown: `$80:BF0E` (the Windwalker flight's Dog palette, `$80:BF01`: five words for forms 2-`$0A`),
`$80:C707` (the flight's Dog animation, `$80:C6F9`: `$4322` wolf, `$4402` greyhound and poodle, `$4522` Podunk;
these are the records the animations kind lists with no user, `dog/anim_4402`, `dog/anim_4522`), `$8E:B512`
(`routines/data_8EB514.md`) and the Toaster's bonus (`$8F:866B` `cpx #$000C`). Entry `+0` is the Dog's picture
on its behaviour menu page (`wram/DOG_SPRITE_ANIM_RECORD.md`); `+8` goes to the Dog record's `+$13`, the attack
reach (`$20`; `$FA` on Act 4, whose attacks fire shots): the companion AI attacks once its target is lined up
within it (`routines/enemy_attack_reach_test.md`, `$8F:D9D1`, called by the Dog's `$8F:D0B0` and the Boy's
`$8F:D05E`; 2026-11-27). Slots 9-14 go to `$1443`-`$144D`, animation records the Dog's AI starts
(`wram/DOG_FORM_ANIM_9.md` and the four after it). The loader reads entries with 16-bit offsets in bank `$8F`
(21 `lda.l $8F00xx,x`: `$8F:947C` + 7k for k < 20, and `$8F:951F` for `+6`), the pointer table with a long operand
(`$8F:9477`). Open Evermore grows the forms by rewriting those operands' bank byte and the pointer operand (v0.476.0); a
copy of the routine elsewhere would need every WRAM operand it holds.
