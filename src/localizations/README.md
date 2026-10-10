# Domain: `localizations`

**Purpose:** Concentration of subjective names across Secret of Evermore to make naming consistent, easily configurable, and capable of falling back to or overriding with in-game dialogue strings.

## Responsibilities

1. **Map / Room Names (`maps.js`)**
   - Authoritative mapping from ROM room IDs (`0x00`..`0x7E`) to room names and world areas.
   - Sourced from SoETilesViewer (`SoEScriptDumper/data.h`) and vanilla catalogues.
   - Supports short names, full names (prefixed by area), and optional in-game string indices.

2. **Sound & Music Names (`sounds.js`)**
   - Music tracks (`0x00`..`0x45`) mapped to titles verified against reference rips in `Secret of Evermore (EMU)`.
   - Sound effect (SFX) parameters mapped to descriptive titles from EMU reference rips and engine disassembly.
   - `getSoundAnimations()`: which animations play which sound (animation command `0x2E`/`0x2F` `sound n` = script id `2n`), from `data/sound-animations.json`. That file is generated from the ROM by `tools/gen-sound-animations.js`; rerun it when the animation catalogue changes.

3. **Tables (`tables.js`)**
   - Curated list of engine lookup tables, jump tables, and alchemy/character data structures by ROM bus address.

4. **Functions (`functions.js`)**
   - Curated list of engine routine entry points, handlers, and script VM dispatchers.

5. **Script Names (`scripts.js`)**
   - NPC / Short scripts (e.g. `0x17cd` -> "Thraxx damage/kill", `0x199e` -> "Aegis kill", `0x1a79` -> "Vigor damage").
   - Absolute scripts by ROM address (e.g. `0x93ca9f` -> "Thraxx maggot trigger part", `0x93d036` -> "Thraxx damage / kill part [1]").
   - Global scripts (e.g. `0x00` -> "Fade-out / stop music").
   - Dynamic overrides and string index binding via `setScriptOverride`.

6. **In-game String Resolution (`strings.js`)**
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

