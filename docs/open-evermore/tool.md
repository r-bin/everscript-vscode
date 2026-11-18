# Open Evermore: the tool

Status: **design (2026-11-18), nothing built.** Back to [README.md](README.md). Labels as there.

`tools/open-evermore/` is an L3 lab ([../projects/README.md](../projects/README.md) §1), shaped like `tools/sa1/`:
TypeScript `.mts` run by Node after `npm run -s build:ts`. It *calls* the compiled modules in `dist/` and copies
none of them. Where this page says nothing, [../split-and-link/tool.md](../split-and-link/tool.md) still holds
(the allocator §5.4, the compiler §7, promotion §10.4).

---

## 1. Commands

```sh
npm run explode -- [rom] --out <dir>       # rom: the ROM library's base ROM when omitted (tools/roms.js)
npm run implode -- <dir>                   # → <dir>/_build/: evermore.sfc, .sym, .bps, report.md, report.json
npm run implode -- <dir> --check-only      # validation stages 1–5, no build (validation.md §2)
npm run implode -- <dir> --strict          # warnings fail too
npm run implode -- <dir> --lock            # write ids given to new names into the _ids.json files
npm run oe:rename -- <kind>/<old> <new>    # rename a resource and every reference to it; logs it in the manifest
npm run oe:prove -- <dir>                  # implode, then the stored playbacks (G1/G2); on demand only
```

