# scripts-tab/ — Scripts tab

The radar panel's **Scripts** tab: every kind of script in the game, each with what it does
on the right. Three columns: a filterable list, the script, and its preview.

| View | List | Middle | Right |
|---|---|---|---|
| **Everscript** | rooms by area | the room's scripts (enter, step-on `S`, B-trigger `B`) as chips, then the selected one's decoded instructions. The enter script has its calls and started threads merged in (folds), and the room's variants as chips (`1 · Thraxx`, `2 · Coleoptera`, `3 · Empty`): the lines the chosen one does not run are greyed, and so are those the entry state rules out (IN_ANIMATION, DOG_UNAVAILABLE, CHANGE_MUSIC assumed 0, a chip each to flip). Step-on and B triggers read the same way (merged and structured, asked for when picked). Called bodies carry a bar per call at the call's arrow column, their text after it (only 8- and 16-bit calls start folded, each by its name); rows, chips and boxes are tinted by role (setup, exit, pickup, sniff spot, scene) | the room picture with every trigger box (magenta step-on, yellow B) and the chosen variant's characters, the camera bounds the shown lines leave (outside greyed), the doors that lead here (click to open them); then the arrivals and the sliced `arg[]` / `temp[]` cells; click a box to open its script |
| **Animations** | the 783 records at `$C43E3A` (⚗ = signals `effect_done`, an alchemy effect) | the record's script disassembly; the lines the current frame ran are lit | the animation playing at 60 ticks/s, facings N…NW, step buttons, palette |
| **Maps** | rooms by area | the room blob as the loader reads it: the map table entry, then each section (header, triggers, map palettes, palette-cycle descriptors, Blocks 1–3, animated tiles, objects, cuttable tiles, object area) with its bytes, decoded fields and items. An item owns every byte range that is its: an object its record, each step's descriptor and stamp; a channel its descriptor and frame list | the selection drawn: the room with every trigger and object box, the map palettes as sets of 7 (`$7E:2437`) with empty slots marked, a channel's frames playing, an object's states playing with each step's hold, every metatile (click one) taken apart with all its states — cut chain, animation frames, the object states that place it |

Everything showing the same thing carries one key (`data-mk`): hover an item, a byte, a box or a
state picture and all of them light up; click to select.
| **Music** | the 70 tracks | the sequence: pointer at `$2EB6 + 2P`, header, verified command records and a few runtime-traced driver-state/timer values, with raw track bytes retained | a silent player: 8 voice lanes moving under a playhead, an overview strip to seek, the note each voice sounds |

Everscript view toggles (simulation, `src/games/evermore/simulation`, work in progress):
- **Everscript (simulation)** — the script as structured Everscript that compiles back to the
  same bytes (`raw code(...)` where it has no exact spelling).
- **Clusters** — the room's triggers grouped as the simulation sees them: pickups, exits,
  dialog, cutscenes, other.

The Alchemy view was removed (v0.327.0): the effect records are marked ⚗ in Animations, and the
formula → block chain stays in `model/alchemy.ts` (`c45ddf.md`, `9180a6.md`), which labels them.
Behind the Maps view: `docs/map-format/map_encoding.md` and the `maps/` library.
Behind the Music view: `docs/todo/audio-and-music.md` §1.

| File | Role |
|---|---|
| `index.js` | Public API: `handlesScriptsMessage` / `handleScriptsMessage`, `buildScriptsTabHtml` |
| `host.js` | The `scripts*` requests; uses the injected sprites and music capabilities |
| `render-scripts-tab.ts` | The pane scaffold |
| `model/icons.ts` | The in-game pictures a listing's lines name (script-model `icons.ts`): an enemy's or character's first frame, a loot reward's or weapon's ring icon, a dog form's idle frame (injected `dogIcon`), a room object in a state (as `soe://rom/assets/maps/<id>/objects/<n>/state_<s>.png`, keyed `object:<room>:<n>:<s>`); all from the user's ROM, sent with the room as `icons` |
| `model/live.ts` | An object index a line computes (`object[<0x24f9>]`), read from the running game: one WRAM read through the injected `readMemory` (the emulator's, as `soe://ram/` reads it), answered as `scriptsLive`; the page asks once a second while such a line shows and redraws when the object changes. Keys `camera` and `unknown` are drawn as 📷 / ❓ |
| `model/rooms.ts` | Room list, a room's scripts with trigger boxes and roles, the merged enter script, its camera-bound writes (a restating one warned), the arrivals, the enter script's characters as sprites, the room picture |
| `model/alchemy.ts` | Formulas → `$91` blocks → animation records; records that signal `effect_done` (labels Animations) |
| `model/map-sections.ts` | A room blob cut into its sections: bytes, fields, items |
| `model/map-views.ts` | What a section or item looks like: the room overlay, triggers, objects; dispatch |
| `model/map-tiles.ts` | Metatile facts and states, a channel's frames, the map palette sets |
| `model/simulation.ts` | The simulation's Everscript for one script, a room's clusters |
| `webview/scripts-tab.js` | `_scr`, the list, the tool bar, dispatch |
| `webview/scripts-room.js` | Everscript view |
| `webview/scripts-anim.js` | Animations view, the animation player |
| `webview/scripts-maps.dom.ts` | Maps view: the section and panel builders, the frame player (bundle `ScriptsMaps`) |
| `webview/scripts-listing.dom.ts` | Everscript view's enter listing: line state (variant, entry state, `} else {`), call depth, roles, the bounds and arrivals overlays, the slices table (bundle `ScriptsListing`) |
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
| `scriptsMerged { id, key }` | `scriptsMerged { id, key, merged }` — a trigger's script merged like the enter script, one at a time (a whole room's can be megabytes) |
| `scriptsAnim { key, record, facing }` | `scriptsAnim { key, anim }` |
| `scriptsMusic { id, seconds }` | `scriptsMusic { id, sequence, timeline }` |
| `scriptsSim { room, key }` | `scriptsSim { room, key, everscript, clusters }` |
| `scriptsVariants { id }` | `scriptsVariants { id, variants, pictures }` (the Rooms tab's worker, injected as `roomVariants`; `pictures[i]` the room with variant i's object states and palette set, null when it sets neither) |
