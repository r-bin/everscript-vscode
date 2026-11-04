---
addr: 80B523
size: 14
end: 80B530
kind: code
category: 🎮
name: title_wait_frames_with_abort_poll
title: Title demo sequence frame delay with controller abort polling ($80:B523)
confidence: confirmed
evidence: ["disasm: loops calling input poller $80:B506; tests abort flag $0E67; decrements frame countdown in direct-page <$12 until zero or abort asserted; callers: title coordinator $80:B5B6"]
see: ["routines/poll_title_input_and_signal_abort.md","routines/enable_nmi_and_enter_frame_loop.md"]
tags: ["title","intro","input","loop"]
---
Waits for the number of frames specified in direct-page `<$12` while continuously executing `poll_title_input_and_signal_abort` (`$80:B506`). Breaks early if the player presses a button asserting `$0E67`.
