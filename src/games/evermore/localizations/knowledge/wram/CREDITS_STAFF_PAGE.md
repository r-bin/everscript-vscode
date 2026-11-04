---
addr: $7E:2475
name: CREDITS_STAFF_PAGE
type: u16
tags: [scripts, credits, text]
confidence: verified
evidence: ["disasm", "cdl"]
---
Game Script Subsystem: Ending credits staff presentation page index word ($7E:2475, values $00..$12; evaluated and incremented in credits display routine $92:D0FD). Sequentially formats and renders each credits page (1..18) within the transparent text box during the game ending.

