# Other tools

Tools we use occasionally or have evaluated. The main approaches have their own pages
([cdl.md](cdl.md), [asm-to-c-port.md](asm-to-c-port.md), [ghidra.md](ghidra.md), [rea.md](rea.md)).

| Tool | Licence | Use it for | Notes |
|---|---|---|---|
| **Mesen2** | GPLv3 (we only exchange files with it) | Interactive debugging: breakpoints, trace logger, memory viewer, its own CDL | Reads our `rom.cdl` bit layout. Planned: write its `.cdl` header variant and `.mlb` labels from our names ([formats.md](formats.md) §3). Do not copy its code |
| **snesrecomp** | external (check) | 65816 → C lift fed by our export, `hle_func` replacement | Covered in [asm-to-c-port.md](asm-to-c-port.md) §5 and [cdl-export-build-recomp.md](cdl-export-build-recomp.md) |
| **Asar** | external (check) | Assembling the export, patches | skill `snes-asm-asar-patching` |
| **DiztinGUIsh** | external (check) | Interactive CDL-driven disassembly to Asar | Windows-only. Our export covers its output. Comparison: [cdl-design-history.md](cdl-design-history.md) §8 |
| bsnes-plus | external (check) | Debugger with usage map | Superseded by Mesen2 + our CDL; check its label-import format before targeting it |
| everscript (`../everscript`) | ours | Script decompiler / compiler, wiki `Rom-Map.md` / `Ram-Map.md` | The script layer of the game is already decompiled. The C port only covers the engine |
| SA-1 investigation (`../evermore-sa1`) | ours | Findings on SA-1 feasibility | Status "not feasible as a simple patch": SoE's HiROM layout conflicts with the SA-1 memory map. Needs a shiftable disassembly first (master plan G4) |

**Not allowed:** the third-party tools the root `AGENTS.md` names (GPLv3). Use no
code, tables, layouts or names from them, and don't read their source while implementing the
same thing.
