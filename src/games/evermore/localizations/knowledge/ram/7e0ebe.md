---
addr: 7E0EBE
size: 2
kind: var
name: RING_16_CURSOR_0EBE
title: Cursor of a 16-byte-record ring at $5DC3-$6183
lifetime: unknown
confidence: guess
tags: []
evidence: ["disasm: $8F:DDC2 adds $10 and wraps to $5DC3 at $6183; $8F:DF2B stores $5DC3 to it and $0EC0", "trace: one of the bytes a timing shift changed in the title-to-load sequence (hotkey hack test, v0.355.0)"]
see: []
---
Moves on by 16 bytes per record; what the records are is not known.
