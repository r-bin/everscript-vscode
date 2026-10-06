# emulator/cdl/ — Code/Data Logger, xrefs, Asar export

Host side of the CDL recorder compiled into the debugger core
(`core/snes9x2005-wasm/source/cdl.c`, gated by `#if EVS_CDL`, constant on).
Design: `docs/tracing-disassembler-and-asar-generation.md` section 9.

| File | Role |
|---|---|
| `opcodes.js` | 65816 opcode matrix — single source for the disassembler and the core's `cdl-optable.h` (`node tools/gen-cdl-optable.js`) |
| `library.js` | Per-ROM library `<globalStorage>/cdl-library/<sha1>/`; mergeable files, atomic flush |
| `rom-map.js` | ROM offset ⇄ bus address (canonical HiROM `$C0+`, LoROM `$80+:8000`) |
| `xref-index.js` | Functions, callers, enclosing function, accessors per address, labels |
| `disasm.js` | Decode one instruction with recorded M/X; format Asar text that reassembles byte-exact |
| `asar-export.js` | `main.asm` + `banks/*.asm` + `rom.bin` (incbin for unreached / DMA runs) |
| `wram-export.js` | `ram.asm`: every WRAM address, accessors, values seen, enum / bit-flag guesses |
| `lookup.js` | "who calls / who touches" answers for the CDL tab |
| `host.js` | Panel glue (the only file that needs `vscode`): seed, merge deltas, flush, export, lookup |

The webview half (tab, strips, drain timer) is `../cdl-view.js`.

## Invariants

- Recording is **off by default** (`everscript.cdl.enabled`, or the tab's toggle per session).
- The SSD is never touched per instruction: the core records into WASM memory, the
  webview drains only changed chunks / new table entries every 15 s, the host merges and
  writes after a 2 s debounce with tmp-file + rename.
- Every stored field merges with OR / min / max / union — re-importing or merging sessions
  in any order gives the same library. No hit counters.
- Export must reassemble byte-identical: `asar --fix-checksum=off main.asm out.sfc`.
  Branches always use a label (`seg_XXXXXX+$n` when no better one) because Asar reads a
  bare number in a branch as the displacement.
- Xrefs are capped at 128 distinct addresses per (instruction, space); beyond that the
  instruction is reported as a bulk range (clears, copies, table walks).

## Allowed dependencies

`../snes-rom-header-model.js`, Node built-ins; `host.js` additionally `vscode`.
