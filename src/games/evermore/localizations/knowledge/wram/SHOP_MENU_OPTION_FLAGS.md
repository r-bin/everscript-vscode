---
addr: 7E225D
size: 1
kind: var
name: SHOP_MENU_OPTION_FLAGS
title: Shop and merchant interaction menu option enable flags
lifetime: save
confidence: confirmed
tags: [shop, ui, menu, flags]
evidence: ["disasm: func_8E8D05 checks $7E:225C bit 7 for Sell option ($F2), $7E:225D bit 0 for Trade option ($F4), and $7E:225D bit 1 for Exit/Dialogue option ($F6) before building $0CDD"]
see: [knowledge/wram/SHOP_MENU_OPTION_COUNT.md, knowledge/wram/SHOP_MENU_OPTIONS_BUF.md]
---
Bitmask byte regulating available menu choices when talking to merchants and shopkeepers.
- Evaluated by `func_8E8D05` when assembling the shop options ring buffer (`$7E:0CDD`):
  - **Bit 0 (`0x01`)**: Enable Option `$F4` (e.g. Trade / Rare Items / Alchemy services).
  - **Bit 1 (`0x02`)**: Enable Option `$F6` (e.g. Talk / Special Exit prompt).
- Complements `$7E:225C` bit 7 (`0x80`), which enables Option `$F2` (Sell items).
