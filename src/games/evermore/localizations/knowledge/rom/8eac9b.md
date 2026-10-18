---
addr: 8EAC9B
end: 8EACBB
kind: code
category: 🧠
name: weapon_skill_threshold_lookup
title: Look up weapon skill experience threshold and format status menu text
confidence: confirmed
tags: [weapon, progression, ui, menu]
evidence: ["disasm: loads weapon category index from $12; reads required XP threshold from table $C4:5B4A,x; stores target into $0BF5; formats numeric string in $7E:2FF4 via $80:B21F; draws text using descriptor $034D via $8C:9E03", "trace: executed when viewing weapon stats in status menu"]
see: [docs/disassembly/ui/weapon-level-tables.md, docs/disassembly/ui/weapon-select.md, rom/c45b4a.md]
---
Looks up the required experience threshold for the highlighted weapon category from table `$C4:5B4A,x`,
stores the target milestone into `$7E:0BF5`, formats the numeric string into WRAM buffer `$7E:2FF4` through
`$80:B21F`, and renders the text to the status window through `$8C:9E03`.
Full disassembly and clean C reconstruction: `docs/disassembly/ui/weapon-level-tables.md`.
