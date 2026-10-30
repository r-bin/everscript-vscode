---
addr: 8D8DFF
end: 8D8FD1
kind: code
category: 🎛️
name: ring_menu_boy_stats_line_formatter
title: Boy character stats line and weapon name formatter
confidence: likely
tags: [ring-menu, boy, stats, weapon, ui]
evidence: ["disasm: called by ring_menu_boy_selection_loop ($8D:91AF); loads string pointer $8D:8FD1; formats Boy HP, attack power rating, and equipped weapon name via $80:B21F and $8C:9E03 into window $0409 (REA dossier 0x8d8dff)"]
---
Formats the Boy protagonist status line for the boy ring menu, converting current hit points, attack power, and equipped weapon name into decimal text strings.
