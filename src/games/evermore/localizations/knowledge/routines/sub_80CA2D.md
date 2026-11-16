---
addr: 80CA2D
end: 80CA57
size: 43
kind: code
category: 🧠
name: sub_80CA2D
title: Mode 7 flight scene initialization, cockpit HUD commit, and raster IRQ setup ($80:CA2D)
confidence: confirmed
tags: ["code","subroutine","cdl", "mode7"]
evidence: ["disasm: $80:CA2D sets dirty buffer flag ($7E:0106 = 1), ticks cockpit heading frame via JSR $80:C881, finalizes OAM via JSL $80:8FEE, waits for NMI (JSL $80:858C), commits OAM DMA (JSL $80:8F85), installs raster IRQ handler via JSR $80:DF3F, calculates shadow projection (JSR $80:D9F5), sets up flight HUD window OAM (JSR $80:D22D), re-finalizes OAM, sets display shadow $7E:0B83 = $800F, and falls into inner flight loop sub_80CA58"]
see: [routines/sub_80C985.md, routines/sub_80CA58.md, routines/sub_80CA5A.md, routines/install_raster_irq_handler_at_df51.md]
---

Mode 7 flight scene initialization and interrupt vector configuration tail.
1. Marks display buffer dirty (`$7E:0106 = 1`), renders cockpit heading indicator frame (`$80:C881`), and clears dirty flag (`$7E:0106 = 0`).
2. Finalizes OAM buffers (`$80:8FEE`), waits for NMI (`$80:858C`), and commits OAM table to PPU via DMA (`$80:8F85`).
3. Installs raster scanline IRQ vector at `$80:DF51` via `install_raster_irq_handler_at_df51` (`$80:DF3F`).
4. Calculates dynamic shadow projection geometry (`$80:D9F5`) and configures flight HUD window OAM slots (`$80:D22D`).
5. Re-finalizes OAM buffers and stores display control parameters `$800F` into `$7E:0B83`.
6. Falls directly through into `sub_80CA58` (`$80:CA58`) to enter the inner flight execution loop.
