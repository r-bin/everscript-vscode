---
addr: $7F:A000
name: LZSS_DECOMP_WINDOW
type: u8[0x0400]
tags: [decompression, system, bank7f]
confidence: verified
evidence: ["disasm: 1,024-byte sliding ring buffer decompression window used by ROM LZSS method 0x03 decompression engine ($8C:988D)"]
---
1,024-byte sliding ring buffer decompression window used by ROM LZSS method 0x03 decompression engine ($8C:988D).
