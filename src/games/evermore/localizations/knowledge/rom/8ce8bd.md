---
addr: 8CE8BD
kind: table
category: 📋
name: SCRIPT_OPCODE_HANDLER_TABLE
title: Script opcode handler table
confidence: likely
evidence: ["legacy: migrated from tables.js; how it was learned was not recorded (sources then: the everscript wiki ROM map, the ROM tab's points.js)"]
---
195 words, opcodes 0x00-0xC2 → handler in bank $8C (used by $8C:D0A6); unused opcodes point at STP traps $8C:E8B5-E8BC; 0xAB → $8C:E8B1 (JML $80:84C9)
