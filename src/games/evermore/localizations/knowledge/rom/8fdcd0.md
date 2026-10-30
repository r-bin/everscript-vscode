---
addr: 8FDCD0
end: 8FDDB3
kind: code
category: ⚙️
name: companion_dog_ingredient_dig_find_trigger
title: Dog companion ingredient discovery and dig behavior trigger
confidence: likely
tags: [dog, companion, ingredients, alchemy, dig, ai]
evidence: ["disasm: called by companion_dog_sniff_and_forage_timer_tick ($8F:DC34); scans hidden ingredient nodes in room table $7F:0000,X; checks node discovered bitmask; sets ingredient found flag $1459 = 1; points Dog AI to ingredient coordinates in $1457 (REA dossier 0x8fdcd0)"]
---
Scans the current room for hidden alchemy ingredient nodes. If an undiscovered ingredient is within sniffing range, it marks the node, alerts the Dog AI to steer toward it, and triggers the sniffing/barking behavior.
