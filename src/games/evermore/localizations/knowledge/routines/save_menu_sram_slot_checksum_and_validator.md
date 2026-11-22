---
addr: 8DB1D2
end: 8DB476
size: 677
kind: code
category: 🧠
name: save_menu_sram_slot_checksum_and_validator
title: Validates battery-backed SRAM save slots, computing checksums and loading player preview metadata
confidence: guess
tags: [unverified, rea-partial-read]
evidence: ["disasm: the save writer $8D:B323-$B46F (six DMA blocks WRAM to SRAM, then the checksum) read in full, its loader twin $8D:B648-$B7D5 has the same blocks (2026-11-23)", "disasm: only the first ~20 instructions plus caller/callee names of the REA dossier were read (v0.387.7-12 batch); the purpose is inferred from those, not verified"]
---
Low confidence — Validates battery-backed SRAM save slots, computing checksums and loading player preview metadata.

> Inferred from a partial read of the routine; names, purposes and variable roles below are hypotheses until the whole body is traced or tested.

Validates save game slots from battery-backed SRAM during title screen and save menu operations.
The routine maps SRAM bank `$30`, iterates over save slot headers, and calls `$8D:B478` (`sram_compute_checksum`) to verify data integrity against stored slot checksums.

For valid slots, it extracts the protagonist\'s name, current level, elapsed playtime, and save location string, transferring the formatted preview text into UI display buffers for user slot selection.

## Callers
- `$8D:D303` (`func_8DD303`)

## Callees
- `$80:B149` (`func_80B149`)
- `$8D:B478` (`sram_compute_checksum`)

## Variables and memory (hypotheses)
- `$30:0000..$30:1FFF` (Battery-backed SRAM save slot memory)
- `$22`, `$24` (Pointer to destination UI text display buffer)
- `$2E` (Slot header data stride pointer)

## The save blocks (read 2026-11-23)

Inside this entry, `$8D:B323`-`$B46F` writes a slot: per block it sets DMA channel 1 B-bus `$2180` (WMDATA) to SRAM bank
`$30` at the slot base (`$C4:599A`: `$6002`, `$6333`, `$6664`, `$6995`, stride `$331`) plus an offset, and runs it; then
`sram_compute_checksum` over `$32F` bytes. The loader (`$8D:B648`-`$B7D5`, inside the entry called
`alchemy_menu_formula_card_and_ingredients_formatter`, which is misnamed there) runs the same blocks the other way.

| slot offset | WRAM | bytes |
|---|---|---|
| `+$0F0` | `$0ABA` | `$65` |
| `+$155` | `$2F52` | `$A2` |
| `+$1F7` | `$2258` | `$92` |
| `+$289` | `$22FF` | `$5C` |
| `+$2E5` | `$2361` | `$2C` |
| `+$311` | `$2513` | `$20` |

So `$22EA`-`$22FE`, `$235B`-`$2360`, `$238D`-`$2512` and `$2533`-`$2833` are not saved. Previously believed: the whole of
`$2258`-`$2833` is copied to SRAM. Uses: docs/todo/growable-items.md.
