---
addr: C800BE
size: 16
end: C800CD
kind: data
name: currency_icon_sprites
title: Animation script picking the currency icon — four one-chunk sprites, talons to credits
confidence: likely
tags: [sprites, economy, hud]
evidence: ["rom: an animation opcode, then four 24-bit sprite addresses $CC3C56, $CC3C5D, $CC3C64, $CC3C6B (the only references to them in the ROM)", "rom: each is a one-chunk sprite of a 16x16 block, $7CB-$7CE: a talon, a jewel, a coin, a card — the order of the currency index (0 talons, 3 jewels, 6 gold coins, 9 credits; routines/award_kill_money.md)"]
see: [routines/award_kill_money.md, routines/hud_portraits_init.md, docs/item-icons.md]
---
The money icon of each era. The script picks the sprite by the currency index. The colours are not
confirmed: the Scripts tab draws them in the HUD's (`$D0AD6B`, the Boy portrait's), where the coin
comes out gold (maps/hud-icons.ts).

## Correction (2026-11-28)
Their colours are palette `$D0:AACB`: the money window (script opcode `0x9F`, `$8C:E5B0`) starts the icon's animation
and loads that palette (seen in MesenCE: the window put it in a sprite palette slot and drew the talon in it).
Previously believed: the HUD's portrait palette `$D0:AD6B`.
