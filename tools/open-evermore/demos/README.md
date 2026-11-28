# Open Evermore Demos

Playable, end-to-end mods stored as clean overlay recipes (`demo.json` + optional `files/` + `verify.lua`), never full exploded trees, ROM bytes, PNGs, or binary patches ([demos.md](../../../docs/open-evermore/demos.md)).

## Structure of `demos/<name>/`

- `demo.json`: metadata, `transforms` (the mod), optional `scene` (boot shortcut to showcase the feature from power-on), and `verify` screenshot assertions.
- `files/`: optional authored `.txt`, `.json`, or `code/*.asm` files copied into the exploded workspace via `{ "op": "copyFiles" }`.
- `verify.lua`: headless MesenCE (`--testrunner`) Lua verification script emitting `OE_PASS`, `OE_FAIL`, `OE_PNGHEX`, and `OE_DONE`.

## Commands

```sh
node tools/open-evermore/open-evermore.mts demo list
node tools/open-evermore/open-evermore.mts demo apply <name|all> <dir> [--no-scene]
node tools/open-evermore/open-evermore.mts demo verify <name|all> [rom] [--random [seed]] [--asar]
```
