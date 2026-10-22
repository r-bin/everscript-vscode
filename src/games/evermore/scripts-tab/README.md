# scripts-tab/ — Scripts tab

The radar panel's **Scripts** tab: every kind of script in the game, each with what it does
on the right. Three columns: a filterable list, the script, and its preview.

| View | List | Middle | Right |
|---|---|---|---|
| **Everscript** | rooms by area | the room's scripts (enter, step-on `S`, B-trigger `B`) as chips, then the selected one's decoded instructions | the room picture with every trigger box (magenta step-on, yellow B); click a box to open its script |
| **Animations** | the 783 records at `$C43E3A` (⚗ = signals `effect_done`, an alchemy effect) | the record's script disassembly; the lines the current frame ran are lit | the animation playing at 60 ticks/s, facings N…NW, step buttons, palette |
| **Maps** | rooms by area | the room blob as the loader reads it: the map table entry, then each section (header, triggers, tile families, CHR descriptors, Blocks 1–3, animated tiles, objects, cuttable tiles, object area) with its bytes, decoded fields and items; the selected item's bytes are lit | the selection drawn: the room with trigger/object boxes, the graphics list, background palettes, a channel's frames playing, an object's states, a swap chain, a metatile taken apart (composite, BG1, BG2, collision); click a map cell or a metatile to take it apart |
| **Music** | the 70 tracks | the sequence: pointer at `$2EB6 + 2P`, header, each track's bytes (`≥ $F0` marked as commands; the opcodes are not decoded) | a silent player: 8 voice lanes moving under a playhead, an overview strip to seek, the note each voice sounds |

Everscript view toggles (simulation, `src/games/evermore/simulation`, work in progress):
- **Everscript (simulation)** — the script as structured Everscript that compiles back to the
  same bytes (`raw code(...)` where it has no exact spelling).
- **Clusters** — the room's triggers grouped as the simulation sees them: pickups, exits,
  dialog, cutscenes, other.

The Alchemy view was removed (v0.327.0): the effect records are marked ⚗ in Animations, and the
formula → block chain stays in `model/alchemy.ts` (`c45ddf.md`, `9180a6.md`), which labels them.
Behind the Maps view: `docs/map-format/map_encoding.md` and the `maps/` library.
Behind the Music view: `docs/todo/audio-and-music.md` §1.1.

| File | Role |
|---|---|
| `index.js` | Public API: `handlesScriptsMessage` / `handleScriptsMessage`, `buildScriptsTabHtml` |
| `host.js` | The `scripts*` requests; uses the injected sprites and music capabilities |
| `render-scripts-tab.ts` | The pane scaffold |
| `model/rooms.ts` | Room list, a room's scripts with trigger boxes, the room picture |
| `model/alchemy.ts` | Formulas → `$91` blocks → animation records; records that signal `effect_done` (labels Animations) |
| `model/map-sections.ts` | A room blob cut into its sections: bytes, fields, items |
| `model/map-views.ts` | What a section or item looks like: the panels on the right |
| `model/simulation.ts` | The simulation's Everscript for one script, a room's clusters |
| `webview/scripts-tab.js` | `_scr`, the list, the tool bar, dispatch |
| `webview/scripts-room.js` | Everscript view |
| `webview/scripts-anim.js` | Animations view, the animation player |
| `webview/scripts-maps.dom.ts` | Maps view: the section and panel builders, the frame player (bundle `ScriptsMaps`) |
| `webview/scripts-music.js` | Music view, the silent player |
| `webview/scripts-init.js` | Binding, host messages |
| `webview/scripts-tab.css` | Styles (`scr-` prefix) |

Host protocol:

| Page → host | Host → page |
|---|---|
| `scriptsInit` | `scriptsIndex { rooms, animations, music }` |
| `scriptsMap { id }` | `scriptsMap { id, map, picture }` |
| `scriptsMapView { id, key }` | `scriptsMapView { id, key, panels }` |
| `scriptsRoom { id }` | `scriptsRoom { id, room, picture }` |
| `scriptsAnim { key, record, facing }` | `scriptsAnim { key, anim }` |
| `scriptsMusic { id, seconds }` | `scriptsMusic { id, sequence, timeline }` |
| `scriptsSim { room, key }` | `scriptsSim { room, key, everscript, clusters }` |
