---
addr: CC37AC
end: CC37B2
size: 7
kind: data
category: 🖼️
name: spr_hud_boy_portrait
title: HUD Boy character portrait 16x16 sprite record
confidence: confirmed
tags: [hud, sprite, boy]
evidence: ["disasm: hud_portraits_init ($8F:810E) stores $CC37AC into $4EF7-$4EF8", "rom: 1-chunk sprite descriptor pointing to 16x16 OBJ block $7AB", "test: drawn on HUD during gameplay with palette $D0:AD6B"]
see: [routines/hud_portraits_init.md, routines/pal_hud_portraits.md, docs/item-icons.md]
---
1-chunk sprite descriptor in Bank `$CC` defining the Boy's portrait shown on the in-game HUD beside his HP gauge.
Points to 16×16 OBJ block `$7AB` rendered with palette `$D0:AD6B`.
Stored into `$7E:4EF7` during HUD setup (`$8F:810E`).
