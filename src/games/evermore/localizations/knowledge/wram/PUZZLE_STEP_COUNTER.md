---
addr: $7E:2469
name: PUZZLE_STEP_COUNTER
type: u16
tags: [scripts, puzzle, dungeon]
confidence: verified
evidence: ["disasm", "cdl"]
---
Dungeon Script Subsystem: Room puzzle / sequence step iteration counter word ($7E:2469, values $00..$18; evaluated and incremented in dungeon script $9A:B910). Tracks progression through the 24-step sequence before triggering the reset or puzzle completion handler.

