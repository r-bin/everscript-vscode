---
addr: 8FD6CE
kind: code
category: 🎮
name: enemy_ai_check_player_within_box
title: Check player presence within rectangular bounding box for enemy AI ($8F:D6CE)
confidence: confirmed
evidence: ["disasm: verifies player HP +$2A,X != 0; computes horizontal delta |+1A,X - +1A,Y| and vertical delta |+1C,X - +1C,Y|; if both within aggro bounds <$06, pulls return address to engage; callers: enemy AI $8F:D69B"]
see: ["rom/8fd69b.md"]
tags: ["ai","enemy","aggro","detection","box"]
---
Enemy AI aggro check. Checks target HP `+$2A,X != 0`. Computes absolute Manhattan distance $\Delta X = |+$1A,X - +$1A,Y|$ and $\Delta Y = |+$1C,X - +$1C,Y|$. If both deltas are within detection threshold `<$06`, pulls return address from stack to trigger combat engagement.
