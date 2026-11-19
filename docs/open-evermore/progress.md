# Open Evermore: progress

Back to [README.md](README.md). Update this page in the same commit as every step.

Legend: ⬜ not started · 🟨 in progress · ✅ done · — not applicable

## 1. Kinds

A kind is **done** when all columns are ✅:

- **Explode**: it writes its folder by name, with its `_enum.json`, losslessly.
- **Implode**: it encodes the folder and generates every table that reaches it (the hard rule, README.md §1).
- **G0**: a fresh tree implodes (stable) to the vanilla sha1, with no warning.
- **Random**: `--random` places every resource elsewhere and the round trip holds.
- **Proven**: `prove` plays the stored playbacks identically (G1).
- **VFS by name**: `soe://rom/` shows the same names and files ([README.md](README.md) §6).

| Step | Kind | Explode | Implode | G0 | Random | Proven | VFS by name | Notes |
|---|---|---|---|---|---|---|---|---|
| S1 | maps (127 rooms) | ✅ | ✅ | ✅ | ✅ | ✅ (~10 rooms visited) | ⬜ (by hex id) | v6: map.json + grid.txt + metatiles.json (words as text) + objects.json (states as cells) + preview.png; cuttable grass as metatiles; uncompressed with the compression noted (237/241 LZSS + all Markov reproduced; 4 blocks keep `packed`); only script ids still numbers (S6). The Rooms tab reads it |
| S2 | tile families (365) | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ (no VFS folder yet) | one array item + the loader's two operands; maps name families; JSON (with the maps using it) or `--families png`; names `family_<id>` |
| S3 | tiles (6,688) | ✅ | ✅ | ✅ | ✅ | ✅ 3 of 4 seeds | ⬜ (by hex id) | indexed PNG (default) or JSON rows; the table at `$EE0000`; 6,682 re-encoded byte for byte, 6 keep `encoded`; maps name graphics and animation frames; names `tile_<id>` |
| S4 | strings (3,002) | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ (by index) | `.txt` per string in our lossless text form; key table generated; 2,157 keep vanilla bytes (vanilla's compressor not reproduced yet) |
| S5 | music, sounds | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (by hex id) | then: a copied track under a new name plays (G2) |
| S6 | scripts | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | upper halves, no bank crossing; packed pointers |
| S7 | characters, sprites, animations | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | animation records bound to `$C4` |
| S8 | header | ⬜ | ⬜ | ⬜ | — | — | ⬜ (`header.json` exists) | fixed by hardware at `$FFC0`; vectors by routine name once code is a kind |
| S9 | code | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ by name already | only routines whose every caller is symbolic; the rest stays in `_base/` |

## 2. Beyond

| Capability | State | Proven by |
|---|---|---|
| a proof over every room (a playback that enters all 127) | ⬜ | `prove` |
| a changed or new resource (G2) | ⬜ | its own playback |
| `"size": "4MiB"`: the 4th MB as a `free` region (rooms leave their banks) | ✅ for `--random` and when a stable build runs out | `prove` seeds 1, 2, 99 |
| tile moves shift room-load timing: drifts that come back in step; seed 7 lost a lag frame for good | 🟨 cause open (not page offset, not bank half; the 64-pointer list at `$7E0140`?) | `prove` |
| `exhirom` / `sa1` layouts, automatic growth hirom → 4 MiB → exhirom | ✅ built, round trip; 🟨 not proven by playback (they leave step: slow ROM, lag frames) | [manifest.md](manifest.md) §1.1 |
| `rename`, BPS output | ⬜ | unit tests |
| the everscript compiler builds into the tree | ⬜ | [../split-and-link/tool.md](../split-and-link/tool.md) §7 |
| the Rooms tab reads a tree's maps (*Open Evermore* rail group) | ✅ | `tree-editor-dom.test.mts` |
| editors save into the tree (promotion) | ⬜ | [tool.md](tool.md) §5 |

## 3. Log

| Date | Step | What |
|---|---|---|
| 2026-11-18 | — | project documented: README, manifest, resources, validation, tool, this page |
| 2026-11-18 | S0 | v0.435.0: explode to `manifest.json` + 48 raw bank files, implode back with validation. **Withdrawn** the next day: banks are not resources (nothing references a bank by name, so implode could only put them back in place) |
| 2026-11-19 | S1 | maps: 127 rooms by name, `maps/_enum.json`, the map table generated; `_base/` replaces raw banks; one CLI (`explode`, `implode`, `prove`); `--random`; the lockstep proof. Seeds 42, 7, 123456, 99 moved 112–122 rooms; attract loop + 2m20 intro identical (14,638 frames). Found: the engine keeps six long pointers into the room blob, one of them one past its end (`knowledge/wram/DIRECT_PAGE_BLOCK.md`) |
| 2026-11-19 | S2 | tile families: `tile_families/<name>.json` (16 colours), the array placed like any item, the loader operands `$90:D065`/`$90:D079` generated; maps reference families by name (map.json v2); explode names everything through one function so cross-kind names survive the round trip; implode resolves every enum before encoding. Seeds 1, 2, 99 moved the array inside bank `$9C`; playbacks identical; no WRAM pointer into it |
| 2026-11-19 | S3 | tiles: `tiles/<name>.json` (pixel rows), the `$EE0000` table generated; maps name graphics and animation frames (`marks`: used, dma). Found: the bit-6 tile form (`$8C:C8B0`, six vanilla tiles, two fetched 3 bytes past their end; checked in VRAM), vanilla's tile encoding rules (6,682 reproduced) and LZSS encoder (237/241). Owner's asks the same day: `--random` grows to 4 MiB (≈900 resources land in the 4th MB); map.json v4 uncompressed and compact; families list their maps or are PNG stripes. The proof now checks VRAM and allows drifts; seeds 1, 2, 99 in step, 7 not |
| 2026-11-19 | S3 | v0.439.0: tiles as indexed PNG by default (coloured with the family vanilla draws each with most), `--tiles json` the alternative; the six kept encodings in `tiles/_encoded.json`; the round trip compares content, not the file format (`Codec.canonical`) |
| 2026-11-19 | S1 | v0.440.0: maps v5 for readability (rated 2/5 → 3.5/5, resources.md §maps): named header and palette cycles, `from`/`to` triggers, `grid.txt`, `metatiles.json` with layer and collision words as text, `preview.png`; the round trip compares meaning (flag order, padding) |
| 2026-11-19 | — | v0.441.0: manifest layouts `hirom` (3/4 MiB), `exhirom`, `sa1`; hirom grows by itself to 4 MiB, then exhirom (1,549 resources land in `$41–$7D` on a random layout); `sa1` through tools/sa1. Rooms and tiles follow `$40–$7D` pointers (`romFileOffset`). Playbacks do not stay in step on exhirom/sa1 yet |
| 2026-11-19 | S4 | v0.442.0: strings by name as text; the key table generated; our fewest-bytes encoder, vanilla bytes kept where it differs; seeds 1, 99 proven with 2,954 strings moved. Found: token `$C1` is a word, not a phrase, and a 0 follows every compressed string (dialogue-text-decoder.md corrected) |
| 2026-11-19 | S1 | v0.443.0: maps v6, completely decoded: `objects.json` (each state as the cells it shows, the XOR deltas rebuilt) and cuttable grass as `cut → into` metatiles; the codec moved to `src/games/evermore/maps/tree-map.ts` so the Rooms tab reads trees (*Open Evermore* group, `imports/tree/`): all 127 maps draw as vanilla. Blobs unchanged, so earlier proofs stand. Found: vanilla object areas are records then stamps, none shared (room-reference.md §8 said shared); room `0x6E` stamps 3 objects past the grid's right edge; grass records are always source → cut (cuttable_grass_mechanics.md corrected) |
