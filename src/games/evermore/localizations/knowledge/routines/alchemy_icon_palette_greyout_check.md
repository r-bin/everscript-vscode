---
addr: 90878C
size: 44
end: 9087B7
kind: code
category: 🧠
name: alchemy_icon_palette_greyout_check
title: Ring-menu formula icon disabled palette validator (animation opcode 0x56)
confidence: confirmed
tags: [ui, ring-menu, animation, palette, alchemy]
evidence: ["disasm: reads word formula index argument, advances bytecode pointer by 2, invokes $91:CE38 to compute available casts, and if accumulator < 1 loads greyscale palette $D0:A8EB into entity record +$0C", "trace: executed while animating ring menu icons when selecting alchemy formulas"]
see: [docs/disassembly/combat/alchemy-xp-growth.md, routines/alchemy_formula_calc_available_casts.md]
---
Animation opcode `0x56` execution handler for ring menu formula icons. Evaluates whether the player possesses sufficient
ingredients by calling `$91:CE38`. If available casts is zero, assigns the disabled greyscale palette `$D0:A8EB` into entity
`+$0C` to grey out the formula icon; otherwise preserves the normal vibrant palette.
Full disassembly and clean C reconstruction: `docs/disassembly/combat/alchemy-xp-growth.md`.

## Note (2026-11-28)
A formula's icon animation greys it when ingredients are short, loading the grey palette into whichever sprite slot of
the 3-slot cache is free, which can be a slot a screen filled itself. While `ALCHEMY_RING_BROWSE_MODE` (`$7E:0B27`) is
non-zero it leaves the colours: the alchemy screens set it, and so does the cheat menu demo (seen in MesenCE).
