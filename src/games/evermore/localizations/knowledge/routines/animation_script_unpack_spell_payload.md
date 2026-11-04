---
addr: 9088AE
size: 14
end: 9088BB
kind: code
category: 🎮
name: animation_script_unpack_spell_payload
title: Unpack spell bytecode payload into entity buffer ($90:88AE)
confidence: confirmed
evidence: ["disasm: loads entity buffer target offset +$86,Y into X; invokes spell payload unpacker $8F:C8DE"]
see: ["routines/spell_script_payload_unpack.md"]
tags: ["spell","script","payload","unpack"]
---
Unpacks spell bytecode payload into entity buffer at `+$86,Y` via `spell_script_payload_unpack` (`$8F:C8DE`).
