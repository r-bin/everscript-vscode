---
addr: C43874
size: 40
end: C4389B
kind: table
name: weapon_entries
title: Equipment record pointers: weapons (1-12), the Bazooka's ammo (13-15), armour (17-56)
confidence: confirmed
tags: [weapons, tables]
evidence: ["disasm: $8F:81D5 `lda $C4388E,x` (X = $2349) and $8F:81DB `lda $C43874,x`", "rom: word 0 is 0 (no weapon), then 12 entries $38E6-$3A72, 36 bytes apart; $C4:388E holds $3A96, $3ABA, $3ADE"]
see: [routines/boy_load_weapon.md]
---
Entry layout, as `$8F:81C9` copies it: `+$04` palette (bank `$90`), `+$06` range, `+$08`-`+$18`
nine animation ids (stand, walk, run, attacks 0-3, dodge, knockback), `+$1A`/`+$1C` are the Boy's two idle animations (`BOY_IDLE_ANIMATION`, `BOY_IDLE_ANIMATION_RARE`: played after 20-54 s standing, 15 and 1 rolls in 16; `$3EBE`/`$3ECE`/`$3EDE` for weapons 0-7, `$0000`, no idle, for the spears and ammo).

Corrected v0.456.0: the table is 57 words, not 20. Word 0 and word 16 are 0; words 1-12 point at the weapon records, 13-15 at the ammo records ($C4:388E + 2·ammo, `$8F:81D5`), 17-56 at the 40 armour records (read as `$C4:3894 + 2·k` with k a ring item's index, `$8E:A694`). Field meanings of the weapon record: `BOY_WEAPON_TABLE`. Every record is read through these pointers or by an address WRAM keeps (armour), so Open Evermore leaves the pointers and the records in place.
