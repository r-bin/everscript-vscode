---
addr: 8EAD67
end: 8EAD7E
size: 24
kind: code
category: 🧠
name: sub_8EAD67
title: Ring menu exit restoration, stack unwinding, and window closure
confidence: confirmed
tags: [ring-menu, ui, window, stack, reconstructed-c]
evidence: ["disasm: restores stack pointer from $0B1F, restores Y, conditionally updates character record at $7E:0090,X, resets sprite bounds via $90:D020 and $90:CC69, clears camera lock $143A, closes windows $034D and $03DD via $8C:ADE5, clears $0BFB, $0BFD, $95, $05AB, returns via RTL"]
see: [routines/ring_menu_action_screen_init.md, reconstructed-c/8E/8EAD67_sub_8EAD67.c]
---
Master cleanup and screen restoration routine executed when closing or exiting the Ring Menu:
- Clears submenu state `$034B`.
- Restores stack frame pointer from `$0B1F` (`TCS`) and pulls caller register `Y`.
- Tests and clears bit 15 of `$05A9`; if set, saves restored `Y` into active party member record at `$7E:0090 + $05A7`.
- Re-aligns sprite coordinates (`DP $02 = 16`, `DP $04 = 224`) and updates entity camera tracking via `$90:D020` and `$90:CC69`.
- Clears companion lead/camera lock latch `$143A`.
- Closes main ring window `$034D` via `$8C:ADE5`.
- Tests and clears bit 0 of `$05AB`; if set, closes sub-action window `$03DD` via `$8C:ADE5`.
- Clears bit 14 of `$0F84` and zeroes scratch registers `$0BFB`, `$0BFD`, `$95`, and `$05AB`.
