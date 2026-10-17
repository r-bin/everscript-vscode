# src/games/terra/maps — agent rules

Kind: **game** module (`src/games/terra/maps/`).
Terranigma Maps and Room Explorer panel.

## Owns
- `index.ts`: Panel lifecycle (`openTerraMaps`, `refreshTerraMaps`, `closeTerraMaps`, `isTerraMapsOpen`, `getTerraMapsPanel`).
- `page.ts`: Pure HTML renderer for Terranigma Table A (1,104 rooms) browser and header opcode inspector.

## Dependencies
- `platform/` only (`platform/games`, `platform/snes`).
- `games/terra/rom.ts` for Table A reading and header decoding.
- Never imports Evermore (`games/evermore`) or Mana (`games/mana`), enforcing rule `games-stay-apart`.
- Uses only verified Terranigma facts recorded in `docs/terra/`.

