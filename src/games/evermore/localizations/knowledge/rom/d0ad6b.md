---
addr: D0AD6B
size: 32
kind: data
category: 🎨
name: pal_hud_portraits
title: HUD character portrait and currency icon palette
confidence: confirmed
tags: [hud, palette, sprite]
evidence: ["disasm: referenced by HUD character portrait and currency icon blitters", "data: 16 SNES 15-bit BGR colors (32 bytes) providing flesh tones, dark contours, and gold/metal highlights"]
see: [rom/8f810e.md, rom/cc37ac.md, rom/cc3c56.md, docs/item-icons.md]
---
16-color PPU CGRAM palette (32 bytes, `$D0:AD6B`..`$D0:AD8A`) applied to character HUD portraits and currency icons.
Contains flesh tones for the Boy's portrait and metallic luster colors for talons, jewels, coins, and credits.
