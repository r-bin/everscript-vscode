---
addr: 8DAFDA
end: 8DB1B5
kind: code
category: 🎛️
name: status_menu_boy_input_loop
title: Boy status screen input loop and character switcher
confidence: likely
tags: [status-screen, boy, input, ui]
evidence: ["disasm: uploads UI sprite tiles via $90:CFB8; polls joypad input via $80:8597; blanks unused OAM via $80:8FEE; on L/R or D-pad switches to Dog status screen by jumping to $8D:A6F6; on B/Cancel returns RTL (REA dossier 0x8dafda)"]
---
Interactive input loop while viewing the Boy status screen, handling page switching to the Dog status card ($8D:A6F6) and closing the status view.
