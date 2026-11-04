---
addr: FE8000
size: 32768
end: FEFFFF
kind: code
category: 🧠
name: exhirom_scale_enemies_hook
title: ExHiROM enemy scaling and difficulty mod hook in Bank $FE
confidence: confirmed
tags: [combat, exhirom, hooks]
evidence: ["docs/exhirom/mods.md documents dynamic enemy stat scaling patch placed at $FE:8000"]
---
Engine modification hook routine at `$FE:8000–$FE:FFFF` that intercepts enemy stat loads to dynamically scale enemy HP, attack power, and defense according to difficulty settings or party level.