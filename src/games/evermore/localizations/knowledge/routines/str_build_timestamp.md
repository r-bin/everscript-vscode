---
addr: 80B72C
end: 80B74B
size: 32
kind: data
category: 📋
name: str_build_timestamp
title: Developer build timestamp ASCII string ("8/3/95 10:29:34 AM")
confidence: confirmed
tags: [build, timestamp, header, metadata, string]
evidence: ["disasm: 32 bytes at $80:B72C..$80:B74B; contains ASCII string '8/3/95 10:29:34 AM' (18 bytes) followed by 14 NUL padding bytes"]
see: [routines/title_demo_sequence_return_stub.md, routines/asset_80b74c_map_graphics_16_16_chr.md]
---
Embedded compile timestamp of the North American retail release of Secret of Evermore:
- String: `"8/3/95 10:29:34 AM"` (August 3, 1995 at 10:29:34 AM).
- Stored as an 18-byte ASCII character sequence followed by 14 null bytes padding out to a 32-byte boundary before CHR asset data at `$80:B74C`.
