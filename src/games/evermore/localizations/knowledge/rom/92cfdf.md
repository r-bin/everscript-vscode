---
addr: 92CFDF
kind: script
name: open_transparent_box
title: Global 0x58 — close the text, open a transparent message box
confidence: likely
tags: [script, dialog]
evidence: ["script: TEXT_END, then opcode open_message_box_transparent(0, 4, 3, $18, $14), END (v0.369.0)", "script: called by sixteen rooms' scripts before their text"]
---
Ends the text shown and opens a transparent message box (x 4, y 3, 24 × 20). Scenes call it before their lines.
