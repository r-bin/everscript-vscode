# Everscript VS Code Extension — Master TODO Index

> Single source of truth for all open tasks, roadmaps, and feature backlogs across the project.
> Each file in this directory represents a distinct, logical task cluster containing active, uncompleted work.
> Completed tasks have been audited, removed from open backlogs, and permanently documented in their respective docs.

---

## Task Clusters

| Cluster Document | Domain | Completed & Shipped Docs | Active Open Tasks |
|---|---|---|---|
| [map-editor.md](map-editor.md) | Map Editor (`src/games/evermore/rooms/`) | [Map Editor Features](../map-format/map-editor-features.md):<br>✅ Collision shape picker (0x0..0xF) & 8px pen<br>✅ Plane-transparent (bit 6)<br>✅ Widget special properties serialization<br>✅ Atomic placed widgets & move/delete<br>✅ Two-finger scroll panning<br>✅ Header effects catalogue & presets<br>✅ Procedural tile fill in neighbours card<br>✅ Animation phase variants & tick stagger<br>✅ Copy room as widget & test ROM export | 🟡 Flood fill tool (by metatile id)<br>🟡 Pan hand tool (`H`) & Space-hold<br>🟡 4-direction room resize (N/W)<br>🟡 Cross-map tile references<br>🟡 Direct Save to ROM for vanilla slots<br>🟡 Object/trigger tabular editor |
| [emulator-and-runtime.md](emulator-and-runtime.md) | Emulator (`src/emulator/`, `src/games/evermore/debugger/`) | [Emulator & Debugging](../emulator-and-debugging.md):<br>✅ Full DAP debugger (breakpoints & stepping)<br>✅ Extended map multi-layer rendering<br>✅ Live camera coordinates located (`$7E0112/$0114`)<br>✅ Sound-chip telemetry to Music tab<br>✅ TAS recording & playback<br>✅ Runtime script injection engine | 🟡 Live painting from editor into running game<br>🟡 Emulator viewport overlay box on editor<br>🟡 Interactive in-panel Everscript REPL<br>🟡 Save state scrubbing timeline |
| [language-tools-and-lsp.md](language-tools-and-lsp.md) | Language (`src/games/evermore/language/`) | [Language Features](../language-features.md):<br>✅ Native hover documentation<br>✅ Keyword/enum autocompletion<br>✅ Go-to-definition & symbol references<br>✅ Document symbols & breadcrumbs<br>✅ Compiler problem matchers & build tasks<br>✅ Dead branch fading & code snippets | 🟡 Rich live diagnostics & AST linter<br>🟡 Workspace-wide rename (`F2`)<br>🟡 Signature help & inlay hints<br>🟡 Tag names in scripts (`<boy.hp>`)<br>🟢 Optional external Python LSP daemon |
| [combat-damage-and-routing.md](combat-damage-and-routing.md) | Mechanics (`src/games/evermore/scaling/`) | [Damage Math](../alchemy-damage.md) & [Scaling Scenarios](../scaling-scenarios.md):<br>✅ Unified physical damage engine<br>✅ 16-bit RNG simulated alchemy damage curves & charts | 🟡 Atlas 100% vs sub-100% traces<br>🟡 Trace-backed Atlas subtraction formula<br>🟡 Route progression simulation |
| [resource-tags-system.md](resource-tags-system.md) | Tags (`src/games/evermore/resources/tags/`) | [Tags Specification](../soe-tags-spec.md):<br>✅ `soe://tags/` provider & hierarchy<br>✅ Multiple inheritance & back-links<br>✅ Tag validation & check tooling | 🟡 Expand `tags.json` ontology (alchemy/weapons)<br>🟡 Bundle `core.evs` in compiler for auto-generation<br>🟡 WRAM address verification |
| [audio-and-music.md](audio-and-music.md) | Music (`src/games/evermore/music/`) | Sound Engine Guide (`everscript/docs/audio_music_sound_formats.md`, sibling repo):<br>✅ Radar Music tab with voice lanes, ARAM map, sound-chip stream | 🟡 Wolfgang v3 sequence bytecode decoding<br>🟡 Piano roll track lanes & live playhead |
| [static-recompilation.md](static-recompilation.md) | Recomp (`tools/recomp/`) | [Recomp Master](../recomp/README.md) & [Bugs/Roadmap](../recomp/bugs-and-todos.md):<br>✅ Milestone 1: Headless intro & attract loop clean<br>✅ Save state `SEXC` chunks & dynamic exclusions | 🟡 Timing drift investigation after NMI ~315<br>🟡 Upstream PRs (BG Mode 4, CPU save states)<br>🟡 Milestone 2: Automated playthrough<br>🟡 Milestone 3: HLE C decompressors |
| [research-and-visualizations.md](research-and-visualizations.md) | RE & Tools (`tools/`) | [Act 0 Dog Research](act0-dog-animations.md):<br>✅ Call-graph galaxy prototype | 💡 Galaxy standalone HTML export<br>💡 ROM heat-strip timelapse over TAS<br>💡 Script flame graph & WRAM phosphor heatmap<br>💡 Event-flag DAG & World atlas<br>🟡 Act 0 dog missing animations & bark patch |
| [table-hack.md](table-hack.md) | Table hack (`tools/table-hack/`) | [Table hack](../table-hack.md), [Extension tables](../extension-tables.md), [Enemies & palettes](../enemies-and-palettes.md), [Adding animations](../adding-animations.md):<br>✅ Rooms, enter scripts, strings, script pointers moved & proven<br>✅ Enemy index, character records, map palettes moved & proven<br>✅ Animation record pool, `animate()` ids, sprite block tables moved & proven<br>✅ New sprite palettes (hook) | 🔴 Sprite info space in `$CA–$D3`<br>🔴 everscript compiler: moved addresses<br>🟡 Block encoder & new animation content<br>🟡 Sprite palette hook vs RNG<br>🟢 Directory + plugin resolver |
| [../cleanup.md](../cleanup.md) | Repo cleanup + multi-game restructure ([multi-game.md](../architecture/multi-game.md)) | — | 🔴 Legal check, re-do of the ported parts<br>🟡 Dead code & tools, `platform/core/games`, ROM library + panel<br>🟡 Duplication, file splits, TS everywhere<br>🟡 Every address & name documented, slim AI files |
| [merge-into-everscript.md](merge-into-everscript.md) | Repo merge: this plugin into `everscript` (deferred 2026-10-16: no merge for now) | — | 🟡 Decide; amend D7/D9 & architecture-state §22<br>🔴 Legal pass on `everscript` tree + history<br>🟡 `language-data.json` exporter from the Python parser (drops `generate_data.py`, hand copies)<br>🟡 One skill tree, one `knowledge/` source<br>🟡 Import as `vscode/` with filtered history, one build, CI<br>🟢 Gate G1–G4 green → archive this repo |
| [variant-vfs-and-consumers.md](variant-vfs-and-consumers.md) | Multi-Variant Support (`src/games/evermore/`) | [Variant Table Mapping](../evermore-variants.md):<br>✅ All 15 core tables mapped across 6 retail ROMs<br>✅ Unified PAL layout discovered<br>✅ Automated discovery tool & boot tests | 🟡 VFS integration (`soe://tables/`)<br>🟡 Connect dynamic `mapTableOffset` to Map Editor<br>🟡 Wire localized string keys & enter scripts<br>🟡 Wire sprite blocks & animation records |
| [romhacks-and-ports.md](romhacks-and-ports.md) | Romhacks & Ports | — | 💡 Secret of Mana content port to SoE<br>💡 Combo ROM → [docs/exhirom/combo-rom.md](../exhirom/combo-rom.md) |

---

## Guidelines for Working on Tasks

1. **Before Starting Work:**
   - Check the relevant cluster file above for ground truth and already-shipped foundation.
   - Review related skills in `.agents/skills/`.
2. **When Completing Tasks:**
   - Remove completed tasks from the cluster file under `docs/todo/`.
   - Document newly implemented features in permanent documentation (`docs/`).
   - Record lessons learned and addresses in `src/games/evermore/localizations/knowledge/`.
   - Follow the `release-ritual` skill (`npm run typecheck && npm run check:circular && npm run check:dead && npm test`).
