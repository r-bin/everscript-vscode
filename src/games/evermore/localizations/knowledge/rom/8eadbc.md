---
addr: 8EADBC
end: 8EAE85
kind: code
category: 🏪
name: shop_dialogue_prompt_joypad_wait_and_sfx
title: Shop dialogue prompt joypad debounce and chime wait loop
confidence: likely
tags: [shop, input, joypad, debounce, sound]
evidence: ["disasm: called by shop buy/sell prompt loops ($8E:A456..$8E:AC0B); closes previous subwindow via $8E:AE85; waits for button press in $0104; triggers prompt select chime via $8E:AFF4; acknowledges joypad via $80:8597; returns SEC with status flag $20 (REA dossier 0x8eadbc)"]
---
Standard joypad wait and debounce loop for merchant shop dialogue prompts, handling cursor confirmation sound effects and button acknowledge signals.
