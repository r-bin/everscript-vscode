---
addr: 8F8126
end: 8F81C8
size: 163
kind: code
category: 🧠
name: dog_companion_entity_slot_init
title: Companion Dog active entity slot initialization and WRAM character record binding
confidence: confirmed
tags: [entities, dog, companion, party, init]
evidence: ["disasm: 163 bytes at $8F:8126..$8F:81C8; binds Dog character record $0A70 into party member slot $0B09/$0B0B, initializes companion AI tracking pointers, exits via RTL"]
see: [rom/8f803c.md, rom/8f810e.md, rom/8f81c9.md, ram/7e0a70.md]
---
Initializes the companion Dog's active world entity slot and combat records:
- Binds party slot registers `$7E:0B09`, `$7E:0B0B`, `$7E:0B0D`, `$7E:0B0F` to the Dog's WRAM character record buffer at `$7E:0A70`.
- Configures default companion AI tracking target vectors and follow leash properties.
- Returns via `RTL` at `$8F:81C8`.

