---
addr: $7E:0F92
name: MINIMAP_RADAR_WINDOW_RIGHT
type: u16
tags: [widescreen, widescreen.streaming]
confidence: verified
evidence: ["cdl", "disasm"]
---
Minimap radar viewport right horizontal clipping bound ($90:A4EC).

## Widescreen notes

Right metatile column of the streamed BG1 window: left + `$0FAC`. Previously believed: minimap radar window.
