# tools/open-evermore — explode the ROM into named parts, implode it back

The design, the hard rule, the resource kinds and the checks are in
[docs/open-evermore/](../../docs/open-evermore/README.md); the state of each kind is in
[progress.md](../../docs/open-evermore/progress.md); the files and the steps of implode in
[tool.md](../../docs/open-evermore/tool.md). This page is how to run it.

```sh
npm run build:ts                                  # once: the codecs call the decoders in dist/
T=tools/open-evermore/open-evermore.mts
node $T explode                                   # base ROM of the ROM library → out/open-evermore/
node $T explode rom.smc --out <dir> --force       # a given ROM and folder (inside the repo: only under out/)
node $T implode out/open-evermore                 # stable: the original, byte for byte → _build/evermore.sfc
node $T implode out/open-evermore --random        # every resource somewhere else; the seed is printed
node $T implode <dir> --random 42 --check-only    # … reproduce a seed; validate and place without building
node $T prove out/open-evermore --random 42       # original vs that layout on the stored playbacks, in lockstep
```

## Invariants

- **The hard rule**: whatever explode writes implodes to a working ROM in any layout. A kind enters
  `evermore/kinds.mts` only when its stable implode is byte-identical, `--random` round-trips and `prove` plays
  identically.
- **Explode is lossless**: a codec refuses to explode what it cannot encode back.
- **One decoder.** Codecs call the decoders in `dist/` (the ones `soe://` uses); they never copy them.
- **No ROM bytes in the repo.** The tree and `_build/` are ROM-derived: `out/` or outside the repository.
- **Generic files stay generic.** Only `evermore/` names the game (AGENTS.md §0.4).
- Tests: `tests/open-evermore/enum-layout.test.mts`, `implode.test.mts` (unit), `g0.test.mts` (rom), `in-game.test.mts`
  (emulator: edits played in the snes9x core); `prove` on
  demand only.
