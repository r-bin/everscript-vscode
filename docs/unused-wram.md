# Unused WRAM in Secret of Evermore (US)

Which WRAM the vanilla US game never seems to use, so that hacks can keep their own state
there. **Nothing on this page is proven free.** Everything comes from what was recorded while
playing (the CDL library), plus one static check. Treat each range as a candidate until a hack
has run the stored playbacks with a guard pattern in it (see "Confirming a range" below).

Measured 2026-10-26 from the vanilla US CDL library
(`cdl-library/79e7738630fff5699217ef58ecc421bc8fcbcd89/wram.flags`, recorded up to
2026-10-25). Other releases (PAL, the prototype) are not covered (`docs/evermore-releases.md`).

## Summary

| | Bytes no recorded code touched |
|---|---|
| `$7E:0000–1FFF` (mirrored low RAM, direct page, stack) | **0**: nothing free |
| `$7E:2000–FFFF` | ~28.6 KB |
| `$7F:0000–FFFF` | ~19.4 KB |
| **Total** | **~46.9 KB** (47,455 bytes counting only blocks of 16+ bytes) |
| …in blocks of 64+ bytes | ~41 KB |
| …in blocks of 256+ bytes | ~38 KB |

"Untouched" means the byte's `wram.flags` entry is 0: no CPU read or write, no DMA/HDMA, no
`$2180` port access, no script access. The boot code's DMA zeroing of both banks
(`docs/disassembly/engine-core/boot-reset.md`, phase C) runs before recording starts, so
every untouched byte holds `$00` after a reset.

## Candidate blocks (128 bytes or more)

Confidence is our own estimate:
- **medium**: one large unbroken gap at the end of a known structure.
- **low**: a gap inside a region whose use depends on the room, the enemies or the effects, so
  content nobody played while recording may fill it.

| Range | Size | Confidence | Notes |
|---|---|---|---|
| `$7E:ADFE–FFFD` | 20,992 (20.5 KB) | medium | Starts right after the OAM mirror (`$7E:ABDE–ADFD`, `knowledge/ram/7eabde.md`) and runs to the top of the bank. The best candidate. See the `$7E:FFFE` note below. |
| `$7F:8200–9743` | 5,444 | low | Inside bank `$7F`'s graphics and room buffers; a bigger room or tileset may reach it. |
| `$7F:9750–9CE3` | 1,428 | low | Same region; a few used bytes separate it from the block above. |
| `$7F:9CE6–9E8B` | 422 | low | Same region. |
| `$7F:9EB0–9FFF` | 336 | low | Same region; ends on a 4 KB boundary. |
| `$7F:C6C0–C7FF` | 320 | low | After the tile palette at `$7F:C300`. |
| `$7F:D000–D12D` | 302 | low | |
| `$7F:D130–D4CF` | 928 | low | |
| `$7F:D4D2–D71D` | 588 | low | |
| `$7F:D79E–D81D` | 128 | low | |
| `$7F:D8ED–DA89` | 413 | low | |
| `$7F:DA8C–DC1D` | 402 | low | |
| `$7F:DED0–E9AB` | 2,780 | low | |
| `$7F:E9AE–EE75` | 1,224 | low | |
| `$7E:8000–A897` | 19 gaps of 135–628 bytes | low | Scattered between used bytes of the tilemap cache, the OBJ tile cache (`$7E:96A5`, `$7E:9727`) and other per-room tables. Probably unused slots of tables that are not always full. Avoid. |
| `$7E:A8A0–AA50` | 433 | low | Just below the OAM mirror. |

The `$7E:8000–A897` gaps: `8000–80BD`, `813B–8266`, `86C8–8848`, `8AE0–8BDA`, `8C27–8D2B`,
`8D32–8FA5`, `8FC7–906C`, `90EB–91E3`, `9247–9396`, `939B–953F`, `98B8–993E`, `9943–99FE`,
`9A25–9AD7`, `9E3A–9F41`, `9F8E–A07E`, `A228–A2ED`, `A35E–A3ED`, `A3F2–A5F8`, `A7C6–A897`.

### `$7E:FFFE–FFFF`

The last word of bank `$7E` is **read as a word by the script VM** (`wram.flags` = `$29`:
READ | WORD | SCRIPT) and never written. Most likely some script reads an address that holds 0;
we have not identified which script. Keep it at `$0000`. Do not extend a hack's block over it.

## Evidence and its limits

1. **Recorded play only.** `wram.flags` holds only what was played while recording. Rooms,
   bosses, alchemy effects, menus or endings that nobody played are missing. Bank `$91`'s
   effect handlers, for example, were never recorded (`cdl-recorder` skill). A large gap is more
   convincing than a small one, but neither is proof.
2. **Static check (done, partial).** No executed long-addressed instruction (`op $7E/$7F:xxxx`,
   opcodes `$0F`, `$1F` … `$FF`, at an `EXT_OPCODE_HEAD` byte of `rom.ext`) targets any block above. The check
   cannot see absolute addressing with DB = `$7E`/`$7F`, indexed or indirect accesses, DMA
   destinations, or code that was never recorded.
3. **Dynamic structures.** Some WRAM is a pool or buffer whose fill level depends on the
   content (OBJ tile cache, decompression scratch, the script VM stack). The 20 KB block could
   be the unreached top of such a buffer. Nothing recorded points that way, but the static check
   cannot rule it out.

## Confirming a range

Before a hack relies on a range:

1. In a test build, fill the range with a guard pattern at boot, after the DMA zeroing.
2. Run the stored vanilla playbacks against it (`sample-playbacks` skill). Compare the guard
   bytes after each run, and diff WRAM outside the range against a vanilla run. Any change in
   the guard means the game uses that range. Any change outside it means our writes leaked.
3. Search unrecorded code too: absolute stores while DB = `$7E`/`$7F`, and DMA writes to
   `$2180` with `$2181–$2183` in the range.

Once a range has passed, record it as a knowledge entry (`knowledge/ram/`, kind `buffer`, name
`FREE_…`), with the playbacks used as evidence, and update this page.

## Reproducing the numbers

Read `wram.flags` (128 KB, one byte per WRAM byte, bits in
`src/core/emulator/core/snes9x2005-wasm/source/cdl.h`, `WF_*`). Collect the runs of `$00`
bytes, then group them by length and bank. The CDL library lives in VS Code's global storage
under `rbin.everscript/cdl-library/<ROM SHA-1>/` (`cdl-recorder` skill).
