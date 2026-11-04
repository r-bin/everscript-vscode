---
addr: 91ACD8
size: 7
end: 91ACDE
kind: code
category: 🎮
name: alchemy_apply_status_flag_1a_assert
title: Assert extended status flag <$1A and enter status application loop ($91:ACD8)
confidence: confirmed
evidence: ["disasm: sets flag <$1A = 1; branches to status application loop entry $91:ACE3"]
see: ["routines/alchemy_apply_status_procs_to_target_list.md"]
tags: ["alchemy","status","flag","loop"]
---
Asserts extended status flag `<$1A = 1` and branches to status application loop entry `$91:ACE3`.
