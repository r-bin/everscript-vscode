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
| S1 | maps (127 rooms) | ✅ | ✅ | ✅ | ✅ | ✅ (~10 rooms visited) | ⬜ (by hex id) | blobs as built by the room encoder (header hex, blocks base64); tile families, graphics and script ids stay numbers until their kinds exist |
| S2 | tile families (365) | ✅ | ✅ | ✅ | ✅ | ✅ | ⬜ (no VFS folder yet) | one array item + the loader's two operands; maps name families; names are `family_<id>` for now |
| S3 | tiles | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (by hex id) | master table `$EE0000`; naming helper for 6,688 tiles |
| S4 | strings | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (by index) | key table: lower halves, one 32 KiB half |
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
| `"size": "4MiB"`: the 4th MB as a `free` region (rooms leave their banks) | ⬜ | `prove` |
| `exhirom` / `sa1` layouts | ⬜ | [manifest.md](manifest.md) §1.1 |
| `rename`, BPS output | ⬜ | unit tests |
| the everscript compiler builds into the tree | ⬜ | [../split-and-link/tool.md](../split-and-link/tool.md) §7 |
| editors save into the tree (promotion) | ⬜ | [tool.md](tool.md) §5 |

## 3. Log

| Date | Step | What |
|---|---|---|
| 2026-11-18 | — | project documented: README, manifest, resources, validation, tool, this page |
| 2026-11-18 | S0 | v0.435.0: explode to `manifest.json` + 48 raw bank files, implode back with validation. **Withdrawn** the next day: banks are not resources (nothing references a bank by name, so implode could only put them back in place) |
| 2026-11-19 | S1 | maps: 127 rooms by name, `maps/_enum.json`, the map table generated; `_base/` replaces raw banks; one CLI (`explode`, `implode`, `prove`); `--random`; the lockstep proof. Seeds 42, 7, 123456, 99 moved 112–122 rooms; attract loop + 2m20 intro identical (14,638 frames). Found: the engine keeps six long pointers into the room blob, one of them one past its end (`knowledge/wram/DIRECT_PAGE_BLOCK.md`) |
| 2026-11-19 | S2 | tile families: `tile_families/<name>.json` (16 colours), the array placed like any item, the loader operands `$90:D065`/`$90:D079` generated; maps reference families by name (map.json v2); explode names everything through one function so cross-kind names survive the round trip; implode resolves every enum before encoding. Seeds 1, 2, 99 moved the array inside bank `$9C`; playbacks identical; no WRAM pointer into it |
