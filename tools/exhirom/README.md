# tools/exhirom — Evermore as an 8 MB ExHiROM image

Why, the bus map and the full write-up of how this was built and proven:
[docs/exhirom/port.md](../../docs/exhirom/port.md).

| File | What it does |
|---|---|
| `convert.js` | `npm run exhirom`: clean 3 MB HiROM ROM → 8 MB ExHiROM image in `out/soe-exhirom.sfc`. Reads everything it needs from the user's ROM; holds no game bytes. |
| `prove.js` | `npm run exhirom:prove`: builds three images (release, core-mirror, trap) and checks them: statically, mapping on the bus, same input → same machine state in our snes9x core and in Mesen2, and with the CDL. Writes `REPORT.md`. |
| `run.js` | One headless snes9x run for `prove.js`: one ROM, one movie (or no input), and a trace (WRAM every frame; VRAM, screen, SRAM, CPU every 60 frames; rooms; optional CDL and bus probes). |
| `mesen.js` | The same for Mesen2's `--testrunner` (Lua script generated per run). |

```sh
npm run exhirom -- "/path/Secret of Evermore (U) [!].smc"      # → out/soe-exhirom.sfc
scripts/build-exhirom.sh "/path/Secret of Evermore (U) [!].smc" # same, via scripts/
scripts/build-exhirom.sh "/path/Secret of Evermore (U) [!].smc" --prove   # build + proof
npm run exhirom:prove -- --rom "/path/Secret of Evermore (U) [!].smc" \
     --movies "$HOME/Library/Application Support/Code/User/globalStorage/rbin.everscript/tas-recordings"
```

The ROM defaults to `$SOE_ROM`, then `out/rom.sfc`. A second argument changes the output path.

`convert.js` options:
- `--fill ff|db` sets the byte for unused space (default `$FF`).
- `--upper hardware|snes9x2005|fill` sets what `0x300000–0x3FFFFF` holds (default `hardware`; see
  `knowledge/rom/80d113.md` for why that area is not free).

`prove.js` finds the movies recorded on the same ROM (their `rom.sha256` header) and runs on all
cores but one. It uses Mesen2 from `/Applications/Mesen.app` or `$MESEN`; `--no-mesen` skips it.
A full run (30 movies, about 440,000 frames) takes about 4 minutes for snes9x plus Mesen's time.

`EXHIROM_CORE=<dir>/snes9x_2005.js` runs on a copy of the core. Use it when something may rebuild
`src/emulator/core/` during the run: a rebuild half-way through aborts the proof.

The ROM goes to `out/soe-exhirom.sfc`; the proof's images, traces and `REPORT.md` go to `out/exhirom/`. None of it may be committed: the
images are game data, and the report quotes a few ROM bytes.
