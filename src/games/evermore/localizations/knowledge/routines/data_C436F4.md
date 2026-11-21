---
addr: C436F4
size: 16
end: C43703
kind: data
category: 🎨
name: data_C436F4
title: 16 bytes between the menu tilemap and the HUD gauge tiles, tile-shaped ($C4:36F4)
confidence: guess
tags: [graphics]
evidence: ["rom: fe ff 99 81 … 7f ff, not padding: the shape of one 2bpp tile; neither the menu setup ($8C:B804, $700 bytes) nor the HUD upload ($8F:8710, from $3704) reads it"]
---
One tile's worth of bytes no known upload reads.
