# tools/sa1 — Evermore as an 8 MB SA-1 image

How it works, why, and how far it has got: [docs/sa1/port.md](../../docs/sa1/port.md).

| File | What it does |
|---|---|
| `convert.mts` | `npm run sa1`: clean 3 MB HiROM ROM → 8 MB SA-1 image in `out/soe-sa1.sfc`: both ROM views (LoROM `$80–$BF`, linear `$C0–$FF`), SA-1 header, and the cycle-exact boot block that sets the SA-1 bank registers. Reads everything from the user's ROM; holds no game bytes. |
| `prove.mts` | `npm run sa1:prove`: builds the release, `mesen` and trap images and runs each against the original in MesenCE on the same input; writes `out/sa1/REPORT.md`. |
| `mesen.mts` | One headless MesenCE run with a per-frame trace; each run gets its own ROM name so no battery save is read or left behind. |

```sh
npm run sa1                                  # base ROM of the ROM library → out/soe-sa1.sfc
npm run sa1 -- rom.smc out.sfc --upper mesen # 4th MB as MesenCE answers it (hardware | mesen | snes9x2005 | fill)
npm run sa1:prove -- --boot-frames 6000 --max-movies 4 --max-frames 15000
```

`prove.mts` takes movies from the extension's `tas-recordings` folder (or `--movies <dir|file>...`), only those
recorded on the base ROM that replay as plain input. MesenCE: `/Applications/Mesen.app` or `$MESEN`. About 1,200
frames per second over six parallel runs; `--jobs` sets the count.

Images and reports stay in `out/`: they are game data, and the report quotes ROM bytes.
