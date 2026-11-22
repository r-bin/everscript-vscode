---
addr: 8E9B3A
size: 53
end: 8E9B6E
kind: code
category: 🎮
name: ring_alchemy_build
title: Build the alchemy ring
confidence: confirmed
tags: ["ring-menu"]
evidence: ["disasm v0.455.0: for each of the 9 slots $0AD2..$0ADA (bit 7 = empty) $07EC,x = $C4:5BAF,formula"]
see: ["docs/open-evermore/resources.md"]
---
Fills `RING_BOY_ALCHEMY` from the formulas put on the ring (`$0AD2`, 9 bytes), each through the formula → ring item table `$C4:5BAF`.

Previously believed: "Alchemy menu ingredient catalog list builder ($8E:9B3A)" (alchemy_menu_populate_ingredient_catalog).
