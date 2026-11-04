---
addr: 8CB29F
end: 8CB55A
size: 700
kind: code
category: 🧠
name: dialogue_window_border_and_box_layout_stream
title: Dialogue window border tile renderer, box layout coordinate calculator, and WRAM tile streamer
confidence: confirmed
tags: [dialogue, window, border, vram, wram, ui]
evidence: ["disasm: streams window border graphic tilewords directly into WRAM buffer $7E:D000 / $7F:C800 via hardware port $2180..$2182 at $8C:B29F..$8C:B55A; terminates with RTL at $8C:B55A"]
see: [rom/8cb068.md, rom/8cb55b.md, ram/7e0b63.md]
---
Core dialogue balloon and menu window framing engine:
- Computes window box dimensions and screen margins from window descriptor `+$14,Y`.
- Streams pre-rendered border tiles, corner ornaments, and background filler directly into the WRAM tilemap buffer at `$7E:D000` / `$7F:C800` via SNES hardware registers `$2180..$2182`.
- Handles multi-line clipping and window drop-shadow attributes.
- Returns via `RTL` at `$8C:B55A`.

