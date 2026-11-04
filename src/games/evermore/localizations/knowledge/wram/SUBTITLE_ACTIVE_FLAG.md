---
addr: 7E23D3
size: 2
kind: var
name: SUBTITLE_ACTIVE_FLAG
title: Subtitle text window active state flag
lifetime: room
confidence: confirmed
tags: [script, opcode, text, ui]
evidence: ["disasm: opcode 0x52 handler at func_8CD99E checks $7E:23D3 and $0B2B bit 15 before calling window opener func_8CC4F6"]
see: [src/games/evermore/localizations/knowledge/opcodes/52.md]
---
16-bit status flag tracking whether an on-screen subtitle text overlay is actively open.
- Checked by Script VM opcode `0x52` (`subtext()`) at `$8C:D99E`.
- When non-zero (or when `$0B2B` bit 15 is set), the engine skips opening a new window frame and directly routes string keys into the active subtitle buffer.
