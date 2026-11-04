---
addr: $7E:2365
end: $7E:237C
size: 24
kind: array
name: DIALOGUE_STRING_PARAM_REGISTERS
type: u8[24]
title: Dialogue and message box numeric string interpolation registers
lifetime: room
confidence: confirmed
tags: [dialogue, scripts, ui]
evidence: ["scripts: Room 0x0A message box stages item price into <0x2365>", "scripts: Room 0x43 dialogue stages numeric values across <0x236d>, <0x236f>, <0x2371>, <0x2373>, <0x2375>, <0x2377>", "scripts: $92DC12, $92DE4D write string parameters to <0x2379>, <0x237b>", "audit: unnamed-memory-audit.md identifies $2365..$237C as volatile string parameter staging registers"]
see: [docs/scripts/unnamed-memory-audit.md]
---
Bank of volatile registers ($7E:2365..$7E:237C, 24 bytes: $7E:2365, $7E:2367, $7E:236B, $7E:236D, $7E:236F, $7E:2371, $7E:2373, $7E:2375, $7E:2377, $7E:2379, $7E:237B) used by room event scripts to stage numeric parameters interpolated into dialogue text strings (e.g. price amounts, countdown timers, quantity counts).
Read during dialogue formatting and discarded.
