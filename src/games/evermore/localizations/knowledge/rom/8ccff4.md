---
addr: 8CCFF4
size: 9
kind: code
category: 🧠
name: wram_word_or_mask_at_x_plus_9
title: OR the accumulator into the WRAM word at X+9
confidence: confirmed
tags: ["flags","helper"]
evidence: ["disasm: full body read (3 instructions): word at $7E:0009+X |= A","disasm: only callers are $8F:A8E2 and $90:83AC, which pass an entity-held pointer and mask"]
see: ["src/games/evermore/localizations/knowledge/rom/8fa8e2.md"]
---
Sets the bits of A in the 16-bit WRAM word at address X + 9 (bank $7E). Its two callers pass a pointer and a bit mask stored in an entity (+$88/+$8A, or a waypoint node), so it works as "tell whoever waits on that flag word that I am done".
