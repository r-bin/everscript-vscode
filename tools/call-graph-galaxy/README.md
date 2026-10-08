# tools/call-graph-galaxy — CDL library as a force-directed "galaxy"

A dev tool, **not part of the extension**. It reads a recorded CDL library and writes
one standalone HTML page. Functions orbit a WRAM core in clusters by ROM bank, with ROM
assets on the rim and I/O registers and Everscript scripts as satellites.

```sh
node tools/call-graph-galaxy/build.js --rom "../everscript/Secret of Evermore (U) [!].smc"
open tools/call-graph-galaxy/out/call-graph-galaxy.html
```

| Flag | Default |
|---|---|
| `--rom` | required. It must be the ROM the library was recorded with, because the library is keyed by the ROM's SHA-1 |
| `--lib` | `~/Library/Application Support/Code/User/globalStorage/rbin.everscript/cdl-library` |
| `--memory-map` | `../everscript/.github/memory-map.md` (WRAM names) |
| `--out` | `tools/call-graph-galaxy/out/call-graph-galaxy.html` (git-ignored) |
| `--json` | not written. Pass a path to also dump the graph as JSON |

The tool only reads the library (`CdlLibrary` loads it and never flushes), so it is
safe to run while the emulator is recording.

## What is in the graph

| Body | Source | Links |
|---|---|---|
| Function | `xref-index` entries (call / interrupt targets, vectors) | `call`, `jump` from `edges.bin` |
| WRAM | `xrefs.bin` WRAM space. Named from memory-map.md, otherwise a 64-byte page | `read`, `write` |
| ROM asset | data / ptrs / gfx / hdma labels from `xref-index` | `rom`, `dma` (with its VRAM / CGRAM target) |
| I/O register | `xrefs.bin` I/O space, only registers in the `IO` table | `iow`, `ior` |
| Script | `script-xrefs.bin`, grouped to the nearest known script start (`address-lookup`) | `script` (named WRAM only), `runs` (to the interpreter function) |

The graph is **pruned to stay readable**. It keeps the top 160 assets, unnamed WRAM
pages need 4 or more functions, and disassembly stops after 14 instructions. That makes
it a picture, not a dataset. For complete machine-readable data, use the CDL export
(`functions.json`, `structs.json`, `enums.json`, `tables.json`, `ram.asm`). See
`docs/todo/research-topics.md` § "Galaxy follow-ups" for an AI-readable form.

Node size uses code bytes, callers, or hits. Hits are only available when the library
has `rom-hits.bin`, which means it was recorded with v0.173 or later. The replay order
is rebuilt by walking calls outward from the NMI vector, because the library stores no
timestamps.

Depends on `src/emulator/cdl/*` and `src/emulator/address-lookup.js` (read-only use).
If those change shape, this tool breaks first.
