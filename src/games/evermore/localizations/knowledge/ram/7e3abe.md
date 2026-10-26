---
addr: 7E3ABE
end: 7E3BBD
kind: region
name: JOYPAD_CHORD_HISTORY
title: The joypad matcher's ring of recent button chords
lifetime: boot
confidence: confirmed
tags: [input, joypad]
evidence: ["disasm: $8C:F121 compares $0EC6 with $3ABE + X (X = byte $3BBE); on a change, if that slot is not 0 it moves X down by 2 and stores it to $3BBE, then writes the chord at $3ABE + X", "doc: the prototype uses the same addresses (docs/soe-prototype-chip1.md)"]
see: [rom/8cf121.md, ram/7e3bbe.md]
---
128 words, newest at `$3ABE + $3BBE`, older chords above it (the index counts down and wraps in
8 bits). A release (0) takes the newest slot until the next chord overwrites it, so the ring
holds the distinct chords held, without the releases. The newest slot equals the held buttons
of the last field tick: comparing it with `$0EC6` tells which buttons went down.
