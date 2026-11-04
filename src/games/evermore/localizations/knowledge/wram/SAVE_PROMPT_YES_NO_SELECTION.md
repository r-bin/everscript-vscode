---
addr: 7E0D0D
size: 2
kind: var
name: SAVE_PROMPT_YES_NO_SELECTION
title: Selected option index in Save Menu Yes/No overwrite confirmation prompt
lifetime: room
confidence: confirmed
tags: [save, prompt, dialogue, menu, ui]
evidence: ["disasm: func_8DDF07 ($8D:DF07) sets selection variable $0D0D, enqueues Yes/No prompt cursor sprites via $90:CFB8, and toggles $0D0D with EOR #$02 on directional pad input", "disasm: returns carry set (SEC) on confirmation when $0D0D indicates Yes (0)"]
see: [routines/save_menu_yes_no_confirmation_prompt.md]
---
16-bit option state tracking the cursor position in modal Yes/No prompts (e.g. confirming save slot overwrite in `func_8DDF07`).
Values: `0x0000` = Yes, `0x0002` = No. Toggled by directional pad inputs.
