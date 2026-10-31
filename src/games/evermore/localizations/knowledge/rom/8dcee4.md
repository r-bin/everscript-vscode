---
addr: 8DCEE4
kind: code
category: 🎮
name: ring_menu_render_description_box_frame
title: Render decorative border frame for ring menu description box ($8D:CEE4)
confidence: confirmed
evidence: ["disasm: reads descriptor index $0B3B (fallback 8); loads vertical offset and height from $8D:CF06 and $8D:CF10; jumps to frame drawer window_box_frame_render $8C:B647; callers: menu layout $8D:CD5E"]
see: ["rom/8cb647.md","rom/8dcd5e.md"]
tags: ["ring-menu","window","frame","border"]
---
Draws the decorative window border frame for description boxes. Reads descriptor index from `$0B3B`, loads vertical position and height from `$8D:CF06,X` and `$8D:CF10,X`, and jumps to frame drawer `window_box_frame_render` (`$8C:B647`).
