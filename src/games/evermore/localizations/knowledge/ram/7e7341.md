---
addr: 7E7341
end: 7E7350
kind: struct
name: HDMA_SKY_GRADIENT_TABLE
title: 6-band HDMA sky horizon color gradient table
lifetime: frame
confidence: confirmed
tags: [render, hdma, color, ppu]
evidence: ["reconstructed-c: 80A1B4_hdma_gradients.c builds 8-word gradient table at $7E:7341", "routine: func_80A1B4 creates dual-band shaded gradients for background horizon color math"]
see: [docs/disassembly/engine-core/wram-map.md]
---
16-byte (8-word) color gradient lookup table formatted for indirect HDMA background color shading:
- Constructed by `func_80A1B4` (`hdma_color_gradient_band_builder`) from an incoming 8-bit shift mask and base 15-bit RGB color.
- Generates 4 dual-band vertical color steps: black horizon base, 50% shaded ambient gradient, or full ambient sky illumination.
- Uploaded by HDMA Channel 5/6 to hardware registers `$2121`/`$2122` (`CGADD`/`CGDATA`) to produce smooth atmospheric sky gradients.
