---
addr: 8DCD5E
end: 8DCEA9
kind: code
category: 💾
name: save_menu_load_game_select_loop
title: Title screen load game slot selector loop
confidence: likely
tags: [save, title, menu, ui]
evidence: ["disasm: caller is main_loop_entry ($80:8B66); sets window 15x5 at $0347/$0349; reads SRAM $30:6001; calls joypad_button_typematic_repeat ($80:8838) with mask $9F00; updates slot index $0B3B and redraws window frame (REA dossier 0x8dcd5e)"]
---
Title screen menu loop for selecting a saved game to load from SRAM `$30:6001`.

