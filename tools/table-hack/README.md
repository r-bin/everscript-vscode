# tools/table-hack: move Evermore's content tables into the 4th MB

The plan, and which tables can move and what each one buys:

- [docs/table-hack.md](../../docs/table-hack.md)
- [docs/extension-tables.md](../../docs/extension-tables.md)

The tool moves only tables, never content. Each table goes to bank `$F1`, the code that reads it is
rewritten, and the old copy is wiped with `$FF`.

| File | What it does |
|---|---|
| `tables.js` | The table list: where each table is, how long it is in this ROM, where it goes, and which reader operands point at it. `build()` makes the 4 MB image. |
| `build.js` | `npm run table-hack`: clean ROM → `out/table-hack/soe-tables.sfc`, with one, some or all tables moved. Optionally applies an everscript IPS patch first (see below). |
| `prove.js` | `npm run table-hack:prove`: builds `base`, one image per table and `all`, replays the sample playbacks (attract loop, sample-playbacks skill) on the original and each image, and writes `out/table-hack/REPORT.md`. It takes about 15 s. |
| `run.js` | One headless snes9x run for `prove.js`. It writes a trace (WRAM every frame, screen every 60) and can save screenshots (`--shots`) or a WRAM dump (`--dump`). |
| `evs/string-3003.evs` | Everscript test: adds string #3003 (key `0x232E`) and shows it when Brian's room is entered. |

```sh
npm run table-hack -- --rom "/path/Secret of Evermore (U) [!].smc"                 # all tables
npm run table-hack -- --rom "/path/…smc" --tables map_table,string_keys --out out/x.sfc
npm run table-hack:prove -- --rom "/path/…smc"   # inputs: .agents/skills/sample-playbacks/playbacks
scripts/build-table-hack.sh "/path/…smc" --prove
```

Table names: `map_table`, `room_enter_scripts`, `string_keys`, `script_pointers`.

**The base image.** Every image is 4 MB. File `0x300000+` holds what the bundled core shows past a
3 MB ROM (offset % size), so an image with nothing moved behaves exactly like the original in that
core. That includes `$80:D113`'s read past the ROM (`knowledge/rom/80d113.md`).

## The everscript test

1. Compile the test with the everscript compiler from the sibling repo, without `--rom`:

   ```sh
   cd ../everscript && python everscript.py -o /tmp/evs ../everscript-vscode/tools/table-hack/evs/string-3003.evs
   ```

   The prebuilt `dist/everscript_mac` is too old for `#include("in/core")`. Use the Python source
   with `requirements.txt` installed.
2. Apply the patch while building the hack:

   ```sh
   npm run table-hack -- --rom "/path/…smc" --ips /tmp/evs/everscript.ips
   ```

The compiler writes into the vanilla tables:

- string key `0x232E` at file `0x11F32E`, which is just past the old key table and on top of a live
  lookup table;
- room `$15`'s enter-script entry;
- script pointer slot 0.

`build.js` writes each of these records into the moved copy instead. A string key past vanilla's
3002 grows the moved table.

Nothing generated here may be committed: the images are game data.
