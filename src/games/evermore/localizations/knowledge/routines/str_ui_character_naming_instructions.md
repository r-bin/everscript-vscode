---
addr: 8D824F
end: 8D82CA
size: 124
kind: data
category: 📋
name: str_ui_character_naming_instructions
title: Character naming screen UI instruction strings and prompt text
confidence: confirmed
tags: [ui, text, strings, naming, menu]
evidence: ["disasm: 124 bytes at $8D:824F..$8D:82CA; contains null-terminated UI strings: 'Enter Character Name' and 'Choose letters by moving the selector and pressing B.  Y deletes the last letter. Press START to exit.'"]
see: [routines/title_screen_load_game_menu_layout_init.md, routines/check_name_profanity.md]
---
UI prompt strings for the character naming screen:
- `"Enter Character Name"`
- `"Choose letters by moving the selector and pressing B.  Y deletes the last letter. Press START to exit."`
Rendered by the name entry menu handler to guide the player when naming the Boy or the companion Dog.

