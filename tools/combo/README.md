# tools/combo — Evermore + Mana combo POC

One 8 MB SA-1 image with both games; Start switches between them. What it does, why, and its limits:
[docs/combo/poc.md](../../docs/combo/poc.md); the research behind it: [docs/combo/README.md](../../docs/combo/README.md).
It reuses `tools/sa1/` (layout, header checks, boot block, MesenCE runner) and changes nothing there.

```sh
npm run combo           # → out/combo/combo.sfc from the ROM library (Evermore base ROM + Mana)
npm run combo:demo      # MesenCE: four switches in gameplay, screenshots + report.md in out/combo/demo/
npm run combo:demo -- --ev-movie <file> --mana-movie <file> --ev-at 4200 --mana-at 10000 --then 130
npm run combo:stress    # MesenCE: Start at random points (seeded) in both playbacks; out/combo/stress/seed-N/report.md
npm run combo:stress -- --seed 4 --ev-frames 20000 --ev-min 1 --ev-max 120 --ma-min 1 --ma-max 120 [--trace] [--no-ref]
```

Needs Asar on the PATH (or `ASAR=`), MesenCE for the demo (`MESEN=`), and playbacks recorded on each base ROM
(the extension's TAS recordings folder).

| File | Job |
|---|---|
| `convert.mts` | builds the image: both games' blocks, header and vectors, the SA-1 boot block, the combo code, the hooks; decodes Evermore's and Mana's register constants into `tables.asm`; checks every patched byte first |
| `combo.asm` | the combo's own 65816 code (Asar, `$B8:9000+`): reset, pad filter, Mana's WRAM hook installer, the register shadow hooks, the switch (sound, memories, mappings, resume) |
| `demo.mts` | the MesenCE proof run |
| `stress.mts` | the stability run: every switch must start within 600 frames of the press, end within 900, bring back the frozen memories and interrupt set-up (MesenCE's own registers), and never reach the crash vector; `--trace` adds the sound ports, commands and DSP echo writes |

To move a hook or add one: put the original bytes in `convert()`'s `expect(...)` list, the patch next to the
others in step 6, and the hook in `combo.asm` next to its siblings; record the game fact in that game's docs.
Nothing of either game is stored: images, tables and screenshots go to `out/`.
