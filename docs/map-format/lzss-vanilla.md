# The vanilla LZSS encoder

How the rooms' LZSS blocks (`sub_flag 0x03`, decoder `$8C:98C9`, [map_decompression_trace_analysis.md](map_decompression_trace_analysis.md))
were packed, reconstructed from the streams themselves (2026-11-19). `lzssCompressVanilla`
(`src/games/evermore/maps/encode-streams.ts`) is our own implementation of it; it gives back **237 of the 241**
vanilla LZSS blocks byte for byte (Block 1 of 115 rooms, Block 3 of 126). The other four, Block 3 of rooms `0x0A`,
`0x16`, `0x2D`, `0x67`, first differ after the window has wrapped (past byte 4,096) *(the rule there: open)*.
Open Evermore stores rooms uncompressed and keeps those four blocks' vanilla bytes as a cache.

| Property | Vanilla | How we know |
|---|---|---|
| window | 4,096 bytes, zeroed, first write at index 0; offset field = index + 1 (0 = end) | decoder |
| match length | 2–17 (nibble + 2) | decoder; shortest seen 2 |
| choice | greedy: always the longest match (one literal in 3,218 had a match, at the end) | token census of 12 blocks |
| zeroed window | never matched before it is written | token census |
| which of equal matches | the node found last on a binary-search-tree path over every window position (17-byte keys), not the nearest or the farthest | 107 → 231 of 241 when modelled |
| index `0xFFF` | never a match source (its offset would encode as 0, the end mark) | 231 → 237 |
| end | the flag bit and the 12-bit offset 0, then zero bits to a byte; the 4 length bits are not stored | length of all 237: `ceil((bits + 13) / 8)` |

Our older `lzssCompress` (hash chains, the custom-room writer) is valid for the decoder but reproduces 1 of 115
Block 1s.
