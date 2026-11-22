---
addr: 90A0D0
size: 113
end: 90A140
kind: code
category: 🧠
name: animated_tiles_v_blank_graphic_swaps_to
title: Animated tiles: V-Blank graphic swaps (to `$90:A1A0`)
confidence: likely
tags: [graphics]
evidence: ["legacy: migrated from functions.ts; how it was learned was not recorded (sources then: the everscript wiki ROM map, the ROM tab's points.ts)", "disasm (v0.404.1): per channel, $90:A0F8 stores 0 to the timer $5018,y and the frame index $4FE6,y and $FF to the loop count $504A,y; the descriptor's first byte goes to the list at $507D when it differs from the previous one, not to the timer"]
---
Animated tiles: V-Blank graphic swaps (to `$90:A1A0`).

At room load each Section 2 channel starts with timer 0 and frame 0 (`$90:A0F8`), so the first tick (`$90:A1B4`) moves it to frame 1 at once: frame 0, the graphic the tilemap already shows, is on screen for one frame. The descriptor's first byte ("initial countdown" in older notes) is not loaded into the timer.
