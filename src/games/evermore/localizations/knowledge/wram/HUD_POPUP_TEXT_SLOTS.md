---
addr: $7E:3074
end: $7E:3273
size: 512
kind: array
type: DamagePopupNode[8]
name: HUD_POPUP_TEXT_SLOTS
title: Floating combat text and HUD notification popup ring buffer (8 slots × 64 bytes)
lifetime: room
confidence: confirmed
tags: [hud, ui, text, combat]
evidence: ["disasm: func_80B37A ($80:B37A) steps pointer $7E:0B57 by +$40 and wraps from $3274 back to $3074", "disasm: callers of $80:B37A include award_kill_money, calc_spell_power_and_cast, func_8F8310, func_8F84F5, func_8F973E, func_8F97C0"]
see: [ram/7e0b57.md, docs/disassembly/engine-core/wram-map.md]
---
512-byte ring buffer in Bank `$7E` (`$7E:3074`..`$7E:3273`) consisting of 8 notification slots (stride 64 bytes / `$40`).
Allocated cyclically by `func_80B37A` to display on-screen damage numbers, currency awards (`award_kill_money`), spell names (`calc_spell_power_and_cast`), and level-up notifications. The current slot head is tracked by `$7E:0B57`.
