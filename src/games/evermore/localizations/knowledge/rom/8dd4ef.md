---
addr: 8DD4EF
end: 8DD8B0
kind: code
category: 💾
name: save_menu_slot_management_formatter
title: Save menu slot copy/erase management screen formatter
confidence: likely
tags: [save, sram, management, menu, ui]
evidence: ["disasm: called from save slot picker loop $8D:D303; sets up the four slot windows ($0391-$0423); loads string pointer $C4:1EE4; enqueues save menu palettes via $80:85FA; formats slot copy and deletion status summaries into window tilemap buffers via $80:B21F and $8C:9E03 (REA dossier 0x8dd4ef)"]
---
Formats the four save slot summary windows when managing save data (copying or erasing existing save files), displaying status text and destination indicators.
