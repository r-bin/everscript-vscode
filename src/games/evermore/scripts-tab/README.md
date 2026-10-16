# scripts-tab/ — Scripts tab

The radar panel's **Scripts** tab: every kind of script in the game, each with what it does
on the right. Three columns: a filterable list, the script, and its preview.

| View | List | Middle | Right |
|---|---|---|---|
| **Everscript** | rooms by area | the room's scripts (enter, step-on `S`, B-trigger `B`) as chips, then the selected one's decoded instructions | the room picture with every trigger box (magenta step-on, yellow B); click a box to open its script |
| **Animations** | the 783 records at `$C43E3A` (⚗ = signals `effect_done`, an alchemy effect) | the record's script disassembly; the lines the current frame ran are lit | the animation playing at 60 ticks/s, facings N…NW, step buttons, palette |
| **Alchemy** | the 35 formulas with their `$91` block | the chain `ALCHEMY_ANIM_MAP` → `$91:80A6` → block, the block's words (record ids lit, click to play), the record's script | the effect animation |
| **Music** | the 70 tracks | the sequence: pointer at `$2EB6 + 2P`, header, each track's bytes (`≥ $F0` marked as commands; the opcodes are not decoded) | a silent player: 8 voice lanes moving under a playhead, an overview strip to seek, the note each voice sounds |

Everscript view toggles (simulation, `src/games/evermore/simulation`, work in progress):
- **Everscript (simulation)** — the script as structured Everscript that compiles back to the
  same bytes (`raw code(...)` where it has no exact spelling).
- **Clusters** — the room's triggers grouped as the simulation sees them: pickups, exits,
  dialog, cutscenes, other.

Facts behind the Alchemy view: `src/games/evermore/localizations/knowledge/rom/c45ddf.md`, `9180a6.md`.
Behind the Music view: `docs/todo/audio-and-music.md` §1.1.

| File | Role |
|---|---|
| `index.js` | Public API: `handlesScriptsMessage` / `handleScriptsMessage`, `buildScriptsTabHtml` |
| `host.js` | The `scripts*` requests; uses the injected sprites and music capabilities |
| `render-scripts-tab.js` | The pane scaffold |
| `model/rooms.js` | Room list, a room's scripts with trigger boxes, the room picture |
| `model/alchemy.js` | Formulas → `$91` blocks → animation records; records that signal `effect_done` |
| `model/simulation.js` | The simulation's Everscript for one script, a room's clusters |
| `webview/scripts-tab.js` | `_scr`, the list, the tool bar, dispatch |
| `webview/scripts-room.js` | Everscript view |
| `webview/scripts-anim.js` | Animations and Alchemy views, the animation player |
| `webview/scripts-music.js` | Music view, the silent player |
| `webview/scripts-init.js` | Binding, host messages |
| `webview/scripts-tab.css` | Styles (`scr-` prefix) |

Host protocol:

| Page → host | Host → page |
|---|---|
| `scriptsInit` | `scriptsIndex { rooms, animations, formulas, music }` |
| `scriptsRoom { id }` | `scriptsRoom { id, room, picture }` |
| `scriptsAnim { key, record, facing }` | `scriptsAnim { key, anim }` |
| `scriptsMusic { id, seconds }` | `scriptsMusic { id, sequence, timeline }` |
| `scriptsSim { room, key }` | `scriptsSim { room, key, everscript, clusters }` |
