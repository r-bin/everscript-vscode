---
addr: $7E:0FBC
name: MINIMAP_BOUND_ORIGIN_X
type: u16
tags: [ui]
confidence: verified
evidence: ["cdl", "disasm"]
---
Minimap rasterization bounding box origin X coordinate restored at start of each line wrap ($90:A582, $90:A653).
