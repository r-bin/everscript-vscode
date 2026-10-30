# tools/ghidra/

Tools for generating Ghidra and REA analysis seeds and context from the CDL library.

- `gen-seeds.mts`: reads the CDL export (`functions.json`, `export.json`, `rom.cdl`) and localizations (`functions.ts`, `tables.ts`, knowledge entries) to produce `traces/rea/soe-seeds.tsv` and `traces/rea/soe-context.tsv`.
- Run: `npm run ghidra:seeds`

