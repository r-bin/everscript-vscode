---
name: open-evermore-modding
description: Use to mod Evermore with Open Evermore: explode the ROM to a folder, edit files by name, implode a ROM, check it with --strict, --random and prove, read the report.
---

# Modding with Open Evermore

How to *use* the tool. Changing the tool itself (a codec, a kind, the allocator) is the `open-evermore` skill.
Design and every kind: `docs/open-evermore/README.md`, `resources.md` (a kind's files and limits),
`validation.md` (every finding). Run commands from the repo root.

## Before the first run

- `npm run build:ts` once, and again after `src/` changed: the codecs load the decoders from `dist/`. It deletes
  `dist/`: never while an implode or a proof runs.
- A ROM: the ROM library's base ROM is the default (`games-and-roms` skill, `npm run roms`), or pass a path.
  Today only US 1.0 has a mapping file (`tools/open-evermore/evermore/map/us.json`); `locate` drafts others.
- The tree is ROM-derived: only under `out/` or outside the repo; never `git add` it (AGENTS.md §0.1).

## The loop

```sh
T=tools/open-evermore/open-evermore.mts
node $T explode                                  # → out/open-evermore/ (--out <dir> --force to redo)
node $T implode out/open-evermore --strict       # unchanged tree: the vanilla sha1 (G0). Do this once first.
# … edit files …
node $T implode out/open-evermore --check-only   # validate + place, no ROM (~4 s)
node $T implode out/open-evermore                # → out/open-evermore/_build/evermore.sfc + report.md
```

1. **Explode once**, check G0 once, then edit in place. Explode again only into a fresh folder (it refuses an
   existing tree without `--force`, and `--force` overwrites your edits).
2. **Edit by name.** Every reference is a name, typed as `<folder>/<name>` in JSON (`strings/menu/rare_item`,
   `wram/DOG_BISCUIT`); scripts call `@name`. Never write an address or an id.
3. **Add** content by adding a file in the kind's folder (copy a sibling, rename it). It gets the lowest free id and
   an `unlocked-id` warning; add its name to `<kind>/_enum.json` to keep that id. **Delete** by setting its enum entry
   to `null`, else `locked-name-missing`.
4. **Never edit** `_base/` (`base-changed`), `_`-prefixed files other than `_enum.json`, or `_build/`.
5. **Implode** and read `_build/report.md`: errors stop the ROM (exit 1), warnings do not, info says what moved.
   An `unknown-reference` lists the closest names: usually a typo.
6. **Play it** in the extension's emulator or MesenCE (`reference-emulators` skill). A visual change is checked by eye
   (`feature-validation` skill), not by a green implode.

## Which flag when

| Want | Run |
|---|---|
| a byte-exact vanilla build of an unchanged tree | `implode <dir> --strict` (warnings become errors) |
| the usual build of an edited tree | `implode <dir>` (relative script calls written absolute: each script may go anywhere) |
| proof that nothing reaches a resource by a fixed address | `implode <dir> --random [seed]`: every resource moved, round-tripped; the seed is printed |
| proof that a layout plays like the original | `prove <dir> --random <seed>` (~1 min a seed): lockstep on the stored playbacks |
| proof of moved WRAM | `prove <dir> --stable` (ROM at home, WRAM compared through the move) |
| prove a few kinds alone | `explode --kinds a,b --out out/<scratch>`, then implode/prove that tree |

- `prove` compares an **unchanged** tree's two layouts (G1). A changed resource needs its own playback (G2): record
  one on the original (`sample-playbacks` skill) and pass `--movies <file>`.
- A misspelt flag is **ignored silently** (`--strcit` builds without `--strict`): read the flag back in the output.
- `--random` builds a 4 MiB image on purpose; a stable build grows only when something no longer fits (`grown`).

## Testing an edit in game

Regression: a replay (01, the demo). A feature (a Dog form, an enemy): Brian's room, all in the tree, never an
everscript IPS (it assumes vanilla's layout). The opening's enter script (room `podunk_opening_over_the_machine`) becomes
`load_map 23, 40, podunk_test_room_brians_room`; Brian's `scripts.json` `enter` names a new `enter.txt`:
`set_flag <0x2261, 0x01>, 0` and `0x02` (the party available), your lines (`write_word CHANGE_DOGGO, 14`),
`call @gothica_ivor_tower_east_room_and_kitchen/door_01_sub_2` (`$22EA` bit `$80` + layers), `unfreeze_boy_and_dog`,
`fade_in`, `end`. Look in **MesenCE** (`Mesen --testRunner x.lua rom`, `emu.takeScreenshot()`): our snes9x core draws no
party in Brian's room (vanilla too).

## Reading a failure

- `g0-failed` on an unchanged tree: the tool or `dist/` changed since explode. Rebuild `dist/`, explode afresh.
  On an edit to an in-place records kind only (equipment, alchemy), build without `--strict`.
- `round-trip`: the built ROM explodes to something else. A tool bug: report the resource it names (`open-evermore` skill).
- `no-space`: the content does not fit its placement rule; `manifest.json` `placement` can only narrow rules.
- `id-over-limit`: the kind's table has a fixed size; the report gives the reason. Growing it is tool work
  (`docs/todo/growable-items.md`, `docs/todo/wram-allocation.md`).
- A proof out of step: `_build/prove-<seed>/REPORT.md` names the first frame. Try a second seed before suspecting the
  edit; some seeds drift on vanilla trees too (`docs/open-evermore/progress.md` §2).

## Rules

- Names are ours (D3/D4, `docs/cleanup.md`): rename by file name plus every reference (no `rename` action yet).
- WRAM a new id needs beyond vanilla's space: a `temp[]` cell, wiped on every room load, not saved (`open-evermore` skill).
- Share nothing ROM-derived: no tree, no ROM. A BPS patch is planned (`docs/open-evermore/tool.md` §1).
- Something only another game would need, or an Evermore fact in a generic file: `docs/todo/game-agnostic-open-rom.md`.
- What you learn about the game (an address, a field) goes into a knowledge entry (`game-knowledge` skill).
