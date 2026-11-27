# Open Evermore: the ROM as a folder of named parts

Status: **maps, tile families, tiles, strings, scripts, opcodes, animations, attack procs, behaviours, characters, sprite blocks, music and sounds, fonts, HUD, ring menus, equipment and alchemy exploded (2026-11-22)**; the rest of the ROM is still the pinned `_base/`. Progress:
[progress.md](progress.md). Labels: *(repo)* = exists today; *(proposal)* = this design, open to change;
*(owner's call)* = a decision for the owner; *(to verify)*.

Open Evermore is the project that turns the [split-and-link](../split-and-link/README.md) plan into a tool. It
keeps that plan's reasoning (gates, codecs, placement rules, fast ROM by heat) and takes these decisions:

| Decision | Split-and-link said | Open Evermore |
|---|---|---|
| Tool and verbs | `tools/split/`, `split` / `link` | **one tool**, `tools/open-evermore/open-evermore.mts`, with the action as its first argument: `explode`, `implode`, `prove` (no npm commands) |
| Item keys | `<id>-<slug>` folders, id = order | **names only.** A kind's folder is a map with no order; the one ordered file is `<kind>/_enum.json` (§4) |
| References | symbols where the export has them | **hard rule: every exploded resource is reached only through what implode generates** (§1) |
| Tree | `game/` (generated) + `mods/` (overlay) | **one tree, edited in place** (§3); sharing goes through a BPS patch first, an overlay later (§9 Q3) |
| Memory map | `split.json`, a per-item manifest | `manifest.json` is the **memory map**: layout, size, fast ROM, regions, placement policy ([manifest.md](manifest.md)) |
| Checks | G0/G1/G2 gates | the same gates, plus **validation on every implode** (errors stop the build, warnings do not, [validation.md](validation.md)) and **random layouts** that prove the references (§5) |
| Reference | `soe://` shape | the tree and `soe://rom/` should become **identical** in the long run (§6) |
| Migration | phases P0–P8 | **one kind at a time**, each placeable anywhere from the start; the rest stays pinned in `_base/` (§7) |

| Page | What it answers |
|---|---|
| this page | the idea, the hard rule, the tree, names and ids, the gates, the method |
| [manifest.md](manifest.md) | `manifest.json` (memory map, fast ROM, regions, placement) and `header.json` |
| [mapping.md](mapping.md) | the game mapping file `evermore/map/<release>.json`: every ROM address the codecs use and where each kind may go, per release; `locate` drafts a language release's file |
| [resources.md](resources.md) | every resource kind: folder, files, references, what implode generates, budgets |
| [validation.md](validation.md) | what implode checks, error vs warning, the report |
| [tool.md](tool.md) | `tools/open-evermore/`: actions, the steps of implode, codecs, the proof, tests |
| [optimizing.md](optimizing.md) | what explode and implode cost (measured), and how to make them faster, easier to use and clearer to read |
| [progress.md](progress.md) | the step list and the state of each kind |
| [wram.md](wram.md) | WRAM by name: `temp[]` as a placeholder, the proof of concept, allocation |
| [memory.md](memory.md) | every memory by name (WRAM, VRAM, CGRAM, OAM, ARAM, SRAM): what each holds (measured), one map per memory instead of one file per entry, region files, the order of work |
| [extending.md](extending.md) | how easy five kinds of new content are today (a Dog form, Act 0 Dog poses, Laser, a formula, items) and what blocks each |
| [roadmap.md](roadmap.md) | the road to 10/10: the rules (one kind per folder, typed names, named entries, no derived data), what still breaks them, the order of work |

---

## 1. The idea, and the hard rule

```sh
npm run build:ts                                                        # the codecs call the decoders in dist/
node tools/open-evermore/open-evermore.mts explode                      # base ROM → out/open-evermore/
node tools/open-evermore/open-evermore.mts implode out/open-evermore    # → _build/evermore.sfc + report (--strict: vanilla)
node tools/open-evermore/open-evermore.mts implode out/open-evermore --random       # a shuffled layout
node tools/open-evermore/open-evermore.mts prove out/open-evermore --random 42     # play it against the original
```

- **Explode** reads the user's own ROM and writes a folder: one file or folder per resource, named, with every
  reference between exploded resources written as a name.
- **Implode** reads the folder, validates it, turns names into ids, encodes every resource, places it, writes the
  tables that point at it, and validates the result.

**Hard rule (owner, 2026-11-19).** Whatever explode writes must implode to a **working** ROM, however implode
chooses the order and the place of the blobs. So every exploded resource is reached **only** through what
implode generates: a table, a pointer, an id. Nothing may reach it by a fixed address. A kind is exploded only
when that holds for it; splitting the ROM into banks, say, would break it, because nothing points at a bank by
name and implode would have no rule to put banks back together.

The promise:

1. **Explode then `implode --strict`, unchanged, gives the original ROM byte for byte** (G0, the stable layout).
   Without `--strict` implode writes every relative call between scripts in its absolute form.
2. **Any layout plays the same**: `--random` puts every resource somewhere else, and `prove` shows the game
   cannot tell (G1).
3. **Adding a file adds content.** No address and no id is typed by hand.
4. **A broken folder never becomes a ROM.** A missing file or an invalid value is an error; a value that makes no
   sense is a warning.

## 2. Why names

A game reaches its content through numbers: room `$06`, song `$05`, tile `$0A3F`. In the folder those numbers
are noise. They change meaning when something is inserted, and they cannot be read. So:

- A resource is known by its **name**: `maps/antiqua_pyramid_outside/`, `music/village_on_the_plateau/`,
  `tiles/floor_sand_01/`.
- Every reference between exploded resources is a name: a map says `"music": "village_on_the_plateau"`, its tile
  grid says `"floor_sand_01"`, a vector in `header.json` says `"reset": "reset_handler"`. References into the
  `_base/` (kinds not exploded yet) stay numbers until their kind is exploded.
- **The id is an implode-time detail**, taken from the kind's enum (§4).

## 3. The tree

```
out/open-evermore/                 GENERATED from the user's ROM; never committed (§8)
  manifest.json                    the memory map (manifest.md)
  maps/rooms/<map>/                the rooms (map.json, scripts.json, animations.json, grass.json, grid, metatiles, objects)
  maps/tiles/                      16×16 map graphics
  maps/collisions/                 the 16 collision forms by name (metatiles name them)
  palettes/backgrounds/, palettes/sprites/   shared background (365) & sprite/icon (269) palettes
  sprites/{blocks_16,blocks_8,metasprites}/  sprite blocks (PNG) and owner-attributed metasprites (JSON)
  animations/{<owner>/,animate.json,modes/}  783 animations with inline scripts, the animate() table (212 ids), 6 modes
  scripts/rooms/<map>/, scripts/global/      the scripts rooms run first (named in their scripts.json), the rest
  scripts/opcodes/, scripts/entities/        the script VM's opcodes; entity operands
  strings/                         text
  characters/records/<name>.json   character records (`palette`, 12 `animations` by name);
  characters/{behaviours,attack_procs,projectiles}/
  music/packages/<package>/, music/sounds/   song packages with their data; script sound ids
  _base/unexploded.bin, _base.json the ROM with every exploded resource and generated table blanked; where each was
  _build/                          GENERATED by implode: evermore.sfc, report.md, report.json, prove-<seed>/
  header.json, code/               planned, one kind per step (resources.md)
```

- **Related kinds share a folder, each kind in a subfolder of its own** (owner, 2026-11-21): resources never sit
  beside another kind's folder (`characters/records/` next to `characters/behaviours/`; `Codec.folder`).

- **A kind's folder is a map.** Files and folders in it have no order. `_`-prefixed files belong to the tool.
- **`_base/` is not a resource.** It is the part of the ROM no kind owns yet, pinned where it is. Editing it is an
  error. It shrinks with every kind that is exploded.

## 4. Names and the enum

**Name rules:**

- `snake_case`: `[a-z][a-z0-9_]*`, at most 80 characters (room names from their full path reach 69), unique
  within their kind.
- Snake case because every name may also become an assembler symbol, and Asar symbols cannot contain `-`.
- The same name may exist in two kinds; a reference always says its kind.

**Where explode takes names from**, in order:

1. our own names already in the repo: room names (`localizations/data/rooms.json`, region + place + part),
   routine names (`soe://rom/code/`), the music and sound names of `localizations/sounds.ts`, item names,
   knowledge entries
2. otherwise the kind and the vanilla id: `map_7e`, `tile_0a3f`, `string_0bb2`

Explode adds no names from third-party tools (AGENTS.md D3/D4). Better names come by renaming (planned: a
`rename` action that rewrites every reference, [tool.md](tool.md) §1).

**The enum: the one ordered file.** Every kind the game addresses by number has `<kind>/_enum.json`:

```jsonc
{
  "kind": "maps",
  "limit": 127,
  "why": "the map table holds 127 entries and stays where it is for now (engine limit: 256, the enter-script multiply)",
  "names": ["omnitopia_omnitopia_alarm_room", "prehistoria_blimps_hut_outside", …]   // names[id]; null = a gap
}
```

- Explode writes the vanilla order, so G0 holds. Reordering it reorders the ids (and the table), not the files.
- A resource the enum does not list gets the lowest free id (a gap first) and a warning (`unlocked-id`) until
  the enum lists it. New names are numbered in name order, so the result never depends on folder order.
- A listed name without a resource is an error (`locked-name-missing`); to delete one, set its entry to `null`.
- Turning names into ids is a step of its own (`enum.mts`), tested apart from encoding and placement.

## 5. The gates

| Gate | Means | Proven by |
|---|---|---|
| **G0 identical** | a fresh tree implodes (`--strict`, stable layout) to the vanilla ROM byte for byte | sha1, on every strict implode of an unchanged tree |
| **G1 shifted** | parts moved, nothing added: the game plays the same | `prove`: the original and a `--random` layout in lockstep on the stored playbacks (§5.1) |
| **G2 extended** | content added: vanilla playbacks still identical, new content has its own playback | as G1, plus a playback per addition |

Implode adds on every run: **validation** before building and after, and the **round trip**: the built ROM is
exploded again, named by the tree's own enums, and must give the same resources.

### 5.1 Random layouts and the proof

- `implode --random [seed]` shuffles where every resource goes: among the neighbours that share its placement
  rule, and (since the image grows to 4 MiB, the 4th MB free) about half of them out of their span. The seed is
  printed; the same seed gives the same layout. A stable build grows to 4 MiB only when something no longer fits.
- `prove <dir> --random [seed]` builds the original (stable) and that layout from the same tree, runs both in two
  snes9x cores in one process on every stored playback recorded on the original, and compares **WRAM every
  frame; screen, VRAM and PC every 60**. A WRAM difference passes only when it is a pointer to the **same
  resource and offset** in both ROMs (long, in either bank form, or one past the end; 16-bit with its bank kept
  elsewhere; a lone bank byte), or dead stack below an equal stack pointer.
- **Drift.** Moving tiles changes how long a room load takes, so mid-load frames can end at different points. A
  frame out of step starts a drift; it must end with everything in step again within 60 frames, and the playback
  must end in step. The report lists every drift.
- Results (2026-11-19): rooms alone (seeds 42, 7, 123456, 99) never drift. With tiles (S3, 4 MiB): seeds 1, 2 and
  99 moved ≈6,780 of 6,814 resources and both playbacks (14,638 frames) stayed in step, with 13–19 drifts of at
  most 17 frames; seed 7 lost a lag frame at 2,846 and never got back (progress.md §2). 2026-11-21, all 14 kinds at
  once (`--strict`): seeds 1, 2, 3, 11, 42 in step, 5 and 7 not (cause open). Placement must not cost cycles vanilla
  did not spend: no piece may end on a bank's last byte where vanilla's did not (`Rule.noBankEnd`), and a command
  written in a faster form (an absolute script call) breaks lockstep, so `prove` builds `--strict`. The two playbacks
  visit about 10 rooms; a proof over every room needs a playback that enters them all.

## 6. The VFS is the reference

`soe://rom/` already decodes most of what explode needs *(repo: 14 asset kinds,
`src/games/evermore/resources/`)*. Explode must not decode anything a second time: it calls the same decoders
(AGENTS.md §0.9). In the long run, the folder and the VFS look the same:

| Today *(repo)* | Target |
|---|---|
| `soe://rom/assets/maps/06/` (by hex id) | `soe://rom/assets/maps/antiqua_pyramid_outside/`, the id path kept as an alias |
| `soe://rom/assets/audio/music/05/` | `soe://rom/assets/music/village_on_the_plateau/` |
| `soe://rom/assets/ingredients/wax/` | already by name |
| `soe://rom/code/<routine>/` | already by name; `code/<routine>.asm` in the folder is that routine's `.asm` |
| `soe://rom/header.json` | the same file as the folder's `header.json` |

**Rule:** when a kind is exploded, its VFS path follows to the same name and the same files, or
[progress.md](progress.md) records the difference. One decoder, two views. `soe://` stays read-only; the folder is
where you write.

## 7. The method: one kind at a time

1. **Pick a kind whose every reference implode can generate** (the hard rule, §1): its readers find it only
   through a table or pointer that implode can rewrite. Maps came first: one table, 127 rooms, already moved
   by the room export.
2. **Explode it by name**, with its enum; its bytes and table become blanks in `_base/`.
3. **Implode it**: stable (G0), then `--random` (round trip), then `prove` (G1). No step is done until all three
   pass.
4. **Order** ([progress.md](progress.md)): maps → tile families → tiles → strings → music and sounds → scripts →
   characters, sprites, animations → header → code. A kind whose readers still use fixed addresses waits until
   they are found and rewritten (the symbolic export, [../split-and-link/symbolic-export.md](../split-and-link/symbolic-export.md)).

## 8. Legal

- The folder is ROM-derived. Explode writes it under `out/` *(repo: git-ignored)* or outside the repository,
  never anywhere tracked. `check:legal` already blocks ROM-derived files.
- Committed here: the tool, the codecs, the rules and limits, names, docs, and tests that use synthetic data or
  the user's ROM at test time.
- What a modder may share: a BPS patch (planned), and files they made themselves. Never the folder or the ROM.

## 9. Open questions

1. **Music names.** The track names of `sounds.ts` *(repo)* are our existing labels; they already read like a
   soundtrack's titles. Explode will use them as they are, in snake case. Taking names from an orchestral
   release instead would add third-party names (D4), so it needs the owner's word. *(owner's call)*
2. **Names without a source.** Tile families (`family_<id>`) and tiles (`tile_<id>`) have numbers for now (owner,
   2026-11-19). Each family file lists the maps that use it, as a start for naming by hand or by tool.
3. **Room names.** Names are region + place + part, so some repeat a word (`antiqua_antiqua_desert_…`). Shorter
   names need a rule (drop the region when the place repeats it?). *(owner's call)*
4. **Sharing.** Is a BPS patch enough, or does the tree need the `mods/` overlay of
   [../split-and-link/tool.md](../split-and-link/tool.md) §4? Proposal: BPS first.
5. **Exploding again** after the repo learns more (more kinds): explode into a fresh folder and carry over the
   user's renames (a rename log in the manifest) *(proposal)*.
6. **Other releases.** US 1.0 only; other builds have other addresses ([../evermore-releases.md](../evermore-releases.md)).
