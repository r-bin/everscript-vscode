---
addr: 7EFFFE
size: 2
kind: var
name: SCRIPT_VM_ZERO_WORD
title: Constant zero word at top of Bank $7E read by script VM
lifetime: boot
confidence: confirmed
tags: [scripts, vm, constant]
evidence: ["cdl: wram.flags marks $7E:FFFE as READ | WORD | SCRIPT ($29) with zero writes during execution", "audit: docs/unused-wram.md §$7E:FFFE-FFFF confirms script VM reads this location as a constant zero operand"]
see: [docs/unused-wram.md, knowledge/wram/HIGH_OAM_ALIGN_PAD.md]
---
16-bit constant zero word located at the top of Bank `$7E` (`$7E:FFFE`–`$7E:FFFF`).
Evaluated by the script VM as a literal zero reference operand and never modified during gameplay.
