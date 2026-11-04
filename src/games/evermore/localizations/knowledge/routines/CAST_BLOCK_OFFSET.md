---
addr: C45F97
end: C45FC4
size: 46
kind: table
category: ⚗️
name: CAST_BLOCK_OFFSET
title: Spell id of script opcodes $9E / $AC → its $91 block offset
confidence: likely
tags: [alchemy, script-vm]
evidence: ["disasm: the handlers of opcodes $9E ($8C:D0D0) and $AC ($8C:D0C3) read $C4:5F97 and $C4:5FC5 by the spell id (routines/script_op_9e_cast_all.md)", "read: 23 even words; offset + $91:80A6 gives the same $91 block a formula with that name has (cast 0 → 2 = Acid Rain, cast 2 → 6 = Flash), and 5F97 + 46 = 5FC5 (v0.328.0)"]
see: [routines/CAST_AND_INGREDIENT_NAMES.md, routines/ALCHEMY_ANIM_MAP.md, routines/ALCHEMY_BLOCK_TABLE.md, routines/script_op_9e_cast_all.md]
---
The spell a script makes a character cast (opcodes `$9E` / `$AC`, Everscript `cast(...)`) is an
even id 0–`$2C`; this table gives, per id, the offset into `$91:80A6` that selects the spell's
block in bank `$91` — the same kind of offset the formula table `$C4:5DDF` holds. Ids whose block
no formula has are enemy-only spells (Confound, Heat Wave, Storm, Disrupt, Plague). The names are
the parallel table `$C4:5FC5`.
