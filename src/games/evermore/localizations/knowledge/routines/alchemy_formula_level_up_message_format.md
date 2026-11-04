---
addr: 91CDC7
end: 91CE37
size: 113
kind: code
category: 🧠
name: alchemy_formula_level_up_message_format
title: Alchemy formula level-up notification message formatter (" now level ")
confidence: confirmed
tags: [alchemy, progression, level-up, format, text, dialogue]
evidence: ["disasm: 113 bytes at $91:CDC7..$91:CE37; directly follows alchemy_formula_award_cast_xp_and_level_up ($91:CD44); formats formula level-up dialogue string ending with ASCII literal ' now level ' at $91:CE2C..$91:CE37; returns via RTL"]
see: [routines/alchemy_formula_award_cast_xp_and_level_up.md, routines/alchemy_formula_calc_available_casts.md, knowledge/wram/FORMULA_COMBAT_POWER_ARRAY.md]
---
Formats and displays the in-game notification banner when an alchemy formula levels up:
- Fetches formula name pointer from master directory `$C4:601F,X`.
- Appends the level-up notice string: `" now level "` (`$91:CE2C..$91:CE37`).
- Formats the new decimal level number and queues the message banner into the dialogue display pipeline.
- Returns via `RTL` at `$91:CE2B`.

