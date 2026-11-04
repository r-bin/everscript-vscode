---
addr: 91C410
end: 91C5AD
size: 414
kind: code
category: 🧠
name: hdma_gradient_lighting_dispatcher_and_curves
title: Ambient HDMA screen gradient lighting dispatcher, fade evaluator, and curve tables
confidence: confirmed
tags: [hdma, lighting, gradient, ppu, graphics]
evidence: ["disasm: evaluates gradient mode in $14D8 at $91:C410..$91:C5AD; dispatches via jump table JSR ($xxxx,X), formats HDMA color tables in WRAM Bank $7F, contains lighting attenuation curves; exits via RTL"]
see: [rom/91c31f.md, rom/91c3a4.md, rom/91c5ae.md]
---
Coordinates ambient screen lighting and atmospheric fog effects via SNES HDMA Channel 5:
- Reads gradient configuration from `$7E:14D8`.
- Dispatches through mode-specific curve handlers to build scanline color palettes in WRAM Bank `$7F`.
- Contains lighting attenuation curve tables (`0x0080, 0x0040, 0x0020, 0x0010, 0x0008...`).
- Exits via `RTL`.

