---
addr: $7E:6611
name: COLOR_CROSSFADE_CGRAM_STAGING_BUF
type: u8[572]
tags: [cgram, palette, crossfade]
confidence: verified
evidence: ["disasm: CGRAM palette cross-fade output staging buffer (572 bytes: $7E:6611..$7E:684C; uploaded via $80:85FA)"]
---
CGRAM palette cross-fade output staging buffer (572 bytes: $7E:6611..$7E:684C) transferred to CGRAM during VBLANK.
