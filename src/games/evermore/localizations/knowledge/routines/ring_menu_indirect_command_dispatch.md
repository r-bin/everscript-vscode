---
addr: 8E990A
size: 22
end: 8E991F
kind: code
category: 🎮
name: ring_menu_indirect_command_dispatch
title: Dispatch ring menu command through indirect vector table ($8E:990A)
confidence: confirmed
evidence: ["disasm: acknowledges input via $80:8597; dispatches indirect vector ($99CA,X); updates state <$97 = $99C2; returns SEC with A=8; callers: ring menu coordinator $8E:A885"]
see: ["routines/joypad_acknowledge_or_clear_buttons.md","routines/shopkeeper_dialogue_show_confirm_buy_box.md"]
tags: ["ring-menu","command","vector","dispatch"]
---
Dispatches ring menu action command at indirect vector `($99CA,X)`. Acknowledges controller input via `joypad_acknowledge_or_clear_buttons` (`$80:8597`), executes command, sets state `$99C2` into `<$97`, and returns with `SEC` and A=8.
