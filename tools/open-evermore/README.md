# tools/open-evermore — explode the ROM into named parts, implode it back

The design, the hard rule, the resource kinds and the checks are in
[docs/open-evermore/](../../docs/open-evermore/README.md); the state of each kind is in
[progress.md](../../docs/open-evermore/progress.md); the files and the steps of implode in
[tool.md](../../docs/open-evermore/tool.md). This page is how to run it.

| Help | For |
|---|---|
| skill [open-evermore-modding](../../.agents/skills/open-evermore-modding/SKILL.md) | **using** the tool: the edit loop, which flag when, reading a failure |
| persona [open-evermore-modder](../../.agents/agents/open-evermore-modder.md) | an agent that makes one game change through the tool, end to end, and reports how it checked it |
| skill [open-evermore](../../.agents/skills/open-evermore/SKILL.md) | **changing** the tool: codecs, kinds, placement, the proof, the traps |
| [game-agnostic-open-rom.md](../../docs/todo/game-agnostic-open-rom.md) | the plan to move every Evermore fact out of the generic files into a game config and the mapping files |

## How to use it

Evermore only, US 1.0 only today (other releases: `locate` drafts their mapping file). Run from the repo root.

**1. Once.** Build the decoders and explode your ROM:

```sh
npm run build:ts                                  # the codecs call the decoders in dist/ (again after src/ changed)
T=tools/open-evermore/open-evermore.mts
node $T explode                                   # the ROM library's base ROM → out/open-evermore/
node $T implode out/open-evermore --strict        # an unchanged tree must give the vanilla sha1 (G0)
```

If the strict implode does not print the vanilla sha1, stop: `dist/` or the tool is out of date with the tree.

**2. Edit by name.** Every resource is a file named for what it is (`maps/rooms/<room>/`, `strings/`, `scripts/`,
`music/`, `characters/records/<name>.json`, …; the tree: [README §3](../../docs/open-evermore/README.md#3-the-tree),
each kind's files: [resources.md](../../docs/open-evermore/resources.md)). References are names, typed as
`<folder>/<name>` in JSON (`strings/menu/rare_item`, `wram/DOG_BISCUIT`) and `@name` in scripts, never an address
or id.

- **Add** a resource with a new file in its kind's folder; list its name in `<kind>/_enum.json` to fix its id.
- **Delete** one by setting its `_enum.json` entry to `null`.
- **Never edit** `_base/`, `_build/`, or `_`-files other than `_enum.json`.

**3. Build.** Validate while you edit, then build:

```sh
node $T implode out/open-evermore --check-only    # validate and place, no ROM (~4 s)
node $T implode out/open-evermore                 # → out/open-evermore/_build/evermore.sfc, report.md, report.json
```

Errors stop the build (exit 1), warnings do not, `--strict` turns warnings into errors. Each finding is explained in
[validation.md](../../docs/open-evermore/validation.md) §3.

**4. Check.** Play `_build/evermore.sfc` in the extension's emulator or MesenCE and look at the change. To show
that nothing reaches a resource by a fixed address, build random layouts and prove one plays like the original:

```sh
node $T implode out/open-evermore --random        # every resource somewhere else; the seed is printed
node $T prove out/open-evermore --random 42       # original vs that layout on the stored playbacks, in lockstep
```

`prove` compares two layouts of an **unchanged** tree; an edited resource needs a playback of its own (`--movies`).

**5. Share.** Never the tree or the ROM (both ROM-derived; only under `out/` or outside the repo). A BPS patch is
planned ([tool.md](../../docs/open-evermore/tool.md) §1).

## All commands

```sh
node $T explode                                   # base ROM of the ROM library → out/open-evermore/
node $T explode rom.smc --out <dir> --force       # a given ROM and folder (inside the repo: only under out/); --force replaces a tree, edits lost
node $T explode --kinds music,sounds --out <dir>   # only those kinds (the rest stays in _base/): prove them apart
node $T explode --palettes png --tiles json --previews   # file formats; --previews draws each room (preview.png)
node $T implode out/open-evermore --strict        # stable: the original, byte for byte → _build/evermore.sfc
node $T implode out/open-evermore                 # relative calls between scripts written absolute
node $T implode out/open-evermore --random        # every resource somewhere else; the seed is printed
node $T implode <dir> --random 42 --check-only    # … reproduce a seed; validate and place without building
node $T implode <dir> --random 42 --strict         # … keeping every encoding as written (vanilla's script groups)
node $T prove out/open-evermore --random 42       # original vs that layout (built --strict) on the stored playbacks, in lockstep
node $T prove out/open-evermore --stable          # ROM at home; WRAM the tree moved compared through the move
node $T locate <rom> [--out <dir>]                # draft another release's mapping file (check it before use)
```

A fresh US tree takes ~7.5 s to explode and ~14 s to implode (~4 s with `--check-only`); what costs what and the
plan to cut it: [optimizing.md](../../docs/open-evermore/optimizing.md). A misspelt flag is ignored silently.

## Invariants

- **The hard rule**: whatever explode writes implodes to a working ROM in any layout. A kind enters
  `evermore/kinds.mts` only when its stable implode is byte-identical, `--random` round-trips and `prove` plays
  identically.
- **Explode is lossless**: a codec refuses to explode what it cannot encode back.
- **One decoder.** Codecs call the decoders in `dist/` (the ones `soe://` uses); they never copy them.
- **No ROM bytes in the repo.** The tree and `_build/` are ROM-derived: `out/` or outside the repository.
- **Generic files stay generic.** Only `evermore/` names the game (AGENTS.md §0.4); the Evermore facts that still sit
  in generic files are listed in [game-agnostic-open-rom.md](../../docs/todo/game-agnostic-open-rom.md) §1.
- Tests: `tests/open-evermore/enum-layout.test.mts`, `implode.test.mts` (unit), `g0.test.mts` (rom), `in-game.test.mts`
  (emulator: edits played in the snes9x core); `prove` on
  demand only.
