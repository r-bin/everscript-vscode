---
addr: 90CCEC
kind: code
category: 🎮
name: palette_staging_buffer_flags_clear_direct
title: Clear palette upload staging dirty flags without bank switch ($90:CCEC)
confidence: confirmed
evidence: ["disasm: resets 16-bit staging flags $7E:1288, $7E:128A, $7E:128C; callers: palette manager $8E:A0B3"]
see: ["rom/8ea0b3.md"]
tags: ["palette","cgram","staging","dirty"]
---
Clears the 3 CGRAM palette upload staging flags `$7E:1288`, `$7E:128A`, and `$7E:128C` directly without changing data bank.
