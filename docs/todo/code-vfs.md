# Code by name: `soe://rom/code/`

How to use it: skill `code-vfs`. This file: where it is going and what is open.

## Done (v0.343.0)

- Routines by name: `code/<name>/info.md`, `<name>.asm`, `<name>.c`; the knowledge entry, the
  centralized asm comments (`asm-comments.json`) and the reconstructed C meet in one folder.
- `code/index.md?q=…` searches names, knowledge text, C, WRAM touched (whole RAM entry), calls;
  filters `status`, `bank`, `category`, `confidence`; `index.json` the same as data.
- `todo.md`: open work per kind, and the routines called by known code that have no entry yet.
- A routine is found in PAL or rebuilt ROMs by its bytes (`docs/evermore-releases.md` §5.1);
  comments follow it.
- `wram.md` and `banks.md`: first views toward the WRAM and ROM maps below.

## Open

1. **Byte-identical rebuild.** All of `reconstructed-c/` compiles together and, with a SNES C
   compiler and a HiROM link map, rebuilds the US ROM byte for byte. Steps: one function per
   entry with a machine-readable address comment (what `code-c-index.ts` matches today), shared
   headers for structs and WRAM instead of per-file copies, a link map generated from the
   entries (`addr`, `end`), and a check that compares each compiled routine with the ROM bytes.
   Many C files are explanatory rather than exact today (helpers like `wram_write_word`).
2. **WRAM map.** Every WRAM address with its RAM entry, its type (enum/struct from the C), and
   who reads and writes it. `wram.md` covers absolute/long operands of known routines only:
   add direct-page and indexed accesses (needs DP/DB per routine: CDL library), and the enums
   that live there.
3. **ROM map.** Which routines and assets live in which bank, drawn (the ROM tab has the asset
   side: `src/games/evermore/rom/`); `banks.md` is the routine count per bank. Needs `end:` on
   more entries, or extents from the CDL library.
4. **Callers through tables.** Calls are direct JSL/JSR/JMP only; opcode tables and jump tables
   (`jmp (abs,x)`) are not followed, so handlers show no callers.
5. **Names in moved ROMs.** Call targets are named from located routines; tables are named only
   when the routine did not move.
6. **Entries keyed by name.** Knowledge files are still named by US address
   (`knowledge/rom/8cd220.md`); the VFS already keys by `name:`. Renaming the files waits until
   other tools (`check-knowledge`, exports) read the `addr:` field only.
