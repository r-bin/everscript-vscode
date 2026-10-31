---
addr: 8DBDE6
kind: code
category: 🎮
name: ring_menu_render_ingredient_icons
title: Render alchemy ring menu ingredient icons to OAM ($8D:BDE6)
confidence: confirmed
evidence: ["disasm: loops Y=8 down to 0 over active ingredient array $0AD2,Y; checks bit 7; loads (X,Y) screen coordinates from table $8D:BE30; initializes anim record via $90:80D2; commits to OAM via $90:81BD; callers: ring menu draw $8D:B98F"]
see: ["rom/9080d2.md","rom/9081bd.md","rom/8db98f.md"]
tags: ["ring-menu","alchemy","ingredient","oam","icon"]
---
Draws active alchemy ingredient icons onto the formula ring menu. Scans slots `$0AD2..$0ADA`; for each assigned ingredient (bit 7 clear), looks up screen coordinates from table `$8D:BE30,X`, initializes sprite record via `func_9080D2`, and renders glyphs to OAM via `func_9081BD`.
