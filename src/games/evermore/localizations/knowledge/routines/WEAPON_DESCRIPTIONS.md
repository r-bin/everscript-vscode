---
addr: C459F8
end: C45A11
size: 26
kind: table
category: ⚔️
name: WEAPON_DESCRIPTIONS
title: Each weapon's description text (bank $C4)
confidence: confirmed
tags: ["weapons", "tables"]
evidence: ["disasm v0.456.0: read by the weapon skill pages ($8D:92CA, $8D:95C2, $8D:98AD) into the text pointer $22", "rom: 1-12 point at plain NUL-ended ASCII in bank $C4; 0 is 0; 13 (the Bazooka) holds $3E16, which is no text (not read for it)"]
see: ["routines/WEAPON_SCHOOL.md", "docs/open-evermore/resources.md"]
---
One word per weapon index: a pointer in bank `$C4` to the line the weapon skill page shows for the weapon. Open Evermore writes it as `description` (the text, at its place).

Previously named `tbl_C459F8` (a CDL lookup table, meaning not recorded).
