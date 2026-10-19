# Domain: `localizations`

**Purpose:** Concentration of subjective names across Secret of Evermore to make naming consistent, easily configurable, and capable of falling back to or overriding with in-game dialogue strings.

## Responsibilities

1. **Map / Room Names (`maps.ts`)**
   - Authoritative mapping from ROM room IDs (`0x00`..`0x7E`) to room names and world areas.
   - Names in our style from `data/rooms.json`: `region › place › part`, a path id, and where each part comes from
     (the region from the Dog form the room asks for, the place from the game's text where it names one).
     Regenerate with `node tools/rooms/write-room-names.js`; edit the rows there, not the JSON.
   - Short names (`place › part`), full names (with the region), and optional in-game string indices.

2. **Sound & Music Names (`sounds.ts`)**
   - Music tracks (`0x00`..`0x45`) mapped to titles verified against reference rips in `Secret of Evermore (EMU)`.
   - Sound effect (SFX) parameters mapped to descriptive titles from EMU reference rips and engine disassembly.
   - `getSoundAnimations()`: which animations play which sound (animation command `0x2E`/`0x2F` `sound n` = script id `2n`), from `data/sound-animations.json` (generated from the ROM by `tools/gen-sound-animations.js`).

3. **Knowledge entries (`knowledge/{ram,rom}/<addr>.md`, loaded by `knowledge.ts`)**
   - Everything known about an address: what it is, its fields, how it is known (`game-knowledge` skill).
   - `tables.js` and `functions.ts` are views of the ROM entries with a `category` (tables, routines);
     `soe://localization/knowledge/` serves every entry and the generated RAM and ROM maps.

4. **Compiler regions** — RAM entries tagged `compiler-region` give the radar its temp / session ranges.

5. **Script Names (`scripts.ts`)**
   - NPC / Short scripts (e.g. `0x17cd` -> "Thraxx damage/kill", `0x199e` -> "Aegis kill", `0x1a79` -> "Vigor damage").
   - Absolute scripts by ROM address (e.g. `0x93ca9f` -> "Thraxx maggot trigger part", `0x93d036` -> "Thraxx damage / kill part [1]").
   - Global scripts (e.g. `0x00` -> "Fade-out / stop music").
   - Dynamic overrides and string index binding via `setScriptOverride`.

6. **In-game String Resolution (`strings.ts`)**
   - Decoder for ROM strings using the 3002-key table at `$C3:D000` (`$11D000`).
   - Resolves `stringIndex` properties dynamically against ROM bytes when available, falling back to subjective names.

## Usage

```js
const { getMapName, getMusicName, getTableName, getFunctionName, getNpcScriptName, getAbsScriptName, resolveLocalizedName } = require('./localizations');

// Get standard subjective names
console.log(getMapName(0x38)); // "South jungle / Start"
console.log(getMapName(0x38, { full: true })); // "Prehistoria - South jungle / Start"
console.log(getMusicName(0x00)); // "Main Title"
console.log(getNpcScriptName(0x17cd)); // "Thraxx damage/kill"
console.log(getAbsScriptName(0x93ca9f)); // "Thraxx maggot trigger part"

// Resolve dynamically from ROM if stringIndex is set
const name = getMapName(0x38, { rom: romBuffer });
```

## Rules for changing this folder

Dependencies, invariants and tests: [AGENTS.md](AGENTS.md).
