---
addr: 8DCF1A
end: 8DD2DB
kind: code
category: 💾
name: save_menu_slot_stats_formatter
title: In-game save menu slot summary card formatter
confidence: likely
tags: [save, menu, sram, ui]
evidence: ["disasm: called from script opcode 0x8C ($8C:E39A) and save slot picker loop $8D:D303; sets up 4 save slot windows at $0391-$0421; reads slot records from SRAM, formats player level, gold, and play clock via $80:B21F and $8C:9E03; loops until checksum validation branch $8D:CD1C (REA dossier 0x8dcf1a)"]
---
Formats the four save slot summary cards for the in-game save menu triggered by save points or script opcode 0x8C, rendering metadata for existing save files.
