---
addr: 90D986
size: 32
end: 90D9A5
kind: table
category: 🏹
name: SCRIPT_PROJECTILE_TABLE
title: The projectiles script opcode 0xB5 launches (16 record addresses)
confidence: confirmed
tags: [combat, projectile, script-vm, table]
evidence: ["disasm: $8C:E851 lda.l $90D986,x with X = opcode 0xB5's first operand; the word goes to DP $06, the record $90:DCC0 reads", "rom: the only reader (no other lda.l $90D986 or 16-bit $D986 operand in bank $90); 16 words, the records follow at $90:D9A6", "rom: vanilla scripts launch kinds $1A, $1C, $1E (ids 13-15) as constants and others from a temp variable"]
see: [routines/tbl_projectile_records.md, routines/configure_projectile_motion.md, opcodes/b5.md]
---
One 16-bit record address (bank `$90`) per projectile id; a script names id k as 2·k. 16 of the 21 records at `$90:D9A6`
are listed; the other five ($D9EE, $DB0E, $DB26, $DB56, $DB6E) are reached by address only (animation command 0x4C), if at all. Open
Evermore: `characters/projectiles/`.
