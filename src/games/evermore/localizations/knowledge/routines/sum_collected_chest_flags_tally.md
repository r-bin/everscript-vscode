---
addr: 8CC41B
size: 27
end: 8CC435
kind: code
category: 💾
name: sum_collected_chest_flags_tally
title: Treasure gourd and chest collection bitmask sum ($8C:C41B)
confidence: confirmed
evidence: ["disasm: switches DBR to $7E; iterates 13 words (X=$18 down to 0, step 2); sums all words in $7E:2517..$7E:252F (SRAM_CHEST_COLLECTED_FLAGS); returns total accumulated value in A; caller: $8E:9B6F"]
see: [knowledge/wram/sram_chest_flags_0.md, routines/alchemy_menu_populate_rare_items.md]
tags: [save, chests, sram]
---
Computes an accumulated checksum/tally of all opened treasure chests and gourds. Sweeps across all 13 persistent words in `SRAM_CHEST_COLLECTED_FLAGS` (`$7E:2517`..`$7E:252F`), adding them into an accumulator and returning the combined result in register A.
