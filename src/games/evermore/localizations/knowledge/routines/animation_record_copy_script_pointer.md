---
addr: 908115
size: 6
end: 90811A
kind: code
category: 🎮
name: animation_record_copy_script_pointer
title: Copy animation script pointer from definition record to active slot ($90:8115)
confidence: confirmed
evidence: ["disasm: reads 16-bit script pointer from +$03,Y; stores into active script address +$00,Y; callers: menu poller $8C:B81D"]
see: ["routines/dialogue_choice_joypad_cursor_loop.md"]
tags: ["animation","script","pointer","copy"]
---
Copies 16-bit animation script pointer from `+$03,Y` into current script register `+$00,Y`.
