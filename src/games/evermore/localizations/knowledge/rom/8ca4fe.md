---
addr: 8CA4FE
end: 8CA590
kind: code
category: 🧠
name: glyph_font_1bpp_unpacker
title: Font character whitespace evaluator and kerning cursor stepper
confidence: confirmed
tags: [text, ui, font]
evidence: ["disasm: handles newline $0A (resets cursor X to left margin +$0A,Y, adds line height $0B3D and line spacing); handles tab $09 via $8C:AAFA; handles space $20 (adds space width +$04,Y); checks right margin overflow; calls bitmap blit $8C:A5A2"]
see: [docs/disassembly/ui/dialogue-glyph-streamer.md, rom/8c9f4e.md, rom/8ca5a2.md]
---
Processes individual characters during dialogue rendering: handles newlines, tabs, and spaces, performs
soft right-margin line wrapping, invokes the 1bpp font bitmap blitter (`$8C:A5A2`), and advances the text
cursor X position by character width plus kerning spacing.
Full disassembly and clean C reconstruction: `docs/disassembly/ui/dialogue-glyph-streamer.md`.
