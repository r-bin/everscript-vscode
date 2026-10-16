---
name: ghidra-analysis
description: Use when running or reading Ghidra (ghidra-snes) or REA on Secret of Evermore: setup, seeding from the CDL library, batch dossiers, and when a result can be trusted.
applyTo: "docs/reverse-engineering/ghidra.md,docs/reverse-engineering/rea.md,tools/ghidra/**"
---

# Skill: Ghidra / REA on Secret of Evermore

Full guide: `docs/reverse-engineering/ghidra.md` (setup, plugin gaps), `docs/reverse-engineering/rea.md`
(REA, the spike numbers in §10). Overall role: `docs/reverse-engineering/README.md`.

## 1. What it is for

- Static fill: functions and direct-call edges in code the CDL never executed.
- Accessors of long WRAM addresses (`$7E:xxxx`) in unplayed code.
- Reading a routine with its callers, callees and named references, to name it.

Not for: code/data truth, M/X widths, DB/D, jump-table targets (the CDL records these),
C code (pseudocode is noise on 65816), asset boundaries, or anything the extension runs.
**Runtime beats static**: tag Ghidra-only facts `static`.

## 2. Traps

| Trap | Symptom | Fix |
|---|---|---|
| Code runs from `$80–$BF`, ghidra-snes maps only `$C0–$FF` | "non-existing memory at 90824b", no callers | Loader patch: map `$80–$AF:8000–FFFF` **file-backed** (ghidra.md §3 step 3) |
| Mirror (byte-mapped) blocks | seeds report 0 functions in `$8x` | Ghidra refuses functions in mapped blocks; use file-backed blocks |
| Seeds at `$Cx` | calls don't link to seeded functions | Seed at the execution address: `off & 0x8000 ? 0x800000+off : 0xC00000+off` |
| Extension in `~/Library/ghidra/…/Extensions` | works in the GUI, "No load spec found" under REA | Install into `$GHIDRA_INSTALL_DIR/Ghidra/Extensions/`; compile `65816.sla` with `support/sleigh` |
| `brew upgrade ghidra` | extension gone | reinstall (it lives in the Cellar) |
| Patched ROM (`../everscript/out/*.smc`) | "No load spec found" | ghidra-snes checks the header checksum; use the clean ROM (SHA-1 `79e77386…`) |
| `PLP` | wrong widths after it | language does not restore M/X from the stack; set context from CDL |
| DB / D | missing or wrong refs for 16-bit / direct-page operands | not modelled; add refs from CDL `regs.bin` by script |
| Decompiler hang | one function spun 14 min and blocked the session | per-call timeout, restart the session, skip the address |
| REA refuses `.sfc/.smc` | "unsupported binary format" | REA 6.4.0 accepts only ELF/MZ/Mach-O; local patch or upstream SNES profile (rea.md §0) |
| Opening someone else's old project | `NotOwnerException`, then "Language not found for '65816:LE:16:default'" | On a copy: set `OWNER` in `<name>.rep/project.prp`; give a cloned Ghidra install an `.ldefs` with that id pointing at ghidra-snes's files; read annotations only (`docs/reverse-engineering/community-ghidra-notes.md` §1) |

## 3. Rules

- Keep projects, listings, pseudocode and dossiers outside the repo; write findings in our own
  words into `functions.js` / knowledge entries (skill `game-knowledge`).
- Seeds and context files are generated from our name sources and the CDL library, never hand-edited.
- Ghidra facts reach `soe://` only via the library (`static.json`, planned), never a live Ghidra.
