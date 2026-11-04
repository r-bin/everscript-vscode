---
addr: $7E:2439
name: ENDING_CREDITS_SCENE_INDEX
type: u16
tags: [scripts, credits, story]
confidence: verified
evidence: ["disasm", "cdl"]
---
Game Script Subsystem: Ending credits cutscene location sequence index word ($7E:2439, values {$00..$05}; initialized to 0 in script $92:CFED, incremented in $92:D00F). Sequences through the 5 background scenes: 0 = Thraxx's chamber, 1 = Nobilia Market, 2 = Footknight Chessboard, 3 = Ebon Keep stained-glass hallway, 4 = Omnitopia shops, 5 = credit fadeout and reset_game().

