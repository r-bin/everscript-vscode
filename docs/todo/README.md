# Everscript VS Code Extension — Master TODO Index

> Single source of truth for all open tasks, roadmaps, and feature backlogs across the project.
> Each file in this directory represents a distinct, logical task cluster.

---

## Task Clusters

| Cluster Document | Domain | Key Responsibilities / Topics | Status |
|---|---|---|---|
| [map-editor.md](map-editor.md) | Map Editor (`src/rooms/`) | Wiring bugs, widget special tiles, frame editing regressions, collision tools, PT bit 6, flood fill, panning, 4-way resize, header effects, procedural tiles, ROM save | 🔴 Active |
| [emulator-and-runtime.md](emulator-and-runtime.md) | Emulator (`src/emulator/`) | Live painting into running game, viewport tracking on editor, REPL console, DAP debugger, save state scrubber, bi-directional WRAM sync | 🟡 In Progress |
| [language-tools-and-lsp.md](language-tools-and-lsp.md) | Language (`src/language/`) | Language Server Protocol (LSP), hover docs, autocomplete, diagnostics, go-to-definition, inlay hints, problem matchers, tag names in scripts | 🟡 In Progress |
| [audio-and-music.md](audio-and-music.md) | Music (`src/music/`) | Wolfgang v3 sequence bytecode decoding, SPC driver trace, opcode table, piano roll visualization, live playhead, ARAM map | 🟡 Research |
| [static-recompilation.md](static-recompilation.md) | Recomp (`tools/recomp/`) | Lockstep timing drift, upstream snesrecomp PRs (BG mode 4, save states), automated in-game playthrough, HLE C replacements, CDL static coverage | 🟡 Active |
| [research-and-visualizations.md](research-and-visualizations.md) | RE & Tools (`tools/`) | Call-graph galaxy, ROM heat-strip timelapse, script execution flame graph, WRAM phosphor heatmap, event-flag DAG, world atlas, Act 0 dog animations | 💡 Exploration |
| [resource-tags-system.md](resource-tags-system.md) | Tags (`src/resources/tags/`) | Ontology expansion (alchemy, weapons, entity slots), `core.evs` compiler bundling, static tag derivation, validation tooling | 🟢 Foundation Shipped |
| [combat-damage-and-routing.md](combat-damage-and-routing.md) | Mechanics (`src/scaling/`) | Atlas damage traces (100% vs <100%), subtraction formula, unified physical math, spell damage graphs, route planner simulation | 🟡 Blocked on Trace |
| [romhacks-and-ports.md](romhacks-and-ports.md) | Experimental Romhacks | Secret of Mana content port (maps, enemies, ROM budgets), SoE + ALttP Combo ROM (SMZ3-style ExHiROM, bank CDL audit, SRAM relocation) | 💡 Long-term |

---

## Guidelines for Working on Tasks

1. **Before Starting Work:**
   - Review the relevant cluster file above.
   - Check related skills in `.agents/skills/` (e.g. `map-editor-rules`, `emulator-subsystem`, `recomp-debugging`, `game-knowledge`).
   - Ground any new facts in verified ROM or emulator behavior (`game-knowledge` skill).
2. **When Completing or Updating Work:**
   - Mark completed items with status updates or commit hashes.
   - Record lessons learned and addresses in `src/localizations/knowledge/`.
   - Follow the `release-ritual` skill (`npm run typecheck && npm run check:circular && npm run check:dead && npm test`).
