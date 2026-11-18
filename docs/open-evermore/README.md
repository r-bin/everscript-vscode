# Open Evermore: the ROM as a folder of named parts

Status: **design (2026-11-18), nothing built.** Progress is tracked in [progress.md](progress.md).
Labels: *(repo)* = exists today; *(proposal)* = this design, open to change; *(owner's call)* = a decision for
the owner; *(to verify)*.

Open Evermore is the project that turns the [split-and-link](../split-and-link/README.md) plan into a tool. It
keeps that plan's reasoning (gates, codecs, placement rules, fast ROM by heat) and takes these decisions:

| Decision | Split-and-link said | Open Evermore |
|---|---|---|
| Tool and verbs | `tools/split/`, `split` / `link` | `tools/open-evermore/`, **explode** (ROM → folder) / **implode** (folder → ROM) |
| Item keys | `<id>-<slug>` folders, id = order | **names only.** A kind's folder is a map with no order; other parts reference by name; ids live in one lock file per kind (§4) |
| Tree | `game/` (generated) + `mods/` (overlay) | **one tree, edited in place** (§3); sharing goes through a BPS patch first, an overlay later (§9 Q3) |
| Memory map | `split.json`, a per-item manifest | `manifest.json` is the **memory map**: layout, size, fast ROM, regions, placement policy ([manifest.md](manifest.md)) |
| Checks | G0/G1/G2 gates | the same gates, plus **validation on every implode**: errors stop the build, warnings (yellow) do not ([validation.md](validation.md)) |
| Reference | `soe://` shape | the tree and `soe://rom/` should become **identical** in the long run (§6) |
| Migration | phases P0–P8 | **start with everything raw, peel one resource kind off at a time**, implode after every step (§7) |

| Page | What it answers |
|---|---|
| this page | the idea, the tree, names and ids, the gates, the method |
| [manifest.md](manifest.md) | `manifest.json` (memory map, fast ROM, regions, placement) and `header.json` |
| [resources.md](resources.md) | every resource kind: folder, files, references, what implode generates, budgets |
| [validation.md](validation.md) | what implode checks, error vs warning, the report |
| [tool.md](tool.md) | `tools/open-evermore/`: files, commands, codecs, tests, what it reuses |
| [progress.md](progress.md) | the step list and the state of each kind |

---

## 1. The idea

```sh
npm run explode -- --out out/open-evermore        # the ROM library's base ROM → a folder
npm run implode -- out/open-evermore              # the folder → out/open-evermore/_build/evermore.sfc + report
```

- **Explode** reads the user's own ROM and writes a folder: one file or folder per resource, named, with every
  reference between resources written as a name.
- **Implode** reads the folder, validates it, encodes every resource, generates the tables that list them, lays
  them out by the memory map and writes the ROM. Then it validates the result.

The promise:

1. **Explode then implode, unchanged, gives the original ROM byte for byte** (G0).
2. **Adding a file adds content.** No address and no id is typed by hand.
3. **A broken folder never becomes a ROM.** A missing file or an invalid value is an error; a value that makes no
   sense is a warning.

## 2. Why names

A game reaches its content through numbers: room `$06`, song `$05`, tile `$0A3F`. In the folder those numbers
are noise. They change meaning when something is inserted, and they cannot be read. So:

- A resource is known by its **name**: `maps/pyramid_outside/`, `music/village_on_the_plateau/`,
  `tiles/floor_sand_01/`.
- Every reference is a name: a map says `"music": "village_on_the_plateau"`, its tile grid says
  `"floor_sand_01"`, a vector in `header.json` says `"reset": "reset_handler"`.
- **The id is an implode-time detail.** Implode gives each name its id from the kind's lock file (§4) and writes
  the id wherever the game needs a number.

## 3. The tree

```
out/open-evermore/                 GENERATED from the user's ROM; never committed (§8)
  manifest.json                    the memory map (manifest.md)
  header.json                      the cartridge header, by reference to the manifest (manifest.md §3)
  code/<routine>.asm               map: routine name → its assembly (resources.md §code)
  maps/<map>/map.json …            map: room name → the room, tiles and palettes by name
  tiles/<tile>.png + _ids.json     map: tile name → 16×16 graphics
  palettes/<palette>.json          map: palette family name → 16 colours
  music/<track>/                   map: track name → song package
  sounds/<sound>/                  map: sound name → sound effect
  strings/<string>.txt             map: string name → text
  scripts/<script>.evs | .bin      map: script name → bytecode
  characters/<character>/          map: character name → record, sprite, palette, animations
  animations/<animation>/          map: animation name → animation script
  sprites/<block>/                 map: sprite block → graphics
  tables/<table>.json              engine tables not yet owned by a kind
  raw/<region>.bin + _raw.json     everything not yet exploded into a kind (§7)
  _build/                          GENERATED by implode: evermore.sfc, .sym, .bps, report.md, report.json, cache/
```

- **A kind's folder is a map.** Files and folders inside it have no order. Only `_`-prefixed files (`_ids.json`,
  `_raw.json`) belong to the tool and are never resources.
- **Every kind has its own page section** in [resources.md](resources.md): its file format, what it references,
  what implode generates from it and its budgets.
- **`raw/` shrinks to zero.** At first every byte is in `raw/`. Each migration step moves one kind out (§7).

## 4. Names and ids

**Name rules** *(proposal)*:

- `snake_case`: `[a-z][a-z0-9_]*`, at most 48 characters, unique within its kind.
- Snake case because every name also becomes an assembler symbol (`map_pyramid_outside`, `!music_<name>`), and
  Asar symbols cannot contain `-`.
- The same name may exist in two kinds (`maps/desert/`, `music/desert/`); a reference always says its kind.

**Where explode takes names from**, in order:

