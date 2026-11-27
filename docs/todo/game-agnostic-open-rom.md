# Game-agnostic explode / implode: every game fact in config and mapping files

Status: **open (2026-11-27)**. Nothing moved yet. Labels: *(repo)* = exists today; *(proposal)* = this page;
*(owner's call)*; *(to verify)*. Related: [Open Evermore](../open-evermore/README.md), [tool.md](../open-evermore/tool.md),
[mapping.md](../open-evermore/mapping.md), [manifest.md](../open-evermore/manifest.md), [openify-agent.md](openify-agent.md)
(this page is its step **O0**, worked out).

**Goal (owner, 2026-11-27).** `explode`, `implode` and `prove` know no game. Everything that is about Evermore
(addresses, sizes, file names, defaults, cartridge layouts, proof tolerances) lives in a **game config file** and the
**mapping files** of its releases. A second game then needs a config, mapping files and its codecs, and no edit to the
generic tool.

**What stays code.** A codec is a format: how a kind's bytes are shaped, read and written back. That is game
knowledge too, but it is code, and it stays in the game's folder (`tools/open-evermore/evermore/codecs/`). The rule
is the one [mapping.md](../open-evermore/mapping.md) already set for addresses: *where* in the config/mapping file,
*how* in the codec. Step A6 asks how far simple kinds can go as data instead of code.

---

## 1. Where Evermore still leaks into the generic files *(repo, 2026-11-27)*

The README's rule "only `evermore/` names the game" holds for names, not for facts. Found by grep:

| File | Evermore fact or default | Goes to |
|---|---|---|
| `open-evermore.mts` | imports `./evermore/map.mts`, `./evermore/kinds.mts`, `./evermore/map-locate.mts` directly; defaults `out/open-evermore`, `out/open-evermore-map`; writes `_build/evermore.sfc` | a game registry (A1); config `tree.out`, `build.rom` |
| `report.mts` | the built ROM's name `evermore.sfc` | config `build.rom` |
| `manifest.mts` | `FORMAT = 'open-evermore'`; `Layout` is HiROM-only; header checks expect HiROM | format id generic (*owner's call*, A0); config `cartridge.mapping` |
| `implode.mts` | growth plan 3 → 4 MiB → ExHiROM 8 MiB; `--random` starts at 4 MiB; the header checked is HiROM | config `cartridge.layouts`, `cartridge.grow`, `random.start` |
| `layouts.mts` | SA-1's boot block hole `$B8:8000-$B8:FFFF`; ExHiROM second half `$41-$7D`; "3 MiB declares 4 MiB" | config `cartridge.layouts.<name>.holes`; mapping (the boot block is a game fact) |
| `prove.mts` | default playbacks = Evermore's `sample-playbacks` folder; title "Open Evermore proof"; the original built as plain HiROM | config `prove.playbacks`, `prove.original` |
| `play.mts` | pointer tolerances learnt on Evermore (one past a blob's end, a 16-bit residue, a lone bank byte, dead stack below `STACK = $100`), `MAX_DRIFT` 60 frames; bus → file for HiROM/ExHiROM only | config `prove.tolerances`, `prove.maxDrift`; the bus maps go to `src/platform/` (hardware) |
| `evermore/kinds.mts` → CLI | `PAST_END` (from the mapping file) and `POINTER_WINDOWS` (`SCRIPT_WINDOW`, a constant in `codecs/scripts.mts`) are passed by hand | both in the mapping file; the engine reads them through the game interface (A2) |
| `wram-census.mts`, `wram-poc.mts`, `memory-probe.mts` | top-level files, but they read Evermore's CDL library, knowledge entries and `evermore/map/us.wram-readers.json` | `evermore/` (A1), or generic with the paths in config |
| codecs (42 files) | ~209 four-plus-digit hex literals; bus constants in ~24 files (`0xCA0000` fallback metasprite, `0x7E0000` hook base); HiROM bus↔file written out again (`animations.mts:62`, `items.mts:45`) | locations → mapping file; bus↔file → one platform helper; instruction shapes stay (A4) |

`codec.mts` (`Rule`, `Window`, `Item`), `enum.mts`, `explode.mts`, `folders.mts`, `links.mts`, `placement.mts`, `tree.mts`,
`findings.mts`, `base.mts`, `layout.mts` are generic already, apart from comments that cite Evermore as the example.

## 2. The target *(proposal)*

```
tools/open-evermore/                 the generic engine: explode, implode, prove, layouts, allocator, enum, links
  games.mts                          the registry: game id → its folder (the only place that lists games)
  evermore/
    game.json                        the game config (below)
    map/<release>.json               the mapping files (exists): addresses, placement, pastEnd, memory, + pointerWindows
    kinds.mts                        the codec list (exists)
    codecs/                          the formats (exists)
    tools/                           wram-census, wram-poc, memory-probe, map-locate (moved here)
```

**`game.json`**, one per game *(proposal; names open)*:

```jsonc
{
  "game": "evermore",                       // = src/games/<game>/ and its descriptor
  "name": "Secret of Evermore",
  "format": "open-evermore",                // manifest.json `format` (A0)
  "releases": { "default": "us", "identify": "descriptor" },   // the variant id picks map/<release>.json
  "tree": { "out": "out/open-evermore", "mapOut": "out/open-evermore-map" },
  "build": { "rom": "evermore.sfc" },
  "cartridge": {
    "mapping": "hirom",                     // the header's map mode the base ROM must have
    "layouts": ["hirom", "exhirom", "sa1"], // what implode may build, in growth order
    "grow": ["3MiB", "4MiB", "exhirom"],
    "randomStart": "4MiB",
    "holes": { "sa1": [["$B8:8000", "$B8:FFFF"]] }
  },
  "prove": {
    "playbacks": ".agents/skills/sample-playbacks/playbacks",
    "core": "snes9x",                       // which core plays the lockstep (reference-emulators skill)
    "original": { "layout": "hirom", "strict": true },
    "maxDrift": 60,
    "tolerances": ["pointer-past-end", "pointer-low16-residue", "lone-bank-byte", "dead-stack"],
    "stack": "$0100"
  }
}
```

- **Config vs mapping.** The config holds what is true for the game as a whole (cartridge, tree, proof). A mapping
  file holds what differs per release (addresses, placement, memory). A value that differs between releases goes
  to the mapping file, even if only one release exists today.
- **Every value has its evidence**: `sources` as in the mapping files, or a link to the doc that measured it
  (`MAX_DRIFT`: [README.md](../open-evermore/README.md) §5.1; the tolerances: `play.mts`'s header).
- **The engine reads the config through one typed module** (`game-config.mts`, schema-checked like `manifest.json`);
  no generic file opens a game's folder by path.
- **Hardware stays hardware.** HiROM/LoROM/ExHiROM bus maps, the header layout, the checksum, the WRAM mirror move
  to (or are shared with) `src/platform/`; the config only names which ones the game uses (AGENTS.md §0.4).

## 3. Steps

| Step | What | Done when |
|---|---|---|
| **A0** | Name the generic tool and format (*owner's call*: keep `open-evermore` for the engine, or `open-rom`; `format` per game or one) | decision written here |
| **A1** | Registry: `games.mts`, the CLI picks the game (`--game`, else `manifest.json` `base.game`, else the ROM's descriptor); Evermore-only tools move to `evermore/tools/` | no import of `evermore/` outside `games.mts`; a check in `check:deps` (or `check:open-rom`) holds it |
| **A2** | `game.json` + `game-config.mts`; tree, build name, playbacks, cartridge read from it; `PAST_END` and `POINTER_WINDOWS` via the game interface, the windows into the mapping file | US explode → `implode --strict` = vanilla sha1; two `--random` round trips; one `prove` smoke seed |
| **A3** | Layouts and growth from the config; HiROM bus↔file and header checks in one platform module; LoROM as a mapping the engine accepts (needed by a LoROM game, *to verify* which of ours are) | `implode.test.mts`, `enum-layout.test.mts` green; a unit test builds a synthetic LoROM tree |
| **A4** | Codec literals: every hex literal that is a **location** goes to the mapping file by name (`map.file(…)`); bus↔file through the platform helper; literals that are **shapes** (opcodes, strides, masks) stay, with a comment | `map.test.mts` still exact (no unasked address, none missing); a grep check: no 6-digit bus constant in `evermore/codecs/` outside an allow list that only shrinks |
| **A5** | Prove's tolerances and drift window from the config; each tolerance a named rule the report cites | `prove` on 2 seeds in step as before; the report names which tolerance passed each frame |
| **A6** | *(owner's call)* Declarative kinds: `records.mts` already reads fields by (table, stride, offset); let a mapping/config entry declare such a kind without a codec file | one in-place records kind (equipment) from data alone, G0 + round trip |
| **A7** | Docs and AI files: README, tool.md, mapping.md, manifest.md, the `open-evermore` and `open-evermore-modding` skills say where a game fact goes | `check:ai-context` green |

Order: A1 → A2 → A3 → A4 → A5; A0 before A1 if the folder is renamed. Each step is one commit and keeps Evermore at
G0/G1: a move changes no byte, so **test what it can break** (G0 sha1, two round trips, one smoke `prove`), not every
seed (owner: an hour of tests for a small change is too long; `open-evermore` skill).

## 4. Traps

- **One release per process** (`selectRelease` before `kinds.mts` loads): the registry must keep that order, now per game.
- **Moving files breaks imports in tests** (`tests/open-evermore/*.mts` import the generic files by path): move with
  `git mv` and fix the imports in the same commit.
- **Another session edits these files** (shared working tree): commit each step with explicit paths.
- **A config is not a place for formats.** If a value only makes sense together with the code that reads it (an
  instruction shape, a field's encoding), it stays in the codec; moving it to JSON just splits one fact in two.
- **No fact crosses games.** The config of a second game is derived from that game, never copied from `evermore/game.json`.

## 5. Open questions *(owner's call)*

1. A0: rename the folder and format (`tools/open-rom/`, `open-rom`) now, or after a second game exists?
2. Does a game's config live beside its codecs (`tools/open-evermore/evermore/game.json`) or with its descriptor
   (`src/games/evermore/`)?
3. A6: how far toward data-only codecs, if at all?
