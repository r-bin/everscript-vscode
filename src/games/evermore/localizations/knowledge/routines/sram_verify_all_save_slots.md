---
addr: 8DC905
size: 78
end: 8DC952
kind: code
category: 🧠
name: sram_verify_all_save_slots
title: Verify All Save Slots in Battery SRAM
confidence: verified
tags: [system, reconstructed-c, g1-pass]
evidence:
  - "[\"disasm: $8D:C905 iterates 4 save slots in bank $30 ($30:6002..$30:6995, stride 0x0331), computes 16-bit rotational checksum over 815 bytes via $8D:B478, compares header checksum, and populates $0B39\"]"
  - "Reconstructed in `reconstructed-c/8D/8DC905_sram_verify_all_save_slots.c` (SOE_BIND); passes Gate G1 differential verification (2/2 reference states, 0/0 fuzzed states, mutation caught: yes, 26173 / 171804 ROM/C instructions per call)."
see: [routines/sram_compute_checksum.md, routines/main_loop_entry.md, engine-core/save-system.md]
---
Scans battery SRAM on boot and builds the valid save file bitmask:
- Iterates across 4 save slots starting at `$30:6002` with stride `$0331` (817 bytes).
- Computes checksum over the 815-byte payload via `$8D:B478`.
- Compares computed checksum against the 16-bit header word.
- Sets bits in `$7E:0B39` (`0x01`, `0x02`, `0x04`, `0x08`) for each valid save file.
- `$7E:0B33` (the slot's bit) and `$7E:0B37` (the slot's pointer) are the loop's position: seen `01`/`$6002`, `04`/`$6664`, `08`/`$6995` at NMIs during the scan, so an NMI inside it shows how far it got.
Full clean C decompilation: `docs/disassembly/engine-core/save-system.md`.
