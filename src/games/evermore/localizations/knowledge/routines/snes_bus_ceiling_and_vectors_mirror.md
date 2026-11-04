---
addr: FF0000
size: 65536
end: FFFFFF
kind: region
category: ⚙️
name: snes_bus_ceiling_and_vectors_mirror
title: SNES 24-bit address bus ceiling and interrupt vectors mirror (Bank $FF)
confidence: confirmed
tags: [engine, mapping, vectors]
evidence: ["docs/memory-map/overview.md documents Bank $FF as the 24-bit address space ceiling holding native vectors at $FF:FFE0-FFFF"]
---
Bank `$FF` (`$FF:0000–$FF:FFFF`) represents the top of the SNES 24-bit address space ($FFFFFF). Its upper half ($FF:8000–$FF:FFFF) mirrors the hardware interrupt vectors, reset vector, and cartridge header vectors.