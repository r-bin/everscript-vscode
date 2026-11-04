---
addr: 8E0000
size: 32768
end: 8E7FFF
kind: table
category: 👥
name: character_database_templates_bank_base
title: Character database templates and party member definitions base in Bank $8E
confidence: confirmed
tags: [character, database, templates]
evidence: ["src/games/evermore/emulator/host.ts references $8E:0000 as the base for character stat templates"]
---
Base address for character database templates and stats in Bank `$8E` (`$8E:0000–$8E:7FFF`). Hosts base stat structures, weapon affinities, and initial character parameter records.