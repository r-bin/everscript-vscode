---
addr: BF0000
size: 65536
end: BFFFFF
kind: region
category: ⚙️
name: cartridge_rom_fastrom_upper_boundary
title: Cartridge FastROM upper bank boundary and expansion limit (Bank $BF)
confidence: confirmed
tags: [engine, mapping, cartridge]
evidence: ["docs/memory-map/overview.md defines Bank $BF as the 3 MB vanilla cartridge FastROM ceiling"]
---
Cartridge FastROM upper boundary in Bank `$BF` (`$BF:0000–$BF:FFFF`). In the standard 3 MB vanilla HiROM cartridge layout, Bank `$BF` marks the top of standard mirrored ROM space before ExHiROM 4th MB mapping.