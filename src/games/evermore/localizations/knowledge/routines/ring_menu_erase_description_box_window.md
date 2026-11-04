---
addr: 8DCEC2
size: 34
end: 8DCEE3
kind: code
category: 🎮
name: ring_menu_erase_description_box_window
title: Clear ring menu item description text window region ($8D:CEC2)
confidence: confirmed
evidence: ["disasm: reads menu descriptor index $0B3B (fallback 8); loads Y pos and height from tables $8D:CF06 and $8D:CF10; jumps to window clearer $8C:B6C5; callers: description setup $8D:CD5E"]
see: ["routines/menu_selection_cursor_card_border_stamp.md","routines/save_menu_load_game_select_loop.md"]
tags: ["ring-menu","window","clear","dialogue"]
---
Clears the item description text sub-window in weapon/item menus. Reads menu descriptor from `$0B3B` (fallback `$08`). Looks up coordinate parameters from `$8D:CF06,X` and `$8D:CF10,X` (X=1, Y, W=30, H) and jumps to window clear routine `func_8CB6C5` (`$8C:B6C5`).
