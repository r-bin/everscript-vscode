---
addr: 800000
size: 32768
end: 807FFF
kind: region
category: ⚙️
name: snes_bank_80_system_registers_mirror
title: SNES Bank $80 system registers, Low-RAM mirror and hardware registers
confidence: confirmed
tags: [engine, hardware, registers]
evidence: ["src/core/emulator/webview/memory-bridge.js accesses Bank $80:0000-7FFF low WRAM and hardware registers mirror"]
---
SNES Bank `$80` system registers mirror region (`$80:0000–$80:7FFF`). Mirrors the first 8 KB of WRAM (`$7E:0000–$7E:1FFF`), PPU registers (`$2100–$213F`), CPU registers (`$4200–$421F`), and DMA channels (`$4300–$437F`).