---
addr: 8CCEE9
end: 8CCF17
kind: code
category: 🧠
name: script_stop_all_threads
title: Script VM — stop every thread
confidence: likely
tags: [script-vm]
evidence: ["disasm: clears bit 0 of $22EE, writes $4000 to $4EC7 and $4F75, zeroes byte +3 of every slot from $28FC in steps of $4F up to $2F28, empties the run list (DP $86 = 0, $2F28 = 0)"]
see: [docs/game-research/script-vm/README.md]
---
Ends all scripts: every slot's pointer bank byte (+3) becomes 0 (a free slot) and the run list is
emptied. The warp and map-change handlers (`0x21` at `$8C:DBB9`, `0x22` at `$8C:DB71`) call it before
moving the player. The writes to `$4EC7` and `$4F75` are +`$3E` of the boy's and the dog's entity
records (`$4E89`, `$4F37`), the count of scripts bound to an entity (`0x4E` raises and lowers it).
