---
addr: 90D55F
size: 45
end: 90D58B
kind: code
category: 🎨
name: palette_family_reload_queue_process
title: Tick every active palette-colour cycle ($90:D55F)
confidence: confirmed
evidence: ["disasm: checks $7E:22EB bit 0; sweeps 16 word slots in table $13D2 (X=$1E down to 0, step 2); for any non-zero low or high byte request, invokes palette family reloader $90:D58C; caller: Reload_families_when_a_script_changes_MAP_PALETTE_90CBB3 ($90:CBB3)", "c: G1 passed (tools/c-to-rom/g1.mts): the bound C equals the ROM on 34 entry states sampled from the 2:20 no-input reference and 544 fuzzed ones; snes9x agrees with the interpreter on 34; a mutation is caught"]
see: [routines/reload_families_when_a_script_changes_map_palett.md, routines/cgram_animated_palette_timer_tick_and_step.md, routines/palette_cycle_setup.md, reconstructed-c/90/90D55F_palette_family_reload_queue_process.c]
tags: [palette, map, graphics]
---
Ticks the palette-colour cycles once per pass. Unless bit 0 of `$7E:22EB` is set, it walks the 32 byte slots of `$13D2` as 16 words (`X = $1E` down to 0, step 2): a non-zero low byte ticks slot `X`, a non-zero high byte slot `X+1`, each through `$90:D58C`. A slot's `$13D2` byte is its signed rate, so a slot is active exactly while its rate is non-zero; `$90:D50F` (room descriptors, script opcode `0xB6`) fills it, two slots per palette (`palette*2`, `palette*2+1`).

Previously believed: a queue of palette-family reload requests. The "requests" are the cycles' rates and `$90:D58C` rotates colours; it reloads no family (v0.404.0, whole body read with `$90:D58C`).
