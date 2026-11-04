---
addr: 8CA1A7
end: 8CA3AE
size: 520
kind: code
category: 🧠
name: dialogue_token_bytecode_interpreter
title: In-game dialogue token stream decoder and control code dispatcher
confidence: confirmed
tags: [dialogue, text, token, interpreter, script, ui]
evidence: ["disasm: scans bytecode stream at $05B1,X at $8C:A1A7..$8C:A3AE; handles character glyphs (< 0x80) via JMP $A30C, decodes control codes (>= 0x80) via jump table, terminates with RTL at $8C:A3AE"]
see: [rom/8c9e03.md, rom/8c9f4e.md, rom/8ca3af.md, rom/8ca4fe.md]
---
Core dialogue string bytecode interpreter for in-game text display:
- Reads next token byte from string stream `$05B1,X`.
- If token `< 0x80`, processes as a printable character glyph, advancing horizontal layout position and queuing glyph tile.
- If token `>= 0x80`, dispatches through dialogue control code handler table (color palette change, delay pauses, audio SFX triggers, player/dog name string interpolation, dynamic currency/item number formatting).
- Returns via `RTL` at `$8C:A3AE`.