Inputs are found as other tools find them *(repo)*: the ROM through `tools/roms.js`, the CDL library with
`--lib` (default: the extension's global storage), Asar with `--asar`, `$ASAR`, `PATH`, then `../asar/`.
Built *(S0)*: `explode` (with `--out`, `--force`) and `implode` (with `--check-only`, `--strict`); the others come
with the steps that need them. The names may still change ([README.md](README.md) §9 Q2).

## 2. Files

Built *(S0)*: `README.md` (with the invariants; no `AGENTS.md`, as no other tool has one), `explode.mts`,
`implode.mts`, `manifest.mts`, `codec.mts`, `raw.mts` (the raw kind is game-neutral, so it sits at the top),
`tree.mts`, `findings.mts` (planned as `validate.mts`), `report.mts`, `evermore/kinds.mts`. The rest is the plan:

```
tools/open-evermore/
  README.md            how to run it; links here; the invariants: G0 on a fresh tree, no warnings on vanilla, no ROM bytes in the repo, one decoder
  explode.mts          CLI: ROM → tree; writes manifest, header, kinds done so far, raw/ for the rest
  implode.mts          CLI: tree → _build/ (§3)
  rename.mts           CLI: rename + rewrite references (every kind declares where its references are)
  prove.mts            CLI: wraps the playback replay of tools/table-hack/prove.js
  manifest.mts         manifest.json + header.json: types, schema, derived header fields
  tree.mts             read/write the folder; names; _ids.json locks; the rename log
  validate.mts         the stages and general rules of validation.md; collects findings
  layout.mts           regions, placement rules, the allocator (stable first, pins, first fit)
  write.mts            bytes into the image at addresses (before code is a kind); checksum; BPS
  assemble.mts         main.asm, ids.asm, Asar, out.sym (once code is a kind)
  report.mts           terminal, report.json, report.md
  evermore/
    kinds.mts          the kind list, in migration order
    rules.mts          limits and placement rules per kind, each with its source
    known-vanilla.mts  the vanilla exceptions for logic warnings (validation.md §1)
    codecs/            one file per kind: raw, header, tables, palettes, strings, music, sounds, tiles, maps, …
```

Only `evermore/` holds game facts. A second game gets a sibling folder; the other files never name Evermore
(AGENTS.md §0.4).

## 3. Implode, step by step

1. **Read and validate** the tree (stages 1–5 of [validation.md](validation.md)).
2. **Encode** each resource with its codec; cache by the hash of its files + codec version (`_build/cache/`).
   An unchanged resource whose encoder cannot yet reproduce vanilla bytes uses its cached original bytes
   (strings, tiles; [resources.md](resources.md)).
3. **Generate tables** per kind from the names present and the locks: one entry per id, counts written.
4. **Lay out.** Stable first: everything stays at its vanilla address while it fits. Pinned resources never move.
   New and grown resources go first fit into `free` regions under their placement rule.
5. **Write.** Before `code/` exists, implode writes bytes into the image itself: `raw/` regions, encoded
   resources, tables, header, checksum. No Asar needed. Once code is a kind, the same layout becomes
   `main.asm` (an `org` + `incbin` per data resource, an `incsrc` per routine) and Asar writes the image and
   `out.sym`.
6. **Check after** (stage 7): G0 when unchanged, round trip, checksum. Write the report and the BPS patch
   against the base ROM.

## 4. Codecs

```ts
interface Codec {
  kind: string;
  version: number;
  /** ROM → files of every resource of this kind (names from the repo's own name sources). */
  explode(rom: Uint8Array, ctx: ExplodeContext): Map<string, Files>;
  /** Files of one resource → bytes, the names it references, its findings. */
  encode(name: string, files: Files, ctx: ImplodeContext): Encoded;
  /** Tables this kind writes from all its resources and their ids. */
  tables(ids: Map<string, number>, placed: Map<string, number>): TableWrite[];
}
```

**Laws** (from split-and-link, unchanged): explode then encode gives the vanilla bytes for every vanilla
resource (round-trip test, `rom` tier); anything without a codec stays `raw`.

**Reused, not copied** *(repo)*:

| Kind | Decoder | Encoder |
|---|---|---|
| header | `soe://rom/header.json` provider (`resources/rom-files.ts`) | `tools/sa1/header.mts` (checksum and fields) |
| raw, regions | `src/games/evermore/cdl/regions.ts` | — |
| tables | `src/platform/cdl/table-assets.ts`, `resources/table-files.ts` | inverse of the table description |
| maps | `src/games/evermore/maps` (`modelFromRom`) | `buildBlob`, `encode.ts` |
| strings, scripts | `script-model/`, `script-vm/`, `rooms/data/room-scripts.ts`, string decoder | to write ([resources.md](resources.md)) |
| music, sounds | `resources/` audio descriptors | raw |
| tiles, palettes, sprites, characters, animations | `resources/`, `maps/`, `sprites/` decoders | table-hack moves; the rest to write |
| code | `src/platform/cdl/asar-export.ts` | Asar |

## 5. Editors (after promotion)

Until promotion, the editor sees an imploded ROM the usual way: `soe://rom/…?rom=<dir>/_build/evermore.sfc`
*(repo)*. After promotion:

- **Commands:** *Explode ROM to folder…*, *Implode folder*, *Rename resource*.
- **Diagnostics:** `report.json` in the Problems panel ([validation.md](validation.md) §4).
- **Editors write into the tree:** the Rooms map editor saves `maps/<map>/map.json`, the Scripts tab saves
  `scripts/`, the palette and tile views save `palettes/` and `tiles/`.
- **Links:** a name in any file links to its resource and its `soe://` page (`vfs-and-knowledge` skill).

## 6. Tests

| Test | Tier | What |
|---|---|---|
| `tests/open-evermore/s0.test.mts` *(built)*; later per step | unit (`npm test`) | synthetic trees: names, locks, every rule of validation.md §3 with one failing case each |
| `tests/open-evermore/codecs.test.mts` | `rom` | every codec over every vanilla resource of its kind: explode → encode = vanilla bytes |
| `tests/open-evermore/g0.test.mts` *(built)* | `rom` | explode + implode of the base ROM: vanilla sha1, no errors, **no warnings** |
| `npm run oe:prove` | on demand | playbacks; never in a test tier (`test-discipline` skill) |
