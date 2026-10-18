---
addr: 8CA5AC
kind: code
category: 🧠
name: dialogue_glyph_render_char
title: Render font glyph character into 2bpp dialogue window tile buffer
confidence: confirmed
tags: [ui, font, graphics]
evidence: ["disasm: loads 1bpp/2bpp font glyph row from $C40000,x; calculates sub-pixel horizontal shift from (X & 7)*2, jumps through table $8C:A619 to shift glyph bits, blends into 2bpp tile buffer at $7F:A000, and loops for all glyph rows", "recomp: clean C in docs/disassembly/ui/dialogue-glyphs.md"]
see: [rom/8ca753.md, rom/808650.md, rom/c40000.md, rom/c40c02.md]
---
Rasterizes a character glyph into the dialogue window 2bpp VRAM staging buffer in Bank `$7F`:
- Computes character index offset: `char_code - 0x20`.
- Resolves font glyph data pointer in master table `$C4:0000`.
- Evaluates sub-pixel horizontal shift: `x_shift = (cursor_x & 7) * 2`.
- Dispatches through shift jump table `$8C:A619` (`$A62B`, `$A62E`, etc.) to shift bits into a 16-bit word (`xba`, `lsr a`).
- Blits and blends shifted bitplanes across two adjacent 8×8 2bpp tile columns in `$7F:A000`.
- Loops through all rows of the character glyph (`dec $32`).
- Upon completion, forwards to `$8C:A753` (`dialogue_glyph_stream_vram`) to upload tiles to VRAM.
- Full clean C decompilation: `docs/disassembly/ui/dialogue-glyphs.md`.
