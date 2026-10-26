# src/games/terra — agent rules

Kind: **game** module (see `AI_ARCHITECTURE_GUIDE.md` §2, `docs/architecture/multi-game.md` §3). What it holds: [README.md](README.md).

## Owns
- Everything Terranigma: the descriptor, the decoder, `terra://`, the Maps panel. Facts live in `docs/terra/README.md`
  (topic docs beside it, e.g. `jumping.md`); the routines read so far, by name, in `decoder/code.ts` (`terra://rom/code/`).

## Dependencies
- `decoder/` imports only `platform/` and `../descriptor` (rule `terra-decoder-is-alone`); `resources/` the decoder,
  `platform/` and `core/resources/`; `maps/` reads only `terra://` (rule `terra-maps-reads-terra-only`).
- Never another game (`games-stay-apart`): nothing known about Evermore or Mana is assumed here. Only SNES hardware
  facts carry over, and those live in `platform/snes/`.

## Invariants
- Every fact comes from the game itself (its code under the headless core / CDL, or the room loader run on
  `platform/snes/cpu65816.ts`) and is written in `docs/terra/README.md` with its routine address in the same commit.
- Rooms are what the game's own loader (`$86:86ED`) leaves; do not re-implement a header section by hand. A
  stand-in for missing hardware (vblank flag, the music section, the starting layout) is a documented trap or
  init, nothing else.
- A routine documented in `docs/terra/` gets an entry in `decoder/code.ts` (name, address, length, entry widths, what it
  does in our own words, its doc, and `notes`: comments on the listing by byte offset) in the same commit. The listing is disassembled from the user's ROM at run time;
  no code bytes are stored. A new COP command needs its argument length read from its handler before it goes in
  `COP_COMMANDS`.
- Base ROM: the English European release (`TERRANIGMA P`, SHA-1 `911239b4…`). Other releases are recognised but
  not decoded (`isBaseTerraRom`): their addresses differ.
- A room that keeps parts from before is drawn after the closest earlier rooms that load them, and the page says so
  (it is a guess: the game has whatever room the player came from). Never invent a map for a room without one.
- A map is only "working" when it renders in the shared editor (`maps/`) as in the game (`feature-validation` skill;
  `tools/terra/check-room.mts`).

## Tests
- `tests/terra/terra-maps-model.test.mts` (unit), `terra-rom.test.mts` (rom: also every `code.ts` listing decodes to its
  end), `terra-maps-dom.test.mts` (dom, needs the ROM).
