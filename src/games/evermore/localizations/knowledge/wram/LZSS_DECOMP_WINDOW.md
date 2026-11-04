---
addr: $7F:A000
name: LZSS_DECOMP_WINDOW
type: LzssDecompWindow
tags: [decompression, system, bank7f]
confidence: verified
evidence: ["disasm: 1,024-byte sliding ring buffer decompression window used by ROM LZSS method 0x03 decompression engine ($8C:988D)", "reconstructed-c/8C/8C988D_lzss_decompression.c"]
---
1,024-byte sliding ring buffer decompression window used by ROM LZSS method 0x03 decompression engine ($8C:988D).

### Inner Struct Layout (`LzssDecompWindow`):
- `+$0000` (`ring_buffer_preseed`, `u8[958]` / 958 bytes): Sliding history window pre-seed buffer before initial cursor index ($8C:988D).
- `+$03BE` (`initial_cursor_tail`, `u8[66]` / 66 bytes): Sliding ring buffer tail from initial write head index (`LZSS_INIT_INDEX = 0x03BE`) to the 1,024-byte wrap boundary ($8C:988D).
