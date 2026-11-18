# Open Evermore: progress

Back to [README.md](README.md). Update this page in the same commit as every step.

Legend: ⬜ not started · 🟨 in progress · ✅ done · — not applicable

## 1. Kinds

A kind is **done** when all five columns are ✅:

- **Explode**: it writes its folder by name.
- **Implode**: it encodes the folder and generates its tables.
- **G0 + round trip**: a fresh tree implodes to the vanilla sha1 and explodes back to the same folder.
- **Validation**: its rules exist, each with a unit test, and vanilla raises no warning.
- **VFS by name**: `soe://rom/` shows the same names and files ([README.md](README.md) §6).

| Step | Kind | Explode | Implode | G0 + round trip | Validation | VFS by name | Bytes left in `raw/` | Notes |
|---|---|---|---|---|---|---|---|---|
| S0 | skeleton: manifest, raw | ⬜ | ⬜ | ⬜ | ⬜ | — | all (3 MiB) | implode writes bytes itself, no Asar |
| S1 | header | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (`header.json` exists) | | vectors stay raw labels until S10 |
| S2 | tables | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (168 by name) | | kinds take their tables over later |
| S3 | palettes (tile families) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | | |
| S4 | strings | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (by index today) | | compressor or cached bytes for G0 |
| S5 | music, sounds | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (by hex id today) | | first slice: a copied track under a new name plays (G2) |
| S6 | tiles | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (by hex id today) | | naming helper for 6,688 tiles |
| S7 | maps | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ (by hex id today) | | `buildBlob` already round-trips all 127 |
| S8 | scripts | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | | raw + labels until the compiler emits relocatable output |
| S9 | characters, sprites, animations | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | | |
| S10 | code | ⬜ | ⬜ | ⬜ | ⬜ | ✅ by name already | | Asar from here on; routines with raw operands stay pinned |

## 2. Beyond G0

Opened per kind, once its readers are symbols ([README.md](README.md) §7.4).

| Capability | State | Proven by |
|---|---|---|
| a kind's resource grows in place or moves (G1) | ⬜ | playbacks |
| a new resource of a kind (G2) | ⬜ | its own playback |
| `"size": "4MiB"`: the 4th MB as a free region | ⬜ | G1 on the moved tables (the table hack's moves, redone by implode) |
| `exhirom` / `sa1` layouts | ⬜ | [manifest.md](manifest.md) §1.1 |
| the everscript compiler builds into the tree | ⬜ | [../split-and-link/tool.md](../split-and-link/tool.md) §7 |
| editors save into the tree (promotion) | ⬜ | [tool.md](tool.md) §5 |

## 3. Log

| Date | Step | What |
|---|---|---|
| 2026-11-18 | — | project documented: README, manifest, resources, validation, tool, this page |
