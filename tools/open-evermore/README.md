# tools/open-evermore — explode the ROM into named parts, implode it back

The design, the resource kinds and the rules are in [docs/open-evermore/](../../docs/open-evermore/README.md); the
state of each kind is in [progress.md](../../docs/open-evermore/progress.md). This page is about the code.

```sh
npm run explode                              # base ROM of the ROM library → out/open-evermore/
npm run explode -- rom.smc --out <dir>       # … a given ROM, a given folder (inside the repo: only under out/)
npm run explode -- --force                   # replace an existing tree (edits there are lost)
npm run implode -- out/open-evermore         # → _build/evermore.sfc, report.md, report.json; exit 1 on an error
npm run implode -- <dir> --check-only        # validate without building
npm run implode -- <dir> --strict            # warnings count as errors
```

## Files

| File | What |
|---|---|
| `explode.mts` | `explode(rom, base)` → tree in memory; CLI writes it |
| `implode.mts` | `implode(tree)` → findings, image; the stages of validation.md §2; CLI writes `_build/` |
| `manifest.mts` | `manifest.json`: types, the manifest of a fresh ROM, schema and region checks, header agreement |
| `codec.mts` | the interface every kind implements |
| `raw.mts` | the `raw` kind: unclaimed bytes, one file per stretch inside a bank, edits refused |
| `tree.mts`, `findings.mts`, `report.mts` | the tree as a path → bytes map; findings; terminal and `report.md` |
| `evermore/kinds.mts` | Evermore's kinds in migration order; the only place with game facts |

## Invariants

- **G0 on a fresh tree, with no warnings**: `tests/open-evermore/g0.test.mts` (`rom` tier). A new kind is added to
  `evermore/kinds.mts` only when that test still passes.
- **One decoder.** A codec calls the decoders in `dist/` (the ones `soe://` uses); it never copies them.
- **No ROM bytes in the repo.** The tree and `_build/` are ROM-derived: `out/` or outside the repository.
- **Generic files stay generic.** Only `evermore/` names the game (AGENTS.md §0.4); the rest knows SNES HiROM only.
- Tests: `tests/open-evermore/s0.test.mts` (unit, synthetic image: every validation rule with one failing case).
