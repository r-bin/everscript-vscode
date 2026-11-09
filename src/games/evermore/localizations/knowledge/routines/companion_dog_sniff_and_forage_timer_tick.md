---
addr: 8FDC34
size: 156
end: 8FDCCF
kind: code
category: ⚙️
name: companion_dog_sniff_and_forage_timer_tick
title: Dog companion sniffing and foraging timer tick
confidence: likely
tags: [dog, companion, foraging, sniff, rng, ai, widescreen, widescreen.activation]
evidence: ["disasm: called from $8F:AFAE; decrements sniff timer in $0E98; rolls RNG via $80:859B to compute next sniff interval (adds $3C); rolls search radius via RNG; on timer expiration delegates to $8F:DCD0 (companion_dog_ingredient_dig_find_trigger) (REA dossier 0x8fdc34)"]
---
Decrements the Dog companion idle sniffing timer each frame and uses RNG to schedule when the Dog stops, sniffs the ground, and seeks nearby hidden alchemy ingredients.

## Widescreen notes

Read 2026-11-09: besides the timer, this is the entity scheduler tick: it adapts the awake budget `$1076` to lag (`$1078`/`$107A`/`$107C`), runs `$8F:DCD0`, then the round-robin sleep/wake pass over 6 slots per frame (`$0EBC`) that calls `entity_sleep_wake` for every slot with `+$10` & `$0300`.
