# Everscript VS Code Extension — Master TODO Index

> Single source of truth for all open tasks, roadmaps, and feature backlogs across the project.
> Each file in this directory represents a distinct, logical task cluster containing active, uncompleted work.
> Completed tasks have been audited, removed from open backlogs, and permanently documented in their respective docs.

---

## Task Clusters

| Cluster Document | Domain | Completed & Shipped Docs | Active Open Tasks |
|---|---|---|---|
| [map-editor.md](map-editor.md) | Map Editor (`src/rooms/`) | [Map Editor Features](../map-format/map-editor-features.md):<br>✅ Collision shape picker (0x0..0xF) & 8px pen<br>✅ Plane-transparent (bit 6)<br>✅ Widget special properties serialization<br>✅ Atomic placed widgets & move/delete<br>✅ Two-finger scroll panning<br>✅ Header effects catalogue & presets<br>✅ Procedural tile fill in neighbours card<br>✅ Animation phase variants & tick stagger<br>✅ Copy room as widget & test ROM export | 🟡 Flood fill tool (by metatile id)<br>🟡 Pan hand tool (`H`) & Space-hold<br>🟡 4-direction room resize (N/W)<br>🟡 Cross-map tile references<br>🟡 Direct Save to ROM for vanilla slots<br>🟡 Object/trigger tabular editor |
| [emulator-and-runtime.md](emulator-and-runtime.md) | Emulator (`src/emulator/`, `src/debugger/`) | [Emulator & Debugging](../emulator-and-debugging.md):<br>✅ Full DAP debugger (breakpoints & stepping)<br>✅ Extended map multi-layer rendering<br>✅ Live camera coordinates located (`$7E0112/$0114`)<br>✅ Sound-chip telemetry to Music tab<br>✅ TAS recording & playback<br>✅ Runtime script injection engine | 🟡 Live painting from editor into running game<br>🟡 Emulator viewport overlay box on editor<br>🟡 Interactive in-panel Everscript REPL<br>🟡 Save state scrubbing timeline |
| [language-tools-and-lsp.md](language-tools-and-lsp.md) | Language (`src/language/`) | [Language Features](../language-features.md):<br>✅ Native hover documentation<br>✅ Keyword/enum autocompletion<br>✅ Go-to-definition & symbol references<br>✅ Document symbols & breadcrumbs<br>✅ Compiler problem matchers & build tasks<br>✅ Dead branch fading & code snippets | 🟡 Rich live diagnostics & AST linter<br>🟡 Workspace-wide rename (`F2`)<br>🟡 Signature help & inlay hints<br>🟡 Tag names in scripts (`<boy.hp>`)<br>🟢 Optional external Python LSP daemon |
| [combat-damage-and-routing.md](combat-damage-and-routing.md) | Mechanics (`src/scaling/`) | [Damage Math](../alchemy-damage.md) & [Scaling Scenarios](../scaling-scenarios.md):<br>✅ Unified physical damage engine<br>✅ 16-bit RNG simulated alchemy damage curves & charts | 🟡 Atlas 100% vs sub-100% traces<br>🟡 Trace-backed Atlas subtraction formula<br>🟡 Route progression simulation |
| [resource-tags-system.md](resource-tags-system.md) | Tags (`src/resources/tags/`) | [Tags Specification](../soe-tags-spec.md):<br>✅ `soe://tags/` provider & hierarchy<br>✅ Multiple inheritance & back-links<br>✅ Tag validation & check tooling | 🟡 Expand `tags.json` ontology (alchemy/weapons)<br>🟡 Bundle `core.evs` in compiler for auto-generation<br>🟡 WRAM address verification |
| [audio-and-music.md](audio-and-music.md) | Music (`src/music/`) | [Sound Engine Guide](../audio_music_sound_formats.md):<br>✅ Radar Music tab with voice lanes, ARAM map, sound-chip stream | 🟡 Wolfgang v3 sequence bytecode decoding<br>🟡 Piano roll track lanes & live playhead |
| [static-recompilation.md](static-recompilation.md) | Recomp (`tools/recomp/`) | [Recomp Master](../recomp/README.md) & [Bugs/Roadmap](../recomp/bugs-and-todos.md):<br>✅ Milestone 1: Headless intro & attract loop clean<br>✅ Save state `SEXC` chunks & dynamic exclusions | 🟡 Timing drift investigation after NMI ~315<br>🟡 Upstream PRs (BG Mode 4, CPU save states)<br>🟡 Milestone 2: Automated playthrough<br>🟡 Milestone 3: HLE C decompressors |
| [research-and-visualizations.md](research-and-visualizations.md) | RE & Tools (`tools/`) | [Act 0 Dog Research](act0-dog-animations.md):<br>✅ Call-graph galaxy prototype | 💡 Galaxy standalone HTML export<br>💡 ROM heat-strip timelapse over TAS<br>💡 Script flame graph & WRAM phosphor heatmap<br>💡 Event-flag DAG & World atlas<br>🟡 Act 0 dog missing animations & bark patch |
| [romhacks-and-ports.md](romhacks-and-ports.md) | Romhacks & Ports | — | 💡 Secret of Mana content port to SoE<br>💡 Combo ROM → [docs/exhirom/combo-rom.md](../exhirom/combo-rom.md) |

---

## Guidelines for Working on Tasks

1. **Before Starting Work:**
   - Check the relevant cluster file above for ground truth and already-shipped foundation.
   - Review related skills in `.agents/skills/`.
2. **When Completing Tasks:**
   - Remove completed tasks from the cluster file under `docs/todo/`.
   - Document newly implemented features in permanent documentation (`docs/`).
   - Record lessons learned and addresses in `src/localizations/knowledge/`.
   - Follow the `release-ritual` skill (`npm run typecheck && npm run check:circular && npm run check:dead && npm test`).
