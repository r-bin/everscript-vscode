---
addr: $7E:3DE1
name: ACTIVE_COMPANION_HEAD
type: u16
tags: [entity, widescreen, widescreen.activation]
confidence: verified
evidence: ["disasm: head pointer to secondary active entity linked list (companion Dog / auxiliary actors); checked alongside primary entity head $3DDF in entity loop ($8F:B2BE) and palette reclaim ($90:CEB6)"]
---
Head of the **asleep** entity list (link at `+$5E`). `entity_go_to_sleep` ($8F:C514) moves an entity from the awake list `$7E:3DDF` into this one, `entity_sleep_wake` ($8F:C40F) moves it back. The Dog is created here with `+$10 = $0200` (asleep) by `dog_companion_entity_slot_init` and woken by the first pass. Previously believed: a companion list (asm read 2026-11-09).

