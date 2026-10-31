---
addr: 91CCAB
kind: code
category: 🎮
name: alchemy_inventory_shift_slots_down
title: Shift ingredient inventory slots downward and clear vacant top slot ($91:CCAB)
confidence: confirmed
evidence: ["disasm: copies $0AD1,Y into $0AD2,Y decrementing Y down to 1; writes $FF into vacant top slot $0AD2; callers: formula setup $8D:B98F"]
see: ["rom/8db98f.md"]
tags: ["alchemy","inventory","ingredient","shift"]
---
Shifts ingredient slots down to remove an item. Copies `$0AD1,Y` into `$0AD2,Y` while decrementing Y down to 1; writes `$FF` into the newly vacant top slot `$0AD2`.