1. our own names already in the repo: routine names (`soe://rom/code/`), room names, the music and sound names of
   `src/games/evermore/localizations/sounds.ts`, item names, knowledge entries
2. otherwise the kind and the vanilla id: `tile_0a3f`, `string_0bb2`, `script_0412`

Explode never invents a name from outside the repo, and it adds no names from third-party tools (AGENTS.md
D3/D4). Better names come by renaming (`npm run oe:rename -- tiles/tile_0a3f floor_sand_01`), which rewrites
every reference in the tree (proposal, [tool.md](tool.md) §2).

**The id lock.** Each kind that the game addresses by number has `<kind>/_ids.json`:

```jsonc
{
  "kind": "music",
  "limit": 128,                     // why: opcode 0x33 takes a byte offset into $8C:8442 (extending.md §5)
  "ids": {
    "main_title": 0, "battle_with_thraxx": 1, "in_the_arena": 2   // … every vanilla name, at its vanilla id
  }
}
```

- Explode writes it. It pins every vanilla resource to its vanilla id, so G0 holds.
- A name in the folder that is not in the lock gets the lowest free id. Implode reports the assignment as a
  warning (`unlocked-id`) and `--lock` writes it into the lock. Ids therefore never change behind the user's
  back.
- A locked name with no resource is an error (`locked-name-missing`). To remove a resource, remove it from the
  lock too; its id becomes a gap, filled as the kind's rule says.
- Code and data that still use the number get it as a symbol: implode writes `_build/ids.asm` with
  `!music_village_on_the_plateau = $05`, and the code export uses those symbols where it can.

## 5. The gates

From [../split-and-link/README.md](../split-and-link/README.md) §1, unchanged:

| Gate | Means | Proven by |
|---|---|---|
| **G0 identical** | a freshly exploded folder implodes to the vanilla ROM byte for byte | sha1, on every implode of an unchanged tree |
| **G1 shifted** | parts moved, nothing added: the game plays the same | stored playbacks, same WRAM every frame (`sample-playbacks` skill) |
| **G2 extended** | content added: vanilla playbacks still identical, new content has its own playback | as G1, plus a playback per addition |

Implode adds two checks of its own, on every run ([validation.md](validation.md)):

- **validation** of the folder before building and of the ROM after it
- **round trip**: the built ROM is exploded again and must give the same folder (minus `_build/`)

## 6. The VFS is the reference

`soe://rom/` already decodes most of what explode needs *(repo: 14 asset kinds,
`src/games/evermore/resources/`)*. Explode must not decode anything a second time: it calls the same decoders
(AGENTS.md §0.9). In the long run, the folder and the VFS look the same:

| Today *(repo)* | Target |
|---|---|
| `soe://rom/assets/maps/06/` (by hex id) | `soe://rom/assets/maps/pyramid_outside/`, the id path kept as an alias |
| `soe://rom/assets/audio/music/05/` | `soe://rom/assets/music/village_on_the_plateau/` |
| `soe://rom/assets/ingredients/wax/` | already by name |
| `soe://rom/code/<routine>/` | already by name; `code/<routine>.asm` in the folder is that routine's `.asm` |
| `soe://rom/header.json` | the same file as the folder's `header.json` |

**Rule:** when a kind is exploded, its VFS path is moved to the same name and the same files in the same commit,
or [progress.md](progress.md) records the difference. One decoder, two views. `soe://` stays read-only; the
folder is where you write.

## 7. The method: peel off one kind at a time

1. **S0 skeleton.** Explode writes `manifest.json`, `header.json` and the whole rest of the ROM as `raw/`
   regions (the region list of `src/games/evermore/cdl/regions` *(repo)*). Implode writes the regions back. G0.
2. **One kind per step.** Each step moves one kind out of `raw/` into its folder: explode writes it by name,
   implode encodes it and generates its tables. **Every step ends with an implode that passes G0 and the round
   trip.** No step is done until it does.
3. **Order** ([progress.md](progress.md) has the list): header → tables → palettes → strings → music and sounds
   → tiles → maps → scripts → characters, sprites, animations → code.
4. **Moving comes later.** Until code is symbolic ([../split-and-link/symbolic-export.md](../split-and-link/symbolic-export.md)),
   every resource stays at its vanilla address. A resource that grows is an error that names the raw reader
   still pinning it. Growing, moving and adding (G1, G2) open per kind as its readers become symbols.

## 8. Legal

- The folder is ROM-derived. Explode writes it under `out/` *(repo: git-ignored)* or outside the repository,
  never anywhere tracked. `check:legal` already blocks ROM-derived files.
- Committed here: the tool, the codecs, the rules and limits, names, docs, and tests that use synthetic data or
  the user's ROM at test time.
- What a modder may share: `_build/evermore.bps`, and files they made themselves. Never the folder or the ROM.

## 9. Open questions

1. **Music names.** The track names of `sounds.ts` *(repo)* are our existing labels; they already read like a
   soundtrack's titles. Explode uses them as they are, in snake case. Taking names from an orchestral release
   instead would add third-party names (D4), so it needs the owner's word. *(owner's call)*
2. **Command names.** `npm run explode` / `implode` / `oe:rename`, or one `npm run oe -- explode …`?
   *(owner's call)*
3. **Sharing.** Is a BPS patch enough, or does the tree need the `mods/` overlay of
   [../split-and-link/tool.md](../split-and-link/tool.md) §4? Proposal: BPS first; add the overlay when someone
   wants to merge two mods.
4. **Exploding again** after the CDL library grows (more routines, fewer raw bytes): explode into a fresh folder
   and let the tool carry over the user's renames (a rename log in the manifest) *(proposal)*.
5. **Other releases.** US 1.0 only; other builds have other addresses ([../evermore-releases.md](../evermore-releases.md)).
