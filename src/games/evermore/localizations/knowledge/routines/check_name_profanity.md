---
addr: 80B173
size: 101
end: 80B1D7
kind: code
category: 🧠
name: check_name_profanity
title: Check entered player or dog name for profanity ("FUCK" / "fuck")
confidence: confirmed
tags: [ui, names, profanity, text]
evidence: ["disasm: $80:B173-$80:B1D7; scans string at [$22] in bank [$24], stops on NUL, and uses 16-bit ORA/STA to set bit 5 in $7E:22E9 on a four-byte case-insensitive match (bytes AB A9 20 00 0F E9 22 7E 8F E9 22 7E 6B at $80:B1CB..$80:B1D7)", "clean C: check_name_profanity in reconstructed-c/8F/8FCC5D_weapon_charge.c; behavior documented in docs/disassembly/combat/weapon-charge.md"]
see: [knowledge/wram/ROOM_TRANSITION_MODE.md, rom/80b1d8.md, rom/80b20f.md, rom/80b21f.md]
---
Called during player/dog name entry to check for forbidden vulgarity substrings:
- Scans null-terminated string at pointer `[$22]` with data bank from `$24`.
- Performs case-insensitive matching against 4-character ASCII sequence `FUCK` / `fuck`.
- If matched, restores data bank (`PLB`) and sets flag bit 5 (`0x20`) in the 16-bit word at WRAM `$7E:22E9` with a read-modify-write (`ORA $7E22E9; STA $7E22E9`).
- Exits on null terminator or end of buffer via `RTL`.
