---
addr: 909C33
size: 107
end: 909C9D
kind: code
category: 🎮
name: hblank_color_gradient_init_line_32
title: Configure HDMA color gradient scanline parameters starting from line 32 ($90:9C33)
confidence: confirmed
evidence: ["disasm: sets scanline offset $0FAC = $0020; branches to color gradient setup handler $90:9C05"]
see: ["routines/hblank_color_gradient_dma_setup.md"]
tags: ["hdma","raster","cgram","scanline"]
---
Configures HDMA color gradient scanline parameters starting from line 32 (`$0FAC = $0020`), then branches to setup handler at `$90:9C05`.
