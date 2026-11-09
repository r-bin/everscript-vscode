---
addr: 90D55F
size: 45
end: 90D58B
kind: code
category: 🎨
name: palette_family_reload_queue_process
title: Map palette family reload request queue processor ($90:D55F)
confidence: confirmed
evidence: ["disasm: checks $7E:22EB bit 0; sweeps 16 word slots in table $13D2 (X=$1E down to 0, step 2); for any non-zero low or high byte request, invokes palette family reloader $90:D58C; caller: Reload_families_when_a_script_changes_MAP_PALETTE_90CBB3 ($90:CBB3)", "c: G1 passed (tools/c-to-rom/g1.mts): the bound C equals the ROM on 34 entry states sampled from the 2:20 no-input reference and 544 fuzzed ones; snes9x agrees with the interpreter on 34; a mutation is caught"]
see: [routines/reload_families_when_a_script_changes_map_palett.md, reconstructed-c/90/90D55F_palette_family_reload_queue_process.c]
tags: [palette, map, graphics]
---
Processes queued map palette family reload requests. Checks update suppression flag `$7E:22EB`: sweeps 16 pending request slots at `$13D2`, invoking family reload routine `$90:D58C` for any active low-byte or high-byte palette family change requests.
