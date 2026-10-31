---
addr: 91ACDF
kind: code
category: 🎮
name: alchemy_apply_status_procs_to_target_list
title: Apply alchemy status effect procs across linked target entity chain ($91:ACDF)
confidence: confirmed
evidence: ["disasm: advances script offset +$14,Y by 4; loads status ID from $91:0002; iterates target entity chain at +$2E,Y; tests <$1A to dispatch extended proc $91:B9A7 or standard status proc $91:B632"]
see: ["rom/91b9a7.md","rom/91b632.md"]
tags: ["alchemy","status","proc","combat"]
---
Applies status effect procs across all linked target entities stored at `+$2E,Y`. Advances bytecode instruction offset `+$14,Y` by 4 bytes, reads status ID from `$91:0002,X`, and iterates through target entity chain. Dispatches extended status application `func_91B9A7` or standard status proc `func_91B632` depending on flag `<$1A`.
