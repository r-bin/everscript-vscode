## [0.151.0] — 2026-10-04

### Feat: [Emulator] Live object states, cuttable grass sync, projectile rendering, fog of war, enemy palette and vertical seam fixes

- **Live Object States Synchronization**:
  - Dynamically reads object states from WRAM `$7E10CE..$7E111D` (64 bytes).
  - Automatically transmits active object states via `requestRoomMap` to `applyObjectStates`, updating chest opening states, lowered bridges, switches, and gates on the extended map in real time.
- **Cuttable Grass Synchronization**:
  - Monitors the WRAM cuttable grass queue (`$7E0FD0..$7E1064`) for player weapon strikes.
  - Automatically swaps cut metatiles via `room.cuttableGrass.table.swaps` on the extended room map so cut grass is seamlessly reflected outside the emulator canvas.
- **Active Projectile Rendering**:
  - Reads active projectile pool from WRAM `$7E6387..$7E6507` (8 slots × 44 bytes).
  - Renders projectile sprites or atmospheric glowing radial energy orbs onto `#extended-entities` sorted by Y depth.
- **Atmospheric Fog of War Effect**:
  - Added toggleable Fog of War mode (`#screen-fog-toggle`, `FOG ON` / `FOG OFF`) in the floating screen chip bar.
  - Darkens the extended room map and entities outside the SNES viewport using an `evenodd` canvas cut-out, leaving the emulator display crisp and vibrant while shading outer surroundings.
- **Enemy Palette Fix**:
  - Fixed psychedelic/incorrect palettes on extended enemies by resolving live palette slot addresses from WRAM `$7E1278` (indexed by entity `slotOffset & 0x0E`) with fallback to the ROM bank `$8E` enemy character records (`$8E0000 | (stype + 0x09)`).
- **1px Vertical Seam Alignment**:
  - Corrected 1 SNES pixel downward vertical seam offset (`mapY = emuY - (camY + 1) * scaleSnes`) to perfectly compensate for the SNES PPU Mode 1 VOffset decrement.

## [0.150.0] — 2026-10-04

### Feat: [Emulator] Extended entity rendering, pre-loop camera sync, seam alignment, and MacBook zoom/pan controls

- **Extended Entity Rendering Beyond Viewport**:
  - Dynamically reads active entities from WRAM linked list (`$7E3DDF` head pointer and `$7E3DE5..$7E4FE5` entity blocks) including Boy (`$7E4E89`) and Dog (`$7E4F17`).
  - Decodes full multi-chunk 4bpp planar character sprites and ROM animation frames on-the-fly (`readSpriteInfo`, `decodeSpriteBlock`, `composeSprite`) with character palettes (`characterPalette`).
  - Renders sprites to a dedicated `#extended-entities` canvas layer (z-index: 1) layered between `#extended-map` (z-index: 0) and `#screen` (z-index: 2).
  - Enemies and the Dog are no longer cut off when moving across the emulator screen edges or wandering off-screen.
  - Decoded animation frames are cached in memory for instantaneous 60 FPS performance.
- **Pre-Loop Camera Sync (1px Walking Lag Fix)**:
  - Synchronizes camera scroll (`$7E0112`/`$7E0114`), map ID, and entity snapshots (`samplePreLoopState`) *before* executing `Module._mainLoop()`.
  - Captures the exact camera state and coordinates used by the PPU to render the SNES frame buffer, eliminating the 1-pixel walking delay between the emulator screen and the extended map.
- **Pixel-Perfect Seam Alignment**:
  - Replaced subpixel flexbox centering with absolute integer pixel positioning (`emuX = Math.round((W - emuW) / 2 + panX)`, `emuY = Math.round((H - emuH) / 2 + panY)`).
  - `#screen`, `#extended-map`, `#extended-entities`, and `#extended-overlay` share exact coordinate origins, removing all subpixel seam gaps and boundary jumps.
- **MacBook Trackpad Zoom & Pan Controls**:
  - Native trackpad pinch-to-zoom (`wheel` with `ctrlKey`/`metaKey`) anchored around cursor position (`zoomAt`).
  - Native trackpad two-finger scrolling / panning (`wheel` without modifier keys) and mouse drag-to-pan.
  - Floating zoom chip toolbar (`[-  100%  +  fit]`) in `#screen-overlay-bar` for quick zoom adjustments and viewport resetting.

## [0.149.0] — 2026-10-04

### Feat: [Emulator] Extended room map background, full-viewport trigger overlay, and focus ring removal

- **Extended Map Beyond Emulator**:
  - Dynamically renders the full decoded room map background into available pillarbox and letterbox space behind the emulator viewport in `#screen-wrap`.
  - Coordinates tracking: synchronizes room composite position (`mapX = emuX - camX * scaleSnes`, `mapY = emuY - camY * scaleSnes`) based on current WRAM camera scroll (`$7E0112`/`$7E0114`) and room map ID (`$7E0ADB`).
  - Seamless extension: the SNES display aligns to the pixel with the extended map behind it, extending the visible play area across the entire window.
  - Extended map toggle with persistent state via floating screen chip button (`#screen-extend-toggle`, `MAP EXT ON` / `MAP EXT OFF`) and panel control checkbox (`#ss-extend-toggle`).
- **Full-Viewport Trigger Overlay**:
  - Moved trigger rendering to a dedicated full-viewport canvas layer (`#extended-overlay`, z-index: 2) above both the emulator screen and extended map.
  - Step-on and B-triggers are rendered across the entire window over the extended map background, and clip to the emulator bounds when map extension is toggled off.
- **Removed Emulator Focus Border**:
  - Removed default yellow/orange focus outline and box-shadow on the emulator screen canvas (`#screen:focus, #screen:focus-visible { outline: none; box-shadow: none; }`), eliminating distracting border flashes during gameplay and arrow-key presses.
- **Fixed Trigger Label Positioning**:
  - Eliminated screen-edge clamping (`Math.max(0, ...)`) on trigger script ID labels. Trigger labels now remain locked in constant position relative to their trigger rectangles rather than sticking to the viewport edge and following the player.

## [0.148.0] — 2026-10-04

### Feat: [Emulator] Live in-game trigger overlay for step-on and B-triggers

- **Real-Time Trigger HUD Overlay**:
  - Live in-game rendering of Step-on (pink `#ff69b4`, `rgba(255,100,180,0.22)`) and B-triggers (yellow `#ffcc00`, `rgba(255,210,0,0.22)`) directly on top of the emulator canvas every frame, matching the look and feel of the Rooms map editor.
  - Dynamically tracks SNES camera scroll (`camera_x`, `camera_y` at `$7E0112`/`$7E0114`), room offsets (`trig_off_x`, `trig_off_y` at `$7E0F86`/`$7E0F88`), and room IDs (`$7E0ADB`) from WRAM with automatic fallback to ROM map headers.
  - Draws uppercase hex script ID labels at the top-left of each trigger box with a dark background pill for high-contrast legibility.
  - Zero-latency native HTML5 Canvas 2D rendering without requiring any external Lua interpreter runtime.
- **Trigger Overlay Controls**:
  - Defaults to **ON**.
  - Accessible via floating screen chip button (`#screen-trigger-toggle`, `TRIGGERS ON` / `TRIGGERS OFF`) in the upper-right corner of the emulator viewport.
  - Accessible via control panel checkbox (`#ss-overlay-toggle`) in `#ss-controls`.
  - Both toggle controls stay synchronized; clicking the chip refocuses the emulator canvas so keyboard gameplay inputs remain uninterrupted.

## [0.147.0] — 2026-10-04

### Feat: [Emulator] Clean script stack live telemetry and column-aligned trace addresses

- **Script Stack Telemetry Cleanup**:
  - Removed outdated textbook explanations and commentary (e.g. `(state==2; not always the bottom slot)`).
  - Fixed tab active counter: only truly active/waiting slots (`state === 2 || state === 4`) are counted; terminated/dead slots (`state === 0`) now report `0 active (idle)` instead of falsely counting dead slots with stale RAM addresses as active.
  - Scheduler chain resolution only chains live scripts, eliminating ghost chains between dead scripts.
  - Compacted argument dump: zero words are collapsed into `none (all 0000)` instead of 4 rows of 32 zeroes, only showing non-zero words (`w0=0001, w1=0015`) when populated.
  - Clean 2-line idle display when scripts are finished: shows active status and last executed slot without boilerplate noise.
- **Column-Aligned Address Indentation Across All Logs**:
  - Main lines and follow-up sublines now align their SNES addresses to the exact same column coordinate:
    - Text OutputChannel: fixed-width padding for timestamp (16ch), slot tag (21ch), lookup tag (16ch), and arrow (3ch), ensuring every address begins at column 56.
    - Webview DOM: fixed-width flex columns for `.ss-trace-time` (95px), `.ss-trace-tag` (140px), `.ss-trace-lookup` (110px), and `.ss-trace-arrow` (20px), ensuring every address starts at pixel x=389px regardless of whether tags or subline arrows are present.

## [0.146.0] — 2026-10-04

### Feat: [Emulator] Slot prefixes on all trace lines, clean end events, global script resolution, and removed call toggle

- **Slot & Timestamp Prefix Across All Message Lines**: Every line in the execution trace (including interwoven sub-instructions and yielded calls) now has explicit slot attribution (e.g. `[+6.26s, f377] [s0 | 0000]   -> 0x92DE4D: WRITE $2379 = 0xffff [18 21 01 CF]`), ensuring slot identity is never lost when scripts yield or run concurrently.
- **Clean End Tag Output**: Script termination events (`[s0 | 0000 | end]`) no longer repeat stale start bytecode or instruction disassembly, cleanly stating `END of script` with no redundant trailing opcode hex.
- **Vanilla Global Script Address Resolution**: Pre-indexed all 386 known global and NPC scripts (`known-scripts.json`) into `RomAddressLookup`. Slot 1 startup at `0x92A050` now automatically resolves and displays `[global[0x36]]` with tooltip `"Unnamed Global script 0x36"`.
- **Removed Call Filter Toggle**: Removed the temporary 8-bit/16-bit call toggle checkbox and CSS hiding from the emulator panel to keep the trace interface clean and focused.

## [0.145.0] — 2026-10-04

### Feat: [Emulator] Unified trace beautifier, compressed tags, opcode at end, and optional 8-bit calls

- **Single Beautifier Architecture**: All execution trace rendering (VS Code OutputChannel and Emulator Webview DOM) now flows through the exact same `ScriptTraceFormatter` class. The host generates the full tokenized HTML markup (`entry.html`), completely eliminating display discrepancies between the panel and the editor.
- **Compressed Trigger & Room Tags**: Replaced verbose tags with compact, high-density identifiers:
  - B-triggers: `[0x15.b[0]]`, `[0x34.b[0]]` (specifying room and exact trigger index).
  - Step-on triggers: `[0x15.step[0]]`.
  - Enter scripts: `[0x15.enter]`, `[0x61.enter]`.
  - Empty triggers & globals: `[empty]`, `[global[0x36]]`.
- **Opcode at the End**: Formatted bytecode hex dumps (`[00 01 02 …]`) at the very end of both main lines and sublines, allowing the human-readable opcode and operands to be read first:
  - `[+7.20s, f434] [s0 | 4E89 | start] [0x15.enter] 0xBC8000: WRITE GET WEAPON ($2441) = Laser Lance (0x18) [14 E9 01 E8]`
  - `  -> 0xBC8004: CALL "Unnamed Global script 0x36" (0x36) [A3 36]`
  - `  -> 0xBC8006: END (return) [00]`
- **Full Syntax Highlighting Across All Lines**: Follow-up sub-lines (`-> 0x...`) are now 100% tokenized with arrow styling (`.ss-trace-arrow`), address colors (`.ss-trace-addr`), opcode keywords (`.sx-kw`), strings (`.sx-str`), numbers (`.sx-num`), and asides (`.sx-aside`) in the webview and TextMate scopes in OutputChannel.
- **Optional 8-Bit Calls & 2-Space Indentation**:
  - Sublines are cleanly indented with exactly 2 spaces (`  -> `).
  - Added `#ss-trace-8bit-calls` checkbox to trace controls, allowing users to toggle 8-bit global calls (`0xA3`) on and off via instant CSS (`.call-8bit`) and channel filtering.
  - 16-bit calls (`0xA4`) and 24-bit calls (`0x29` / CALL ABS) remain visible at all times.

## [0.144.0] — 2026-10-04

### Feat: [Emulator/Rooms] ROM address lookup, trigger canvas highlight, hide inactive updates & unified trace formatter

- **ROM Address Lookup Table (`RomAddressLookup`)**: Fast address resolution mapping ROM execution addresses to human-readable sources:
  - Custom Room 0x15 enter script (`0xBC8000 -> Room 0x15 Enter Script (Laser Lance + Fade)`).
  - Draft B-triggers and step-on triggers (`0x92A42F -> Room 0x15 B-trigger (bare END)` / `0x94E644 -> Room 0x34 B-trigger #0 (Gourd Prize)`).
  - Vanilla enter script pointer table (`$92801B + 5*r`) across all 127 rooms and named global scripts (`names.json`).
  - Lookup tags (e.g. `[Rm 0x15 Enter]`, `[Rm 0x15 B-trig]`, `[Empty Trig]`) displayed in both the output channel and webview UI.
- **Trigger Execution Highlighting on Map Editor Canvas**: Trigger execution notifications dispatch from emulator panel to Map Editor, automatically selecting the trigger (`triggerSelect`) and pulsing feedback in the editor note banner (`Trigger executed: Room 0x15 B-trigger (bare END)`).
- **Hide Inactive Script Events Filter**:
  - Added `#ss-trace-hide-inactive` checkbox to SCRIPT TRACE controls in the emulator UI.
  - Toggling immediately filters inactive `.end` rows via CSS in the webview.
  - Notifies host so OutputChannel filters out redundant status completion lines when enabled.
- **Unified Trace Formatter Class (`ScriptTraceFormatter`)**: Standardized formatting class delivering identical token structure, tags, timestamps, frame counters, and colors across both the VS Code OutputChannel and the webview DOM.
- **TextMate Trace Grammar & Theme Scopes**: Added `#lookup_tag` pattern matching `[Rm 0x15 ...]`, `[Empty Trig]`, and `[Global: ...]` with `entity.name.tag.lookup.trace` styled in cyan/teal bold in `everscript-dark.json`.

## [0.143.0] — 2026-10-04

### Feat: [Language/Emulator] Colorized output channels with TextMate trace grammar

- **Colorized Output Channels**: Registered `everscript-trace` language and TextMate grammar (`src/language/syntaxes/everscript-trace.tmLanguage.json`) bound to the `Everscript Script Trace` and `Everscript ROM Builder` output channels (`vscode.window.createOutputChannel(name, 'everscript-trace')`).
- **Syntax Highlighting for Script Trace**: Real-time trace lines in VS Code's Output panel are now highlighted with token colors:
  - Relative timestamps (`[+20.86s, f1253]`) and frame counters (`fNN`) in blue and teal.
  - Script lifecycle transitions (`start` in green, `resume` in yellow, `step` in blue, `end` in red).
  - SNES ROM addresses (`0x92A42F:`, `0xBC8000:`) and RAM locations (`$2441`) in teal/yellow.
  - Bytecode hex dumps in dimmed gray, instruction opcodes (`WRITE`, `CALL`, `END`, `IF`, etc.) in keyword blue, and string names in orange.
- **Syntax Highlighting for ROM Builder Logs**: Highlights status tags (`[SUCCESS]`, `[ERROR]`, `[WARNING]`, `[INFO]`) and section titles (`[Export ROM]`, `[Play in Emulator]`).
- **Theme Support**: Included color rules in `src/language/themes/everscript-dark.json` and standard TextMate scopes (`markup.inserted`, `markup.changed`, `markup.deleted`, `keyword.control`, `constant.numeric`) compatible with all VS Code themes.

## [0.142.1] — 2026-10-04

### Fix: [Rooms] B-triggers (and step-on triggers) in an exported map never fired

- **Cause**: on a B press, the engine reads the B-trigger table only when the tile the Boy faces has collision bit 15 (`0x8000`, `$8FCE43`). Otherwise he swings his weapon. A gourd drawn in the editor kept collision `0x1F`/`0x19` without that bit, so its trigger was never even checked. Step-on triggers have the same gate on bit 14 (`0x4000`, `$8FB07B`).
- **Fix**: Export ROM and Play in emulator now set the gate bit on every cell a trigger covers, in the map as it loads (`withTriggerGates`, `rooms/rendering/rom-export.js`). An object's later states keep their own words, so an opened gourd stops answering B, as vanilla's does.
- **Verified in the game**: a headless boot of a room-0x34 gourd. Before the fix, B did nothing. After it, the same press ran the gourd's script, the gourd opened, and the prize and flag were written.
- A trigger with no script still gets id 477, a bare `END`. It fires but does nothing visible, and it is too short for the script trace to show. See `docs/map-format/rom-export.md`.

## [0.142.0] — 2026-10-04

### Feat: [Emulator/Rooms] Map export logging, UI tabs & resizer, enter script trace, and boot garbage filter

- **Map Editor compilation & export logging**: Added dedicated `Everscript ROM Builder` output channel logging the full compilation pipeline for "Export ROM" and "Play in emulator": map dimensions, trigger counts, object counts, base vanilla ROM verification, custom room 0x15 blob construction (size, SNES address, metatiles, animation channels), temporary staged ROM path (`*_emulator.sfc`), and emulator connection status.
- **Emulator UI tabs & resizer**: Replaced the cramped bottom stack layout with tabbed navigation (`SCRIPT TRACE` active by default with count badge, `SCRIPT STACK`, and `DEBUGGER & HOOKS`) and a draggable resizer (`#ss-resizer`) so the trace log fills the panel without being obscured by the slot table.
- **Cold RAM garbage filter**: Added `isValidScriptAddr()` to reject cold-WRAM fill pattern (`0x555555`) and uninitialized/non-ROM memory writes across all 20 slots during reset.
- **Room 0x15 enter script lifecycle trace**: Detected slot 0 enter script initialization at `0xBC8000`, capturing the full multi-instruction sequence completed within frame 1: `WRITE $2441 = Laser Lance (0x18)`, `CALL Global 0x36 (Fade in)`, and `END (return)`.
- **Timestamps & frame counters**: Added relative seconds (`+X.XXs`) and frame counters (`f<N>`) since ROM launch to all execution trace entries in both the webview UI and output channel.

## [0.141.0] — 2026-10-04

### Fix: [Emulator/Rooms] "Play in emulator" webview crash fix, trigger export & execution trace

- **"Play in emulator" launch fix**: Escaped regular expression literal in `panel-webview.js` so generated webview HTML no longer throws an unterminated group `SyntaxError`, allowing the webview script to complete initialization, emit `ready`, and receive and boot custom ROMs.
- **B-trigger & Step-on trigger export**: Exported custom rooms now forward `bTrigger` and `stepOn` from `map-editor-rom-export.js` into `CustomRoomInput` and serialize them into the custom room blob (`src/maps/custom-room.ts` and `src/rooms/rendering/rom-export.js`).
- **Gourd & placed object interaction**: Placed objects retain their B-triggers and vanilla script IDs, while unscripted triggers default to a safe empty return script (`0x92A42F`, `00 END`), making placed gourds and objects interactive in the custom test room.
- **Enter script & B-trigger execution trace**: Updated WRAM script slot tracker in `panel-webview.js` to immediately detect and log scripts running on frame 1, capturing the room enter script at boot (`0xBC8000: WRITE $2441 = Laser Lance; CALL Fade in; END`) and subsequent B-trigger executions.
- **Canvas click interaction**: Added focus and B-button pulse handler to the emulator canvas on click, allowing clicking directly on interactive objects (like gourds) to trigger them.

## [0.140.0] — 2026-10-03

### Feat: [Emulator] real-time bytecode execution logging & disassembly

- **Interwoven script execution tracking**: Monitored all 20 WRAM script slots each frame to detect start, step, resume (after wait/sleep), and termination transitions.
- **Disassembly & snippet generation**: Real-time disassembly of executed bytecode matching map editor script snippets with hex byte dumps and syntax highlighting.
- **Script Trace Log UI**: Added color-coded execution trace panel to emulator webview with auto-scrolling, clear, and clipboard copy controls, as well as an Everscript Script Trace VS Code output channel.

## [0.139.0] — 2026-10-03

### Fix: [Emulator] audio distortion, display fill, keybindings, and debugger core auto-selection

- **Audio distortion resolved**: Fixed APU playback sample rate mismatch in `exports.c` (matched to 44.1 kHz), dynamically scaled sample block generation to 735 samples/frame, expanded ring buffer to 16k samples with silence padding on underrun (eliminating buzzing loops), and throttled render loop to 60 fps to prevent 2x fast-forward on 120 Hz displays.
- **Display fill**: Fixed 256x224 low-res SNES screen buffer extraction by scaling pixels 2x cleanly across the 512x448 canvas; added collapsible `#script-stack` (`hide stack` / `show stack`) allowing the game canvas to fill the entire panel.
- **Keybindings**: Updated controls to standard keyboard layout (A=V, B=C, X=D, Y=X, L=A, R=S, Start=Enter, Select=Space, Pause/Resume=Escape) and added TODO for configurable bindings UI.
- **Core selection**: Automatically selects the modified debugger-enabled core (`src/emulator/core/snes9x2005-wasm`) by default if present, and stopped repeated `Script hook disarmed` log spam.
- **Legal packaging**: Removed `copyright` exclusion from `.vscodeignore` so mandatory Snes9x and GPLv2 attribution files are always included in the `.vsix` distribution.
- **Skills & Documentation**: Added `emulator-subsystem` skill in `.github/instructions/emulator-subsystem.instructions.md` and created `docs/emulator-status-and-roadmap.md`.

## [0.138.0] — 2026-10-03

### Change: [Rooms] a map is never smaller than one screen (16×14)

- The game draws a room smaller than 16×14 scrambled (found in 0.137.1). Instead of padding such a map at export, the editor no longer makes one.
  - The resize grip stops at 16×14, and its label says one screen is the smallest.
  - A map saved smaller by an older version opens at 16×14, with its cells kept.
  - Export ROM and Play in emulator refuse a smaller grid with a message instead of writing a broken ROM.
- Widget canvases still go down to 1×1: a widget is never exported as a room.
- The rule and how it was measured are in `docs/map-format/rom-export.md` (*At least one screen*), the room reference, the editor concepts and the map-editor-rules skill.

## [0.137.1] — 2026-10-03

### Fix: [Rooms] Export ROM — a map smaller than one screen came out scrambled

- The game only draws a room correctly when it is at least one screen, 16×14 tiles. Every vanilla room is bigger. In a smaller map, unless the Boy started in the top-left corner, the first screen of the tilemap was read from outside the map: one stale tile everywhere, and garbage along the top rows.
- Export ROM and Play in emulator now grow a smaller map to 16×14. The new cells go right and below, are empty and solid, and nothing you placed moves. The export message says when this happened.
- Found by booting exports in the bundled snes9x core and comparing VRAM with the draft. The graphics and the WRAM grid were always right. Only the BG tilemaps were wrong, which is why the export's own read-back check never caught it.

## [0.137.0] — 2026-10-03

### Feature: [Characters] richer script listing

- What a command loads now shows **beneath it** instead of in its own column: the sprite a `sprite` command sets, the 16 colours a `palette` command loads, and the animation of the projectile a `projectile` command throws (in its own palette, else the thrower's). The toggle is now called **previews** and is on by default.
- `mode` lines list their bits, e.g. `mode $0014` → `$0004 walking`, `$0010 attacking` (everscript's FLAGS_7 names, checked against the code).
- Sprite addresses link to the Sprites view, and projectile ids link to the projectile's animation in Animations.

## [0.136.0] — 2026-10-03

### Feature: [Docs] Cheats section: the diagonal speed boost

- New `docs/cheats.md`, and a **Cheats** section in the radar's Docs tab. Holding a diagonal moves at the full E/W speed on both axes, because walk/run animations have four poses (NE/SE play the E script) and the mover `$8FAD51` doesn't scale diagonals.
- Speed tables for every Boy weapon group and every Dog form, plus which weapon and direction to pick for horizontal and vertical travel. The Boy goes fastest vertically with a spear or the Bazooka, zig-zagging diagonals (walk 2.00 vs 1.50, run 3.00 vs 2.75). For some Dog forms straight is faster.

## [0.135.0] — 2026-10-03

### Fix: [Characters] diagonal movement speeds

- The speed overlay lists all eight facings with x and y per tick. The game's mover (`$8FAD51`) moves a diagonal by the full step on both axes, and a four-pose walk plays the E/W script on diagonals. So walking NE with the spear climbs at 2.0 px/tick against 1.5 walking N, and running at 3.0 against 2.75. That is the "vertically faster" spear: it only happens on diagonals. The old N/E/S/W table hid it, and the earlier "¾ perspective" explanation was wrong.

## [0.134.0] — 2026-10-03

### Feature: [Characters] stamina selector, character centred on the stage

- **Stamina selector** in the overlay panel: < 50%, 50–99%, 100%, 200%, 300%. On an attack it switches to the level that stamina plays (under 100% → Attack Lvl 0, 100% → Lvl 1, 200% → Lvl 2, 300% → Lvl 3, `$9082D8`), and the stage overlay shows the power factor from `$8FC02B`: ×¼ under 50%, ×½ under 100%, ×1, ×2, ×4. Picking an attack tile moves the selector to match. Works for the Boy, the Dog's forms and every character.
- **Centred character:** the character's sprite sits in the middle of the stage whatever floats over it. The scale shrinks until projectiles and the target fit on both sides.

## [0.133.0] — 2026-10-03

### Feature: [Characters] effect previews, south-facing lists, matching tabs, attack levels documented

- **Tab renamed:** the radar tab is now **Characters** instead of Sprites.
- **Matching tabs:** the Characters / Animations / Sprites switch on the left looks like the sidebar tabs on the right (labels with a blue underline).
- **Animations mode** hides the Animations and Stats sidebar tabs, which only apply to a character.
- **Previews face south:** the Animations list asked for facing 0 (north).
- **No more rockets:** command `0x5D` is `effect_done`, an alchemy effect telling its spell it is done. When the next byte starts another record (106 of 114 uses), the effect ends there; before, it ran on into the rocket record and every such effect showed a rocket. Effect previews use the fullest frame when the last one is a fading wisp.
- **Attack level by stamina documented:** below 100% the Boy plays Attack Lvl 0, a different animation. Axes and the Bone Crusher reach clearly less, swords about the same, spears slightly further.

## [0.132.0] — 2026-10-03

### Feature: [Sprites] floating controls, attack facing, script and placeholder palettes, Dog palette fixes

- **Controls float over the stage:** the Facing and Overlays panel sits on top of the map at the top left, like the speed overlay on the right, instead of taking its own column. The scene centres in the space beside it.
- **Zooms out for projectiles:** the scene box includes projectiles and the target again, so a thrown spear stays on screen. The scale steps in halves (1.5×, 2.5×) so it uses the stage.
- **Attacks round the facing:** the attack starter rounds a diagonal facing to east or west when the attack record has four poses (`$908343`), and steps and projectiles follow it. A spear thrown facing NE now flies east (and falls). The stage overlay says "Attack faces E".
- **Command `0x4B` is `palette`:** a script can load its own palette (75 records, e.g. explosions, the Windwalker, the Pigoodle). Those animations are drawn in it, and the Script tab says so. Placeholder ids (`ANIMATION_PLACEHOLDER`) otherwise use the `PLACEHOLDER` entity's palette (#25).
- **Dog palettes:** the Dog's standard animations (its Act 1 wolf) no longer take the selected form's palette, which drew a red wolf with Act 4 selected. Records the Act 4 toaster shares with the Dark Toaster no longer fall back to the Act 1 palette. `ACTn_…` ids use that act's form palette, and the header swatch shows the palette the stage is drawn in.

## [0.131.0] — 2026-10-03

### Feature: [Sprites] movement speed, stage overlays, inferred palettes

- **Movement speed:** animations that move show their speed for N, E, S and W in an overlay at the top right of the stage, in px/tick and px/s, with the current facing highlighted. Each facing has its own script: the spear walk is 1.5 px/tick north/south and 2.0 east/west, so it is faster *horizontally*.
- **Stage overlay:** the playback speed and scale controls moved into that overlay.
- **Overlays are overlays:** the canvas now fills the stage at a fixed scale, centred on the character and its walk path. Aggro, target, projectiles and trails draw over it and no longer shrink the scene.
- **No more oscillation:** frames with no sprite (Vigor's empty death is `nop! nop! reset!`) used to resize the canvas and make the stage and bottom bar jump. The canvas keeps its size now, and the frame info no longer wraps.
- **Inferred palettes:** an animation nobody owns takes the palette of whoever shares its sprites, else of the nearest owned sprites in the same bank, else of the nearest owned record. The Script tab says which, e.g. the Pigoodle uses Horace's Twin's palette, because its sprites are stored next to his.

## [0.130.0] — 2026-10-03

### Feature: [Sprites] compass + vertical overlays, bottom seek bar, tile previews; fixes

- **Layout:** a control column on the left has an 8-way compass (N, NE, E, SE, S, SW, W, NW) and every overlay listed vertically. The stage fills the middle, and the seek bar runs along the bottom.
- **Facing labels corrected:** the game's direction tables and the art agree that facing 0 is **north** (the Boy's back) and 8 is **south**. The old "S" button showed facing 0; list previews now show the front.
- **Chunks show their tiles:** each chunk row in both views has a preview of its 8×8 or 16×16 tile, flipped and coloured as drawn.
- **Script tab:** columns are address, command, then bytes. A **sprites** toggle previews the sprite each sprite command loads.
- **Less repetition:** sidebar panes no longer repeat the tab's name, and the Animations tab drops the "Weapon: …" heading the selector already shows.
- **Harry's palette:** chunks whose OAM palette bits are 1 use the character's second palette (`+0x0B`). Only Harry and Vigor do this, and Harry's cauldron now has the right colours.
- **Deaths:** a one-shot now ends at `end_check!`. Before, a death ran on through every death script after it.

## [0.129.0] — 2026-10-03

### Feature: [Sprites] resizable sidebars, previews everywhere, Animations tab, HUD opcodes

- **Resizable:** drag the splitter next to the list or next to the sidebar; the widths are remembered. The list's splitter was drawn before but did nothing.
- **Previews in every list:** the Animations and Sprites lists show a square thumbnail per row. They render lazily, only for rows scrolled into view, so the 5,128-sprite list stays fast. Raw sprite thumbnails follow the chosen palette.
- **Animations tab:** the character's animations moved into the first sidebar tab, as preview tiles grouped like before (weapon / form, general, special), with the weapon / form selector on top. Tiles follow the facing and palette, and a reused animation shows "→ Idle" under its name. An animation that sets no sprite previews with the character's standing sprite.
- **Sprites view gets the same sidebar:** Chunks and Palettes tabs. Pick a palette from the grid instead of a dropdown.
- **Opcodes `0x60`–`0x64` decoded:** HUD commands that draw sprites at fixed screen positions from an inline table (49, 13, 28, 13 and 52 bytes). Record `$56DE` is a HUD bar. **All 1,752 record scripts now run to completion.**

## [0.128.0] — 2026-10-03

### Feature: [Sprites] sidebar layout, movement-aware hits, palette fixes, clearer labels

- **Sidebar:** Stats, Script, Chunks and Palettes moved into a tabbed sidebar on the right, so the stage stays in view. The Palettes tab renders when opened.
- **Hits follow movement:** hits are computed both for the walk path and for the entity held in place, and the tab uses whichever matches **Walk path**. With it off, a charging body only deals contact damage if it already overlaps the target. Magmar's roll reaches a Boy 40 px away only by rolling.
- **List previews in square boxes:** two equal boxes per row, so every name lines up.
- **Palettes:** Salabog (or any frame without a main sprite) shows its head segment instead of leaving the previous grid. Changing character resets the palette choice and re-renders the grid. Choosing a palette no longer restarts the animation.
- **Labels:** "Stand (Idle)" → **Idle**, "Damage (Hurt)" → **Knockback**, "Spoils" → **Death with spoils**, and the weapon set loses its "(Weapon)" suffixes. An animation that reuses an earlier one's record says so, e.g. **Run (→ Walk)**.
- The Boy and Dog are badged **Hero**, not Enemy.

## [0.127.0] — 2026-10-03

### Feature: [Sprites] contact damage, list previews, every palette

- **Contact damage:** yes, Rimsala, Magmar's roll and the slimes hurt through their body. Mode bits `$4000`/`$8000` mark a charging body, and when it runs into another body (`$8FB4AB`: radii summed, the 2:1 squash, heights within `$230`) with full stamina, `$8FB52C` deals damage through its attack proc, once per charge. The body box turns red and dashed with "contact damage", and the target flashes on the contact tick. Correction: knock-back (and casting) **does** protect against contact damage, though not against strikes.
- **List previews:** every character in the list shows its resting pose (the idle's last drawn frame) facing south and east, in its own palette, the Boy's first weapon or the Dog's first form.
- **Names fixed:** `<Boy Name>` and `<Dog Name>` showed blank in the list because they were inserted as HTML. They're escaped now.
- **All palettes:** a new **All palettes** button shows the current frame in each of the 104 palettes the characters use, labelled by who uses it. Click one to play the animation in it; **Own palette** goes back.

## [0.126.0] — 2026-10-03

### Feature: [Sprites] aggro, no-visuals tags, everscript names, spider leap fixed

- **Spider attacks fixed:** an attack that is still in the air at `loop` (the Widowmaker's leap) used to start again mid-air. One-shots (attack, damage, death, cast) now hold their last frame until they land and end there. Idles still carry on into a hover.
- **Aggro overlay:** a new **Aggro** checkbox draws the engage area. It's a square, not a circle: the game engages when the target is within `+0x13` px in x **and** in y (`$8FD72D`), checked only once stamina is full and then with the aggro chance. With the target on, the square lights when the target is inside.
- **No visuals:** 10 characters whose own animations show nothing (Statue, Bridge, Fan, Speaker, Aegis, Aquagoth, Mungola, Face, #25, #26) are dimmed and tagged in the list. Death is excluded, since it is the shared dust puff.
- **everscript names:** spawn flags read as everscript's `FLAG_ENEMY` names; the frame info shows mode bits by `FLAGS_7` names (knockback, walking, running, attacking, casting/dodging); `+0x2A` is **Level**. The cross-reference table in `character_table.md` notes where everscript is off: `CHARGE_RATE` (a byte off) and `+0x46` (casting, not running).
- **Hit cooldown documented:** after a hit, the same attacker can't hit again for 21 ticks (`+0x36/+0x38`), while others can. See `entities-reference.md` § 6, which also gets a refreshed entity-field table.

## [0.125.0] — 2026-10-03

### Fix: [Sprites] smooth snakes, hurt offsets, hit cooldown, every character field

- **Tar Skull and Salabog move smoothly:** `segment` (`0x59`) only sets a target, and `segment_step` (`0x58`, run every tick) eases each segment toward it (`$8FC905`, a velocity-damped ease using the Mode 7 multiplier). This is now modelled exactly, with a position for every segment on every tick. The head (segment 0) is drawn in front, so the order is no longer inverted, and the hurt region follows the head.
- **Hurt offsets applied:** `+0x42/+0x44` (from `hurtbox` and `segment_step`) are what the hit test uses, so the hurt region moves with them. The Skullclaw's rises while flying. The Boy and Dog keep the default because their scripts set values that cannot be offsets.
- **Hit cooldown:** the same attacker can hit again after 21 ticks (`+0x36/+0x38`), so a lingering strike or a piercing projectile counts every 21 ticks of contact, not once. Knock-back itself is **not** invulnerable.
- **Cast:** character field `+0x46` (the Boy, Bad Boy, Verminator) is relabelled **Cast (alchemy / item)**, and `+0x48` (the evil copies) is listed.
- **Character fields decoded from the code that reads them:** flags `+0x07` (bit 4 = immune to projectiles, bit 1 = −30 hit rate, and more), second palette `+0x0B`, prize chance as a percentage (value / 128), and code-backed descriptions for every stat. Fields still open (`+0x11`, `+0x17`, `+0x2A`, `+0x48`) are shown and marked as open. The full table is in `docs/script-format/character_table.md`.

## [0.124.0] — 2026-10-03

### Fix: [Sprites] damage, fliers, Tar Skull, invulnerability, consumed projectiles, trail

- **Damage animations no longer empty:** the shared damage script (`$3E6A`) never sets a sprite, so the character keeps showing its standing one through the knock-back. The interpreter now takes that initial sprite.
- **Fliers keep flying:** the Skullclaw, Bone Buzzard, Gargon and Dragoil are still airborne at `loop`, so the run carries on until the motion repeats, and playback loops into the hover instead of snapping to the ground. `hover_hold` (`0x44`) holds frames above the game's random hover height (`$0E96`, 16–47 px; the middle is used).
- **Tar Skull is a snake:** `0x57` is decoded (a segment count, then `[count][sprite]` groups), and so is `0x59`, which places each segment (always 7 bytes; the earlier 1-byte "weapon slash" reading was wrong). The Tar Skull draws as a head and seven orbs that curl. `0x3C` (9 bytes) is measured too. 1,748 of 1,752 record scripts now run to completion.
- **Invulnerable frames:** mode bit `$20` (the hit test's `$0016 & $0020`) shows the hurt region dotted purple and labelled "invulnerable". The weapon slot labelled "Charge Attack" is relabelled **Dodge (invulnerable)**, and "Block" is relabelled **Field +0x46 (invulnerable)**.
- **Consumed and piercing projectiles:** record `+0x14` is the attack proc. Procs 2 and 6 delete the projectile on a hit, so its path now ends there; proc 4 pierces. Each contact counts once.
- **Trail:** a new number box keeps each tick's strike and projectile hit boxes on screen for that many ticks, fading out.
- **No stale sprite:** a frame whose image is still loading no longer leaves the previous animation's sprite on the stage.
- Corrected `0x48`, `0x49`, `0x4A` and `0x58` from their handlers: the earlier descriptions were wrong.

## [0.123.0] — 2026-10-03

### Feature: [Sprites] Dog forms, projectile flight and damage, a target, height reach

- **Dog forms:** the Dog gets a **Form** selector like the Boy's weapons. There are six entries from bank `$CF` (pointer table `$CF945F`): Act 0–4 and the Act 1 wolf with a stick. Each has its own palette and 15 animation slots, named where an `ANIMATION_DOG` id or the Dog's record names them.
- **Projectile flight decoded:** setup routines (straight; aimed at the target `0x16`/`0x18`; the boomerang ellipse, routine 6) and per-tick behaviours (gravity until it lands, timed lifetime, orbit) from `$90D967`. Vigor's boomerang laps a 256×128 px ellipse in 256 ticks and comes back. Projectiles that outlive the cycle finish before playback loops.
- **Projectile damage:** there is no `strike` in projectile animations. A projectile hit-tests a **16×16 box every tick it lives**. Each projectile now shows that box on the ground beneath it, with a line up to its height.
- **Target:** a new **Target** checkbox and distance put a second character ahead of the viewed one: the Boy for enemies, a Wimpy Flower for the Boy, the Dog and NPCs. Aimed projectiles aim at it, and every tick a strike or projectile reaches it flashes red. Hits use the engine's own test (`src/maps/hit-test.ts`).
- **Height reach:** a character 30 px or more up cannot be hit by a ground-level attack (`$8FB674`). Its hurt region dashes grey and says "out of reach".
- **Hurt region centred on the feet**, as the hit test measures it (`$8FB63D`), instead of standing up from them. Strike boxes are drawn on the ground footprint too.
- The stage grows to 520 px and scales a bigger scene down to fit, instead of clipping it.

## [0.122.0] — 2026-10-03

### Feature: [Sprites] movement and jumping

- **Walking moves the sprite:** the interpreter tracks x/y per tick for the selected facing. `step n` moves `(n + f) >> 2` px with the engine's 0, 3, 1, 2 dither (`$0F36`), along the mover's direction table (`$8FAF18`). The Boy's walk carries him 60 px per cycle. A new **Walk path** overlay turns it off to animate in place, and a faint marker shows where the walk began.
- **Jumps lift the sprite:** height and z-speed follow the engine's gravity (`$8FAFF5`: `h += v − 1`, `v −= 1`, land at ≤ 0). `hop`, `hop_maybe` and `wait_landed` are modelled, so the Skelesnail's attack hops 31 px and the hop frame lasts exactly its 64-tick airtime. The shadow (second sprite slot), body box and origin stay on the ground. The sprite, hurt box and strike box lift.
- **Projectiles launch from where the thrower is**, including its height. The canvas sizes itself to the whole scene: path, jump and flights.
- **Strike boxes show only on the ticks that run them:** removed the fallback that drew an animation's single strike box on every frame.
- The frame info shows where each frame ends up and how high it gets. Docs: *Movement and height* in `animation_script.md`.

## [0.121.0] — 2026-10-03

### Feature: [Sprites] projectiles

- **Projectiles fly in the player:** when an animation runs `projectile` (`0x4C`), the Sprites tab launches the projectile's own animation on the right tick, from its spawn offset and height. It flies along the facing at its real speed for the straight-line routines (2 and 4) and is drawn in place, labelled, for the others. A new **Projectiles** overlay toggles them. The canvas grows to hold the flight, capped at 160 px from the feet.
- **Projectile records decoded:** `$900000 + id`, 24 bytes (`src/maps/projectiles.ts`): animation record, palette (`0` = thrower's), movement routine, speed (1/16 px per tick), power. The routine 4 direction table at `$90DD88` gives the velocity per facing.
- **Weapon palettes:** the Boy, and what he throws, are now drawn in the equipped weapon's palette (weapon record `+0x04`). His own palette leaves slots 12–13 as placeholder green, which showed on the spears' energy wave and on weapon sprites. *Read from the data; the loader is not traced.*
- **Catalogue:** projectile animations are listed as thrown by their animation and drawn in the thrower's palette (11 records; 284 now have no known owner). The script status line names what an animation throws, and the frame info names the throw on its frame.
- Docs: a Projectiles section in `animation_script.md`. It includes the `$90DD88` evidence that facing 8 moves down the screen.

## [0.120.0] — 2026-10-03

### Feature: [Sprites] every animation in the ROM, run like the engine runs it

- **Animations mode:** a third rail mode lists all **783 animations** in the ROM's record table (`$C43E3A`–`$C45999`, 1,752 records across 1, 4 or 8 facings). Each one shows what uses it (character fields, Boy weapons, `animate()` ids with their `index.json` names) and plays in its owner's palette. The 295 with no known owner use the Boy's palette as a guess.
- **Animation Script panel:** every animation (in Characters mode too) shows its disassembled bytecode in the notation of `animation_script.md`, and highlights the commands behind the frame on screen.
- **Tick-accurate playback:** frames now come from an interpreter (`src/maps/animation-vm.ts`) that models holds as checkpoints, so counted loops repeat (Flowering Death strikes twice), jumps land, and a strike before a hold lasts its one real tick instead of the whole pose.
- **Fixed special animations:** `animate()` ids now resolve through the real id table at `$C43C92` (read at `$8CE13C`) instead of `$910000`, which is font graphics. `MAGMAR_ENTER` is now Magmar's own record `$4DD2` (15 frames, not 22 frames of an unrelated record). Boy and Dog script animations such as `SLEEP_UP` and `ACT3_FALL_2` now appear instead of being filtered out as garbage.
- **Decoded more opcodes:** `0x3D`, `0x3E`, `0x51`, `0x55`, `0x5C`, `sprite_aim` (`0x5E`) and `sprite_long` (`0x5F`). All widths now live in one table (`src/maps/animation-opcodes.ts`) that the room view's walker reads too. 1,713 of 1,752 scripts run to completion.
- **New `animation-script` skill** (Claude, Copilot, Gemini) with the rules for touching any of this.

## [0.119.3] — 2026-10-03

### Docs: [Sprites] the animation script language

- **New `docs/script-format/animation_script.md`:** the animation bytecode as a language: the per-entity machine, the frame-end bit, holds as checkpoints, a notation for writing scripts down, every opcode from the `$908000` dispatch table, and disassembled scripts (Mosquito, Wimpy Flower, Boy walk, Flowering Death, Stone Cobra).
- **Decoded the entity-variable family:** widths for `0x31`, `0x33`–`0x37`, `0x39` (decrement-and-jump) and `0x3a` (jump-if-positive), read from their handlers. 823 of 845 character scripts now walk to their own loop, up from 815, so animations such as Flowering Death's attack play past the counted loop instead of stopping.
- Folded in the pending hurt-box / strike-box centring notes in `attack_boxes.md` and `animation_format.md`.

## [0.119.2] — 2026-10-03

### Fix: [Sprites] Boy weapon animations, missing opcodes, facing directions & hitbox alignment

- **Weapon selector for the Boy:** Added full weapon selection (Bone Crusher, Gladiator Sword, Crusader Sword, Neutron Blade, Spider's Claw, Bronze Axe, Knight Basher, Atom Smasher, Horn Spear, Bronze Spear, Lance, Laser Lance, Bazooka, Bazooka Thunder Ball, Bazooka Particle Bomb) reading from ROM weapon table `$0438E6`. Choosing a weapon loads its full animation set (Stand, Walk, Run, Attack Lvl 0–3, Charge Attack, Damage) alongside the Boy's general actions.
- **Decoded missing animation opcodes:** Added widths for attack opcodes `0x48` (1 byte), `0x49` (3 bytes), `0x4a` (3 bytes), `0x58` (1 byte), and `0x59` (1 byte) in `character-animation.ts`, allowing multi-frame attacks like the bone slash to play through all frames rather than halting on frame 0.
- **Fixed facing directions:** Corrected facing constants and UI buttons (South=0 front-facing, East=4, North=8 back-facing, West=12) so clicking South shows the front of the character and clicking North shows the back.
- **Aligned hurt box and strike box:** Positioned the hurt box ($2r \times 2r$) upward from the character's feet origin `cy` so it wraps the standing character body rather than extending below ground. Correctly centered strike boxes around attacker offset $(dx, dy)$ and only rendered them on frames that declare active strikes. Expanded canvas viewport to prevent clipping wide weapon sweeps.
- **Filtered external animation scripts:** Validated external animation scripts against legitimate ROM script banks (`$C4..$CE`) and valid starting opcodes, purging font tile bitplane references (such as Dog `ACT3_FALL_2` rendering letter "B") while preserving real script triggers like Magmar's lava entry.

## [0.119.1] — 2026-10-02

### Fix: [Sprites] acquireVsCodeApi collision and empty list handling

- **Fixed acquireVsCodeApi collision in webview bundle.** In VS Code webviews, `acquireVsCodeApi()` can only be invoked once per session. Reusing the global `vs` instance declared by `shared.js` prevents an uncaught exception that halted webview execution and left the character list unpopulated.
- **Robust empty states and defensive initialization.** Added dynamic "All" chip count updating, fallback character selection, guarded palette selection options, and empty state notice informing the user if ROM assets are missing or loading.
- **Removed hardcoded character count in Sprites tab filter markup.**

## [0.119.0] — 2026-10-02

### Added: Sprites tab (characters, raw sprites, animations, hitboxes & stats)

- **New Sprites tab in Memory Radar.** Placed right next to Rooms, combining the capabilities of the Characters and Sprites viewers from SoETilesViewer.
- **Lists all 142 characters and 5,128 raw sprites.** Browse heroes, enemies, bosses and NPCs from ROM table `$8EB678`, or switch to Raw Sprites mode to inspect every OAM chunk sequence starting at `$CA0003`.
- **Plays all animations.** Supports standard animations (Stand, Walk, Run, Attack 0–3, Damage, Death, Spoils, Block) across 8 facings, as well as externally triggered animations (such as Magmar landing in magma via opcode `0x78` / `animate(entity, mode, id)`). Includes full playback controls (Play/Pause, Step Prev/Next, Loop toggle, Speed, Scrubber).
- **Hitbox and Hurtbox overlays.** Inspect the entity's Body bump box ($2r \times r$), Hurt box ($2r \times 2r$), Origin crosshair (+), and dynamically extracted attack strike boxes.
- **In-depth stat cards with engine meanings.** Every character record field (HP, Attack, Defense, Magic Defense, Evade, Hit Rate, Aggro Range, Aggro Chance, EXP, Money, Prize Chance, Radius, Flags, Palette, Charge Limit/Speed, Attack Proc, AI Script) is displayed alongside mechanical descriptions and formulas explaining its role in the game engine.
- **Per-frame chunk inspector.** Inspect every $8\times 8$ and $16\times 16$ tile chunk, its relative coordinate offset, VRAM block address, and flip/priority flags for each frame.

## [0.118.1] — 2026-10-02

### Fix: animated tiles no longer covered by their still frame

- **Torches, flames and water animate cleanly on vanilla maps.** The map draws the room's canopy as a still picture over the animation, so characters can walk behind it. That picture held each animated tile's first frame, so a torch looked like a moving flame under a frozen one. 38% of all animated tiles in vanilla have canopy art. With animation on, animated tiles are now left out of that picture.
- **A later frame no longer lets the first frame show through.** Each frame now covers its whole tile.
- **Tiles you paint on a vanilla map are no longer covered by the room's old canopy.**
- **Animation on/off on the Animation tab now stops a vanilla room's own animated tiles too**, not only the ones you placed.

## [0.118.0] — 2026-10-02

### Added: Step-on as a special, palette sets, and the Info tab in three parts

- **Step-on (collision bit 14) works like Interact.** The game only checks a step-on trigger while the player stands on a bit-14 tile. The Special tab has a **Step-on** group (Force 1 / Force 0), the Special menu a **Step-on** overlay that marks those tiles with `S`, the status bar shows each cell's step-on state, and the Tile tab can filter to step-on tiles. The special eraser clears it like the other specials.
- **A step-on trigger that can never fire is flagged.** Info → Map lists every step-on box with no bit-14 tile under it, and says how to fix it.
- **Palette sets.** 22 vanilla rooms carry more than seven tile families: extra sets a script switches to, such as Thraxx going from orange to white. Info → Header shows each set as a strip of its colours, marks the one the room loads with and the ones its own scripts set, and clicking a set redraws the map in it. This is only a preview: nothing is written to the room.
- **The Info tab has three sub-tabs:** **Header** (the header and palette sets), **Budget** (the ceilings and counts) and **Map** (what the map holds, and the checks).
- **Header rows are easier to read.** Each field shows its name and value in words on one line, with its controls on the line beneath.

## [0.117.2] — 2026-10-02

### Changed: state 0's step shows as a fixed 1

- **Under state 0, a greyed-out `1`.** The first step always happens on the next tick, because the game starts the countdown at zero when a script sets the state. The box shows that rather than leaving a gap; it cannot be edited. The last state still has no box, since nothing comes after it.

## [0.117.1] — 2026-10-02

### Fix: an object's Play works, and its tick boxes are narrow

- **▶ Play on the Object tab now runs.** A click on it never reached the tab, so it did nothing. It also looked disabled, like every small button in the panel; it is lit now, here and on the Animation tab.
- **Play does what `object[n] = 0x7e` does.** It starts from state 0 and steps once to the last state, holding each state on the way, then stops there without looping.
- **A hold's tick box is just wide enough for three digits**, since a hold is 0 to 255.

## [0.117.0] — 2026-10-02

### Added: objects step through their states, holding each one for its ticks

- **Each object state now shows a tick box, and the row has ▶ Play.** When a script sets an object's state, the game walks it there one state at a time and holds each state in between for a set number of 60 Hz ticks. That is how a bridge extends or a boss segment moves. The ticks sit under each state chip, as on the Animation tab, and Play steps the object on the map the way the game would, from state 0 to the last state or back. State 0 and the last state are never held, so they have no box.
- **Vanilla objects bring their own timing.** The ROM stores it in byte 0 of each state record. The docs called that byte the footprint width, but it is the hold time. The game's code reads it into a per-object countdown, so this is read off the code, not guessed (docs/map-format/map_objects.md §4c).
- **Export ROM writes each object's holds.** It used to write the object's width there, which the game then used as a hold time.

### Fix: objects with more than two states export correctly; whole object areas when reading a room

- **States after the first export correctly.** Each state was encoded as a change from state 0, but the game applies the changes one after another, so state 2 and later came out wrong in game. Each state is now encoded as a change from the state before it.
- **Reading a room for re-encoding keeps its whole object area.** It measured each stamping block with an old guess at its size. In 86 rooms that dropped the last bytes of the final block, and in 23 it ran past the room's data. A new test checks that a rebuilt room ends exactly where its last block does; the old test could not see either error.

## [0.116.0] — 2026-10-02

### Changed: Tile / Collision / Animation as sub-tabs, animated tiles move by drag, no channel cap

- **One `Tile` tab, with Tile, Collision and Animation as sub-tabs.** The top strip is Tile, Special, Trigger, Object, Widgets, Info. The `Tile` tab opens the sub-tab you last used.
- **Animated tiles move by drag and drop.** With the select tool on the Animation sub-tab, drag an animated tile (or a group) to new cells. Its outline follows the pointer, and the move is one undo step.
- **`+ New animated tile` is gone.** The pencil away from the open tile already starts a new one.
- **No 42-channel limit.** The tab shows how many channels the map uses, without a ceiling. The export now allows 255 channels, Section 2's one-byte count. Vanilla never runs more than 42 in a room, so more is untested in game.

## [0.115.2] — 2026-10-02

### Fix: animation previews drawn one way, vanilla maps fast again

- **Every frame preview is the map's own render of that frame**, with both layers and the cell's flips, whether it is frame 0 or a later one, in a row, a frame chip or a group. Before, frame 0 came from the map while later frames were put together from the family sheet, sometimes over the wrong layer. Only a tile still missing frames, which the map cannot render yet, is put together from its graphics.
- **Vanilla maps are fast again.** With the `Animation` marks on, the default, every redraw of the map on every tab walked the whole room to find the animated tiles and group them. The result is now kept until the map or its animated tiles change. Each row also asked for its family's tile sheet, and each sheet that arrived redrew the whole tab; patterns come with the palette now, so those requests are gone.

## [0.115.1] — 2026-10-02

### Fix: groups pause together, frames shown as the group looks, Play with empty frames

- **A drawn 2×2 (or any group) pauses as one.** With its row open, only the tile you clicked stopped on the open frame; the others kept playing, so half the group looked dead or out of step. The whole open row now stops on the open frame, and ▶ Play runs all of it.
- **Frames of a group show the group**, laid out as on the map, like the Object tab's states: one chip per frame, with every tile of the group in it. The closed row's preview is the group as the map shows it now. The per-tile lines are gone.
- **▶ Play works on a tile with empty frames.** An unfinished tile has no channel yet, so nothing played. It is now played on the map from its frames, with the empty ones as purple boxes.

## [0.115.0] — 2026-10-02

### Changed: vanilla patterns always found; touching animated tiles on one pattern are one animation

- **No vanilla animated tile shows `custom`.** Letters were looked up in the family tile sheets the editor had loaded, so a room whose families were not open in the Tile tab had none. The palette now carries vanilla's whole pattern table (every cycle, every pattern it runs at, ~470 cycles), so a ROM room's own animation always finds its letter, A when vanilla runs it only one way.
- **Touching animated tiles on the same pattern are one animation**: one row, one outline on the map and one letter. A torch's flame and base, or a pool of lava, are one animation, even though each tile is its own channel. Same pattern means the same ticks from the same start, so they stay in step. A shape that is not a rectangle gets a dotted bounding box. The open row has a line of frames per tile, and a pattern, tick, countdown or frame change applies to every tile in it.

## [0.114.0] — 2026-10-02

### Added: sets of animated tiles on one timing, copy and paste; vanilla patterns for every ROM channel

- **Sets.** Dragging a rectangle with the pencil on the Animation tab makes one animated tile per cell, all on one timing, a 2×2 fan for instance. The open row shows each cell's frames on its own line; tile each one with the pencil. A pattern, a tick, the countdown, `+ Frame` or `− Frame` changes every tile in the set. A set is one row.
- **Copy and paste.** On the Animation tab, Cmd/Ctrl+C copies the open animated tile (or set) and Cmd/Ctrl+V puts a copy where the pointer is. Copies change together with the original.
- **Vanilla animations are never `custom`.** The vanilla index kept one cycle per graphic, so a room running a second cycle through the same graphics (lava's 4410 runs in five) had no patterns for it. 167 of the 1020 channels in the ROM read as `custom`. Every cycle is kept now, and a new ROM test checks that every channel finds its own pattern.
- **Long lists are fast.** Each row drew a full copy of the map as its thumbnail, and each row re-scanned the map to find out whether it was open. With more than 12 rows the thumbnail is the room's outline, and the open row is found once.
- **Clicking an animated tile on the map selects its row**, on a locked (vanilla) map too, and scrolls the row into view.

## [0.113.2] — 2026-10-02

### Fix: drawing into a new animated tile on a custom map; one row per placement

- **Tiling a new animated tile on a custom map works.** An untouched cell has no stamp, and the tile was dropped from it the moment frame 0 got a tile (0.113.1 looked for a floor stamp that custom maps never have). The rest of the stroke then painted the map beneath, which is why the tile went under the purple box, survived deleting the animation, and frame 1 drew beneath again. The cell now takes the tile as the empty stamp, blank on both layers, and a stroke begun on an animated tile never runs on into the map. Erasing it leaves the cell empty again.
- **The Animation tab lists every placement**, not every channel: each run of touching cells showing an animated tile is its own row (`2 of 6`), with its own position and cell count. Copies share frames and ticks.

## [0.113.1] — 2026-10-02

### Fix: new animated tiles on a custom map's empty cells, frame swatches, tick fields

- **A new animated tile stays on the map once its first frame is tiled.** On a custom map an untouched cell has no stamp, and placing the tile there wrote nothing: tiling frame 0 cleared the purple cell and left the tile with 0 cells, so its border went and frame 1 could not be drawn. Such a cell now reads as the map's floor. Taking an animated tile off a custom map's cell also put back the wrong word.
- **Custom maps save their animated tiles** (`anims` in map.json); they were lost on reload.
- **A frame not on its family's sheet** (the beam's last frame) is drawn as the map renders it, instead of an empty box.
- **Tick fields fit four digits**: no spinner, a little wider.

## [0.113.0] — 2026-10-02

### Changed: drawing into animated tiles, merged frames, previews from the map, Animation marks

- **Drawing into frames works like the cuttable layer.** A frame is one graphic, not a stamp. The Tile tab's pencil on a cell of an unfinished animated tile puts the tile into its open frame (else its first empty one) instead of into the map beneath it. The frame you are looking at is drawn over the cell, above the canopy; an empty one is a purple box.
- **Frames holding one graphic in a row are one frame**, with their ticks added up (the 24-frame mushroom reads as 6). A frame holds at most 127 ticks in the ROM (vanilla's maximum, checked over every room), so a longer hold is stored as several frames; the export clamps to 127.
- **Previews show the tile as the map does**: its first cell's own stamp, both layers, its flip and its ticks, paused or off as the map is. The beam and the fire drew from the family sheet before.
- **`Animation` chip in the filter bar** (default on, saved): a violet border and the pattern letter (`*` for custom ticks) on every animated cell, on any tab.

## [0.112.1] — 2026-10-02

### Fix: Animation tab previews, letters, and drawing a new animated tile

- **Previews draw again.** An animated tile placed from a ▶ swatch never recorded its palette, so its row (preview, frame chips) had no family sheet to draw from. The family is now read off the first cell showing it.
- **Patterns are letters.** The pattern chips show A…M only; the ticks are in each chip's tooltip.
- **The tile list shows the pattern a pick places**, as a violet letter (B for a beam whose family runs B most) instead of `▶4`.
- **The pencil starts a new animated tile** anywhere but the open tile's own cells, and opens it. Before, with a row open, it placed another copy of the open tile (a torch) where you meant a new one. To place more copies of a tile, arm its row's `place` button. The hover ghost on this tab is a violet box, not the Tile tab's brush.

## [0.112.0] — 2026-10-02

### Changed: an animated tile is a channel — one row each, painted as empty purple frames, vanilla patterns lettered

- **An animated tile is one channel.** The Animation tab lists every animated tile on the map, one row each. Closed, a row shows where the tile is in the room, a live preview, and its pattern: A, B, C… for vanilla's patterns, `custom` otherwise, or how many of its frames are tiled yet. Open, it shows the patterns, then each frame with its ticks. The groups of channels from 0.110–0.111 are gone. A ROM room's channels are each their own row, locked, with their own timing.
- **Painting animated tiles.** The pencil places a new animated tile as empty purple frames, wherever you drag. Pick a tile on the Tile tab and click one of its cells to tile the open frame. It animates (and gets a channel) only once every frame has a tile. With a tile open, the pencil places it elsewhere, like a tile. The eraser takes it off a cell. `+ New animated tile` closes the open one.
- **▶ swatches are the same thing, ready-made**, at the pattern their family runs most. Vents in family 291 get B (`6 6 6`), in 220 A (`1 1 1`). `vanilla-animation.ts` now tallies every pattern per family; family sheets carry the pick.
- **Vanilla's patterns are lettered** in one global order, most-used first. A tile shows the letter its ticks match. Patterns are offered only for frames vanilla runs.
- **Vanilla animated tiles are locked** to their frames until disbanded, like a placed widget. Ticks stay editable.
- **Animation: on / off**, map-wide and saved. Off shows every animated tile on frame 0.
- **Violet** (`--rg-anim`) marks everything animated: rows, letters, the tile list's ▶ mark, unfinished cells on the map.
- Placed widgets switch pattern on their own (A/B/C chips); other copies keep their ticks.

## [0.111.0] — 2026-10-02

### Changed: Animation tab — one row per animation, timings as chips, vanilla presets, drawn animations are objects

- **Vanilla rooms list their animations again.** Seeding the room's channels waited for an empty list, but the list was made on first use, often before the palette arrived. It now keys on a flag (Volcano Room 2: 5 channels over 200 cells).
- **A rectangle is an empty animation.** The pencil drags out an animation object over any cells, even empty ones, opened on frame 0. Paint frame 0, + Frame, paint the next. A cell gets a slot of its own only where its frames differ from the other cells', and a cell whose frames never change costs no channel. The eraser sets a frame back to the one before it.
- **One row per animation, its timings as chips.** A, B, C… sit under the row's header, always visible; `+` adds a timing to the same animation (it used to add a row). Remove timing takes one off; × stops the whole animation.
- **Vanilla's timings as presets.** The open timing offers every timing vanilla runs exactly these frames at, turned to the timing's phase and marked `v` (the Antiqua torch: `5 5 5 5 3 3` on 17 channels, `7 7 7 7 7 4`, …). A timing chip whose ticks are vanilla's is marked too. Frames vanilla never runs get no presets. (`vanilla-animation.ts` keeps every timing per cycle; the family sheets carry them.)
- **Draw what you see.** An open timing, paused, shows the frame being drawn on the map; ▶ Play runs it.
- A ▶ tile picked while a timing of its animation is open joins that timing.

## [0.110.0] — 2026-10-02

### Added: the Animation tab; a frame picked on its own stays still

- **Animation is per slot, and only where an animation says so.** In the game a Section 2 channel swaps the graphic in one tile slot, so every tile on that slot moves together. The editor now keeps it that way (`map-editor-animations.js`): a slot animates exactly while an animation group lists it. Before, any graphic vanilla animates played wherever it was placed. That was the "frame 2/3 still animates" bug: a frame picked in the Tile tab's `frames` view now lands in a still slot, and a ▶ swatch in the `anim` view in a slot of its own that moves at vanilla's timing. One graphic can sit in several slots (still, timing A, timing B), as vanilla does.
- **The Animation tab**, after Collision. One row per animation on the map, named by its lowest graphic and its timing letter (A, B, C…). The open row is the timing editor: each frame's hold in 60 Hz ticks, the initial countdown, + Frame / − Frame, and **New timing** (the same animation on slots of its own). The pencil drags out a rectangle that becomes a new animation (the top art of each cell moves to slots of its own, so the rest of the map stays still), and with a row open on frame 1 or later it paints that frame. ▶ tiles from the Tile tab appear here while they are on the map. The tab shows the channel count against 42, vanilla's most.
- **Vanilla rooms list their own animations**: the room's channels, grouped where their cells touch and their timing matches (a torch's two halves, a pool of water), with the same animation at another timing as another letter.
- **Placed widgets get timing chips** (A/B/C) beside their colourings, to move a placed torch onto another timing.
- **The widget timeline is gone.** A widget is its cells. Each part keeps the channel its art moved on (`anim`), and stamping it brings that animation into the map's Animation tab. Vanilla objects cut from rooms keep their parts' channels too.
- **Host:** the canvas renders the channels it is told (`channels` on the composed preview; a ROM room's own channels by default), and Export ROM writes exactly the draft's channels, with their delays and initial countdown (`planCustomAnimation` explicit channels). A draft from before falls back to vanilla's cycles.
- The tab strip spreads its eight tabs across the dock instead of overflowing it.

## [0.109.0] — 2026-10-02

### Changed: widgets lose hand-made variations; animation is opt-in; colourings recolour every state and frame

- **No more `+ Var` / Duplicate / Swap Family / ✕ Var.** A widget is its own frames (`frames`, `animated` in `widgets.json`); its colourings are derived from its art and never stored (`map-editor-widget-colours.js`). A library saved with variations keeps the first one with art; empty and generated ones are dropped on load.
- **Animation: off / on.** A new widget has no frame timeline. The switch in the widget's app bar shows it; switched off, the widget stamps its first frame and its other frames are kept for later.
- **A colouring recolours everything.** Switching a placed widget's colouring now recolours every object state (the gourd's lit state too) and every animation frame, not only the stamped tiles.
- **Plan for the Animation tab** written down in `docs/animation-tab-plan.md`, with the ROM census behind it and four open questions.

## [0.108.4] — 2026-10-02

### Fix: widget colourings are every family vanilla draws their art in, read from the ROM

- **Union, from the vanilla index.** The host now sends, with the widget library, every family vanilla draws each widget graphic in, with its placement count (`graphicFamilies`, `custom-host.js` → `rendering/vanilla-index.js`). A widget offers one colouring per family *any* of its pieces is drawn in, most-placed first. The 2×2 Antiqua urn has 7 (#127 coloured only its top half, and still counts). The hand-kept `WIDGET_GRAPHIC_FAMILIES` table from 0.108.3 is gone: it could never cover a widget it did not list. The floor fan, for instance, is attested in #220, #291 and #231.
- **Empty variations are not variations.** A `+ variation` never painted (no cell in any frame) is left out of the Placed chips and the library count, except on the widget's own canvas. The floor fan's eight empty B–I chips are gone.
- **Animated widgets keep their frames in every colouring.** Generated colourings recolour each frame of the widget's variation, not only its first.

## [0.108.3] — 2026-10-01

### Fix: placed widgets keep collision and family slots in step with the map; urn colourings are the ROM's

- **Collision follows a placed widget.** Stamping, moving, deleting, reordering or recolouring a widget changes what the map shows without a cell write, so the drafted collision layer was never asked for again until the overlay was toggled. `editEnd` now runs the cells-changed hooks (collision redraw, painted-family sync) whenever the step changed the groups.
- **Variation switch replaces the family.** `placedSetVariation` counted slot usage over the baked map, which still held the widget itself, so the old family never read as free and the new one took a second slot. The widget is now lifted off while its slots are counted; the slots only it used are freed, the new colouring takes one, and the whole switch — slots included — is one undo step.
- **A widget's family leaves with the widget.** Families a stamped widget brings in are adopted as painted families (`editAdoptPaintedFamily`), so they drop out of the strip once no cell names them — deleting the widget frees the slot, undo brings it back.
- **Only attested colourings.** The hand-written variant lists are replaced by `WIDGET_GRAPHIC_FAMILIES`, measured over every vanilla room and checked against `buildVanillaIndex` by a ROM test. A variation needs a family that colours *every* piece of the widget: the 2×2 Antiqua urn has 6 (#127 only ever coloured its top half; #128, #111, #141 never coloured it at all), the smooth Prehistoria gourd has one, and the Gothica barrel has one. Library widgets saved with the old generated lists are trimmed on load; hand-made variations are untouched.

## [0.108.2] — 2026-10-01

### Fix: prevent palette slot exhaustion on placed widget variation changes, restore thumbnails & add 10 urn variants

- **Palette slot management on variation switch (`placedSetVariation`).** Switching variation now reuses the group's existing palette slot if unshared, or allocates an unused slot while actively pruning orphaned widget variation families that have 0 usage across the room. Prevents the 7/7 palette limit from being reached when cycling variants, allowing variants 5 and 6 (and all others) to be selected smoothly.
- **Variation chip thumbnail rendering (`widgetArtStyle`).** Fixed empty / blank chip thumbnails by replacing invalid `background-size: contain` and `background-position: center` rules with `widgetArtStyle()`, correctly positioning and centering sprite-sheet previews into 30×30 chip thumbnails with `data-w` and `data-h` tracking.
- **10 attested Antiqua urn variants (`widgetAttestedFamilies`).** Expanded Antiqua urn attested families to all 10 verified ROM families (`[115, 35, 127, 139, 159, 188, 158, 128, 111, 141]`).
- **Deferred widget preview loading.** Placed list now calls `requestWidgets()` if `_widgets` is not loaded yet, and `ensureWidgetPreviews()` marks only the chunk of 48 actually requested to prevent starvation.

## [0.108.1] — 2026-10-01

### Fix: restore clean widget library cards & move variant preview chips to Placed list

- **Clean My Widgets library cards.** Removed variant preview chips from the Library grid cards (`widgetCardHtml`), eliminating vertical stretching and restoring uniform compact cards with concise variation count badges (`2×2 · 10v`).
- **Object-like Placed Widgets list.** Transformed each stamped row in the Placed tab (`placedRowHtml`) to follow the Object tab card layout:
  - Header row with grip, room position preview, thumbnail, label, caret toggle (`▾`/`▸`), disband, and remove buttons.
  - Expanded section (`.rg-object-expanded .ro-chips`) displaying clickable variation preview chips (`.ro-chip`) with live pixelated thumbnails and family labels.
  - Clicking any chip immediately switches the variation of that placed widget on the map (`placedSetVariation`) in one undo step, recomposing and updating the canvas and chrome.
  - Clean chips layout without extra `+` add or delete buttons.

## [0.108.0] — 2026-10-01

### Feat: clickable widget variant preview chips filtered by contained tiles

- **Clickable variant preview chips.** Widget cards in the Widgets tab now display visual object preview chips (`.ro-chip`) for each variant:
  - Each chip features a live pixelated thumbnail (`.ro-img.rg-widget-var-thumb`) rendering the exact tile palette override and a concise label (e.g. `#166`, `#184`, `#35`).
  - Active/armed variant is highlighted with the `.sel` state.
  - Clicking any chip arms that specific variant for stamp placement immediately without altering the widget pencil mode.
  - Cards stay clean without extra clutter — no `+`, delete, or dropdown select buttons on the card.
- **Attested tile family filtering.** Automatically extracts all contained graphics from saved widgets (such as Prehistoria Gourds or Antiqua Urns) and filters variants to the verified vanilla tile family sets where those graphics appear.
- **Card DOM semantics.** Rendered `.rg-widget-card` as an accessible interactive container (`<div role="button" tabindex="0">`) so nested `.ro-chip` buttons maintain valid HTML and clean pointer-event dispatch.

## [0.107.0] — 2026-10-01

### Feat: unused tile tagging & filter, canopy filter, and dual-layer ground filter

- **Unused tile tagging & filter.** Identified and tagged tiles never placed on any vanilla room grid:
  - Tiles with 0 placements across all 127 vanilla room grids are tagged as unused with a dimmed swatch (`.rg-tile-unused`) and a red `Ø` mark (`.rg-unused-mark`).
  - Swatch tooltip explicitly states `unused in vanilla (0 grid placements)` rather than showing misleading unplaced dictionary entry counts.
  - New **`unused`** filter button in the Tile tab filter bar isolates unused graphics. Families with no unused graphics are skipped without fetching sheets.
- **Canopy filter.** Added a **`canopy`** filter button in the Tile tab to display graphics drawn predominantly in the front / overhead canopy layer over characters.
- **Dual-layer ground filter.** Added a **`2-layer`** filter button for tiles that need 2 layers with no canopy to look complete (metatiles where both Layer 1 and Layer 2 are used with sprite priority 1 so characters walk in front of both layers).
  - Dual-layer ground tiles feature a dual-toned border (`box-shadow: inset 0 2px 0 #7ecbd0, inset 0 -2px 0 #b58a4a`) and a `2L` mark (`.rg-dual-mark`).
  - Swatch tooltip indicates `needs 2 layers with no canopy to look complete (dual-layer ground)`.
- **Accurate grid placement metric.** Fixed `buildFamilySheet` and `buildVanillaIndex` so placement counts report authentic placed grid cell totals (`index.cells`), correctly identifying leftover and unplaced metatile dictionary entries.

## [0.106.0] — 2026-10-01

### Feat: widget tile variations and animation timeline with seek bar

- **Tile variations (e.g. gourd A/B/C/D).** Widgets now support multiple variations (named A, B, C, D...) with a dedicated variation bar in the Widget Editor app bar.
  - Quick actions to add blank variation (`+ Var`), clone existing variation (`Duplicate`), swap tile family (`Swap Family`) to recolor every tile in a variation instantly, or delete (`✕ Var`).
  - The Widgets tab library card displays variation chips (`A`, `B`, `C`...), allowing quick selection and arming of any variation.
- **Animation frames & seek bar (e.g. torch A/B/C/D).** A floating animation timeline dock sits at the bottom of the Widget Editor canvas:
  - **Play / Pause button** (`▶` / `⏸`, shortcut: Space): Plays the animation live on the canvas driven by a requestAnimationFrame loop.
  - **Seek bar / scrubber**: Interactive range slider to scrub through animation frames in real time with frame count badge (`1 / N`) and step buttons (`◀` / `▶`, Left / Right arrows).
  - **Delay setting**: Configurable hold delay per frame in 60 Hz ticks (with real-time ms preview, e.g. `8 ticks ≈ 133ms`).
  - **Frame management**: `+ Frame` adds a new frame, `⧉ Clone` duplicates the current frame for subtle animation tweaks (such as torch flicker), and `✕` deletes a frame.
- **Backwards compatibility & persistence.** Widget library storage (`widgets.json`) transparently normalizes legacy single-frame widgets into variation 'A' while persisting all variations, frames, and delay timings cleanly. Stamping an animated widget creates an animated object with all its states.

## [0.105.0] — 2026-10-01

### Feat: prediction modes — relationship +, vanilla examples, and procedural filling

- **Prediction modes toggle bar.** The "likely neighbors" card on the Tile tab now includes segmented buttons to switch between three prediction modes:
  - **relationship +** (`cross`): The directional compass showing likely North, East, South, and West neighbors based on authentic vanilla metatile adjacency and Jaccard co-occurrence scores.
  - **vanilla examples** (`examples`): Authentic scenarios where the tile appears across the 127 vanilla rooms. Each card displays room name, area, layer, occurrence count, and an interactive 3×3 surrounding context patch with controls to pick neighbor tiles, arm the entire 3×3 patch as a multi-cell stamp, or jump directly to the room in the editor.
  - **procedural filling** (`fill`): Procedural patch generation using directional Markov transitions weighted by adjacency. Features a **⟳ re-generate** button to cycle combinations, 3×3 and 4×4 size toggles, tile picking, and an **arm stamp** action to paint the generated cluster onto your map.
- **Pure generator & engine index.** Implemented pure TypeScript `proceduralPatch` in `src/maps/vanilla-procedural.ts`, along with `vanillaExamples` and `proceduralFill` helpers in `src/rooms/rendering/vanilla-index.js`.

## [0.104.0] — 2026-10-01

### Feat: one collision pen that draws and carves into the predicted collision

- **One pen instead of two modes.** The Collision tab's list starts with the **8px pen**, which is armed by default. Whatever is armed shows in miniature under the pencil in the tool bar.
- **The pen works on the collision each cell already has**, whether that's the predicted collision or a shape you set. Left-drag draws 8px squares; **right-drag carves** them away. Carve one corner off a solid wall and you get a 45° slope; carve everything and the cell is open. Draw a cell back to its prediction and its override disappears.
- A cell only takes on a drawing that matches a real collision tile (open, solid, a half, an L for 45°). A lone corner or two opposite corners stay drawn with a "?", and the cell keeps its own collision.
- **Picking a shape** sets whole cells; right-click with a shape makes a cell open. **The eraser** returns cells to their predicted collision.
- **No more slide/stop toggle.** A drawn diagonal keeps the variant the cell already had, otherwise the one vanilla uses most. The variants can still be picked from the shape list.
- The tab now shows what each mouse button and the eraser do, in place of the long explanation.

## [0.103.2] — 2026-10-01

### Fix: a drawn L shows as its 45° collision tile

- **When a drawing matches a collision tile, the cell now shows that tile**: an L of three squares shows as its 45° diagonal, with your squares traced faintly on top. Before, the editor did detect the match but still showed only the squares, so nothing ever looked like a diagonal.
- **A drawing that matches no tile is now easy to tell apart**: grey squares with an amber dotted box and a "?". It used to be marked in red, the same colour as level 1, so it looked just like a match. The hover preview uses the same look.

## [0.103.1] — 2026-10-01

### Fix: Draw 8px is a pen — the drawing stays as drawn and applies only where it matches a tile

- **What you draw stays exactly as drawn**, 8px square by 8px square. A cell's collision changes only while its four quarters match a real collision tile: all four (solid), two along a side (half), or an L of three (45°). Anything else stays on the map, marked in red, and the cell keeps its own collision: a lone corner, two opposite corners, or nothing left after erasing. Before this fix, every stroke was turned into a shape straight away, so a single corner became a diagonal.
- The eraser removes single 8px squares. Drawing over a cell set with Shapes replaces that shape, and picking a shape over a drawing replaces the drawing; each is one undo step. Cells drawn with 0.103.0 count as picked shapes, and the pen or eraser clears them the same way.
- The hover preview shows the cell as your stroke would leave it, marked red if that won't match a tile.

## [0.103.0] — 2026-10-01

### Feat: draw collision freehand on the 8px grid; filter to the shapes vanilla uses

- **Draw 8px** (Collision tab): draw collision by filling 8px quarters of a cell, and the editor turns them into the matching shape. Two quarters along a side make a half wall (`_`). Three in an L, or a single corner, make a 45° diagonal. All four make a solid tile. The eraser removes quarters. Two opposite corners don't match any shape the game has, so that stroke is refused with a note. A choice in the tab sets whether diagonals **slide along** or **stop you**. If a cell ends up back at the shape its tile already had, the override is removed. While you hover, the preview shows the quarter you're on and the shape the cell would become.
- **Used in vanilla** filter (top of the Collision tab, on by default): hides the two shapes no vanilla room uses (0x04 and 0x0B). The game's own tables treat both as fully open, so the "half wall" drawing they used to get was misleading. Each shape's tooltip shows how many vanilla cells use it, counted from your ROM.
- **The diagonal twins are now labelled "slides" and "stops"** (for example 0x02 and 0x06). They cover the same pixels, but the game handles them differently: only the "slides" one is set up to push you along the slope. That reading comes from the game's tables and hasn't been confirmed in play.

## [0.102.0] — 2026-10-01

### Feat: a Collision tab to set a cell's shape by hand; Cmd/Ctrl+A selects the whole map

- **New Collision tab, right after Tile.** It lists all 16 collision shapes, each drawn the way "Tile by tile" shows it: the solid pixels in the colour of the level you're painting on. Pick one and the pencil sets that cell's shape, replacing the shape its tile was given. The tile itself is not changed, so erasing the override brings the original shape back. Overrides show on the map while the tab is open or the Collision overlay is on, and they are used by the collision view and by Export ROM. Undo covers them.
  - Six pairs of shapes cover exactly the same pixels (0x02/0x06, for example), and nothing documented says how the two differ, so both are listed and each says which one it matches.
  - An override replaces the shape and turns off "always walkable" (stairs and drift). The cell keeps its level, gate, see-through and interact settings.
- **Cmd/Ctrl+A selects the whole map** with the copy tool; Cmd/Ctrl+C then copies it. This also works on a locked map.
- **Cut grass no longer hides the grid.**

## [0.101.0] — 2026-10-01

### Fix: disbanding a widget keeps its look; resize and family slots are undoable

- **Disbanding a widget no longer changes what the map shows.** A widget stamped on top of another one (a gourd on a pasted floor) used to lose its art and leave bare floor. It now stays exactly as it looked. The widget underneath gives up the cells it shared, since the map holds them now. Checked against every widget on your test map: the picture is identical before and after.
- **A placed widget's tiles can't be erased until it is disbanded**, the same as its triggers and objects. The eraser says so, and its preview shows nothing to erase there.
- **Resizing a map can be undone and redone.** Undo also puts the Boy back if the shrink moved him.
- **Removing a tile family (✕), or putting one back, can be undone and redone.**
- Renaming a map or widget, and view choices (tool, tab, level, filters, which object state is shown), stay out of undo on purpose.

## [0.100.0] — 2026-10-01

### Feat: see-through tiles in the Special tab; vanilla grass shows what is beneath it; freer panning

- **New Special: Level › See-through** (collision bit 6, `T`). A see-through tile can be walked through from any other level, and standing on it keeps the level you are on. Vanilla rooms show their own see-through cells with the same `T`, and the Special filter can hide them. These are the purple cells in the collision overlay. The amber rungs are not a setting: they appear wherever two levels meet, so you get them by painting levels with the bar on the left.
- **With Cuttable off, a vanilla room's grass shows the tile under it**, the tile the game swaps in when the grass is cut. This already worked on custom maps; turn Cuttable on to see the grass again.
- **Item icons sit in the middle of their trigger.** The game's art fills only the top-left of its 16×16 frame, so icons used to look shifted up and left.
- **The map can be dragged out from under the tools.** Any edge can now come as far as the middle of the view, at any zoom. Fit still centres the map.
- **An object's states no longer hide the grid.** The grid is drawn back over its tiles, and the 8 px / 16 px grid toggles still apply.

## [0.99.0] — 2026-10-01

### Feat: rename a custom map in place; Escape puts down what you are stamping; a clearer ⋯ menu

- **A custom map's name is a text box on its name line**, like a widget's. Type to rename it; the list on the left updates as you type. Enter or Escape finishes, and leaving it empty keeps the old name. A vanilla room's name is the game's own and stays as it is.
- **Escape puts down whatever is on the cursor.** An armed widget is disarmed and the pencil, stamp or eraser goes back to Select, so the next click changes nothing.
- **The ⋯ menu no longer looks greyed out.** Its items show at full strength as a plain list, with Delete map in red.
- **Discard draft and New room… are gone from the ⋯ menu.** Use undo to take changes back, and `+ New Map` to start a map.

## [0.98.1] — 2026-10-01

### Fix: a widget with no visible tile can be stamped

- **Stamping a widget that has no tiles now places what it carries.** A sniff spot (a B-trigger and a two-state object on an invisible cell) used to leave nothing on the map. Its trigger and object now land where you click.
- **Such a widget is selected, moved and deleted by its box,** since it has no tile to click. It cannot be moved off the map.

## [0.98.0] — 2026-10-01

### Feat: the map editor previews every change; widgets edit in the app bar and shrink to 1×1

- **Editing a widget turns the room's name line into its app bar**, the way Android swaps its top bar for whatever you are editing: ← back (saves and returns to the map), the widget's name to edit in place, its size underneath, and Delete where the map's ⋯ and lock usually sit. The banner over the dock is gone.
- **Widgets can be resized down to 1×1.** Rooms still stop at 2×2, the smallest grid the format can encode.
- **Before you click, the map shows what the click will do:**
  - the pencil shows the tile, special or trigger box under the pointer;
  - the stamp tool and an armed widget show the whole widget, drawn at full size;
  - the eraser strikes through what it would remove, or shows only an outline when there is nothing there to remove.
- **Dragging the resize grip outlines the new size** and dims everything outside it, so you see what a shrink would hide before you let go. The grip and its size label follow the pointer.
- A preview never changes the map: it adds no stamps, takes no family slots and adds nothing to undo.

## [0.97.0] — 2026-10-01

### Feat: item icons come from your ROM — ingredients, consumables, armour, alchemy

- **B-triggers show the game's own ring-menu icon** for what they hand over, decoded from the ROM set in `everscript.romPath`. That covers all 22 ingredients (the four without a picture before now have one), plus the 8 consumables and 40 armour pieces, which had no icon at all.
- **Icons are drawn at their true size**: 16px against the map's 8px tiles, as the game draws them, rather than stretched to fill the trigger.
- **The Scaling tab shows each alchemy formula's icon** in its legend.
- **`everscript.assetsPath` is removed.** The extension no longer reads a folder of `.webp` images. Without a ROM, the emoji fallback is unchanged.
- Money, trade goods and charms still have no icon: the ring menu has none for them.

## [0.96.0] — 2026-10-01

### Feat: Widgets › Placed — what you stamped, in draw order, with disband

- **The Widgets tab has two tabs: Library** (the widgets you can stamp) **and Placed** (the ones stamped on this map, empty at first).
- **Placed rows** show where each sits in the room and how it looks, with its size, position, triggers and objects. Click a row to select it on the map.
- **The list is the draw order**: a later row is drawn over an earlier one where they overlap. Drag a row by ⠿ to reorder (one undo step).
- **× removes** a placed widget with its triggers and objects.
- **A placed widget's triggers and objects are locked to it**: deleting or moving its trigger, or removing or editing its object, says so instead.
- **Disband** writes the widget into the map and lets its triggers and objects go, to be edited on their own (one undo step).

## [0.95.1] — 2026-10-01

### Fix: stamped gourds losing tiles and floor

- **A stamped or moved gourd no longer loses tiles or its floor.** Its tiles are made on the fly, after the preview sheet had been asked for, so they drew as nothing. The sheet is now asked for them first, and again whenever drawing needs one it lacks.
- **Stamped objects stack**: a gourd stamped onto a pasted floor sits on that floor, not on the bare map under both.
- **Opening a map saved before v0.95.0 lifts overlapping stamped objects correctly.** v0.95.0 lifted them one by one and garbled where they overlapped; cells an old stamp never changed are dropped, so they no longer override collision.

## [0.95.0] — 2026-10-01

### Feat: a stamped widget is kept apart from the map, and baked in only on export

- **A stamped gourd no longer changes the map under it.** A placed widget (or pasted region) is stored as its own layer over the map: the floor, the hut, whatever it sits on stays exactly as it was. Moving it, deleting it, or painting the floor under it never disturbs the other.
- **What shows is composed on the fly**: the widget's own art over the map's cell, on the map's floor and level. Its object's states (a broken gourd) sit on that floor too — no black floor carried along from where the widget was cut.
- **Only the exports bake it in** (Export ROM and the JSON handoff).
- Copying a stamped object, or keeping it as a widget with "+ From selection", keeps its own cells, not the floor it happened to be on.
- Maps saved before this lift their stamped objects back out of the map when opened.

## [0.94.1] — 2026-09-30

### Fix: a stamped object sits over the map instead of replacing it

- **A stamped gourd keeps the floor it lands on.** It showed its frame 1 by default, which carried a blank (black) floor from the widget; objects now show **state 0** until a state is picked, and a frame's blank floor becomes the floor under it.
- **Moving a stamped object takes the floor of where it lands**, for state 0 and every other state, and puts the old floor back. Before, the gourd dragged its old floor (and state 0's look) along. It also lands on that floor's level, as a fresh stamp does.
- So a hut with three gourds stamped into it: the gourds can be moved or deleted without disturbing the hut.

## [0.94.0] — 2026-09-30

### Feat: the lock and ⋯ on the room's name line, loot quick filters, resize that keeps what it hides

- **The lock and the ⋯ menu live on the room's name line**, at its right end (⋯ left of the lock), not on the tool pill: they act on the map, not on a stroke. The ⋯ menu opens downwards, right-aligned.
- **"Loot only" quick filter** on the Trigger and Object tabs, with a count — shown when the room has any loot (gourds, chests, sniff spots). Filtered rows keep their table number.
- **Resize:** the grip sits on the map's own bottom-right corner at any zoom (it was placed against the view), shows only on a drafted map and not while it is locked. Making a map smaller no longer deletes the cells past its new edge: they stay in the draft, undrawn and not encoded (the ROM export reads the grid; the JSON export skips them), and come back if the map grows again. The drag label says how many it hides.

## [0.93.0] — 2026-09-30

### Feat: the lock moves to the tool pill; locking greys out the editing tools

- **The lock is a padlock at the tool pill's right end** — shut and amber while locked, open while not — instead of a "locked" chip in the filter bar.
- **Locked, the tools that change the map go dark:** pencil, eraser, move, stamp, undo/redo and the level bar are disabled; select, pick and copy still work. Locking puts the pencil down (back to Select), and anything that would arm it while locked — a tile or special picked, a widget chosen — falls back to Select.
- **The level bar sits against the map's left edge.**

## [0.92.0] — 2026-09-30

### Feat: the map fills the editor; loot on object rows; a one-line filter bar

- **Object rows say what they hand over:** the Everscript call of the trigger whose loot names the object by number (`_loot_chest(0x01, WAX, 0d01);`), coloured like the Trigger tab's.
- **The map fills the space between the bars.** The canvas card is gone: the viewport runs from the name line to the status bar and from the rooms list to the dock, and "fit" fits the map to it (live — it refits as the window or a column handle changes it). The bars float in front of the map: tools at the top, levels against the right edge, filters at the bottom, the zoom chip top-right. The resize grip rides the map's own corner.
- **The status bar is a flat strip** across the bottom of the map column.
- **The filter bar is one line:** *BG* / *FG* for Background / Foreground, and *Interact* moved into the Special menu.

## [0.91.0] — 2026-09-30

### Feat: readable trigger scripts, map labels for triggers and objects, dock to the top

- **Pickups as Everscript:** a collapsed trigger row shows the call that writes its loot (`_loot_chest(0x03, OIL);`) instead of just the item name.
- **Coloured script lines:** numbers and addresses (`SKIP 19`, `$2273`, `0x94e65d`, `0d01`), quoted names, the leading keyword and the Everscript function each get their own colour; the note that ends a line (`(to 0x94e65d)`) is dimmed, a condition mid-line is not.
- **One instruction, one row:** a wrapped line hangs under its first and rows alternate their background, so a long instruction no longer reads as two.
- **The dock runs to the top:** the room's name line heads the map column, not the whole page.
- **Triggers menu:** *Type* (the B/S letter, on) and *Script ID* (the script each box runs, in hex, off), drawn small in the box's first cell on the special glyphs' 3×3 grid.
- **Objects menu:** *ID* (the number a script's `SET OBJ` names, top-right of the area) and *Sub-frames* (where each changed state draws, for every object), both off by default.

## [0.90.0] — 2026-09-30

### Feat: the editor takes the whole Rooms tab — scripts in the trigger rows, nothing under the map

- **Nothing under the editor.** The data column under the map is gone. Redundant sections were removed: the old tile palette, the trigger tables, the ROM-scripts meta row, the source objects table and object-state browser, the ROM header table (which also carried wrong labels, e.g. TM `$16` as "the Oglin cave variant"), and the summary strip. What the editor has no place for yet was parked in `sandbox/room-data/` with a README: sprite palettes, the `.evs` source tables (entrances, enemies, objects, transitions), the ROM feature table and legend.
- **Trigger scripts in the Trigger tab.** Rows start collapsed and say what their script does when the decoder recognised it (loot, the room it leads to, NPCs it places); ▸ opens the script as one summary line per instruction, with door destinations as links. Placed triggers find their script by id. The emulator's current-instruction highlight lands on these lines.
- **Enter tab** beside B and Step-on: the room's enter script, shown, not drawn.
- **Full-height layout:** the dock runs the whole height and scrolls inside; the filter and status bars sit at the bottom of the screen; the page itself no longer scrolls.
- **Resizable columns:** drag the handle between the rooms list and the editor, or between the map and the dock. Minimum widths 160 / 300 px; remembered across sessions.

## [0.89.0] — 2026-09-30

### Feat: Header edits show at once; trigger and object lists follow the lock

- **Header changes redraw immediately:** main screen, sub screen and colour math decide how every stamp's layers composite, so a change re-renders the room image, the palette's stamps and the draft's own stamps with the edited header (`rendering/header-overrides.js`, threaded through `buildRoomTileOverlay`, `buildRoomMetatilePalette` and `buildComposedPreview`). Undo and redo redraw too. The palette refresh replaces only its picture, so a custom map keeps its own grid.
- **Locked maps:** trigger rows, like object rows, lose their grip and remove button and no longer drag; reordering a trigger is refused with a note.
- **One border per object:** the card frames its row and its state chips together.
- **Sizes read "2×3 tiles"** on trigger and object rows; an object's position moves to its tooltip.
- **Fix:** an object's open/closed state was kept by uid alone, and uids restart in every map — closing object 5 in one map collapsed object 5 in the next. It is now kept per map.

## [0.88.1] — 2026-09-30

### Fix: Info tab header — compact when unlocked

- Unlocked, each header field is one line: its label, and its controls on the right. The lit chips and the selects' choices are the value; the words ("Front · Ground · HUD · Sprites") move to the row's tooltip. Locked maps keep the words in place of the controls.
- Size and trigger origin share one row.

## [0.88.0] — 2026-09-30

### Feat: Object tab drawn like the trigger lists

- **Rows as the Trigger tab draws them:** grip, where the object sits in the room (its area lit), how it looks on the map now, `#n · size at x,y`, remove. Drag a row by ⠿ to reorder (one undo step); the ▲▼ buttons are gone.
- **Sniff spots collapse:** an object whose states all look the same (same front and ground art in every state — e.g. 31 of room 0x4B's 32 objects only clear the interact bit) starts collapsed and says "no change". Every other object, and the selected one, starts open; the caret overrides either way.
- The "State 0: Base look (loads with room)" caption is gone; the chips say it.
- Locked maps: no grip, no remove, and removing, adding or reordering frames is refused with a note.
- The list moved into its own file, `map-editor-object-list.js`.

## [0.87.0] — 2026-09-30

### Feat: Info tab redesign — header first, in words; measured rows as bars

- **Order:** Header, Capacity, Map, Checks.
- **Header in words:** layers read Front · Ground · HUD · Sprites (BG1–3/OBJ), colour math reads "Subtract on Ground · Sprites", the blend source "sub screen, everywhere", and the effect by name (None, Lantern mask, Layered canopy, Arena, Heat shimmer — only the variants vanilla rooms use, each named after what those rooms do). Register and raw value are in the tooltip.
- **Locked maps** show the values as plain text instead of dimmed disabled chips; the controls (layer chips, mode/source/region/effect selects, parameter input) sit under each value only while unlocked.
- **Map section:** the same rows as Capacity, with bars in green (readings, not budgets) instead of a tinted card of plain numbers.

## [0.86.0] — 2026-09-30

### Feat: Info tab — the map's measured facts and the room header (editable)

- **MAP section** (its own tinted card — readings, not budgets): drawn cells, walkable / partly solid / solid, canopy coverage, levels, cuttable, drift, stairs, gated and interactive cells, objects — counted off the map as it is now.
- **HEADER section:** origin and size (set by the map), then the fields the map does not decide — main and sub screen layers (TM `$212C` / TS `$212D`, as BG1–4/OBJ chips; BG1 is the foreground), colour math (`$2131`), colour window (`$2130`), effect variant and the 16-bit parameter at bytes 9–10. Editable when the map is unlocked, one undo step per change, saved with a custom map, written by Export ROM (`applyHeaderOverrides`) and carried by the vanilla draft's export.
- **Triggers:** shown as counts with the bytes they take. The step-on and B tables have 16-bit byte lengths and the engine walks them with a 16-bit index (`$8FAC84`); what is 8-bit is each box's coordinates — 0..255 cells from the origin — so no count ceiling is drawn.
- The Info tab moved into its own file, `map-editor-info.js`.

## [0.85.0] — 2026-09-30

### Feat: Two-finger panning, the Info tab as the mock draws it; fix the deflect filter

- **Two-finger panning:** a plain two-finger scroll over the map pans it while it is bigger than the view (a pinch still zooms); at fit, or at the map's edge, the panel scrolls as before. Zoom and pan moved into their own file, `zoom-pan.js`.
- **Info tab redesigned** to the mock's inspector: a CAPACITY section — label, `used/max · pct%` in mono and a thin bar that warns when full — and CHECKS as dot-and-line rows. Only attested ceilings get a bar (7 families, 264 graphics, the 32 KB WRAM window); stamps, room size and triggers are counts, not the mock's placeholder `/128` and `/16`. Families are the draft's own, so the tab agrees with the Tile tab (it read 7/7 on a six-family room). "No brush selected" is no longer listed as a check.
- **Deflect filter:** a tile was flagged when any single vanilla placement had bit 8 set — blank canopy art over gated cells, grass gated once somewhere. A flag now needs most of the graphic's placements on a layer, and deflect is the Special tab's Deflect (gate nibble 1), not the boy/dog walls. The drift and interaction filters use the same majority rule.

## [0.84.0] — 2026-09-30

### Feat: Every map opens in the editor; vanilla maps open locked

- **No `edit` button:** every map opens in the editor. The bar's `locked` is the one switch: a vanilla (or .evs) room opens locked — look, pick, copy and select, but strokes, undo, paste, delete and the dock's changing buttons are refused — and unlocking lets its draft change. A custom map opens unlocked.
- **Tile families follow the lock:** an unlocked map with a free slot lists every family again (v0.83.2 limited it); a locked map lists only its own. The free slot's `+` scrolls to the other families.
- **Eraser really erases:** one click ran the eraser on down *and* up, so the second pass took the rest of a layered cell and put a vanilla cell straight back. Each cell is now erased once per gesture.
- **Bar chips on vanilla maps:** Triggers now hides the loot icons with their B-triggers (edit mode had hidden the icons outright), Cuttable marks the room's own cuttable grass, and the baked grass outlines leave the render while editing. Special and Interact work because the editor always draws them now.
- New `editEraseCells` (map-editor-phases.js) holds the eraser's per-cell pass; map-editor-rules §1, §3, §7 updated.

## [0.83.2] — 2026-09-30

### Fix: Tile list limited to the room's families, front/ground erasing, New Map reuse

- **Tiles limited to the chosen families:** the Tile tab lists the draft's own families (and one a pick has planned a slot for), even when a slot is free. A free slot used to list all ~320 other families unasked — room 0x33 has six. The free slot's `+` (strip and card grid) now lists the others on request; it was a dead button before. A map with nothing loaded (a new custom map) still lists everything.
- **Eraser front/ground:** the Tile tab's `front` erases only front art and `ground` only the ground again — v0.83.1 left only the bottom bar's layer toggles, which do nothing visible on a custom map or widget. `auto` keeps smart erasing: top-most layer first. A stroke with nothing on the chosen layer no longer writes the cell.
- **New Map reopens the untouched map:** `> new map` reaches a freshly built panel before it has asked for the saved maps, so it saw an empty list and made another "New map 1" each time. It now asks and waits.

## [0.83.1] — 2026-09-30

### Fix: Smart erasing — the top-most visible layer goes first

- **Erase reads what is shown, not the Tile tab's front/ground pick:** `editEraseLayers()` (map-editor-phases.js) follows the bottom bar's Background/Foreground segments again, replacing v0.82.10's `_layerForce` (the pick for how a *new* tile is placed) as the eraser's switch.
- **Both layers shown (the default):** the front art goes first where a cell has any, restoring the floor's collision under it; a second stroke takes the painted tile itself back. Foreground only takes just the front art; Background only takes the ground, keeping any front art.
- **Gestures:** map-editor-gestures.js writes the resolved stamp as before; tests updated to the top-most-first behaviour.

## [0.83.0] — 2026-09-30

### Fix: Vanilla rooms connected to the map editor

Editing a ROM room now looks and behaves like editing a custom map.

- **Palette leak:** a custom map's palette keeps its donor's `roomId`, so opening the donor as a vanilla room reused it — the custom map's grid, size and families (the "6/7 active" with a `?` family, and every family listed as a candidate). It is now marked `customBlank` and refused by `mtPaletteFits`. The Tile tab also redraws when the palette arrives instead of staying on "loading the tile palette…", and `editFamilies` no longer caches an empty list asked for before then.
- **Triggers in the right place:** ROM trigger records count from the header's origin and end exclusive. The palette handed them over raw, so every box sat `originX, originY` cells off and one cell too big (room 0x38's gourd triggers were out in the canopy, and the Trigger tab previews were black). They now arrive as inclusive map cells; copying a room and saving constructs read them that way. The deco catalogue had the same misreading: 188 of its 532 objects (not 68) carry their B-trigger, 123 covering the object exactly.
- **Objects listed and editable:** a vanilla room's objects join its draft once, each with its whole area (the union of its deltas, not the first one's footprint) and its states as frames, built from the XOR deltas (`editorObjects`). They export as `roomObjects`, not as new attachments. Copy Map keeps their frames.
- **Specials as on a custom map:** while a ROM room is edited its drift, stairs and gate bits show with the Special tab's own glyphs, read off each cell's collision word, instead of the old baked arrows and borders. The Special tab gains the four diagonal drifts and "walkable" (nibbles 3..7) — vanilla places all of them (§6 of the collision doc).
- **One copy of everything:** in edit mode the render leaves out its baked drift, gates, objects, triggers and labels; the editor draws them, so a moved or deleted trigger is gone from the picture. Objects and glyphs draw above the canopy layer that hid them.
- **Grid:** covers the map only, counted from its corner, as on a custom map. It ran one 8px strip past the map on 54 of 126 rooms.
- New `map-editor-romroom.js` holds the vanilla-room pieces; `map-editor-rules` §7 records the rules.

## [0.82.10] — 2026-09-30

### Feat: Right panel layer-force aware eraser (FG-only, BG-only, and auto erase)

- **Layer-force aware eraser tool:** In `src/rooms/webview/map-editor-phases.js`, updated `editEraseLayers()` and `editResolve()` to respect the right panel's layer control (`_layerForce`):
  - When set to `front` (`'canopy'`), the eraser removes only foreground (canopy) art, preserving background terrain and restoring walkable floor collision.
  - When set to `ground` (`'terrain'`), the eraser removes only background (terrain) art, preserving foreground canopy art. If the tile has no canopy art, it clears the cell.
  - When set to `auto` (or `null`), the eraser erases both layers at once (`EDIT_ERASE_CELL`), allowing one-stroke clearing.
- **Idempotent erase gestures:** In `src/rooms/webview/map-editor-gestures.js`, guarded against redundant draft writes and history pushes when clicking an eraser on a cell whose selected layer is already bare (`finalIndex === here`).
- **Tests:** Updated `tests/memory/map-editor.test.js` and `tests/memory/map-editor-dom.test.js` to verify FG-only, BG-only, and auto erasure through both `editResolve` and `editStroke` gestures.

## [0.82.9] — 2026-09-29

### Fix: Selection overlay layer order, gesture edge clamping, async room duplication, and persistent object active frame

- **Top-level selection overlay (#rg-edit-overlay):** In `src/rooms/webview/map-editor-paint.js`, created a dedicated `#rg-edit-overlay` group appended as the last child of `#rg-svg` (above `#rg-fg` Mode 1 priority foreground tiles, `#rg-canopy-ov`, and all map layers). Selection rectangles (`.rg-edit-sel`), trigger drag outlines, group outlines, and paste ghosts now render strictly on top of priority tiles and canopies.
- **Gesture edge clamping and pointer events:** In `src/rooms/webview/map-editor-gestures.js`, clamped `cell.x` and `cell.y` to map boundaries during `move` and `up` phases so mouse gestures moving past room edges do not abort and drag selections finalize cleanly. In `src/shared/shared.css`, added all `[class*="svge-"]` elements to `pointer-events: none !important;` during editing to prevent vanilla SVG layers from intercepting mouse clicks and drags.
- **Async vanilla room copying:** In `src/rooms/webview/map-editor-custom.js`, `detail-renderer.js`, `map-editor-ui.js`, and `metatile-palette.js`, fixed `_mtPalette` tracking across rooms. When copying a vanilla room whose metatile palette is not yet cached or loaded, `customDuplicateMap` requests the palette and triggers `customCopyMapReady()` when the dictionary arrives, successfully populating all cells and attachments instead of creating a blank map.
- **Widget creation on vanilla rooms:** In `src/rooms/webview/map-editor-widgets.js`, added a readiness check for `_mtPalette` and immediate UI panel re-rendering on `widgetStore`, allowing "From selection" widgets to be created seamlessly from vanilla rooms like Strongheart's Hut.
- **Persistent object active frame:** In `src/rooms/webview/map-editor-objects.js` and `map-editor-paint.js`, tracked `o.activeFrame` on each object instance. In `editObjectSvg`, unselected objects now default to rendering their active frame delta tiles (or Frame 1 when delta frames exist) instead of falling back to State 0 until the Objects tab is clicked.
- **Tests:** Added unit test coverage in `tests/memory/map-editor.test.js` verifying out-of-bounds gesture edge clamping, unselected object delta rendering, and deferred vanilla room duplication.

## [0.82.8] — 2026-09-29

### Fix: Box-select sticking under overlays, Copy Map action, and selection widget creation

- **Box-select overlay interception fix:** In `src/rooms/webview/map-editor-paint.js`, `map-editor-groups.js`, `map-editor-objects.js`, and `src/shared/shared.css`, added `pointer-events="none"` to `#rg-edit`, `.rg-edit-sel`, `groupBoxSvg`, `.rg-obj-area.rg-obj-cluster`, `.rg-obj-frame`, and `.svge-romobj` during editing so rubber-band box selections drag cleanly across placed groups and objects without pointer capture interruption.
- **"Copy map" action:** Added "Copy map" button to the ⋯ More dropdown menu (`map-editor-filterbar.js`) and overflow toolbar actions (`map-editor-toolbar.js`). Handled via `customDuplicateMap()` (`map-editor-custom.js`), duplicating the current room's metatiles, tile families, triggers, objects, and Boy start into a new editable custom map (`_customMaps`) and opening it immediately.
- **Preserve selection on tab switch:** In `src/rooms/webview/map-editor-drawable.js` and `map-editor-input.js`, tab navigation passes `keepSelection = true` to `editDeselectAll()` so `_groupSel` and `_editSel` are not cleared when switching to the Widgets tab. Added a direct "Save as widget" fast-path button on the tool pill when a selection is active.
- **Capture special flags in constructs:** In `src/rooms/webview/map-editor-constructs.js`, `editBuildConstruct` records cell special flags (`specialCells`) into construct cells, and `editConstructWrites` propagates `specials` on placement.
- **Tests:** Added comprehensive test assertions in `tests/memory/map-editor.test.js` covering SVG overlay pointer-events, More menu copy button markup, room duplication with pre-seeded cells and attachments, selection preservation across tab changes, and construct special flag roundtripping.

## [0.82.7] — 2026-09-28

### Docs: todo files — map editor, research topics, copy-room-as-widget

- `docs/map-editor-todo.md` — 17 open items: vanilla sidebar/bottom-bar wiring, widget special-state loss, Select cursor background bug, collision shape picker, PT tile, widget locking, flood fill, animation phase, ROM write-back, trigger UI, room resize, Info tab cleanup, pan-while-editing, all-direction resize, header effect presets, procedural tile fill + cross-map references.
- `docs/todo/research-topics.md` — 8 research topics: audio/SPC + AKAO, slash weapon hitboxes, alchemy scripts, item icons, script simulator, hex editor, on-screen trigger overlay, enemy attribute tab.
- `docs/todo/copy-room-as-widget.md` — 3 bugs blocking "copy Strongheart's Hut as widget": box-select stuck under group SVG rects (`pointer-events` not set to none), Copy Map missing from ⋯ More menu, From Selection clears `_editSel` on tab switch.

## [0.82.6] — 2026-09-28

### Fix: Preview active frame on tile tab, isolate frame specials, copy current frame on +, and export objects to ROM

- **Active frame preview on Tile tab:** In `src/rooms/webview/map-editor-objects.js`, removed tab gating around `curLayer` rendering in `editObjectSvg`. When an object frame is active (`_objectActiveFrame >= 1`), its delta tiles remain visible over the map on `#rg-edit` even when navigating to the Tile tab.
- **Isolated special flags per frame:** In `src/rooms/webview/map-editor-gestures.js`, `editSpecialObjectWrite` records special writes (such as `F0` / `interact-force-0`) into `o.frameSpecials[_objectActiveFrame - 1]` for that frame instead of global `d.specialCells` / `d.cells`. In `map-editor-special.js`, `editSpecialsAt` checks the active object frame's specials first, and in `map-editor-paint.js`, `editSpecialGlyphs` overrides base cell glyphs with `o.frameSpecials`. Toggling back to State 0 restores the base specials without contamination.
- **Copy current frame on `+`:** In `src/rooms/webview/map-editor-objects.js`, `objectAddFrame` clones the currently selected frame's delta tiles (`curFrame`) and specials (`curSpecials`) rather than creating an empty frame that falls back to State 0. Frame reordering (`objectMoveFrame`) and removal (`objectRemoveFrame`) keep `o.frameSpecials` synchronized with `o.frames`.
- **ROM object export (Section 3):** In `src/rooms/webview/map-editor-rom-export.js`, `romExportPayload` resolves each frame's layer1/layer2/collision words into `objects`. In `src/maps/custom-room.ts`, `buildDictionary` registers all object delta tiles into Block 3, and `buildCustomRoomBlob` encodes Section 3 object records and stamp records with XOR deltas (`targetId ^ baseId`) for native `$90A4E8` transition execution. Passed through `src/rooms/rendering/rom-export.js` into ROM blob generation.
- **Tests:** Added comprehensive test coverage in `tests/memory/rom-export.test.js` (verifying Block 3 dictionary registration, Section 3 encoding, and `applyObjectStates` XOR transition matching the target grid) and `tests/memory/map-editor-dom.test.js` (testing Tile tab active frame rendering, `F0` frame isolation from State 0, and current frame cloning on `+`).

## [0.82.5] — 2026-09-28

### Fix: Drawing context routing, tab stability on tile pick, and object box overlay toggle

- **Drawing context respected:** In `map-editor-gestures.js`, `editStroke` only routes to `editObjectGesture` when `drawKind() === 'object' || drawKind() === 'tile'`. When the user is on the Special or Trigger tabs, clicks on an object write specials (such as `F0` / `interact-force-0` or stairs) or triggers rather than corrupting the object's active delta frame with brush tiles.
- **Special write fallback on empty cells:** In `map-editor-gestures.js`, `editSpecialWrites` falls back to `d.blank.floor` when `editCellAt` returns `< 0`, allowing specials to be placed on empty floor cells.
- **Explicit F0 suppresses default B-trigger '1' glyph:** In `map-editor-special.js`, `editCellSymbols` checks `!hasF0 && editHasBTriggerAt(x, y)` so that explicitly painting `F0` (Force 0) suppresses the white `'1'` and displays `'F0'`.
- **No auto-tab jumps on tile pick:** Removed `_editActiveTab = 'object'` from `editOnStampPicked` and `editOnTilePicked` in `map-editor-input.js` and `editUseFamilyTile` in `map-editor-families.js`. Picking a tile or stamp while an object is selected stays on the current tab without jumping to the Object tab.
- **Hide object blue boxes when Objects overlay is off:** In `src/rooms/webview/map-editor-objects.js`, `editObjectSvg` checks `editObjectsVisible()` and skips rendering `.rg-obj-area` and `.rg-obj-frame` when Objects is unchecked. In `rom-overlay.js`, `syncRomTriggerClass` toggles `.hide-obj` when `'o'` is disabled. In `src/shared/shared.css`, `.hide-obj` hides `.rg-obj-area`, `.rg-obj-frame`, and `.rg-obj-cell`.
- **Tests:** Added assertions in `map-editor.test.js` and `map-editor-dom.test.js` verifying that picking a stamp stays on the Tile tab, `F0` suppresses B-trigger `'1'` and writes specials without mutating the object frame, and `editObjectsVisible()` reflects the `hide-obj` state.

## [0.82.4] — 2026-09-27

### Fix: Object delta frame stroke routing and State 0 preview isolation

- **Root cause:** When painting delta tiles on an object after picking a tile from the palette or family strip, the editor was on the Tile tab (`_editActiveTab === 'tile'`). `map-editor-gestures.js` guarded `editObjectGesture` behind `drawKind() === 'object'`, so paint strokes fell through to `editPaintStroke` and wrote into `d.cells` (the room's base cells) instead of the object's active frame (`o.frames[0]`). Because `#rg-edit-tiles` renders `d.cells`, and State 0 preview thumbnail uses `<use href="#rg-edit-tiles"/>`, the painted tile erroneously contaminated State 0 preview thumbnail and the base map view.
- **Gesture routing:** In `map-editor-gestures.js`, strokes inside an object area are routed to `editObjectGesture` whenever an object delta frame is active (`_objectActiveFrame >= 1 && _objectSel != null`). In `map-editor-objects.js`, `editObjectGesture` handles strokes inside the selected object and falls through safely if outside when not on the Object tab.
- **Seamless tab workflow:** Picking a tile or stamp from `editOnStampPicked`, `editOnTilePicked`, or `editUseFamilyTile` while an object frame is active (`_objectActiveFrame >= 1`) automatically returns to the Object tab so the active frame chips and object controls remain visible.
- **Chip click object selection:** `objectSelectFrame` now accepts an optional `uid` passed from chip clicks (`t.dataset.objectUid`), ensuring the selected object and active frame stay in sync.
- **CSS pointer events:** Added `pointer-events: none` on `.ro-chip *` and `.ro-img` in `src/shared/shared.css` to prevent click target walk-up mismatches on nested thumbnail elements.
- **Tests:** Added end-to-end DOM tests verifying real paint strokes on a 2×2 object with Frame 1 write exclusively to `o.frames[0]` while leaving `d.cells` untouched (0 base cells), State 0 thumbnail shows the base dirt without delta tiles, Frame 1 thumbnail shows the grass delta, and clicking State 0 vs Frame 1 chips properly toggles between the base map and delta view on `#rg-edit`.

## [0.82.3] — 2026-09-27

### Fix: phantom Frame 1 on restored and widget-stamped objects

- **Why objects still showed two frames:** two paths bypassed the v0.82.2 State-0-only lifecycle. Objects saved before it (custom maps auto-save their whole draft, `placed` included) restore with the old implicit empty Frame 1 baked in. And `editStampedConstruct` fell through to its legacy `cells` branch for a State-0-only object (`frames: []` is length-0), so every object stamped from a widget came back with a phantom empty Frame 1.
- **Fix:** new `objectNormalizeFrames` in `map-editor-objects.js` collapses an all-empty frame list to `[]` (State 0 only). A list with any painted frame is kept verbatim — scripts name states by index, so non-empty frames are never renumbered. Applied on custom-map restore (`customRestore`) and when stamping a widget object (`editStampedConstruct`), which no longer fabricates a frame for `frames: []`.
- **Tests:** the object workflow block in `tests/memory/map-editor-dom.test.js` now drives the whole flow through real `#rg-wrap` mouse gestures and real chip clicks instead of calling the gesture functions directly: drag creates a State-0-only object, State-0 painting is refused and leaks nowhere, `+` creates Frame 1, a real paint drag lands only in Frame 1, and chip clicks toggle the preview. Plus assertions for the restore migration and the widget stamp path.

## [0.82.2] — 2026-09-27

### Object lifecycle: State 0 first, then +Frame 1

- **New objects start in State 0 only.** `editAddObject` in `map-editor-objects.js` now creates objects with `frames: []` and `_objectActiveFrame = 0`. The base room appearance is edited by painting on the map while State 0 is active; no implicit Frame 1 is created.
- **Frame 1 is created explicitly.** Clicking the `+` button (or any `objectAddFrame` path) adds Frame 1 and switches to it. Delta tiles painted afterwards are stored only in that frame.
- **Frame labels updated.** Empty frames now show "same as base" instead of "empty" in the chip tooltip and frame-info bar, making it clear they do not introduce new tiles.
- **Object tab delegation completed.** `map-editor-input.js` now dispatches all object-tab data attributes through `objectClick`, not just `objectSel`/`objectRemove`.
- **Tests:** Rewrote the object workflow assertions in `tests/memory/map-editor-dom.test.js` to match the new lifecycle: drag an area in State 0, add Frame 1, paint a 2×1 delta, add Frame 2, and assert each frame keeps only its own tiles.

## [0.82.1] — 2026-09-27

### Fix: Object tab frame chips and frame isolation

- **Root cause (again):** `EDIT_CLICK_KEYS` in `map-editor-input.js` was missing most object-tab data attributes (`objectToggle`, `objectFrame`, `objectAddFrame`, `objectRemoveFrame`, `objectConfirmRemoveFrame`, `objectCancelRemoveFrame`, `objectMoveFrame`, `objectMoveObj`). The `editClickTarget` walk-up skipped past them, so clicks on State 0, Frame 1, Frame 2, `+`, `◀`, `▶`, and Delete frame landed on an inner `<span>` and were silently dropped. This is the same walk-up bug that v0.81.6 fixed for the first batch of object keys; the rest were never added.
- **Fix:** Added every object-tab `data-*` attribute to `EDIT_CLICK_KEYS`.
- **Undoable object strokes:** `editObjectGesture` now wraps paint and erase strokes on objects in `editBegin`/`editEnd`, so one drag is one undo step and the `frames`/`layer` state stays consistent across the gesture.
- **Tests:** Extended `tests/memory/map-editor-dom.test.js` to switch to State 0 and Frame 2 after painting, asserting frame 0 stays empty and frame 2 keeps only its own tile.

## [0.82.0] — 2026-09-27

### Widget editor now preserves every object frame

- **Bug:** A widget containing an object with multiple delta frames would lose all frames except the active one when saved from the widget editor. Re-opening the widget (or stamping it on a map) showed only frame 1; frames 2..N were empty.
- **Save path:** `widgetPlacedIn` in `map-editor-widget-edit.js` now serializes the full `frames` array for each object, not just the active `layer`. Frame 0 (the base room look) is still derived at runtime and not stored.
- **Restore path:** `editStampedConstruct` in `map-editor-constructs.js` restores all saved delta frames into the placed object's `frames` array. Old widgets that only stored a single `cells` array keep working.
- **Tests:** Added a headless round-trip test in `tests/memory/map-editor.test.js`. Fixed underlying event-delegation instability in `tests/memory/map-editor-dom.test.js` by stopping click/wheel propagation from `#rg-dock` so the same gesture is not handled twice when the dock is nested inside `#room-detail`.

## [0.81.9] — 2026-09-27

### Fix: Object tab buttons (◀ ▶, Delete frame, frame chips, +) were always dead — actual root cause

- **Root cause found:** `#rg-panels` (where the Object tab lives) is a child of `#rg-dock`, which is a sibling of `#rg-outer` in the DOM — completely outside `#room-detail`. `bindEditControls` attaches its delegated click listener to `#room-detail`, so clicks on any tab-panel button bubble up through `#rg-dock` and never reach that listener. Every EDIT_CLICK_KEYS fix in v0.81.6–v0.81.8 was correct but irrelevant: the clicks were never delivered to the handler in the first place.
- **Fix:** Added `bindEditControls(dock, room)` immediately after the dock is created in `editDock` (`map-editor-ui.js`). The `editBound` guard ensures the listener is added only once per dock lifetime; the dock is destroyed when edit mode is toggled off so there is no leak.

## [0.81.8] — 2026-09-27


### Fix: Object tab regression — all frame buttons broken again (v0.81.7 reverted the EDIT_CLICK_KEYS fix)

- The v0.81.7 commit accidentally reverted the `map-editor-input.js` changes from v0.81.6 (the `replace_file_content` call matched the wrong version of the line and undid the expanded `EDIT_CLICK_KEYS` + dispatch guard). The installed 0.81.7 extension had the correct `map-editor-objects.js` but the old broken `map-editor-input.js`, so all frame buttons still fired nothing.
- Restored both changes: the 8 missing object data attributes in `EDIT_CLICK_KEYS` and the full 10-key dispatch guard for `objectClick`.

## [0.81.7] — 2026-09-27


### Fix: Object tab — three frame-editing bugs

- **Delete frame did nothing:** `window.confirm` is suppressed in VS Code webviews, so the confirmed path never ran. Removed `window.confirm`; "Delete frame" now always shows the inline two-step "Delete? / Cancel" confirmation.
- **◀ ▶ arrows couldn't reach frame 0:** The arrows were wired to `objectMoveFrame` (reorder), disabled at frame 1. Changed to `objectSelectFrame` navigation: ◀ at frame 1 now reaches frame 0, a ▶ is also shown on the State 0 bar for symmetrical stepping.
- **Stale tiles remained after object delete:** `editRemoveObject` only called `renderEditChrome`. Added `renderEditLayer` + `requestComposedPreview` so delta tile overlays clear from the canvas immediately on delete.

## [0.81.6] — 2026-09-27

### Fix: Object tab frame navigation buttons were stuck / non-responsive

- **Root cause:** Eight object data attributes (`objectToggle`, `objectFrame`, `objectAddFrame`, `objectRemoveFrame`, `objectConfirmRemoveFrame`, `objectCancelRemoveFrame`, `objectMoveFrame`, `objectMoveObj`) were missing from `EDIT_CLICK_KEYS` in `map-editor-input.js`. The `editClickTarget` walk-up only searches that list, so clicking a frame chip, `+`, `◀`, `▶`, or "Delete frame" returned the inner `<span>` (empty dataset) and the click was silently swallowed.
- **Fix:** Added all eight missing keys; widened the dispatch guard to cover every data attribute that `objectClick` handles.

## [0.81.5] — 2026-09-27


### Map editor: Object clusters, expandable frames with automatic delta bounds, and reordering

- **Object clusters (dotted blue rectangle):** Dragging with the pencil on the Object tab marks the cluster area with a dotted blue line representing the working bounds for that object.
- **Expandable object frames (states):** Clicking on an object in the Object tab list expands it to reveal individual frame chips (State 0 for base room map look, Frames 1..N for changed states) styled like the ROM objects state list.
- **Automatic delta bounds & solid blue frame:** Drawing on an object frame automatically calculates the tight bounding box and dimensions of the changed delta tiles, rendering a solid blue outline around the delta.
- **Add, remove, and reorder frames:** Added `+` button to add new frames to an object, `◀` / `▶` buttons to reorder frames in sequence, and a confirmation-protected delete button to safely remove frames.
- **Order-sensitive objects:** Objects display their 0-indexed identity (`obj 0`, `obj 1`, ...) and can be reordered up/down in the object list.

## [0.81.4] — 2026-09-27

### Map editor: Multi-special flag lists, unified grid layout, deflect tool, and object drift indexing

- **Multi-special flag lists per tile:** Paint operations merge compatible attributes from different categories (e.g. vertical stairs + Force 1, gate + deflect) instead of clobbering, while replacing mutually exclusive flags within the same group (e.g. drift direction, Force 0 vs Force 1).
- **Unified white glyphs & adaptive grid layout:** All special and interact glyphs render in crisp white with dark stroke outlines. Glyphs arrange into a standardized grid based on active flag count: 1 entry centered, 2–4 entries in a 2×2 grid (top-left to bottom-right), and 5–9 entries in a 3×3 grid.
- **Fixed false `1` on Force 1:** Painting `Force 1` no longer renders a spurious natural `1` glyph; `1` is strictly reserved for metatiles covered by an active B-trigger.
- **Deflect special tool:** Added `Deflect` (`DF`) tool in the Special tab to set Bit 8 (`0x0100`) on collision words, making weapon slashes against walls deflect.
- **Tile filters for special flags:** Extended the Tile tab filter pill with options for `drift` (conveyor drift flag `0x2000`), `deflect` (Bit 8 `0x0100`), and `interaction` (Bit 15 `0x8000`).
- **Object drift tiles indexing:** Indexed unplaced room metatiles in `vanillaIndex` so sewer water currents (Family 28) and sliding volcano metatiles appear in the drift tile filter.

## [0.81.2] — 2026-09-27

### Map editor: Pristine custom map reuse, B-trigger Bit 15 interaction, and quadrant special tiles

- **Reuse pristine custom maps:** `> new map` reuses the most recently added or opened custom map if it has not been modified yet, preventing map list clutter.
- **B-triggers set Bit 15 naturally:** Any cell covered by an active B-trigger (vanilla or placed) evaluates to `1` in interact state and sets Bit 15 in exported ROM collision words, unless explicitly overridden by `Force 0`.
- **Special tiles visual clarity:** Special and interact tiles render with crisp white dashed outlines (`.rg-special-cell-box`) and high-contrast white glyphs with dark strokes.
- **Quadrant layout for multi-flags:** Cells carrying multiple flags (e.g. gate + B-trigger / interact state) arrange active symbols in cleanly separated quadrants so nothing overlaps.

## [0.81.1] — 2026-09-27

### Map editor: Clean Interact overlay UX

- **Clean map overlay:** Kept default Bit 15 = 0 cells completely transparent instead of rendering labels on every tile, keeping the map clean and readable.
- **Accurate 3-state visualization:** Only active states (`force 1` as green `F1`, `force 0` as red `F0`, and natural 1 / B-trigger target as yellow `1`) are drawn.
- **Proper SVG scaling:** Aligned font size and stroke width to the editor coordinate system (`EDIT_UNITS = 2`) so text and cell borders render sharply within metatile boundaries.

## [0.81.0] — 2026-09-27

### Map editor: Bit 15 (Interact), concise Special tab, Force 0/1 tools, and Interact overlay

- **Bit 15 (Interact) documented and verified:** Decoded engine B-button dispatch routine `$8FCE39..$8FCE46` testing `BIT #$8000` to distinguish B-interactions from weapon attacks.
- **Concise Special tab:** Replaced verbose multi-sentence paragraphs across Start, Stairs & Drift, Gate, and Entrance with compact one-line descriptions.
- **New Interact group in Special tab:** Added `Force 1` and `Force 0` special tools to explicitly set (`0x8000`) or clear Bit 15 on any metatile.
- **Bottom bar Interact toggle:** Added an `Interact` button alongside `Collision` (default off) that renders Bit 15 states (`forced 1`, `forced 0`, `1`, `0`) over the map and reports live state in the status bar on hover.

## [0.80.1] — 2026-09-26

### Docs: brought up to date with the map editor

- `STATE_FLOW.md`: the editor's state as of v0.80.0 — six tabs, custom maps
  on disk, widgets, objects, levels, groups, trigger order, the clipboard,
  the lazy vanilla list — and a map of the editor's host messages.
- The map-editor rules: the Object tab in the pencil rule; Export ROM as
  the custom map's write path (and what it doesn't write yet); stamps
  taking the floor's level; layers drawn over the map; portable widgets.
- `src/rooms/README.md`, the redesign plan (what was built after it) and the
  map-format index.

## [0.80.0] — 2026-09-26

### Map editor: an Object tab, trigger toggles, and fixes

- **New Object tab**, after Trigger. An object is an area that changes when a
  script changes its state: a gourd breaks, a chest opens.
  - Drag out its area with the pencil.
  - With it selected, draw what the area turns into, using the Tile tab's
    brush. The eraser takes a tile off.
  - The object's tiles sit on top of the map, like the cuttable layer. They
    show only while the Object tab is open; elsewhere the area is a dashed
    outline.
  - The list shows each object's place in the room and its tiles, with × to
    remove it.
- **Vanilla widgets bring their changed look.** A stamped gourd now carries
  its broken look as the object's tiles. 530 of the 532 generated widgets
  have one.
- **Triggers in the bottom bar**, with B and step-on toggled separately
  under its ▾. It now shows on custom maps too; default on.
- **Fixed:** picking a tile from a new family could put it in the second
  palette slot while the first was empty. A slot reserved by a pick you
  never painted with is now given back.
- **Fixed:** with Cuttable off, the map showed the cuttable tile. It now
  shows the tile beneath; turn Cuttable on to see and edit the cuttable
  layer.
- **Fixed:** arming a vanilla widget selected the old Stamp tool, which then
  kept stamping on other tabs. It arms the pencil now.

## [0.79.0] — 2026-09-26

### Map editor: your own widgets, and a gourd that works on any level

- **Widgets scroll** instead of paging. Thumbnails load as they come into
  view.
- **Your widgets come first.** The 532 widgets generated automatically from
  vanilla rooms are hit and miss, so they only show while the new `vanilla`
  toggle is on. The toggle is remembered.
- **Add and edit widgets.** You can create one three ways:
  - "+ New widget" starts an empty one;
  - "+ From selection" keeps the copy tool's region or a stamped object;
  - ☆ on a vanilla card keeps that one.

  ✎ opens a widget on its own canvas with every tool (the design mock's
  Widget Editor Mode): tiles, collision, specials and triggers. You can
  rename and resize it, and delete it (you're asked first). It saves as you
  go, and "← Back to map" returns to your map. Widgets are shared by every
  map, in `widgets.json`.
- **A gourd stamps whole:** its tiles, collision, B-trigger and object, as
  one object you can move and delete. It lands on the **level of the floor
  it's placed on**, so on a level-2 plateau it is a level-2 gourd whatever
  the level bar says. On open ground the bar decides.
- **Not yet in the game:** the exported ROM still writes no triggers or
  objects. The gourd's vanilla script also points at its original room's
  object number and "already looted" flag, so making it work in the game
  needs new scripts, which is its own step.

## [0.78.0] — 2026-09-26

### Map editor: trigger rows as the design mock draws them

- **Each row matches the mock:** a ⠿ grip, a thumbnail of the whole room with
  the trigger's box lit in its colour, a crop of the tiles it covers, then
  `#n · N tiles` and ×. The name, the cells and the script are in the row's
  tooltip.
- **Both previews are the map itself**, not a copy, so they show your
  painted tiles, follow every stroke and even play animated tiles.
- **Drag a row by ⠿ to reorder the list.** Drop it on the other kind's tab
  (B-triggers ↔ Step-on triggers) to change its kind; it keeps its box and
  script. Both are one undo step, and a custom map saves the order.

## [0.77.0] — 2026-09-25

### Map editor: animated tiles animate in the exported game

- **Export ROM writes the room's animation data (Section 2).** A torch,
  flame or water tile painted on a custom map now animates in the game, as
  it does in the editor. Each animated graphic gets its own animation, which
  plays vanilla's frames and timing, starting from the frame you placed.
- Vanilla often runs the same torch at different starting frames so torches
  flicker out of step. A custom map doesn't: torches placed from the same
  frame flicker together.
- A room can have up to 42 animated graphics, the most any vanilla room has.
  Beyond that, the extra ones stay still and the export message says how
  many.
- Checked by booting an exported ROM in the bundled emulator: the flames
  change from frame to frame.

## [0.76.0] — 2026-09-25

### Map editor: placed animations play on the map

- **Placed animated tiles animate.** A torch, water or flame painted on the
  map now plays its frames at the game's own timing, like its swatch in the
  Tile tab. Tiles on one cycle flicker in step, as in the game.
- **`frames` mode marks the first frame `1/n`**, like the other frames. `▶n`
  is only for a whole animation in `anim` mode.
- **Not yet:** an exported custom map still doesn't animate in the game.

## [0.75.0] — 2026-09-25

### Map editor: animations in the tile list

- **Animations are marked.** A swatch that animates in the game carries
  `▶n` (an animation of n frames). A single frame shown on its own carries
  `k/n`. The tooltip says which.
- **Tile tab: `anim | frames`.** With `anim` (the default) an animation such
  as a torch is one swatch that plays its frames at the game's own timing.
  The game only ever places the first frame and plays the rest in place.
  `frames` lists every frame separately.
- The game often runs one torch cycle at several phases so torches flicker
  out of step. Those are recognised as one animation: 329 in all, whose 636
  other frames no longer crowd the list.
- **Fixed:** the family "goes with your map" score could pass 100% (it
  showed 114%).
- **Not yet:** an exported custom map doesn't animate. A painted torch is
  its first frame, standing still, in the game.

## [0.74.0] — 2026-09-25

### Map editor: floor/edge/wall filter, paste on the pointer, stable tile order

- **Tile tab: `all | floor | edge | wall`.** Lists tiles by the collision
  they'd be painted with:
  - **floor**: walkable, including stairs;
  - **wall**: fully solid;
  - **edge**: half tiles and diagonals, the filler in between.

  Combines with `cuttable | stairs`. Families with nothing to show drop
  out before they load.
- **Stamped widgets and pasted objects use the chosen level.** They used to
  keep the level of the vanilla room they came from, often level 0, which
  is why they were outlined blue on a level-1 map.
- **Paste rides on the pointer.** Cmd/Ctrl+V shows a see-through preview of
  the copy's own tiles, centred on the pointer, and it follows the pointer.
  A click puts it down exactly there, as one object, selected. Escape drops
  it. The dashed outlines of every object no longer show while copying.
- **The Select tool follows the open tab.** On the Trigger tab it picks a
  trigger even under a stamped object. Elsewhere the object comes first.
- **The pencil's S badge (step trigger) is pink**, like step triggers on the
  map.
- **The tile list keeps its order.** Tiles are ordered by how often vanilla
  places them, and using one no longer reshuffles the list. The % badge
  still shows how well a tile goes with the map.

## [0.73.0] — 2026-09-25

### Map editor: tiles on load, collision modes, moving specials, trigger sub-tabs

- **Fixed: a reopened map shows its tiles straight away.** Before, painted
  cells stayed blank until you picked a tile.
- **Collision in the level's colour.** The tile list's collision marks use
  the colour of the level you're drawing on, e.g. red on level 1.
- **Two ways to draw collision**, behind the Collision chip's ▾:
  - **Outline** (the default), as before;
  - **Tile by tile**: every pixel a tile makes solid, filled in its level's
    colour.

  The choice is remembered.
- **Move specials with the Select tool.** On the Special tab, click a tile's
  specials to select them (highlighted), then drag them to another tile.
  They include the glyph and the gate, drift or stairs bits. A stairs flag
  that came from a stair tile moves too. The target keeps its own level
  and shape. One undo step.
- **The rectangle fill tool is gone.**
- **Paste lines up with the pointer.** The tile your pointer was on when
  you copied lands under the pointer when you paste.
- **Trigger tab:** a sub-tab each for B-triggers and Step-on triggers. The
  open one is what the pencil draws, and the only one listed. Selecting a
  trigger on the map opens its sub-tab.

## [0.72.0] — 2026-09-25

### Map editor: vertical stairs, one armed look, a smart eyedropper, copy and paste

- **The stairs filter now lists vertical stairs.** In vanilla, the steps
  you climb up the screen carry bit 13 with no drift direction. Examples:
  the steps beside the diagonal stairs in 0x0b and 0x2b, Ebon Keep's and
  Ivor Tower's steps, and the log steps in 0x65. The filter now covers 30
  families (96 tiles), up from 11. Bit 13 also keeps the Boy's level,
  which is how a staircase joins two levels.
- **The Special tab's Vertical writes that flag too.** All three stairs are
  now real collision writes.
- **One look for what's armed.** The special, trigger kind or widget the
  open tab will draw now wears the same accent ring as the selected tile.
  With the eraser out on the Special tab, a note at the top says what it
  removes. The eraser has a badge like the pencil's.
- **Trigger tab:** the Draw row is gone. Click the B-triggers or Step-on
  triggers heading to choose what the pencil draws. B-triggers is first and
  selected by default.
- **The Boy can be selected.** With the Select tool:
  - click him to select and highlight him;
  - drag him to move him (one undo step).

  Selecting something else, changing tab or tool, or pressing Escape lets
  him go.
- **Tile tab:** the families, filters and likely-neighbours card stay in
  place. Only the tile list scrolls.
- **The eraser removes every special on the Special tab.** That covers
  stairs, drift and gate flags and the glyph, including a stairs flag that
  came from a stair tile and has no glyph.
- **The eyedropper picks up what you click, with its tab and tool:**
  - **the Boy:** the Special tab with the Boy pick;
  - **a special:** the Special tab with that special;
  - **a trigger:** the Trigger tab with its kind, and the trigger selected;
  - **a tile:** the Tile tab with that exact tile, its swatch highlighted
    and scrolled into view, and H/V and the level taken from the cell.
- **Copy and paste instead of click-to-stamp.** With the copy tool:
  - drag to select a region;
  - Cmd/Ctrl+C copies it;
  - Cmd/Ctrl+V pastes it under the pointer as one object.

  Drag the pasted object into place while it's selected. It stays a movable
  object afterwards, like a stamped widget. A selected object copies the
  same way, and Delete removes it.

## [0.71.0] — 2026-09-25

### Map editor: levels, saved maps with their history, stamped objects that move

- **Levels.** A vertical bar at the left of the map picks the level (0–3)
  that new tiles are drawn on. Level 1, the red one, is the default. A level
  is the collision word's elevation plane: tiles on another level are walls,
  unless they're see-through. That's how bridges pass over tunnels.
- **Custom maps are saved on their own, as files.** Each map is a folder in
  the extension's storage with `map.json` (the map) and `history.json`
  (every edit). Maps saved in the old place are moved over the first time.
  There's no save button: a map is written a moment after each change.
- **Reopening the panel shows the map you were on**, as you left it.
- **The edit history is kept for good.** Undo and redo work after closing
  and reopening VS Code.
- **One gesture is one undo step.** A pencil or eraser drag across many
  cells undoes and redoes in one go.
- **Stamped objects stay one thing.** Stamping a gourd or a saved construct
  makes a group. With the Select tool:
  - click it to select it;
  - drag it to move it, along with its trigger;
  - press Delete to remove it. What it covered comes back.
- **Export map…** (in the `⋯` menu) saves a `.zip` with:
  - the room blob, round-trip checked like Export ROM;
  - the editor file;
  - a sample `.evs` that skips the intro into the map;
  - `stamps.json`, every stamp the map uses;
  - a README.
- **Delete map…** (in the `⋯` menu) asks first, then removes the map and
  its history.
- **New Map no longer piles up empty maps.** If the current map, or any
  other, is still untouched, that map is opened instead of making another.
- **Fixed:** the Trigger tab's B-trigger / Step trigger choice didn't
  respond to clicks.
- **Fixed:** undo or redo could bring back a tile whose stamp had been
  cleaned up, and that cell then drew nothing.
- The file format is described in `docs/map-format/custom-map-files.md`.

## [0.70.0] — 2026-09-25

### Map editor: a smart pencil, stairs tiles, working tool tooltips

- **The pencil draws what the open tab has selected, and only that:**
  - **Tile:** the selected tile.
  - **Special:** the selected special.
  - **Trigger:** a new trigger. Drag out its box. A **B-trigger /
    Step trigger** choice sits at the top of the tab; B-trigger comes first
    and is selected by default.
  - **Widgets:** the selected widget.
  - **Info** keeps the last tab's choice.

  A badge on the pencil shows what it will draw, and so does the status
  bar. The eraser and the rectangle follow the same choice: on the Trigger
  tab the eraser removes the trigger under the cursor, and on the Special
  tab it removes only the special.
- **Fixed: a selected stairs special no longer paints along with the tile.**
  Before, one click drew both the tile and the special.
- **Triggers you add are drawn on the map**, as a box with a B or S in its
  kind's colour. They're saved with a custom map and undo like everything
  else. They have no script yet.
- **Stairs tiles.** The game marks diagonal stairs in the collision word:
  bit 13 plus direction 1 (rises to the right) or 2 (rises to the left). It
  uses this only under stair art, and the direction follows the tile's
  horizontal flip. So:
  - A new **`stairs`** filter next to `cuttable` lists only stair tiles.
    Only one of the two filters is on at a time.
  - A stair tile shows its direction in a corner of its swatch, and its
    tooltip says which way it climbs.
  - Painting a stair tile gives it the stairs flag, mirrored when H is on.
    The map shows the flag on each such cell.
  - The Special tab's **Diagonal L / R** now write the same flag onto any
    tile. **Vertical** stays an icon only: the game has no encoding for it.
- **Collision suggestions treat stairs and drift tiles as walkable.** Before,
  their direction number was read as a slope shape. Suggestion accuracy
  moves from 76.9% to 77.1%.
- **The toolbar's tooltips now appear.** They're drawn by the page itself,
  below the button, after a short hover.
- The Special tab's icons no longer run into their labels.

## [0.69.2] — 2026-09-25

### Map editor: drawing order, erasing by layer, smoother tile list

- **Drawing order no longer matters.** Painting a ground tile onto a cell
  that already has a front tile (like the skull) keeps the front tile and
  only changes the ground. That's the same result as painting the ground
  first. The front tile's collision is used either way.
- **The eraser follows the selected layer:**
  - With **Cuttable** on, it removes the cuttable tile.
  - With only **Foreground** on, it removes the front tile.
  - With only **Background** on, it removes the ground and keeps any front
    tile.
  - With both on, it removes the front tile first, then the painted tile
    itself.
- **Erasing on a custom map now works on ground tiles too.** Before, erase
  only removed front tiles, so erasing a ground tile did nothing.
- **Scrolling the Tile tab is smoother.** Tiles load several screens ahead
  instead of one. A family's tiles now appear in place when they arrive,
  instead of redrawing the whole list each time.

## [0.69.1] — 2026-09-25

### Export ROM: the Boy gets a spear, so cuttable grass can be tested

- **Test ROMs now give the Boy the Laser Lance before the room fades in**
  (`MEMORY.GAIN_WEAPON = GAIN_WEAPON.SPEAR_4;`). After the intro skip he only
  has the Bone Crusher, and that didn't cut grass.
- **Cutting now confirmed in the game.** In the built-in emulator, one swing
  at a cuttable tile revealed exactly the tile beneath it. The v0.69.0 notes
  said this was unverified.

## [0.69.0] — 2026-09-25

### Map editor: a cuttable layer

- **A `Cuttable` toggle next to Collision**, off by default. While it's on,
  painting, rectangles and erasing work on the cuttable layer: tiles drawn
  over the map that the player can cut away to reveal the map's tile beneath.
  A cuttable tile is a full tile (background, foreground and collision), and
  a front tile painted on this layer is drawn over what it covers. Cuttable
  cells get a green outline while the layer is being edited.
- **Export ROM and Play in emulator turn the layer into real cuttable
  grass.** Each cuttable tile gets a record in the same format the game's own
  rooms use, and cutting it reveals the tile beneath it. The exported ROM is
  read back and checked that every cuttable cell cuts to exactly the tile
  under it.
- The Collision view shows the collision the room starts with, so cuttable
  tiles count as blocking until they are cut.
- Undo, redo, saving and resizing all include the cuttable layer, and a tile
  family used only by cuttable tiles stays loaded.
- **Not yet seen working in the game.** The ROM data has been checked, but
  cutting could not be tested in the emulator from the command line, not even
  on the game's own grass. Try it by hand with Play in emulator.

## [0.68.1] — 2026-09-25

### Tile tab: the tiles revealed by cutting grass are listed

- **The cut-grass stubble from Act 1 (graphics 677, 685 and 691) is now in the
  tile list**, in family 32, and the `cuttable` filter shows it. These tiles
  never appear in a room's saved layout: the game only shows them once the
  grass on top is cut. The tile list was built from saved layouts alone, so
  no family listed them.
- Such tiles now count toward their tile family and their layer, weighted by
  how many cells would show them once cut. Their suggested collision comes
  from the cut state, which is walkable.
- Their tooltip says how many cells show them once the grass is cut, instead
  of a placement count.

## [0.68.0] — 2026-09-25

### Map editor: a `cuttable` filter in the Tile tab

- **A new `cuttable` toggle next to H/V**, off by default. Turned on, the tile
  list shows only tiles that are part of cuttable grass: the uncut tile, or
  what it turns into when cut. Families with no such tiles are hidden without
  loading their tiles. That leaves 38 tiles in 9 families, 28 of them in
  family 32 (Antiqua), taken from the 7 rooms that have cuttable grass.
- **Only tiles that actually change count.** The ground under a cuttable bush
  stays the same when it's cut, so it isn't listed. Neither is the empty tile
  that cut grass leaves behind.
- A tile's tooltip says whether it is the uncut tile, what cut grass turns
  into, or both.

## [0.67.0] — 2026-09-25

### Map editor: suggested collision

- **Tiles show their recommended collision.** With **Collision** on in the
  bottom bar, every tile in the Tile tab shows the collision shape the game
  usually gives it, plus a number for how many of the game's rooms agree. A
  dashed shape means the game uses the tile both ways, walkable in some rooms
  and blocked in others. A `?` means the tile never appears on that layer.
- **Painted tiles get that collision.** When you paint a tile on a custom map,
  it gets the recommended shape: from the ground layer for ground tiles, from
  the foreground for front tiles. The shape goes on elevation plane 0,
  because copying the game's full collision value would also copy its plane,
  gates and sprite settings.
- **Custom maps show their collision.** With Collision on, a custom map now
  draws its walls in the same style as the game's own rooms, and the drawing
  updates as you paint, erase, undo or redo. Walls on elevation plane 0 are
  drawn blue.
- **Checked against all 127 rooms** by predicting each room's collision from
  the other 126. The recommended shape was right 77% of the time. Where 95% or
  more of the game agrees, it was right 92% of the time. Rerun the check with
  `npm run check:collision`; details are in
  `docs/map-format/collision-suggestions.md`.

## [0.66.1] — 2026-09-25

### Emulator: a stale core path no longer leaves the panel blank

- If `everscript.snesCorePath` points to a file that no longer exists, the
  emulator now falls back to its built-in core and shows a warning. Before,
  it loaded no core, so Play in emulator opened an empty panel. Old settings
  can still point to `debugger/core/…`, a location from before the code was
  reorganized. To stop the warning, clear the setting or point it at a real
  core.

## [0.66.0] — 2026-09-25

### Map editor: Play in emulator

- **Play in emulator** is a new item in the map editor's ⋯ menu, next to
  Export ROM. It builds the same ROM and runs it in the built-in emulator
  panel, starting in your custom map. Nothing is written to disk and no save
  dialog opens.

## [0.65.2] — 2026-09-25

### Export ROM: a second export no longer fails

- **Fixed "ROM export failed: Room 0x34: Block 2 … expected 0x07 / 448".**
  An export changed the extension's in-memory copy of the vanilla ROM: it
  wrote the new map's size into the header of the room the map borrows its
  graphics from. The first export worked, but after that the borrowed room
  could no longer be read, so the next export failed and rendering that room
  broke too. Exports now work on a private copy and never touch the ROM the
  extension has loaded. The ROM file on disk was never modified.

## [0.65.1] — 2026-09-25

### Map editor: new maps keep their Boy, and families follow the map

- **Every new map shows the Boy's start marker again.** When the panel
  opened through `everscript: new map`, the saved custom-map list arrived just
  after the new map was created and replaced the list. The new map was left
  without a row, its empty room was never built, and there was no Boy. Saved
  maps are now merged into the list instead. A new map whose name is already
  taken gets the next number.
- **Every request is answered once.** The panel added a new message handler
  each time it refreshed and never removed the old ones, so after a few
  refreshes each request was answered several times. Export ROM could open
  several save dialogs.
- **Clicking a tile no longer adds its family.** The family is loaded when one
  of its tiles is painted on the map, and removed again when the last one is
  erased or undone. Families you add with `+` stay until you remove them.
- **No more "N placed cells name palette slot 2" warning** after painting a
  new map. The empty tile (`$A800`) draws nothing, so the palette slot it
  names no longer counts.
- The tile preview and the exported ROM now keep each family in its own
  palette slot when an earlier slot is empty. Before, the families after a
  gap moved up one slot and drew in the wrong colours.

## [0.65.0] — 2026-09-25

### Map editor: Export ROM

- **Export ROM…** is a new item in the map editor's ⋯ menu. It works on custom
  maps and saves a playable ROM that starts inside your map: the intro is
  skipped and the game fades straight in, with the Boy standing on his start
  marker.
- The export is built from your vanilla ROM, which is never modified. The
  output ROM is 4 MB. Your map replaces Brian's Test Ground (room 0x15) and
  lives in the ROM extension at `$BD:8000`.
- The intro's first script becomes `load_map(0x15, x, y)`. Brian's room gets a
  `fade_in()` enter script, because its original enter script is empty and
  the screen would stay black.
- Before saving, the export reads back the ROM it wrote and checks the room,
  the enter script and the intro jump. If anything doesn't match, nothing is
  saved.
- The room encoder is a port of the everscript repo's `encode_room.py`. It
  reproduces all 127 vanilla rooms byte for byte.
- Not exported yet: triggers, objects, and edits to vanilla rooms. See
  `docs/map-format/rom-export.md`.

## [0.64.0] — 2026-09-25

### Map editor §8e: the Tile tab's first look, and a simpler bottom bar

- **A new map starts with no tile families (0/7).** Every family's tiles are
  listed, and picking a tile loads its family into a slot.
- **TILE FAMILIES and LIKELY NEIGHBORS start closed.** LIKELY NEIGHBORS is
  always there, and empty until you pick a tile. Whether each is open is
  remembered.
- **The tile list shows everything.** It has no collapse control and no
  "N more families" button. Every family is listed with all of its tiles, and
  tiles load as you scroll near them. The list doesn't shift while they load.
- **Clicked tiles no longer jump.** The list keeps its scroll position. A
  family keeps its place in the list when it is loaded into a slot, and the
  panel no longer slides sideways when the status line gets longer.
- **Bottom bar:** everything is shown by default except collision.
  **Objects** is now a single on/off toggle. **Triggers** has only Step
  trigger and B trigger. NPCs, hitboxes, grass, the grids, script tables and
  ROM triggers moved to **More**.
- **The Boy's start marker no longer holds a green club.** The weapon piece
  was drawn in the wrong palette, so it is left out.

## [0.63.0] — 2026-09-25

### Map editor §8d: a new map is its own room

- **`+ New Map` makes a custom map** instead of opening Strong Heart's Hut. The
  map gets its own entry under **Custom rooms** ("New map 1", "New map 2", …)
  and is selected there. Nothing in the Vanilla list is highlighted: only a ROM
  room is ever selected in that list.
- **It starts as one SNES screen**, 16×14 tiles: an empty grid with the Boy in
  the middle. It has no objects and no triggers. It still borrows room
  `0x34`'s graphics and families to draw with, but nothing of that room is
  shown.
- **Your custom maps are kept.** Switching to another room and back returns
  your drawing and the Boy's position. The maps are saved by VS Code, so they
  survive the panel being rebuilt and restarts.
- The editor's inline **new room…** form also makes a custom map now, using
  the graphics of the room you are in.
- Custom maps can't be renamed, deleted or exported yet.

## [0.62.0] — 2026-09-25

### Map editor §8c: new maps are empty, the Boy marks the start, families start collapsed

- **No more Strongheart on a new map.** A new map borrows room `0x34`'s
  graphics and families, and until now it also kept that room's NPCs (Strong
  Heart himself), its doors and its triggers on the canvas and in the Trigger
  tab. Those are now removed when the blank map arrives.
- **The Boy marks where the map starts**, like a level editor's debug entrance.
  He is drawn with the game's own sprite and placed in the middle of every new
  map. There is always exactly one: move him with **Special → Start → Boy**
  (click or drag), and undo works. The eraser cannot remove him, and a resize
  pulls him back inside. He is not exported yet, because the encoder has no
  entrance field.
- **Tile families start collapsed.** Click a family's header to open it. Which
  families are open is remembered by VS Code across panels and restarts.

## [0.61.0] — 2026-09-25

### Map editor §8b: LIKELY NEIGHBORS is the plus-shape the design specifies

- **The neighbour card is now a plus.** The armed tile sits in the centre, and
  each of the N, E, S and W cells shows the tile vanilla draws **on that side**,
  on the same layer, drawn as the real tile art with a match % badge. The
  gourd's top-left piece shows its other pieces east and south at 100%, and
  noise on its free sides.
- **Click a side** to pick it. **Click it again, or scroll over it,** to cycle
  through that side's candidates. The picked candidate is spelled out under the
  grid with a **use** button, which makes it the brush. The card then centres
  on it, so you can walk an object piece by piece.
- **Click the centre** to switch the brush between front and ground. The
  `auto | front | ground` pill follows, and the card shows the other layer's
  neighbours.
- **H/V are honoured.** A mirrored brush's east edge is its unmirrored west
  edge, so the sides swap and every candidate is drawn and armed with the same
  mirror.
- **Honest gaps.** A side vanilla never draws anything on is an empty cell.
  A candidate from a family you have no slot for (7/7) is shown dimmed, and
  its **use** button says why.
- Under the hood, the vanilla index now counts every adjacency per side and
  per layer, off the same single pass it already made. That adds about 2 MB and
  about 60 ms, once per ROM. Tile ranking still uses the undirected score and
  is unchanged.

## [0.60.0] — 2026-09-24

### Map editor §8a.3: four more reports from using the real tool

- **H/V no longer shove the tile panel off the right edge.** The panel never
  got wider; it moved. A long status note, which is exactly what a flip writes,
  used to force the canvas column wider, and that pushed the panel past the edge
  of the window and clipped the `H | V` buttons. Now the canvas column can
  shrink, and the note gets cut off with an ellipsis instead.
- **New maps start completely empty.** They no longer open as a picture of
  Strong Heart's Hut. Every cell is now the room's own "draws nothing" word on
  both layers, and every cell is walkable. The donor room still lends its
  graphics and its seven colour families, because the format cannot draw
  anything without them. It no longer lends its picture.
- **A front tile no longer wipes the ground under it.** Fixed in three places:
  - The rectangle tool, and the backfill left behind by `move`, wrote the brush
    as-is, which blanked the terrain under a front tile. They now use the same
    per-cell rule the paint tool always has.
  - Painting on a new map no longer puts the donor room's terrain under a front
    tile.
  - Picking one of the room's own graphics now respects `front` and the layer
    vanilla uses.
- **A full palette (7/7) shows only its own seven families.** There are no
  outside candidates and no "N more families" pager, because there is no slot
  to adopt into. Free a slot and they come back. This reverses v0.58.1's
  change, which had misread an earlier report.

## [0.59.0] — 2026-09-24

### Map editor §8a.2: four things the Tile tab did not need

All four from using the real tool, not from the mock.

- **The "new metatiles" list and the hand-composer are gone from the Tile
  tab.** "They are calculated dynamically/implicitly" — and they are: the
  machinery is untouched, `editAddStamp` still invents a stamp the instant a
  stroke needs one. Only the panels that surfaced that by hand are removed.
- **H/V now flip the visible swatch,** not just the exported word. The bits
  were always right; nothing mirrored what you were looking at, so the toggle
  changed what you'd paint without changing what you saw.
- **The room/deco phase toggle is gone.** Both of its jobs were already
  implied by data we had: a brush composed as "front" always carries real art
  in its canopy word with a blank terrain, and a "ground" brush the exact
  opposite — so "is this a decoration or a floor tile" is readable off the
  brush itself. `editResolve` derives it from the brush when painting and
  from the cell when erasing. **Erase is the real winner**: it used to be a
  flat no-op unless you remembered to switch to deco phase first, and now it
  just works on whatever is under the cursor.
- **"Add a family" is gone.** Clicking any tile from an unadopted family
  already pulls that family in behind it, which is exactly what made an
  explicit browse-by-id control redundant.

## [0.58.1] — 2026-09-24

### Fix: two real bugs from trying the Tile tab

- **"You can't load more tiles when your 7 family slots are full."** The
  candidate-family pager spent its page budget on the adopted families
  themselves, so a full seven-slot palette always started at zero extra
  shown, and "more families" barely moved. Fixed — the page size is now
  independent of how many slots are already spent.
- **"When clicking on a tile the order should not change."** Arming a brush
  seeded the relationship lookup with the tile you just clicked, which
  scores 0 in its own results (it can't recommend itself) — so every click
  sank that tile to the bottom of its own family's grid, before you'd even
  painted anything. Fixed — the lookup now seeds only from placed cells;
  order moves when the map changes, not when you're browsing.

Two other reports (an H/V-triggered layout shift; the mock's directional
plus-shaped neighbours widget, which this codebase does not render) are
recorded in `docs/map-editor-redesign-plan.md` §8a.1, unfixed pending more
information — the first didn't reproduce under a real Playwright repro
against the actual bundle, and the second doesn't match any code in this
repository.

## [0.58.0] — 2026-09-24

### Map editor redesign, §8a: the Tile tab

The tab the editor is actually used through. Restructured against the design
mock rather than restyled — see `docs/map-editor-redesign-plan.md` §8a.

- **The seven adopted families and the ~300 adoptable candidates are no longer
  one interleaved list.** They are two groups now: a collapsed swatch strip or
  an expanded 2-col card grid for what is in your palette, and a separate
  `+ add a family` control for what is not. The mixed `× / +` list was the
  single biggest source of noise in the panel.
- **Both explanatory sentences are gone** ("7 of 7 slots used · full — remove
  one to add another…" and "Clicking a tile makes a metatile from it and
  adopts its family…"). The header now reads `TILE FAMILIES  7/7 active`;
  every fact the prose carried survives as a tooltip, a count or a
  placeholder.
- **The invalid-family banner is finally where it is useful.**
  `editStrandedCells()` — placed cells whose family is no longer loaded — was
  one line buried in the Info tab's checks. It is now a banner at the top of
  the Tile tab with its two real actions: re-adopt the family, or clear the
  cells that need it (one undoable step, sharing the existing undo stack).
- **New `H`/`V` mirror toggle.** Bit 14 is horizontal flip and bit 15
  vertical (`docs/map-format/map_rendering_pipeline.md` §3), and
  `renderVramLayer` already reads exactly those bits back per word — so
  mirroring needs no second render path. A mirrored word costs a dictionary
  entry but **no graphics slot**, which against a hard ceiling of seven
  families makes it free art.
- Layer override (`auto|front|ground`) rendered as one segmented pill. The
  mock draws two segmented controls; only one axis exists in our data, so the
  second was not manufactured to match the drawing.
- `LIKELY NEIGHBORS` is now the mock's collapsible card. It stays a **ranked
  list, not the mock's N/E/S/W plus-shape**: our adjacency model scores "drawn
  beside", never "drawn above/below", and presenting it as compass directions
  would invent a distinction we never measured. Directional adjacency is
  computable and tracked as §8b.
- Family group headers restructured from sentences into headers.
- `map-editor-relations.js` split out of `map-editor-chips.js`;
  `map-editor-stranded.js` and `map-editor-tile-tab.css` added.

## [0.57.0] — 2026-09-24

### Map editor redesign, phase 7b: the left rail

The rail was a dense monospace list with a `ROOMS` header, `Live`/`Vanilla`
mode buttons, no search and no footer action. It is now the mock's roomy
sans-serif list. See `docs/map-editor-redesign-plan.md` §7b/§7b.1.

- **The `Live`/`Vanilla` mode toggle is gone.** The two trees are now two
  collapsible groups — `VANILLA ROOMS` and `CUSTOM ROOMS` — in one scrolling
  list, which is the mock's structure. Nothing is lost: a row already said
  which tree it came from, so the mode button was a rendering choice rather
  than state. Custom is open and Vanilla collapsed on load, showing exactly
  what the old `Live` default showed. Two behaviour fixes fall out of it —
  selecting a room now clears the *other* tree's highlight (both could look
  selected before), and switching groups no longer blanks the detail panel.
- **Search rooms**, net-new and client-side: it matches a room's name *and*
  its id, so `sewers` and `0x12` both find Ebon Keep sewers. Empty areas and
  empty groups fold away, and "No rooms match" is an explicit state.
  Collapsed groups open for the duration of a search and close again when you
  clear it — your expansion state is never overwritten.
- **Rooms are grouped by area, not by act.** The mock shows `ACT 0…4`; the
  ROM catalogue groups by area (`Prehistoria`, `Antiqua`, `Gothica`, …) and
  that is the game's real structure, so the mock's *look* was adopted and its
  placeholder content was not.
- **`+ New Map` in the footer** runs the project-level new-map action — the
  same one the `Everscript: New Map` command runs. The editor's own
  `new room…` is a different thing (an inline width/height form that borrows
  whichever room is open) and stays in the tool pill's `⋯` overflow.
- **32px rows, a 2px accent bar on the selected one**, quiet uppercase group
  headers, and a sans-serif face scoped to the rail alone. The
  memory/scaling/route/docs/RNG tabs and the room detail panel were rendered
  before and after and are **pixel-identical**.
- New files `rooms-rail.js` / `rooms-rail.css`; `tab-init.js` is down to the
  tab strip; `shared.css` lost three rules that died with the mode toggle.
  33 new browser-driven checks in `tests/memory/rooms-rail-dom.test.js`.

## [0.56.0] — 2026-09-24

### Map editor redesign, phase 7a: the canvas column

Phases 0–6 each said "restyle only, preserve every control where it is" — and
the result was a themed version of the old dense layout, because the mock's
whole thesis is *reduction*. This phase changes the constraint from "every
control keeps its position" to **"every control stays reachable"**. See
`docs/map-editor-redesign-plan.md` §7a/§7a.1.

- **Tab order fixed**: Tile / Special / Trigger / **Widgets** / Info, the
  design mock's own order. Widgets had been shipping last since phase 5.
- **The toolbar is a compact icon-only pill** floating over the canvas card:
  `[↖ ✎ ⌫ ▭ ⤵] | [⧉ ✥ ❖] | [room deco] | [↶ ↷] | [⋯]`, grouped by thin
  dividers, every button carrying its existing tooltip text. `room`/`deco`
  keep their words — they name a real documented concept (`editResolve`), not
  a label to reskin. New file `map-editor-toolbar.js`, split out of
  `map-editor-ui.js`.
- **`discard`, `copy draft` and `new room` moved into a `⋯` overflow menu.**
  `new room` is there until §7b moves it to the left rail's `+ New Map`
  footer, where the mock puts it.
- **The canvas is a centred card** — rounded, bordered, shadowed, generously
  padded — instead of a left-aligned full-bleed grid.
- **The `+ − fit` row became a zoom chip** in the card's bottom-left, showing
  a live percentage (100% = one ROM pixel per screen pixel). The controls and
  the pan/pinch behaviour are unchanged.
- **The bottom filter bar is six controls instead of ~25 chips over 3 rows**:
  a segmented `Background | Foreground | Collision` pill, then `Triggers ▾`,
  `Objects ▾`, `Special ▾` and `More ▾`, then `edit`/`locked` past a divider.
  **Nothing was deleted** — all 21 view toggles and all 9 ROM feature flags
  are still there, regrouped by affinity into the dropdowns, and a regression
  test enumerates every key by name so dropping one cannot be silent. New
  file `map-editor-filterbar.js`, split out of `detail-renderer.js`.
- **`Background`/`Foreground` are two derived views of one owner.** The host
  bakes exactly one of `composite`/`layer2`/`layer1` per render, so there is
  no second boolean to mirror: `romLayerVis()` derives both segments from
  `_currentLayer` and writing either one writes back through it. Turning both
  off is refused — there is no "render nothing" layer.
- **A full-width status bar** under the filter bar: `x: 07 y: 04 · 24 × 16 ·
  <draft summary> · <hovered entity>`. The draft summary moved out of the
  toolbar (same element id, same writers); the hover coordinates are new.
- **Not built, deliberately**: the mock's `S`/`B` (start a trigger draft) and
  `◆` (collision brush) pill buttons. No such tools exist in this codebase, and
  a dead control is worse than an honest gap.
- **Fixed an overlap found by visual QA**: shared.css's "decoding ROM map…"
  badge is centred on the canvas region's top edge — exactly where the new
  pill hangs. Re-hung on the card's own top-right corner.
- **File sizes**: `map-editor-ui.js` 309→248, `detail-renderer.js` 388→354,
  `map-editor-theme.css` 381→189 (the canvas column's chrome moved to a new
  `map-editor-canvas.css`). Three new files, none over 400.

## [0.55.0] — 2026-09-24

### Map editor redesign, phase 6: polish (redesign complete)

Closes out `docs/map-editor-redesign-plan.md`'s six-phase plan.

- **Triggers filter dropdown**: the flat "trigger" chip in the per-room
  filter bar gained a caret opening Step-trigger/B-trigger sub-toggles, the
  same shape as the Special chip's dropdown. `hide-step`/`hide-btrig` were
  already real `shared.css` rules with no chip wired to them — reused
  rather than inventing new keys. Lives in `map-editor-trigger-panel.js`
  (`buildTriggerFilterChipHtml`), the file that already owns the Trigger
  tab's list UI.
- **Shared filter-dropdown chrome**: the Special chip's three CSS classes
  (`.rg-special-filter`/`.rg-special-caret`/`.rg-special-dropdown`) were
  generalized to `.rg-filter-group`/`.rg-filter-caret`/`.rg-filter-popup` so
  the new Triggers dropdown reuses one chrome definition instead of a
  second copy of the same ~15 lines of CSS. `map-editor-input.js`'s
  outside-click-close logic is now one `EDIT_FILTER_MENUS` list instead of
  a block hardcoded to the Special dropdown alone.
- **Fixed a real, pre-existing visibility bug** found by this phase's own
  visual QA pass (rendering the real bundle in a headless browser and
  looking at screenshots): the filter-dropdown popup's `display:flex` rule
  (an author style) always overrode the browser's own
  `[hidden]{display:none}` rule regardless of selector specificity, so the
  Special dropdown had been visually open at all times since it shipped in
  phase 3 — the only existing test asserted the DOM `.hidden` property, not
  actual paint. One `[hidden]{display:none}` override fixes both dropdowns;
  the regression test now also checks computed `display`.
- **Zoom chip / resize grip restyle**: `.rg-zoom` (the +/-/fit controls) and
  `.rg-resize`/`.rg-resize-label` (the canvas resize grip) now use
  `map-editor-theme.css` tokens instead of `shared.css`'s pre-redesign flat
  colours. Chrome only — position, sizing and drag behavior are unchanged.
- **`STATE_FLOW.md` backfilled**: every map-editor webview state variable
  that predated the redesign table (`_edit`, `_panelOpen`, `_editOrigin`,
  `_editCompose`/`_editComposed`/`_editConstruct`, `_editSel`/`_editClip`,
  the chip/family/deco/metatile-palette state, `_editDrag`, the new-room/
  resize state, `_editPendingNote`/`_editPanelRoom`) now has a row.
- **Plan doc closed out**: `docs/map-editor-redesign-plan.md`'s phase table
  marks phase 6 landed, and a new "Redesign complete" section summarizes
  all six phases plus the deliberately deferred future work (the Entrance
  export-shape gap, Widget Editor Mode, trigger reordering).

## [0.54.0] — 2026-09-24

### Map editor redesign, phase 5: the Widgets tab

Continues `docs/map-editor-redesign-plan.md`'s structural rebuild. Confirmed
by this phase's own audit: `map-editor-deco.js`'s deco picker already
implemented almost exactly what the mock calls "Widgets" — a thumbnail
picker with filters, a search box, paging, and an arm-and-stamp flow. This
was mostly a reskin/relocation, not new work.

- **New 5th tab**: `Tile / Special / Trigger / Info / Widgets`, in the
  mock's own screen order. The deco picker moved out of the Tile tab into
  its own tab (`map-editor-deco.js`'s `widgetsTabHtml`); the picker's own
  state and logic are unchanged, only where they render moved.
- **Category grouping**: cards are grouped into Foreground/Background/Misc.
  There is no ROM-native category for this — `deco-catalogue.js`'s
  `decoIndex` now derives a `back` field (background-only: every cell draws
  terrain and no canopy) the same way the existing `front` field already
  was (foreground-only: canopy, no terrain); anything that is neither is
  Misc. Attested on the real ROM: 352 foreground, 33 background, 147 misc,
  of 532 total.
- **Visible warnings**: "+N families needed" / "1 B-trigger added" now show
  as card text (`.rg-deco-warn`), not only in the hover tooltip — the mock's
  own ask, computed from information the tooltip already had.
- **"Ready only" toggle**: filters to entries that come with a B-trigger
  script — mapped to the existing `works` filter flag (`d.scriptId !== null`)
  rather than a new boolean, since the mock never defines "ready" precisely
  and this is the closest existing semantic. The toggle and the "works" chip
  read/write the same state through the same click key, so they cannot
  disagree.
- **Widget Editor Mode (the mock's screen 7 — authoring a custom widget on
  its own grid) is explicitly deferred, not built.** No concept of a
  user-authored, savable widget exists anywhere in this codebase, and
  `map-editor-newroom.js`'s blank-room drafting has no serialization format
  to build on — see `docs/map-editor-redesign-plan.md` §5.3 for the full
  reasoning.

## [0.53.1] — 2026-09-24

### Fix: the always-visible filter bar looked like a pre-redesign leftover

The room detail filter bar (`map`, `header`, `special ▾`, `edit`, `locked`,
etc.) is shared between browsing and edit mode, but phases 0–4 of the map
editor redesign only restyled edit-mode chrome (the floating tool pill, the
tab strip). Browsing a room therefore showed *more* flat, ungrouped `.rdf`
chips than before this redesign started (phase 3 added the Special chip +
dropdown to this same bar), with none of the new theme applied — a real
visual regression on the default, non-editing view.

- The bar's root now also carries `.rg-view-filters` (`detail-renderer.js`),
  themed in `map-editor-theme.css` with the same tokens as the edit-mode
  chrome — background/border/text/accent instead of `shared.css`'s hardcoded
  `.rdf` colors. Family/tile/deco filter rows elsewhere keep the plain
  `.rdf` look untouched (they don't carry the new class).
- Chips are now grouped into logical clusters (view/ROM, entities, rendering
  aids, Special, edit/lock actions) with `.rdf-sep` dividers, instead of one
  undifferentiated two-row wall of ~20 identical buttons.
- **Found and fixed a latent bug while doing this**: the old
  `#rg-outer > .rd-filters` CSS selector also matched `#rg-edit-bar` (the
  floating tool pill) — its higher specificity was silently overriding the
  pill's own centering/padding/radius. Renaming the filter bar's hook to
  `.rg-view-filters` removes the collision; the pill now keeps its own look
  regardless of source order.
- The Special dropdown menu now has a real background/border/shadow instead
  of rendering as a bare unstyled box.

No behavior changed — every `data-hide`/`data-edit-*` attribute is untouched.

## [0.53.0] — 2026-09-24

### Map editor redesign, phase 4: the Trigger tab becomes a real editor

Continues `docs/map-editor-redesign-plan.md`'s structural rebuild. The
Trigger tab's placeholder (a read-only mirror of the entity tables above the
map) is replaced with real select/move/delete/copy-paste interactions over
the room's triggers, and a new Select tool (↖) drives them.

- **One unified trigger concept, two real sources.** A room's own ROM-sourced
  triggers (`_mtPalette.attachments.bTrigger`/`.stepOn`, read-only tuples)
  and this draft's own additions (`_edit.placed`) are merged by a new
  `map-editor-trigger-select.js` into one list per kind, addressed by a
  `{kind: 'step'|'b', id}` ref (`'base:'+i` or `'placed:'+uid`). Deleting a
  base trigger marks it hidden (`_edit.removedTriggers`) rather than mutating
  the room's own array; moving one hides it and adds a new placed entry at
  the new position, reusing the addition mechanism that already flowed into
  `editExport()`. Deleting a placed trigger soft-deletes it
  (`removed: true`) so `_edit.placed` stays append-only, preserving the
  existing tail-only undo-prune rule for the metatile dictionary.
- **A real Select tool** (new first entry in `EDIT_TOOLS`, map-editor-ui.js):
  click a trigger to select it (outlines on the canvas in its kind's accent —
  step pink, B yellow, tokens reserved since Phase 1), drag its own cells to
  move it (clamped to the room), Backspace/Delete to remove it, Cmd/Ctrl+C/V
  to copy and paste (offset +1 row/+1 col, also clamped). Every shortcut is
  inert while a text input has focus. Switching to any other tool clears the
  selection; selecting a trigger (canvas or list row) switches the dock to
  the Trigger tab.
- **One shared undo stack, not a parallel one.** A trigger op (delete/move/
  paste) is recorded as a before/after snapshot of
  `{removedTriggers, placed}` and interleaves with the tile grid's own
  `editApply` steps in `_edit.undo`/`_edit.redo` (`editApplyTriggerOp()`,
  map-editor.js). Fixed a real bug found while testing this: undo/redo could
  leave `selectedTriggerRef` pointing at a trigger that had just been
  removed/restored out from under it — `editDropStaleTriggerSelection()`
  clears it when that happens.
- **The Trigger tab's list UI** (new `map-editor-trigger-panel.js`): step/B
  sections with click-to-select rows, a mini position+crop preview cut from
  the room's own already-loaded picture (no second image pipeline), and a
  remove button. The Info tab gains step/B trigger counts — deliberately with
  no "x/16" ceiling: the ROM's trigger tables are byte-length-prefixed, not
  count-limited, and no per-room maximum is attested anywhere in
  `docs/map-format/`, so inventing one would be exactly the kind of
  unvalidated mechanics claim this project's rules forbid.
- **Not implemented, flagged for later**: drag-to-reorder the trigger lists
  (the mock's own spec mentions it) — whether ROM trigger-table order affects
  in-game evaluation priority for overlapping boxes is unconfirmed, so no
  reorder semantics were invented for base triggers. See
  `docs/map-editor-redesign-plan.md` §5.2 for the full list of decisions.
- **Proactive file-size split**: `map-editor.js` was already at 396 lines
  before this phase's undo changes; the stamp-dictionary functions
  (`editAddStamp`/`editStampWords`/`editAdoptGraphic`/`editBrushFromTile`/
  `editNeededStamps` and friends) moved to a new `map-editor-stamps.js` to
  stay well under the 400-line limit — a pure location change, no behavior
  difference.
- Tests: `tests/memory/map-editor.test.js` gained a full model-level suite
  (list merging, hit-testing, move/clamp, delete, copy/paste, export
  filtering); `tests/memory/map-editor-dom.test.js` gained an end-to-end
  Select-tool suite driven through real `editStroke`/keyboard-event calls
  (select/deselect, drag-move with clamping, undo/redo, delete, copy/paste,
  the tab-switch-on-select behavior, and the text-input shortcut guard).

## [0.52.0] — 2026-09-24

### Map editor redesign, phase 3: the Special tab (Stairs & Drift / Gate / Entrance)

Continues `docs/map-editor-redesign-plan.md`'s structural rebuild. A new,
net-new fourth tab — Special, between Tile and Trigger — lets a room pick
Stairs & Drift, Gate, or Entrance glyphs onto a cell, alongside the tile
brush rather than instead of it.

What's real vs. cosmetic follows `docs/map-format/map_collision_mechanics.md`
byte for byte, not the design mock's own bit-level assumptions (which carry
no ROM authority):

- **Gate** (bits 11..8) and **Drift** (bit 13 + bits 3..0) are genuine
  collision-word writes. Picking one modifies the affected cell's stamp
  through the existing `{layer1, layer2, collision}` model (`editAddStamp`/
  `editStampWords`), exactly like painting a tile — no new bit values were
  invented; every nibble traces to the doc's §4/§6 tables. "Boy"/"Dog"/"Rest
  of party" map to the three nibbles (7/5/3) actually attested in vanilla
  ROMs; no boy-only nibble exists, and the UI note says so.
- **Stairs** (Vertical/Diagonal L/Diagonal R) has no attested distinct
  collision encoding (the doc's own §8 documents a past mistake here) — it
  is an icon-only glyph over an ordinary painted tile, never a collision
  write. The four Drift picks in the same group *are* real writes.
- **Entrance** is "stored in the room's data, not the tile grid" per the
  design mock's own README, and `editExport()` has no field to put it in —
  visual-only, not exported, flagged as a known gap for a later phase.

New state on the draft (`map-editor.js`'s `_edit`): `specialCells`
(`"x,y" -> specialId`) and `currentSpecialId`, both documented in
`STATE_FLOW.md`. `editApply`/`editUndo`/`editRedo` now take an optional
second `specialWrites` batch so a single click that paints both a tile and a
special glyph undoes as one step, not two — the existing undo stack, not a
parallel one. A new `src/rooms/webview/map-editor-special.js` (211 LOC) owns
the catalog, the bit math, the tab's markup, and the filter bar's new
"special" chip + its caret dropdown (Stairs & Drift / Gate / Entrance
sub-toggles) — the dropdown's open/close rides the dock's existing
delegated, bind-once click handler rather than a second mechanism.
`map-editor-paint.js`'s `renderEditLayer` draws each glyph as a `<text>`
overlay, non-blocking of the tile beneath it. Paint and Erase
(`map-editor-gestures.js`) compose a tile write and a special write into one
final stamp per cell, so undo never sees two writes for the same
coordinate.

15 new pure-logic tests (`tests/memory/map-editor.test.js`) cover the bit
math, the catalog's own real-vs-cosmetic invariant, and the undo batching;
13 new DOM checks (`tests/memory/map-editor-dom.test.js`) cover the tab,
chip selection, paint/erase through a real `editStroke`, and the filter
dropdown's open/close.

## [0.51.0] — 2026-09-24

### Map editor redesign, phase 2: the tab shell

Continues `docs/map-editor-redesign-plan.md`'s structural rebuild. The right
panel that used to stack families/tiles/deco/new-metatiles/compose/checks/
budget as one long column of collapsible sections now files them under three
real tabs — Tile, Trigger, Info — with a horizontal strip (2px accent
underline on the active tab, dimmed inactive labels) that switches between
them. Special and Widgets tabs are not built yet (Phase 3/5).

A new `src/rooms/webview/map-editor-tabs.js` owns `_editActiveTab` and
renders the tab strip; it has no content of its own. `map-editor-panels.js`
now builds three content groups instead of one flat stack: `tileTabHtml`
(families/tiles/deco/needed metatiles/compose — unchanged content, just
re-homed), `infoTabHtml` (the budget bars + checks panel), and
`triggerTabHtml` — a deliberate placeholder that mirrors
`tables-builder.js`'s `buildEntityTablesHtml` output rather than owning any
trigger-editing state of its own; real click-select/drag-move/copy-paste
interactions are Phase 4's job. The always-visible entity tables
`detail-renderer.js` renders unconditionally (browsing or editing) are
untouched — the Trigger tab is an edit-mode-only duplicate, not a move.
Switching tabs needed no new event listener: `data-edit-active-tab` is just
another key in the dock's existing delegated, bind-once click handler.

The per-room filter bar (`.rd-filters`, restyled in Phase 1 but left under
`.rd-head`) is now built as its own `filtersHtml` string in
`detail-renderer.js` and handed to `buildRoomSvgSection` (`svg-builder.js`),
which docks it as the last child of `#rg-outer` — below the canvas card,
inside the same card, so it travels with the canvas in both browsing and
editing layouts instead of sitting under the room's name line.

Every existing button, filter input, `data-*` attribute, and collapsible-
panel toggle keeps working exactly as before, just filed under a tab — no
new functionality beyond the tab mechanism itself. 9 new DOM tests
(`tests/memory/map-editor-dom.test.js`) cover the tab strip's default state,
switching between all three tabs, content actually leaving the DOM (not just
CSS-hidden) on tab switch, and the Trigger tab mirroring a room's step/B
trigger tables.

## [0.50.0] — 2026-09-24

### Map editor redesign, phases 0+1: design tokens and a floating tool pill

The first two steps of `docs/map-editor-redesign-plan.md`'s structural rebuild
(scoped from a design mock — see the plan doc for the full multi-phase map).

**Phase 0 — design tokens.** A new `src/rooms/webview/map-editor-theme.css`
ports the mock's oklch palette (backgrounds, borders, text, accent,
success/warning/error, the step/B trigger colors for a later phase) as CSS
custom properties, scoped entirely under `.rg-theme` — the class
`renderRoomDetail` now puts on `#room-detail`, the node that already wraps
every piece of the map editor's DOM. `shared.css` is untouched, so the
memory/scaling/docs/route tabs render exactly as before. Typography stays
offline: a system-ui stack for chrome text, the existing mono stack for
coordinates/counts/badges — no Google Fonts fetch.

**Phase 1 — layout shell.** The edit toolbar (`buildEditToolbarHtml()`) is
now a floating pill above the canvas — rounded, shadowed, grouped by divider
into phases / tools / undo-redo-discard / new-room-export — instead of one
flat inline row. Four tools (paint/erase/rect/pick) get a Unicode glyph in
place of their text label; copy/move/stamp and every phase/action button keep
their word, since a wrong icon guess is worse than the text it would replace.
The per-room filter bar (the `data-hide` view toggles in `detail-renderer.js`)
gets the mock's "docked chrome bar" look — its own background, rounded
corners, shrink-to-fit width instead of spanning the whole detail column.
Every existing button, `data-edit-tool`/`data-edit-phase`/`data-edit-act`
attribute, and tooltip is unchanged — this is a restyle of existing markup,
not new functionality or new state.



### `> everscript new map`

A command that opens the editor **in the active column** — the whole editor area, not the right-hand strip — on the Rooms tab, already in edit mode with a blank 24×16 map drafted. It borrows graphics from room `0x34` (small, plain floor, seven families that between them attest 157 graphics), because a blank room cannot invent a Block 1: a synthetic one-entry list renders black.

It works with no `.evs` file open. A new map's content comes from the ROM, so an empty in-memory document stands in rather than the editor refusing to appear.

### Resize the canvas by dragging it

A grip on the map's bottom-right corner. Dragging reports the size in tiles **and what it costs**, live: `w*h*2 + stamps*8` against the 32768-byte window the grid shares with the dictionary, plus how many placed cells a shrink would drop. Releasing commits, and the cells that still fit survive.

The reason this is more than a CSS change: `baseMetatile === width * height * 2`. The dictionary starts immediately after the grid, so resizing **renumbers every metatile id in the room**. The draft survives that only because it stores dictionary indices and converts to ids at export. A ROM room on screen would not, so it refuses and says so rather than quietly corrupting the ids.

### The relationship index — what vanilla draws beside what

The genuinely new measurement. Every right- and down-neighbour of every cell in all 127 rooms, per layer: **693079 edges over 49374 distinct pairs**, folded into the existing index pass.

The score is **Jaccard**, `adjacent / (placed(a) + placed(b) − adjacent)`, not a raw count — and the difference is the whole point. Graphic `3736` is the gourd body's top-left canopy tile. Its raw top four are the other two gourd pieces *and* the floor and wall it happened to stand against. Jaccard puts the two gourd pieces at exactly **1.00** — always adjacent, never apart — and drops the floor to 0.04.

Relationship and family turn out to be independent: only **38.1%** of neighbour pairs share a dominant family. So grouping by one and ranking by the other is two signals, not one said twice.

### The sidebar, pointed the other way round

**Family chips.** A family id is not a name. Every family is now a chip leading with its two most-placed tiles — all 329 in one 81 KB sheet — plus its id and act. A chip **filters** the tile list; select several, or none for everything. The `×` **frees the slot**, which the old one did not do: it carried the picker's data attribute and opened the browser to swap the family instead. Proven in a browser before and after.

**The tile list is the primary control.** Tiles are grouped by family and, within a group, ordered by how well they go with what you have already placed — so once one gourd tile is down, the rest of the gourd is at the top. Clicking a tile adopts its family, so the seven fill themselves as a consequence of drawing rather than a prerequisite for it.

**Foreground or background, decided by vanilla.** Each tile is badged with the layer vanilla draws it on (4822 of 5628 graphics are ≥90% one-sided) and lands there automatically. `front` and `ground` force every pick onto a layer regardless — a tilemap word does not care which of the two slots it is written into.

**A recommended-neighbours strip** under the selection, scored, one click from placing.

**Removing a family is now a check, not a silent recolour.** The word still names palette slot N and slot N is now empty, so the cells that named it are stranded and the checks panel counts them and says what to do.

### One scroll container

The sidebar scrolls; nothing inside it does. Three nested `max-height` + `overflow` pairs are gone (`.rg-fam-list` at 140px, `.rs-mt-sheet` at 340px, panel sheets at 180px). A panel that is open is as tall as its content.

### Not reproduced

"The graphics are broken" was not reproducible as a rendering fault: the preview sheet is a correct 128×192 PNG of 12 rows × 8 real tiles, and in a browser every strip cell measured exactly 16px at the right offsets. What was true is that eight mostly-dark tiles at 16px in a 320px column tell you nothing. The chips show two tiles at 32×16 and the groups show everything at 2×, which is the fix if the complaint was legibility. Say so if it persists.

## [0.48.0] — 2026-09-22

### The edit and "new room" buttons work every time now

They worked after an odd number of room renders and were dead after an even one. `#room-detail` survives a re-render — only its `innerHTML` is replaced — but `bindEditControls` attached a fresh click handler on every render, stacking them on the same node. Two handlers meant every toggle fired twice and cancelled itself out: `edit` turned edit mode on and straight back off, `new room` opened the form and closed it.

The panel is now bound once, the way the gesture and key handlers already were. Proven in a browser: bind twice, click once, and edit mode has to end up in the other state.

### Picking a tile hands the clicks back to the brush

The stamp tool places the armed *construct* and ignores the brush entirely, so arming a widget and then clicking a grass tile sent the next map click to the widget. That was "I'm not allowed to stamp a gourd tile, even though it is part of my family". Choosing a tile is choosing to paint, so it now says so: the tool goes back to paint and the armed construct is released.

### Finding the gourd you can actually use

532 nameless objects is a haystack, so the picker gained the four questions the ROM can answer, as buttons:

| | keeps | how many |
|---|---|---|
| **fits** | entries every one of whose families you already have | 93 of 532, for room `0x34`'s seven |
| **works** | entries that came with a B-trigger script | 68 |
| **front** | entries that draw on the canopy alone, over any floor | 352 |
| **open** | entries with more than one state | 134 |

All four at once is "a fully working, foreground-only gourd out of my own families" — **27 entries** in room `0x34`, including the family-35 gourds. An entry is dimmed and badged `+N` when it would cost palette slots you have not got, rather than hidden: it is a decision, not an error. Typed words now AND together too, so `ebon keep` and `ivor 3x4` both narrow the way you would expect.

This needed the index to change shape: an entry carries its **family ids**, not a count, because whether it is usable depends on the seven the draft holds and only the editor knows those.

### No more "showing 16"

A family strip cut itself off at sixteen swatches and said so, which hid two of family 35's eighteen for no reason. Everything the host sends is shown. The host still caps at 128 graphics per family, and *that* is worth saying, so a big family reads "the 128 most-used shown".

### Internal

`map-editor-input.js` passed 400 lines, so the map's own pointer and key gestures moved to `map-editor-gestures.js`. The split follows a line that was already there: one file is the map, the other is the chrome.

## [0.47.0] — 2026-09-21

### The deco library now stamps the thing, not the place

Stamped deco came out as rubble, and it brought a patch of someone else's floor with it. Two separate bugs, both now measured and fixed.

**A tilemap word is room-relative.** Its low ten bits index *that room's* Block 1 and its palette bits index *that room's* seven families. The library stored words, so replaying one in another room named a different picture in different colours. An entry now stores `{graphic, family, flags}` per layer and the destination rebuilds the word, adopting the graphic and the family it needs — or refusing by name when all seven palette slots are spoken for, which is better than half a gourd in the wrong colours. The same pot now renders identically stamped into room `0x51` (its home) and room `0x34` (different Block 1, different family order).

**An object's rectangle contains the floor it stands on.** Across the 863 candidate objects in all 127 rooms, **83.4%** of the terrain words inside an object rectangle are also used outside every object rectangle: they are the room's ground, not the object. Those are dropped. A layer stored as `null` means *keep whatever is already there*, and **82.2%** of the library's 4081 cells now leave the ground to the destination room. Cells that are pure bounding box — nothing drawn, and the floor's own collision — are left out, so a 2×3 entry whose art is two cells stamps two cells.

Blankness is tested on the pixels, not on the word: 122 of the 127 rooms use an all-transparent graphic as their most-placed canopy word, but `0x0e`, `0x1e`, `0x4d`, `0x72` and `0x73` have real ceiling art there, and treating that as blank would have cut the ceiling out of every object in those rooms.

Stripping the floor is also what makes deduplication work — the library went from 655 entries to **532**.

### A thumbnail of the object, on nothing

Previews were cropped out of a render of the room the object lives in, so every gourd came with a patch of that room's floor. Each entry is now packed into a synthetic room exactly its own size and composited over a **transparent** backdrop, then centred in its cell and halved if it is bigger than one. The picker draws a checkerboard behind it, so what you see is the object and what it will not cover.

### A stamped gourd works

**99 of the 863 objects** sit under a B-trigger, 50 of them with the same shape: the object's rectangle grown one tile right and down. After deduplication **68 of the 532 entries** carry one. An entry now brings its object record and its B-trigger along, stamping records them in the draft, and the export carries them next to the metatiles.

The script id is vanilla's, copied with the art — that is what makes the gourd work the moment it lands, and it is also why the editor says so out loud: two copies of one entry run one script and share its "already opened" flag until one is pointed at a new one. `ctrl+z` takes the object and the trigger back with the tiles; redo puts them back.

The picker's new **`works`** filter keeps only the entries that come with a script, and each one's tooltip says how many of its cells it draws, what it costs in families and tiles, and which script it runs.

## [0.46.0] — 2026-09-21

### A deco library, read out of the ROM

Section 3 objects **are** the game's deco widgets — that is where the gourds, pots and fire pits already live. Room `0x51` is 25 gourds and pots; room `0x25`'s 4×3 objects are fire pits, lit and unlit. So the library is not invented, it is read out: **655 distinct objects**, deduplicated by the metatile words they are made of, with how often the game places each one.

Click one and it becomes an armed construct you can stamp.

**There are no names in the ROM.** An object is a rectangle of metatiles and an id; nothing says "gourd". So the picker is visual: a thumbnail cropped from a render of the room the object lives in (floor included, or a gourd reads as a silhouette), plus its size, its act, its room, and whether it has more than one state. Filter by act, room name, a size like `4x3`, or `open` for the 134 that open, break or burn.

Copying the art is not copying the object record, and the note says so: a multi-state object stamps **its tiles only**.

### `ctrl+z` now reverts the metatiles too

Undo restored the cells but left every stamp it had created in the dictionary, so the budget only ever grew. Undo and redo now prune the metatiles nothing references any more — and the adopted graphics with them.

Only the **tail** is pruned. An index is a position, so removing from the middle would silently repoint every cell above it; stamps still in use keep their original index. The armed brush survives even unplaced, because you chose it on purpose.

### A tile goes on the layer vanilla puts it on

You were right that transparency implies foreground, and the ROM can settle it: the index now counts, per graphic, how often it is drawn as canopy versus terrain. **4822 of 5628 graphics are at least 90% one-sided.**

So picking a tile no longer just follows the phase — where vanilla has an opinion (≥60%), that decides which word the new metatile gets, and the status line says it is following the game. Below that the phase breaks the tie.

### "2×2 shows 4×4 tiles"

Two causes, both fixed:

- `svg-builder` **bakes the grid paths** from the room it rendered, so swapping a blank room underneath left the previous room's lines behind. The grid is regenerated for the new size.
- The viewBox kept `svg-builder`'s 8-unit minimum, which drew lines past the edge of a small room. It is now the room's exact extent.

### Also

- `map-editor-phases.js` split out of `map-editor.js` to stay under the 400-line limit.
- The browser test is at **53 checks**, including that undo prunes from the tail only and that the regenerated grid stops at the room's edge.

## [0.45.0] — 2026-09-21

### Clicking a tile in a family strip did nothing

It was dead code. `editUseFamilyTile` was written in 0.44.0 but never wired up: the branch that should have called it was still the old one, because a `str.replace` I used to swap it silently matched nothing (the file had a literal em-dash where the pattern had an escape). The brush stayed at −1, the checks kept saying "no brush selected", and the map could not be painted.

Now the click does the whole chain, and it is pinned by a browser test that clicks the real swatch and then paints with it.

### You can see what you picked

- **The swatch itself gets the selected ring.** A click with no visible confirmation reads as a dead control, which is exactly how this felt.
- **The status line survives.** Every explanation the editor produced was being overwritten in the same tick — almost every caller of `editNote` goes on to `renderEditChrome`, which rewrote that slot with the cell/brush summary. A note now holds until the next render shows it, then hands back to the live summary:

```
brush: graphic 4186 in family 58 — stamp #175, as ground. Paint on the map.
→ 1 cell, 1 new stamp · brush #175
```

### Tiles are 32px again

0.44.0 dropped the panel strips to 1× to save vertical space, which made 16px of pixel art impossible to read — you could not tell a wall from a floor. The strips keep the palette's **integer 2× scale**; only the family picker's dense browse list stays 1×, where the rows are a list rather than swatches to aim at.

### Also

The browser test loads the **real stylesheet** now. Without it every swatch is 0×0, so nothing is clickable and no size assertion means anything — which is why the dead click path survived the previous round of tests. 39 checks.

## [0.44.0] — 2026-09-21

### Click a tile, get something you can stamp

The missing step in the inverted flow. Clicking a tile now **creates the metatile for it** and makes it the brush, with the other two words deliberately empty:

| Phase | canopy | terrain | collision |
|---|---|---|---|
| **room** | blank | **the tile** | `$0000` |
| **deco** | **the tile** | kept by `editResolve` | `$0000` |

A bare graphic says nothing about what is drawn over it or what is solid, so inventing either would be a guess. `$0000` is the format's do-nothing collision — plane 0, geometry open — not a claim about the tile.

Picking a tile out of a **family strip** does the whole chain: adopts the family into a palette slot, adopts the graphic into a Block 1 slot, builds the word that names that new slot in that family, and creates the stamp. Each step costs budget and each is reported. The composed preview is told about the adopted graphics and families too — without that, a word naming a freshly adopted tile resolves to whatever the room had in that slot and the swatch draws the wrong picture.

### "The first time you click edit you get an old version of the editor"

You did. Edit mode docked the **pre-rebuild tile palette section** next to the new panel column, so two different tile pickers were on screen at once and the older one was on top. The browsing palette below the map now steps aside while editing — the panel column is the editor's whole tile UI.

The composer moved into the panel column with it (it was being injected into the section that is now hidden) and starts collapsed, since clicking a tile is the main path and hand-composing is the fallback.

### Less clunk

- Panel tile strips render at 1× instead of 2×. The palette's doubled scale made every sidebar row 32px tall and turned the column into a scrolling chore.
- **new metatiles** and **compose & constructs** start collapsed; metrics, checks, families and tiles start open.
- The dock is wider (300–460px), so family rows stop wrapping mid-word.

### Also

- `map-editor-constructs.js` split out of `map-editor.js` to stay under the 400-line limit.
- `tests/memory/map-editor-dom.test.js` is up to 32 browser-driven checks, including that edit mode shows exactly one tile picker, and that a tile click produces a stamp with empty canopy and collision.

## [0.43.0] — 2026-09-21

### The family picker shows the art, and says what the family is for

A family id is a terrible name. "220" tells you nothing; **"220 · Omnitopia · Reactor room"** with eight of its tiles next to it is a choice you can actually make.

Each row in the picker now carries:

- **its art**, eight tiles rendered in that family, *before* you pick it
- **the acts** it appears in — Prehistoria, Antiqua, Gothica, Omnitopia
- **the rooms**, by name: "Fire Eyes' Village", "Ebon Keep sewers", "Pipe maze"

Twelve families a page with back/more, because twelve rows of art is what fits. The strips come as **one image per page**, not one request per family.

**The filter takes what you actually know**: an act (`omni`), a room name (`strong`), an id (`58`), or `>100` for the big ones.

### The 2×2 room bug

A small new room came out as a giant blurry grid. Everything inside `#rg-svg` is in **viewBox units of 8px**, not pixels, and I had set the image's width to its pixel width — so a 32px-wide room was drawn 8× oversize, and what you saw was a magnified corner of the floor with the 1-unit grid lines stretched across it.

The image is now sized in viewBox units, the viewBox keeps `svg-builder`'s 8-unit minimum so a tiny room is not blown up past the panel, and the SVG and its wrappers are resized to match. The stale canopy and collision overlays from the previous room are cleared too, instead of being stretched over the new one.

### Also

- Fixed: a blank room's budget meter read **"attested undefined"** — it was built with `roomBudget` instead of `budgetSummary`, which is the one that carries the attested-vocabulary count.
- The tiles panel's header said "tiles families"; it now says how many of what.
- `tests/memory/map-editor-dom.test.js` grows to 22 browser-driven checks, including the viewBox-units regression and the 2×2 minimum.

## [0.42.0] — 2026-09-21

### Two bugs a logic test could never have caught

**"new room" did nothing.** It asked for the size with `window.prompt`, which **does not exist in a VS Code webview** — the call is silently inert. Replaced with an inline form: width, height, create, cancel. Creating one now also rewrites the palette's grid and the SVG viewBox, so the editor actually paints into the new room instead of against the old room's cells.

**Clicking a panel's caret did nothing.** `e.target` is the deepest node under the pointer — the `<span>` holding the caret, not the header carrying `data-panel`. The click handler now walks up to the nearest element with a known data attribute, which also fixes every button that has a `<span>` inside it.

Both are now pinned by **`tests/memory/map-editor-dom.test.js`**, which drives the real chrome in a real browser through Playwright (already a devDependency). It skips cleanly where no browser is installed.

### Tile families: add, remove, preview, filter

The seven slots are now editable rather than a read-out.

- **×** on a filled slot, **+** on an empty one, both opening the same picker.
- The picker lists **every family the ROM attests** (329 of them), biggest first, with each one's graphic and room counts. Type an id to jump to it, or `>100` for the big ones.
- Clicking a slot **previews that family's whole art**.
- **Picking a tile adopts its family**: if it is not in your seven it takes the first free slot, and if all seven are taken it says so instead of silently drawing the tile in the wrong colours.

Fixed while building it: the filter matched an id **or** a minimum tile count in one expression, so typing `58` also kept every family with at least 58 graphics — which is most of the big ones. The two are now separate, `>N` for the count.

### Tiles are drawn in the family they belong to

The tile list has three sources:

- **my families** (new default) — each chosen family's art, **rendered in that family**. This is the fix for recommended tiles being shown in the wrong colours: a graphic carries no colours of its own, so a tile in the wrong palette is a different picture.
- **this room** — the 92 graphics Block 1 loaded.
- **by usage** — the co-occurrence grouping from 0.41.0.

### Also

- `buildFamilyCatalogue` on the host: 329 families as `[id, graphics, rooms]`, about a kilobyte, sent once and filtered in the webview.
- `map-editor-input.js` split into `map-editor-families.js`, `map-editor-actions.js` and `map-editor-newroom.js` to stay inside the 400-line limit.

## [0.41.0] — 2026-09-21

### The editor, rebuilt around the inverted flow

Edit mode now opens a panel column beside the map. Everything below is in it.

**Metrics.** The budget meter from 0.40.0 moves to the top of the editor, where it belongs.

**Tile family slots.** Seven slots, one per background palette, each showing which family it holds. Click one and you get *every graphic vanilla has ever drawn in that family* — family 58 is 74 graphics across 3 rooms, family 32 is 210 across 13 — so choosing a slot is a reviewable decision instead of a guess at a palette id.

**Tiles grouped by which rooms use them together.** The room's 92 graphics become 11 groups. Graphics that appear in exactly the same rooms were put there for the same scene, so the grouping separates walls from floor from one-offs without anyone having labelled anything.

**New metatiles.** A live list of the stamps the draft needs that the room does not already define, with their three words and what they cost in bytes. Placing the same thing twice adds nothing to it.

**Checks.** Hard errors (past the seven-family clamp, past what a tilemap word can name, past the memory window) and warnings (past what any vanilla room does) are separated, because only the first kind is impossible.

### Layer phases — draw the room, then fill it with deco

Two phases that write genuinely different things:

| Phase | Canopy | Terrain | Collision |
|---|---|---|---|
| **room** | brush | brush | brush |
| **deco** | brush | **kept** | brush |
| **erase** (deco) | blank | **kept** | the room's own, for that terrain |

The deco row is what room `0x34` actually does — a plain floor cell is canopy `$A800` over terrain `$4C62`, and the hide on the floor is canopy `$2C66` over the *same* `$4C62`. So painting a gourd onto a floor cannot replace the floor.

### The eraser

**erase** rubs decoration off. Both halves are derived from the room rather than assumed:

- the blank canopy is the room's most-placed canopy word — `$A800` in every room measured (140 placements in `0x34`, 2034 in `0x76`, 3800 in `0x38`), and room `0x34`'s graphic at that word has **zero** non-transparent pixels, so erasing to it really does erase.
- the restored collision is the one the room uses most on bare ground of that terrain — otherwise removing a gourd would leave a hole you still cannot walk through.

Erasing already-bare floor is a no-op rather than a pointless new stamp.

### Constructs — stamp the whole thing

Select a region, save it, stamp it. A construct stores its stamps **as words**, so it survives being placed in a room with a different dictionary, and it carries every trigger and object whose rectangle overlaps the selection. Read straight out of room `0x34`:

```
objects   (5,5) 2x2 · (12,7) 2x2 · (11,5) 2x2      <- the three gourds
bTrigger  (8,11)-(10,13) script 1854 · (14,11)-(16,13) 1857 · (15,13)-(17,15) 1860
stepOn    (11,23)-(13,24) script 1851
```

So a gourd comes with an object and a B-trigger; the hide on the floor comes with metatiles and nothing else. The library says which before you place it.

### A blank room to test in

**new room** drafts a room that is not in the ROM, at any size from 2×2 to 128×128. It borrows the current room's graphics list and families, because a synthetic room with its own one-entry Block 1 renders black — rule 7.1.

Its floor is the borrowed room's most-placed **walkable** stamp, not entry 0 and not simply the most placed: entry 0 is wherever the encoder happened to start, and the most-placed stamp is usually the black surround outside the playable area. Both make a new room look broken.

`roomProblems` checks what an encoder would: the minimum size, that `baseMetatile` matches `width * height * 2`, and that cell (0,0) uses metatile 0.

### Also

- `src/maps/blank-room.ts` and `groupByRooms` are pure and tested; the index now also tracks which rooms draw each graphic.
- Fixed: the grouped tile view embedded the sheet's 13 KB data URI once per group — 150 KB of markup for one image. Now hoisted to a single wrapper (25 KB), with a test that pins it.

## [0.40.0] — 2026-09-21

### Inverting the editor: the vanilla ROM as a lookup table

New design page, [building-a-room-from-a-picture.md](docs/map-format/building-a-room-from-a-picture.md), and the first two phases of it.

The premise: you know what the room should look like; the editor should work out the families, graphics, stamps and collision words. That is possible because **127 vanilla rooms are a labelled training set** — 779 752 placements already answer "which family does this graphic belong to" and "what collision goes under this art".

### `src/maps/vanilla-index.ts` — measured, not guessed

One pass over all 127 rooms (~64 ms, cached) building graphic → family and graphic → collision, counted by placements and ranked.

- **Family lookup is strong**: 3236 of 5628 graphics (57.5%) are only ever drawn in **one** family; 3503 (62.2%) have one carrying ≥90% of their placements. Pick the art, the family follows.
- **Collision lookup is weak, and the UI says so**: only 1296 of 3065 (42.3%) terrain graphics have a single collision word. So it is **suggested with its confidence**, never asserted.
- `graphicsForFamilies` turns a seven-family choice into a filtered vocabulary — room `0x34`'s set attests **157** graphics out of 6202 game-wide.

### `src/maps/budget.ts` — the four ceilings

`roomBudget` and `marginalCost`, the latter computed against what the room already has. The gourd in Strongheart's Hut costs **nothing** in room `0x34` and **10 graphics + 3 families + 1 stamp, over the family ceiling** in room `0x33`.

**Correction**: [building-a-room-from-scratch.md](docs/map-format/building-a-room-from-scratch.md) §4.2 gives the graphics high-water mark as 246. That is Block 1 alone. Counting animated graphics, which share the same slot space, the real maximum is **255** (room `0x08`) against the ~264 ceiling — nine slots, not eighteen.

### Rooms tab

- **A budget meter** under the tile palette: graphics, families, stamps, WRAM, each with its bar and vanilla's own high-water mark on hover. Families is the only line that can go red — the loader hard-clamps to 7.
- **Vanilla evidence per graphic**: select one in the **tiles** view and it reads `usually family 58 (100%, only one seen) · collision $101F (94% of placements)`, or says outright that vanilla has never drawn it.

### Findings worth recording

- **Vanilla has no object library.** Room `0x34`'s three gourds use three *disjoint* graphic sets — each was authored separately. Harvesting repeated 2×2 blocks (30 574 of them exist) yields grass and walls, not gourds; the gourd block occurs exactly **once**. So the object library has to be user-built, seeded by selection.
- **The master `$EE0000` table is ordered by art group.** Ids 3728–3775 are one coherent hut/gourd/vegetation set, which makes "show me the neighbours of this graphic" a real discovery tool.
- **The gourd is 2×3, not 2×2** — 6 stamps, 10 graphics, 3 families — and its body sits in the **canopy** layer, so the character walks behind it.

## [0.39.0] — 2026-09-21

### Rooms tab: the tiles view is now a real tile browser

The **graphics** view is renamed **tiles** and both view buttons carry their count, so `stamps · 175` / `tiles · 92` says up front what each one holds. The summary line follows the view instead of always describing the dictionary.

**The palette selector became family tabs.** It used to read `1 2 3 4 5 6 7`; it now reads the room's own family ids — `35 187 58 165 149 59 166` — because that is the number the header lists and the number a tilemap word's palette field selects. One tab per family the room loaded, each showing the same 92 graphics in that family's sixteen colours.

A graphic is now **selectable**, and the detail line under the sheet gives the whole word: `#41 word $0C02 — tile id $0423, chr 2, pal 3`. That word is the thing an editor writes, so it is the thing the tab shows.

Switching family tabs no longer re-renders the metatile atlas. Tile sheets have their own cache keyed by palette, which takes a tab switch on room 0x34 from 13 ms to 2 ms — and from seven full re-renders to one on room 0x37's 2131 stamps.

### Map editor: **add stamp** does something, and says so when it cannot

It required a canopy word *and* a terrain word and returned silently without them, which from the outside is a dead button. Now:

- **Raw tiles compose.** Clicking a graphic in the **tiles** view fills whichever composer source is armed. Previously only stamps could be picked, so the graphics sheet was a read-only reference — you could see the window tile but not build a stamp out of it.
- **A collision word still comes from a stamp.** Nothing in a tilemap word says what is solid, so arming `collision` and clicking a graphic is refused with a reason rather than inventing geometry.
- **`from brush`** loads all three words from the selected stamp — the shortest path to a working stamp is to take one that already works and change the one word you care about.
- **The hint line tracks state**: what to click while a source is armed, what is missing when it is not, and that it is ready when it is. `add stamp` lights up only when it will actually do something, and the status slot explains every refusal (`a stamp needs both a canopy and a terrain word`, `no stamp in this room draws that terrain word yet`).

Five new tests in `tests/memory/map-editor.test.js` pin it: the `chr | pal << 10` word, the family-id tab labels, the armed-source pick, the collision refusal, and that a half-composed stamp adds nothing while a whole one lands and becomes the brush.

## [0.38.0] — 2026-09-21

### Rooms tab: see the graphics a room actually loaded

The Tile palette section gains a **graphics** view beside **stamps**. Stamps are the combinations the room already defines; graphics are the **raw material** — every 16×16 picture Block 1 loaded, any of which a new stamp may name. Each swatch's tooltip gives the `chr` value a tilemap word needs in order to draw it, and animated entries (Section 2) are outlined in amber.

A graphic has no colours of its own, so the view has a palette selector: the same sheet redrawn in each of the room's background palettes.

### Corrections — `tileFamilies` are palettes, and the canopy is BG1

Two things the docs had wrong, both caught by reading the loader:

- **A tile family is not a graphics bank.** It is a **16-colour palette**, a 32-byte BGR555 record at `$9CC322 + id*32`, DMA'd to CGRAM by `$90D020`. Families map to background palette slots 1–7 in list order, and **the loader clamps to 7** (`$90D037`), tracking progress in `$7E2437` — which is why 74 rooms list exactly 7 and 18 list 14 (two sets, swapped at runtime). So "how many families until VRAM is full" has no answer: they never touch VRAM. The real ceilings are 7 palettes, ~264 addressable graphics (246 is the vanilla max), and v-blank bandwidth for animation.
- **The canopy layer is BG1, not BG2.** `room.ts` claimed BG2; `compositeLayers` gates it on `displayTm` bit 0 and the pixel-parity test agrees. Mode 1 draws BG1 above BG2, so the upper layer is BG1. Comment fixed.

### Docs: [building-a-room-from-scratch.md](docs/map-format/building-a-room-from-scratch.md)

Expanded with everything needed to actually choose values rather than copy defaults:

- **Visible layers** — bit table and a menu of useful combinations (`21` = terrain off, `7` = sprites off, `19` = no HUD…), with the caveat that a layer switched off also leaves colour math.
- **The blend** — all three fields together, and the **dark cave** (`0x4b`) worked end to end. The reader's guess was right: its canopy is a soft-edged disc that is *subtracted* from the terrain, and room effect 1 slides it with the camera. Refinement: the dark disc is where subtraction *stops*, so it is a lantern drawn as a hole in a mask, and the top-left square is the layer's entire extent.
- **Room effects** — what all eight jump-table entries at `$908E74` do, and which rooms use them.
- **Camera flags** — bit 14, the only bit any code reads.
- **`extraGraphics`** — the 3-byte descriptor decoded field by field.
- **Rule 7.2 corrected.** "Introduce stamps in ascending order" is the safe advice, not the rule. The literal index field widens as the sequential token fires (`bits = floor(log2(counter)) + 1`), so gaps *are* legal below that width — verified against the encoder with five cases. It is also why 7591 vanilla stamps can be defined but never placed.
- **Real examples** for animated tiles, objects and cuttable grass, taken from the decoder rather than invented — including that object states are **XOR deltas**, not absolute stamps, and that cuttable grass can take several slashes.

## [0.37.2] — 2026-09-21

### Docs: building a room from scratch, with nothing left as "unknown"

New tutorial: [docs/map-format/building-a-room-from-scratch.md](docs/map-format/building-a-room-from-scratch.md), plus the script that produces it ([examples-build-rooms.py](docs/map-format/examples-build-rooms.py)). Five rooms of increasing difficulty — one stamp; the same picture with half of it solid; two looks; a canopy the player walks behind; a trigger — each built, spliced into a scratch ROM, read back and rendered.

**The header is now fully decoded.** The previous note called bytes 9–12 reserved/unknown. Disassembling the loader at `$908F60` shows that is wrong:

- **`+9..+10` is a real 16-bit field**, read with `REP #$21` and stored at `$0F84`. Exactly one site in the ROM reads it — `$909ECC` tests **bit 14**, which pulls the camera to `focusY − 96` when it sits below that (`$0617` is the camera focus point, written at `$8EA0F5` from entity `+0x1C` minus 13). Zero in all 127 rooms, so the shipped game never uses it.
- **`+11..+12` really are skipped** — the loader does `INY/INY` at `$90904D` and its next read is the trigger length at +13.

Every other header byte is named by what the loader does with it (`$212C`/`$212D`/`$2131`/`$2130`, and the room-effect jump table at `$9092BC`), with distributions measured across all 127 rooms — `blendRules` is `2` in literally every one.

**Two rules the examples discovered the hard way**, both of which broke a build:

- **Borrow a whole tile set, never one entry.** A room with one Block 1 entry decodes perfectly and renders *solid black*: word `0x302C` wants character 44, which resolves to palette slot 14, and a short list silently falls back to tile 0.
- **Stamps must be introduced in first-appearance order.** The grid compressor grows its index field as new stamps appear, so stamp *n* cannot be referenced before *0…n−1*. Build the dictionary from the grid, not the other way round.

Also documented: `extraGraphics` descriptors (3 bytes → `$90D50F`), and Section 4's first byte as the grid compressor's pre-registered-stamp seed.

## [0.37.1] — 2026-09-21

### Painting smeared the whole tile sheet over the map

A painted cell is a nested `<svg>` whose `viewBox` crops one 16×16 stamp out of the palette atlas — and **the crop is the nested viewport clipping**, nothing else. 0.37.0 shipped `.rg-edit-cell{overflow:visible}`, which switched that clipping off, so every painted cell drew the entire 256px-wide sheet scaled across the room. One stroke and the map was gone.

One character of CSS; `overflow:hidden` now, explicitly, with the reason written next to it. `map-editor.test.js` asserts the rule, because no runtime test would catch a stylesheet turning off the mechanism the geometry depends on.

## [0.37.0] — 2026-09-21

The map is editable: a docked tile sidebar, five drawing tools, undo, and a metatile composer.

### The palette docks beside the map

Turning on **edit** moves the Tile palette section next to the map instead of below it — moved, not rendered twice, so there is one node, one set of handlers and one selection wherever it sits. It loads itself on entry rather than making you find the button.

### Drawing

| Tool | Does |
|---|---|
| **paint** | click or drag to stamp the selected tile |
| **rect** | drag a rectangle and fill it |
| **pick** | take the stamp under the cursor as the brush |
| **copy** | drag a region, then click to stamp it elsewhere |
| **move** | the same, but the source is backfilled with the brush |

`move` has to backfill because the format has no empty cell — every cell holds *some* metatile, so "move this window to the side" must say what is left behind, and the brush is the one answer that is the user's choice rather than the editor's guess.

Undo is per **gesture**, not per cell: a rectangle fill or a paste undoes in one step. `⌘Z` / `⌘⇧Z`, `Esc` drops a selection.

A painted cell is drawn **client-side out of the palette atlas the tab already has** — a nested `<svg>` whose `viewBox` crops one 16×16 stamp out of the sheet — so a stroke is instant and costs no round trip. The layer sits directly above the map image and below everything else, because an edit replaces map pixels: it is scenery, and the canopy and the feature overlay still belong on top.

### Composing new metatiles

Pick a **canopy** source, a **terrain** source and a **collision** word by clicking stamps in the palette, and add the combination. The host renders the new stamps against the room they are for, so the swatch uses that room's families, palette and display registers.

Two rules keep the dictionary from exploding: a combination the room already has returns that stamp and adds nothing, and one the draft already made returns the one it made. `collision = terrain` fills the third field with whatever collision word the room already pairs with that terrain. New stamps continue past the room's own dictionary — index `count + n` — which is how they would be appended to Block 3.

### The draft

**Nothing is written to the ROM.** `copy draft` puts the edit on the clipboard and opens it as an untitled JSON document:

```json
{ "roomId": 118, "baseMetatile": 7280, "originalMetatileCount": 702,
  "cells": [ { "x": 12, "y": 30, "metatileId": 7392 } ],
  "appendMetatiles": [ { "layer1": 13706, "layer2": 6604, "collision": 4127 } ] }
```

`cells` carries **WRAM ids**, not dictionary indices, because that is what `layer1_metatile_ids` holds — a draft handing back indices would be silently wrong, so the test pins it.

### Internals

- `src/rooms/webview/map-editor.js` is deliberately DOM-free (draft, undo stack, dedup, export), which is what makes `tests/memory/map-editor.test.js` possible: **17 tests**, including the move-a-region gesture and the atlas crop.
- Gestures attach to `#rg-wrap` in the **capture** phase, so a stroke is decided before the pan/select handlers ever see it and nothing is intercepted while edit mode is off.
- The palette payload now carries the room's grid as dictionary indices (42 KB on the largest room), which is what makes pick, copy and move possible at all.
- `buildComposedPreview` on the host; `withMetatiles(room, entries)` in `src/maps/metatiles.ts`.

## [0.36.0] — 2026-09-21

First map-editor work: the placement palette, and the write path proven before anything is built on it.

### Which tiles can be placed — the dictionary, not the tile families

A grid cell stores a **metatile id**, and Block 3 turns it into three parallel words: the Layer 1 (canopy) tilemap word, the Layer 2 (terrain) one, and the collision word. So a metatile is a whole vertical stack — art *and* behaviour, bound together — and **nothing outside the room's dictionary can be placed without extending it**.

Measured across all 127 rooms: 2 to 2131 metatiles per room (median 503), 1–14 tile families, 2–246 Block 1 tile ids. **7591 of the 75203 defined metatiles are never placed** — each one a free slot for a new combination.

New `src/maps/metatiles.ts`:

- `metatileTable(room)` — every entry with its two words, its collision word, and how many cells use it.
- `renderMetatileAtlas(rom, room, {columns, layer})` — the whole dictionary as one image, in composite / terrain / canopy. It is built as a **synthetic room whose tilemaps are the dictionary** and handed to `renderRoomComposite`, so it goes through the same Mode 1 path the map does instead of a second copy of it.

Pinned by `checkMetatilePalette`: 640 sampled cells across four rooms must each be pixel-identical to the same metatile where it appears in the room.

### Tile palette in the Rooms tab

A new section showing the dictionary as a sheet of stamps, with the three layer views, a used/spare filter, and a detail line decoding the selected stamp's words (`chr`, palette, priority, flips). Fetched **on demand** — room `0x37`'s atlas is a 325 KB data URI, and entries are packed as arrays rather than objects (50 KB instead of 166 KB on that room).

### The write path is verified, not assumed

`npm run check:encode` runs the sibling repo's `tools/encode_room.py --verify --verify-rebuild`:

```
byte-exact round-trip: 127/127 rooms
re-encoded round-trip:  127/127 rooms
```

Both pass today. The extension does not write anything yet; this makes the encoder a checked dependency rather than a claim, and it skips gracefully when the checkout, ROM or venv is missing.

### Design: [docs/map-format/map_editor_ui.md](docs/map-format/map_editor_ui.md)

The UI answer to the whole request, including the awkward part: **a per-layer edit is a find-or-create on the dictionary**, because a metatile carries both layers and the collision word. Painting canopy onto a cell means finding (or adding) a metatile with the new canopy word and the old terrain and collision. That also makes "solid but looks the same" fall out for free. Also covers resize (`baseMetatile = width * height * 2`, so a resize renumbers every metatile in the room), the WRAM ceiling (largest vanilla room: 32680 bytes of grid + dictionary), trigger/object counts, and what to borrow from Lunar Magic, Tiled, ZScream, Temporal Flux and LazyShell.

## [0.35.1] — 2026-09-21

### The dash was cut across the screen, not along the wall

Upstream's dash pattern is `floor((x + y) / 3) % 2` — a stripe that is **constant along the 45-degree diagonal**, which is the direction half the geometry codes draw. So a diagonal boundary landed inside one band and came out fully solid, right next to a horizontal one that dotted correctly. It looked like solid/dotted was being mixed with thick/thin; it was one pattern that only works in some directions.

With a visibility mask, `dashAlongContour` now breadth-first walks the 1px edge and cuts the dash from each pixel's **distance along the contour**, so a dash is the same length whichever way the wall runs. Components are entered in raster order, which keeps it deterministic — the map raster and the canopy layer each draw the contour once and have to agree pixel for pixel.

Pinned by `checkDashBreaks`: in rooms `0x3b`, `0x76` and `0x25`, the longest unbroken run of covered contour is measured in all four directions and must be at most 12px. It is now 3–7px everywhere; before, a diagonal ran the length of the wall.

Upstream's drawing is untouched without a mask, so `checkOverlayParity` still compares it.

## [0.35.0] — 2026-09-21

Dots instead of weight, and a real answer to "what is actually covered".

### Covered collision is dotted again

Reverted the weight experiment. With a visibility mask, every plane draws **solid in its own colour** and a boundary is **dotted only where the foreground covers it**. Upstream's "dash = secondary plane" still applies when no mask is passed, so `checkOverlayParity` is untouched.

### Priority art is not the same thing as a canopy

The real bug behind "the detection seems off". `renderRoomForeground` returns every priority-half pixel, and rooms scatter perfectly ordinary floor across both layers with the priority bit set — purely so the art layers nicely. 32% of room `0x06` renders into that pass and none of it hides anything.

`hiddenTileMask(room, foreground)` now takes **two** tests per metatile:

1. the foreground covers at least half of it, and
2. its collision word has **bit 12 clear**, so `$8FC773` would draw a character there *behind* that art.

Bit 12 is the game's own statement about which art a character passes behind, which makes it the right discriminator. Room `0x06` goes from 32% covered to 1%; the jungle in `0x76` stays at 20%.

### /simulation

Design notes for the simulation, md only and no code, in build order: [virtual WRAM](simulation/virtual-wram.md) (the starting-state problem and the expression evaluator), [damage](simulation/damage.md), [spawn scenarios](simulation/spawn-scenarios.md), [placed entities](simulation/entities.md), [interaction](simulation/interaction.md), [cutscenes](simulation/cutscenes.md) and [routes](simulation/routes.md). Each says what already exists, what is missing, and how it would be checked. `docs/room-simulation.md` and `docs/route-planner.md` now point at them.

## [0.34.0] — 2026-09-21

Five corrections to 0.33.0's layering, all from the same root: one signal was carrying two meanings.

### The enemy marker is annotation, not scenery

The red square on the tile went into the sprite's own layer, so the canopy swallowed it along with the sprite. The tint stays under the sprite, where it belongs on the ground, but the **outline is now drawn with the other annotation on top** — a marker a tree can hide is not a marker.

### Depth: the plane comparison comes before bit 12

`$8FC773` tests the character's plane against the tile's *first*, and only falls through to bit 12 when they match:

```
8FC798  LDA $0018,Y / AND #$0030 / CMP $12
8FC7A0  BEQ $8FC7A9      ; same plane -> bit 12 decides
8FC7A2  BMI $8FC7C1      ; below the tile's plane -> priority 3
8FC7A4  LDA #$CC20       ; above it -> priority 2
```

And `$8FA914` refuses to update `$0018,Y` on a plane-transparent or forced-walkable tile, so a character resting on one keeps the plane it walked in with — which the map cannot say. `spawnDepth()` answers **`unknown`** there rather than guessing, and the tab draws those in front.

That is the invisible enemy on map `0x3b`: the Rock at (89, 61) stands on tile `$0061`, plane 2 and transparent, and calling it plane 2 buried it under the rock face. 13 of the 1402 vanilla spawns are in that position; the rest now split 1069 in front, 311 behind, 9 never drawn.

### Contours: colour is the plane, weight is the visibility

Upstream dashes a *secondary plane*; 0.33.0 also dashed a *covered* boundary. Two meanings, one pattern — which is why a covered diagonal still read as a visible one.

With `CollisionOverlayOptions.hidden`, every plane now draws **solid in its own colour**, 3px where the player can see the boundary and a washed 2px where the foreground covers it. Without `hidden` the drawing is upstream's byte for byte, so `checkOverlayParity` still compares it.

### The coverage mask is per tile, and both passes get it

Two fixes to "the detection seems off a bit":

- **Per metatile, not per pixel.** Foreground art is full of small holes, so a per-pixel mask made a wall flicker between covered and visible along its length. A tile more than half hidden is covered. Collision is a per-tile property anyway.
- **Both overlay passes get the same mask.** 0.33.0 gave it only to the canopy pass, so wherever the canopy art had a hole the map's own thick line showed through a boundary the other pass had already thinned.

### Internals

- `coverageMask()` in `src/maps/render.ts`; `spriteDepth()`, `spawnDepth()` and the `SpriteDepth` type in `collision.ts`.
- `buildLegend(features, weighted)` — the "(DOTTED)" suffix would be a lie under the new drawing.

## [0.33.0] — 2026-09-21

The canopy from 0.32.0 was drawn over *every* character. It should only cover the ones the game draws under it, and it should never cover the collision overlay.

### Which characters the scenery covers is a per-tile question

The trace answers what 0.32.0 left open. Entity `+0x3C` — the word `$8FC773` tests — is filled from the tile the character stands on:

```
8FAFE5  LDX $003A,Y          ; the tile under the entity
8FAFE8  LDA $7F0000,X        ; -> its metatile record
8FAFED  LDA $7F0004,X        ; -> that record's collision word
8FAFF1  STA $003C,Y
```

`$7F0004 + record` is the metatile collision table this repo already decodes, and four entities in `walking_against_flower.txt` pin it: the words the trace loads ($0010, $0010, $0013, $0010) are exactly `collisionWords` at their tiles in room `0x38`.

So bit 12 of an ordinary collision word is the whole answer for a resting spawn — and **84.4% of vanilla tiles set it**, along with 1077 of the 1402 vanilla spawns. Laying the foreground over everybody was wrong about three quarters of them.

The Rooms tab now sorts its spawns into two groups and puts the canopy between them. `spriteDrawsInFront()` is verified rather than documented-but-unused, and the artwork agrees: in room `0x76` every spawn marked *in front* has no priority pixels near it, and the ones marked *behind* are standing in foliage. Nine vanilla spawns stand on a gate-nibble-8 tile, which `$8FC773` refuses to draw at all; those are dimmed.

New doc: [docs/script-format/sprite_priority.md](docs/script-format/sprite_priority.md). `sprite_format.md` is corrected too — a chunk's bits 4–5 are masked out of the OAM attribute by `$809433`, so they order chunks within a sprite and are not the hardware priority.

### Collision the foreground hides is dashed, and always on top

The overlay is baked into the map raster, so the canopy hid it. It is now painted a second time onto the canopy's own pixels, cut back to them, and drawn above everything — with the main plane's contour in the same 3-on/3-off dash a tunnel under a bridge already uses. Solid line means the player can see that wall; dashed means the scenery covers it.

Everything else that is annotation rather than scenery moved above the map layers with it: the 8 px and 16 px grids, the trigger boxes, and the spawn hitboxes (which used to be painted *under* the sprites).

### The palette budget as slots

The room's palettes are drawn as a row of chips with a dashed empty chip for each slot still free, plus four pips beside the heading — so "one more and it glitches" reads without counting. A palette past the fourth is red: that is the one sharing the slot `$90CE92` steals.

### Internals

- `src/rooms/webview/svg-spawns.js` — `buildSpawnLayers()` returns the three layers (`behind`, `front`, `marks`) svg-builder stacks around the canopy.
- `src/rooms/rendering/object-previews.js` and `rom-fingerprint.js` — split out of `tile-overlay.js`, which the second render pass pushed past 400 lines.
- `opaqueMask()`, `spriteHiddenOn()`, `SPRITE_HIDDEN`, and `CollisionOverlayOptions.hidden`.

## [0.32.0] — 2026-09-21

Three asks from map `0x76`: draw enemies the way the game layers them, track palettes, and show where a room is entered from.

### The canopy goes over the enemies

`$8FC773` builds an entity's OAM attribute from the tile it stands on, and only ever picks priority **3** or **2**:

```
8FC7AA  BIT #$1000
8FC7AD  BNE $8FC7C1      ; -> LDA #$CC30, priority 3: in front of everything
8FC7B7  LDA #$CC20       ; otherwise priority 2
```

In Mode 1 the order is `OBJ.3 > BG1.1 > BG2.1 > OBJ.2 > BG1.0 > BG2.0`, so a priority-2 character goes behind exactly the priority half of whichever layer won. The host now renders that half on its own — `renderRoomForeground`, transparent everywhere else — and the Rooms tab lays it over the spawns. In room `0x76` it is 47% of the picture, which is why the Hedgadillo looked pasted on top of the leaves. Toggle: **canopy**.

### Sprite palettes, and how many enemies fit

New doc: [docs/script-format/palettes.md](docs/script-format/palettes.md).

**Map and enemy palettes do not share slots** — sprites live in CGRAM 128..255, backgrounds in 0..127. Within the sprite half, `$90CD80` manages the table at `$7E1278`:

- it first looks for the wanted palette in five slots, so **two characters with the same record `+0x09` cost one slot between them**;
- it then looks for a free slot in only **four** of them;
- and with nothing free, `$90CE92` overwrites sprite palette 2 unconditionally. That is the glitch: the fifth distinct palette sits in the slot the next effect takes.

So the budget is **4 distinct palettes**, not 4 enemies. The Rooms tab now shows the room's palettes with swatches and how many slots are left. 90 distinct palettes cover the 134 characters that have one, and 27 are shared — a room with a Mosquito can add a Magmar, a Skullclaw or a Death Spider for free, and all eight villager palettes are one slot.

### Arrivals

New doc: [docs/script-format/arrivals.md](docs/script-format/arrivals.md). Nothing in a room says where you come in, so the index is built backwards: every map's triggers walked once, every `CHANGE MAP` keyed by destination. 45 ms for all 128 rooms, cached per ROM.

Each door is drawn at its landing tile with an arrow for the direction the player is walking — read from the prepare script's own name ("South exit/north entrance" means still heading south) — and clicking it opens that room. Toggle: **arrivals**.

### Also

- **`0x2c` is a second sprite slot**, the shadow: `$90842F` writes `+0x09`/`+0x0A` where the ordinary set-sprite writes `+0x06`/`+0x08`. It is used only when a frame sets no main sprite, which is what the Hedgadillo's north pose does — it was rendering as nothing.
- The example in map `0x76` is not a facing bug: its four records are shadow, back, side, front, so facing south really does select the side view. The selection itself is checked against a villager, the chameleon and the traced viper.
## [0.31.0] — 2026-09-21

Attack boxes, from the trace of the Boy hitting the flower. New doc: [docs/script-format/attack_boxes.md](docs/script-format/attack_boxes.md).

### No, the attack box is not the collision box — there are three

| | Collision box | Hurt box | Strike box |
|---|---|---|---|
| What it is | what you bump into | what a weapon lands on | what a swing sweeps |
| Comes from | record `+0x0D` | record `+0x0D` | animation command `0x47` |
| Size | `2r` wide, `r` tall | `2r` wide, **`2r` tall** | whatever the command says |
| Centre | the entity's position | position + `$0042`/`$0044` | attacker's position + the command's offset |
| Per character? | one number | the same number | **per animation frame and per facing** |

`+0x0D` is the one number for how big a character is and both tests read it — but moving squashes the vertical by half (`ASL` on `|dy|` alone) while a strike doubles both axes equally. Same radius, flat box for walking, square one for being hit.

### The strike command

`47 <dx:s8> <dy:s8> <w:u8> <h:u8>` — five bytes, which is where the width I measured two releases ago finally got a meaning. `$9087BA` adds the offsets to the attacker's position, stashes the size in `$3E`/`$40` and calls the hit test. The Boy's east-facing swing is `47 1E 00 17 11`: a **23 × 17** box, 30 px east of him, exactly what the trace shows in `$46`/`$3E`/`$40`.

A hit needs `2*(|dx| - r) < w` and `2*(|dy| - r) < h` — the strike box grown by the target's radius, then the same plane and height checks the movement test uses, after five state filters (own side, no HP, invulnerable, already hit by this attacker, dying).

`$0042`/`$0044` move the hurt box; animation command `0x50` sets them and `0x52` — the reset that starts nearly every script — puts them back to `(0, −16)`, which cancels the `+16` in the test. So by default the hurt box sits exactly where the collision box does.

### Contact damage does use the collision box

`$8FB52C`, the handler the *movement* collision calls when a move is blocked, dispatches the attacker's `attack_proc` just as a strike does — if the mover is charging (`$0016 & $C000`) and fast enough (`$002E >= $0400`). That is how the 96 characters with no `0x47` hurt you.

| | |
|---|---|
| declare at least one strike box | **45** |
| no attack animation at all | 54 |
| attack animations but no `0x47` | 42 |

### Seven more command widths

Reaching attack animations needed `0x32`, `0x38`, `0x40`, `0x43`, `0x4b`, `0x4c`, `0x5b`, all read off their handlers. Attack walks that stop early went from **39 to 5**, and adding them changed **no idle walk** — all 141 characters produce byte-identical frames — which is the check a wrong width would fail loudly.

`0x4c` is the projectile: six bytes, a word and three signed bytes, calling `$90DCA4`.

### Checked

`checkStrikeBoxes` pins the Boy's swing at `$C71468` to all four traced numbers, plus the flower's two-stage lunge (22×19, then 19×27 reaching two tiles south), the Mosquito's 17×16 and the Viper's two.

## [0.30.0] — 2026-09-21

Hitboxes, from the trace of the Boy walking into a Wimpy Flower. There was no research on this before; there is now [docs/script-format/hitboxes.md](docs/script-format/hitboxes.md).

### Where the size lives

**Character record `+0x0D`** — `characterdata.h`'s `unknown0d`, a radius in pixels. One grep found it: of the nine character-record fields read anywhere in the trace, it is read 1819 times, more than `anim_stand`, `aggro range` and everything else.

### The rule

`$8FB46D` is asked "can this entity stand at `$46`/`$48`?" and checks each entity in the list:

```
8FB4AE  LDA $8E000D,X    ; the candidate's radius
8FB4B2  BEQ $8FB4FC      ; zero: no body at all, walk through it
8FB4B5  ADC $16          ; + the mover's radius
8FB4C5  ASL              ; |dy| doubled...
8FB4C6  CMP $18          ; ...must be under the sum
8FB4D6  CMP $18          ; and |dx|, undoubled, under it too
```

So `|dx| < r1 + r2` and `2·|dy| < r1 + r2`: an axis-aligned box **twice as wide as it is tall**, the same 2:1 squash the game's perspective uses. A character's own body is `2r` wide and `r` tall, centred where its sprite is anchored.

Two more conditions have to hold: the entities must share an elevation plane (`$0018`, from the tile's collision word — already decoded in `src/maps/collision.ts`) unless the plane-transparent bit is set, and `+0x1E` must be within `$230`. And if the mover is *already* inside the box it is let through, so nothing that spawns on top of you can trap you.

### Checked against the game's own verdict

The trace walks into the same flower from the west, the north and the east, and the game decides on every frame. Parsing it gives **925 collision tests with the game's answer on each; this rule agrees with all 925.** The boundaries land exactly where it says:

| Approach | Blocked up to | Free from |
|---|---|---|
| west, east | \|dx\| = 21 | \|dx\| = 22 |
| north | \|dy\| = 10 | \|dy\| = 11 |

22 is the flower's 14 plus the Boy's 8; 11 is half of it.

### On the map

Every ROM spawn now draws its collision box — a dashed rectangle `2r × r` centred on the spawn point — with a `hitbox` toggle beside `npc`, and the tooltip says how far it stops the Boy. Radius 0 means no body at all: the statue, the bridge and the stone cobras are walked straight through, and they draw no box.

### Spawns were 4 px out

Every entity in the trace sits at pixel `8 × x` for the script's `x` — the two Mosquitoes placed at x=17 are at `$0088` = 136, and so on for all of room 0x38. So a spawn stands on the map unit, not in the middle of its cell. The Rooms tab was adding half a unit, putting every enemy 4 px down and to the right. Removed.

### Split

`characters.ts` had grown to 471 lines, over the 400 limit. It is now three files along the chain it already followed: `character-record.ts` (the table — palette, disposition, hitbox, which animation a facing selects), `character-animation.ts` (walking that script into frames) and `characters.ts` (blitting them).

## [0.29.0] — 2026-09-21

Answers the four things in the screenshots, three of them from the same place: the ROM says so, and nobody had read that part yet.

### The face behind the body — chunk flags are an OAM attribute byte

`vhoopppn`: flip Y, flip X, two **priority** bits, palette, name. Every field lines up with the data — bits 4-5 only ever hold 0 and 1, bit 6 is set on 31% of chunks, bits 1-3 are zero on 99.3%.

Priority changes what covers what, and so does index: the PPU draws a **lower OAM index in front of a higher one**. So the first chunk belongs on top. Painting the list front to back left the *last* chunk on top, which is what buried the Megataur's face behind its body. 1161 of the 5128 sprites reuse a cell across chunks, so it was visible on more than bosses — the Boy's arm was behind him too.

SoETilesViewer's `frameview.cpp` gets this right (`for priority 0..3 { for i = n-1 down to 0 }`); the port did not.

### The flowers played half their attack — `0x2d` is the loop

```
90877D  LDA $0003,Y     ; the script's start, saved when the animation was chosen
908782  STA $0000,Y     ; ...becomes the running pointer again
```

A walk that reaches `0x2d` has seen the whole cycle; one that steps over it runs into whatever script was assembled next in the bank. The Wimpy Flower's idle is one held frame followed by `0x2d`, so reading past it played two frames of its attack.

### Frames last as long as the timer, not as long as the last hold

```
908100  DEC $0005,X      ; the frame timer
908103  BEQ $908108      ; still counting? then...
908107  RTL              ; ...leave the saved pointer where it was
908108  LDA #$01         ; expired: back to one
908111  STA $0000,X      ; ...and only now step past the command
```

A frame-ending command re-runs from the same point every game frame until the timer runs down, and the timer resets to **1**. So a bit-7 command with no hold before it lasts one frame, and repeated sprites merge. The flower merges to a single 102-frame still — which is what the game shows.

### Lengths, measured again from scratch

The old method paired consecutive `$5D` reads and had to discard every pair crossing a frame boundary; its survivors gave `0x53` a width of 2 that the game does not use. The interpreter states each length directly instead: the command read at `$9080E3`/`$9080F0` prints its **effective address**, and `$90810F` prints where a frame-ending command resumes. Nothing is discarded and nothing is contaminated, because one call serves one entity end to end. Result: 29 opcodes, each with exactly one observed width.

Five more appear in no trace at all (`0x44`, `0x45`, `0x46`, `0x50`, `0x5a`). Their handlers were disassembled instead — each advances the script pointer in plain sight, every path to its `RTS` agreeing. `0x5a` is the check on the method: the trace measured it at 2 as well.

### Hostility is a flag, so the tile shows it

Character record `+0x05` is the default entity flag word, the same field `add_enemy(…, flags)` overrides per spawn. Bit 1 (`INVINCIBLE`) splits the table cleanly: all 39 townspeople have it, no monster does. Each ROM spawn now draws its tile red or blue accordingly, dashed when `INACTIVE`, with the flags and their source in the tooltip.

### Measured

| | before | now |
|---|---|---|
| Walks that end on the script's own loop | — | **139 / 141** |
| Characters that resolve to a sprite | 122 | **126** |
| Characters with a real animation | 36 | **37** |

The 15 that draw nothing are not failures: 13 share an idle script that sets no sprite at all, and they are the invisible helper entities (`PLACEHOLDER`, `FAN_ENTITY`, the tentacle and Thraxx-arm stand-ins). The game does not draw them either. The two that remain are the segmented bosses, whose `0x57` takes a run-time-length operand.

Across maps 0x00–0x7f: 1433 spawns, 1095 hostile, 335 friendly, 239 inactive.

### Not changed

Facing was checked again and is doing the right thing: the 49 characters with neither directional bit — bosses, statues, flowers, seated NPCs — have exactly one drawing in the ROM, and the game shows that one whichever way they are turned. Turning an NPC the way a room's script turns it needs the enter-script simulation.

## [0.28.0] — 2026-09-21

Fixes all four things the screenshots showed.

### Mirroring — Strongheart's buggy tile
Chunk flags carry **mirror bits that were being ignored**: bit 6 left-to-right (31% of all chunks), bit 7 top-to-bottom (4%). Symmetrical sprites store one half and mirror it — Strongheart's chunks 0 and 1 are the *same block* at x=−7 and x=0, differing only in bit 6 — so ignoring it drew one half twice.

### Facing — most NPCs looking north
**Two** flag bits mean "directional", and only one was handled:

| Flags | Selection | Characters |
|---|---|---|
| bit 7 (`0x80`) | `anim_stand + 2 * facing` — eight poses | 7 |
| bit 6 (`0x40`) | `anim_stand + table[facing]`, table at `$90815B` — four poses | **85** |
| neither | one pose for every direction | 49 |

The `0x40` form is the common one, so 85 characters were drawn in their first pose — which is north-facing.

### Animation — flowers standing still, mosquitos not flying
Both were the walk stopping on an unmeasured command. Two rules fixed the measurement, and both were learned by getting them wrong:

1. **Pair reads for the same entity** — the trace line carries `Y`; without it, interleaved animations invent widths.
2. **Never measure from a command with bit 7 set** — it ends the frame, so the next read is a game-frame later and the gap stops being a width. This is what made `0x42` look like 4 or 5 when it is 2.

Applying both across three traces took the ambiguous count from three to **zero**.

### Measured
- **122 of 141** characters resolve, **36** with a real animation — up from 6.
- The Mosquito flaps between `$CC5B38` and `$CC5B3F`, the exact pair the game was traced drawing (28 and 27 times alternating). That pair is now the pinned anchor, since it comes from the running game rather than from this code.
- All 21 spawns in South jungle animate.

## [0.27.0] — 2026-09-21

Enemies face south, and sit where they belong.

### Facing
**Animations come in a set, one per direction**, when the record's flags byte has bit 7 set — `$908124` then indexes `anim_stand + 2 * facing` instead of using the record directly. **Entity `+0x22` holds the facing and south is 8**, written both by the spawn routine and by the FACE SOUTH opcode, which is why an unposed enemy already faces the camera.

Confirmed against the game: a Viper made to face south draws `$CD2C66`, and `anim_stand + 2*8` gives exactly that. Read without the facing it gives `$CD2CF5` — a different pose, which is what was being drawn before.

### Placement
**Sprites anchor at their feet, not their centre.** A 32×32 Wimpy Flower has its origin at y=25, so centring dropped every enemy about a tile low. `renderCharacterFrames` now blits all of a character's frames into one box aligned on that origin, so the caller positions by the origin and the animation no longer jitters between differently-sized frames.

### Notes
- Non-directional characters (Mosquito, Wimpy Flower) resolve to the same sprites as before — their records have bit 7 clear, so nothing changed for them.
- Coverage is unchanged at 121 of 141; facing selects a better pose rather than unlocking new characters.
- Pinned in the parity test: the Viper's south sprite, one shared frame box, and an origin below centre.

## [0.26.0] — 2026-09-21

Enemies animate, and every format researched in this series now has a written-up page.

### Animation
- **`characterAnimation()`** walks a character's idle script into frames with their hold durations, and `renderSpriteAt()` renders any frame in that character's palette.
- Spawned enemies play their idle animation on the room map, each with its own clock and a random starting phase so a field of the same enemy does not pulse in lockstep. The Wimpy Flower animates over 4 frames; **14 of the 21 spawns in South jungle** animate.
- Enemies whose script does not reach a second sprite keep the still frame — **121 of 141** show something.

### Two corrections to the animation model
- **The set-sprite family is `0x22`–`0x2b`, not `0x22`–`0x28`.** Grouping the dispatch table at `$908000` by handler address gives the families directly (`$908418` serves ten opcodes, `$90836C` serves `0x01`–`0x1e`), which is better evidence than measuring one opcode at a time.
- **`0x20` holds for the *next byte's* ticks** (2 bytes), which is what unblocked the Flower's second frame.

### Facing
`anim_stand` is the default idle, and the sprites it yields already face the camera — flower, mosquito, bee, chameleon and villagers all render front-on. No direction selection was needed; whether other facings live in separate animations is not investigated, and the doc says so rather than implying it is handled.

### Documentation
New **`docs/script-format/`** with an index and eight pages: the operand grammar, the instruction set, loot, map transitions, enemy spawns, the character table, the animation format and the sprite format. Each records how a claim was established — measured, read from the encoder, or traced — and what was ruled out where something is still open. `docs/sprite-rendering.md` becomes a pointer to its successors.

### Structure
`src/maps/sprites.ts` reached 424 lines and was split: `sprites.ts` keeps blocks, chunks and composition; new `characters.ts` owns the character table, animation and palette.

## [0.25.0] — 2026-09-21

**The purple flower renders.** 121 of 141 enemies now resolve, up from 118.

### The fix: bit 7 is "end of frame", not a different opcode
The Wimpy Flower's script stopped at `0xa4`, which looked like an unknown command. It is not a command at all — the interpreter's dispatch masks it:

```
9080F2  ASL              ; carry = bit 7, A = (cmd & 0x7f) * 2
9080FA  BCC $9080EC      ; bit 7 clear: dispatch and keep going
9080FC  JSR ($8000,X)    ; bit 7 set: dispatch, then...
908100  DEC $0005,X      ; ...tick the frame timer and return
```

Both paths index the same table with `(cmd & 0x7f) * 2`. So `0xa4` is command `0x24` — a set-sprite — that also ends the frame, and the Flower's idle sprite (`$CC4F3B`) is reached through exactly that.

### Added
- Opcode masking, plus command lengths for `0x06`, `0x07`, `0x08`, `0x2e`, `0x41`, `0x53`, `0x54`, `0x5a`, measured from the Wimpy Flower trace.
- `$CC4F3B` pinned in the test alongside the Mosquito's `$CC5B1C`.

### A measurement caution, learned the hard way
Pairing consecutive `$5D` reads only gives a correct length when **one** entity is animating. The Flower trace had several, and the interleaving produced a wrong length for `0xa4` (5 instead of 3). It happened to change nothing — verified by diffing every enemy's resolved sprite before and after — but the safe rule is to measure on single-entity stretches and re-check that a new length changes no already-resolved sprite.

### Still missing
Twenty enemies stop on `0x1e` (13), `0x50` (4), `0x57` (2), `0x2d` (1). Both traces so far covered act-1 field enemies; a boss or later-act room would likely cover these.

## [0.24.0] — 2026-09-21

**Enemies are drawn on the room map, in the game's own artwork and palettes.**

### The chain, solved from the Mosquito trace
| Step | Where |
|---|---|
| Character record | `$8EB678 + id * 74` |
| Idle animation | record `+0x32` (`anim_stand`) |
| Animation script | 24-bit pointer at `$C40000 + anim_stand` |
| Sprite command | first opcode in `0x22..0x28` while walking the script |
| Sprite pointer | `((cmd + 0xA8) << 16) \| <u16 operand>` |
| Palette | record `+0x09`, a 16-bit address within bank `$90` |

The command byte carries the sprite's bank in itself — the interpreter does `TXA; LSR; ADC #$A8` on the doubled opcode. Command lengths were **measured**, not guessed: the interpreter reads each command with `LDA [$5D]` at `$9080F0`, so the distance `$5D` moves between reads is that command's length.

### Added
- `resolveCharacterSprite`, `characterPalette` and `renderCharacterSprite` in `src/maps/sprites.ts`.
- Spawns on the room map now draw the enemy's idle sprite instead of a hollow box, cached per character (a jungle places fourteen flowers and they are one picture). Enemies without a resolvable sprite keep the box.
- Test coverage: the Mosquito's sprite pointer `$CC5B1C` is pinned as the anchor — the one case checked against a running game — plus a floor of 118 enemies rendering.

### Measured
**118 of 141 enemies resolve and render.** Verified by eye against recognisable characters: blue mosquito, orange bee, green chameleon, grey boulder, Fire Eyes, Horace in armour.

### Still missing
The other 23 stop on an animation command whose length has not been measured: `0xd2`, `0x50`, `0xcd`, `0xa4`, `0x5a`, `0x2d`. **The Wimpy Flower is one of them** — its script stops at `0xa4`. A trace of entering the South jungle would cover it, since it spawns there.

Item icons are still a separate, unsolved problem: they are menu background tiles, not sprites.

## [0.23.1] — 2026-09-21

### Added
- `docs/sprite-rendering.md` updated from the Mosquito spawn trace. **The animation table is at `$C40000`, indexed by `anim_stand` directly** (`$90817B: LDA $C40000,X`), and a record is a list of 4-byte frames, `[spriteOffset:u16][u8][u8]`. The Mosquito's four frames are 21 bytes apart — exactly a four-chunk sprite — so the word is a byte offset into sprite-info data, not an index.
- **The decoder is now validated against live frames.** The trace hands 11 distinct 24-bit sprite pointers to the game's own renderer; decoding all of them cold from the ROM produces correct sprites. That is a stronger check than the walk count.

### Still missing
The base that frame offset is relative to. Scanning every base in `$C00000..$D00000` for one where both the Mosquito's and the Flower's frame gaps match their sprites' declared sizes finds **zero** candidates, so it is per-character or per-room — consistent with the draw routine taking a full 24-bit pointer from the entity's display list (`$8096DB`) rather than computing one. The next step is a breakpoint on writes to that display-list entry.

Two drawn sprites look like a mosquito and alternate 28/27 times, but they are 7 bytes apart (a one-chunk sprite) while the animation record calls for four-chunk frames — so that pairing is not claimed.

## [0.23.0] — 2026-09-21

Ports the ROM's sprite decoder. **Neither "enemies on the map" nor "all item icons" is finished** — both turned out to need a lookup that does not exist yet, and this is the layer underneath them.

### Added
- **`src/maps/sprites.ts`** — a port of SoETilesViewer's `spriteblock.h` and `spriteinfo.h`, the only implementation of this format anywhere. Decodes both block pools (16×16 at `$EC0000`/`$D90000`, 8×8 at `$D80000`/`$D10000`), the bit-per-word skip-list compression, and composes chunk lists into whole sprites.
- `checkSprites` in the map parity harness. The walk finds **5128 sprites**, the same count the reference's walk ends on — a sharp check, since it chains on each entry's declared length and one wrong size would desynchronise everything after it. 9 of 5128 are blank padding.
- `docs/sprite-rendering.md`.

### Why neither ask is done
- **Enemies.** The character table holds *animation pointers*, not sprite indices. Wimpy Flower's `anim_stand` is `0x495e`, and five readings of it were tried and ruled out (sprite index, `$CA0003+`, `$CA0000+`, `$90495E`, `$7E495E`). SoETilesViewer shows these values but never resolves them either. Drawing a guessed sprite would be worse than drawing none.
- **Item icons.** They are not sprites at all. The earlier menu trace found them composited from background tiles by a blitter at `$8CA6AB`–`$8CA6C6`, and rendering the tail of the sprite list confirms it — effects and particles, no icons.

### Lead worth following first
The everscript `ANIMATION` enum's values are the low 16 bits of a 24-bit pointer, with the bank in the comments (`MENU_CLOSE = 0x61a7` beside `[A7 61 7E]`). So `anim_stand` is probably a low word whose bank comes from elsewhere. Reading the encoder answered the spawn-format question outright last time, so it is worth checking `animate()` before reaching for a trace.

### Notes
- Decoder parity unchanged: 99.992% boundaries, 99.776% summaries, 593/593 sniff flags.

## [0.22.0] — 2026-09-21

Every NPC a script places is now named and plotted on the map.

### Why this went from "unknown" to "settled" in one step
0.21.0 reported spawns as bare indices and refused to place them, because two things were unestablished. Both were answered by reading the sibling `everscript` compiler instead of tracing the game: `add_enemy` is the function that *emits* these opcodes, so it defines them.

- **The index is an `ENEMY` enum value.** The encoder emits `enemy * 2` for the opcodes that store an address (`0x3c`, `0xa2`) and the bare value for the rest (`0xba`, `0xc2`), so unshifting lands back on the enum. Its comments carry the character record and the in-ROM name: `FLOWER_PURPLE = 0x0b, // #109, "Wimpy Flower"`.
- **Coordinates are the same space as `add_enemy(x, y)`**, which the encoder passes straight through — the same values the Rooms tab already plots live enemies at.
- **`$2433` is `ENEMY_SPAWNER_QUANTITY`**, not a character id. That is why it is written just before each spawn.

The earlier guess that the jungle's index 15 was the purple flower was wrong — 15 is the Mosquito; the Wimpy Flower is index 11.

### Added
- **1606 spawns across the ROM, 100% named**, 1603 with a character record. South jungle resolves to 7 Mosquitoes and 14 Wimpy Flowers.
- Spawns plotted on the map, drawn **hollow** because they remain candidates, with a `npc` toggle and a tooltip giving the enum name, the game's name, the character number and the caveat.
- The table under the enter script shows enum name, in-ROM name, character record and position.
- `0xc2` (`add_enemy_spawner`) is now reported too, with the quantity staged in `$2433`.
- `enemies` in `names.json` (144 entries), generated from the `ENEMY` enum.

### Still not built
The simulation itself. Which branch actually runs still needs an expression evaluator and a defensible starting WRAM, so the Rooms tab shows the reachable superset and says so. Drawing an idle animation is now **unblocked** — SoETilesViewer already decodes sprites, and the character record is known for every spawn.

### Notes
- Decoder parity unchanged: 99.992% boundaries, 99.776% summaries, 593/593 sniff flags.

## [0.21.0] — 2026-09-21

Reports which NPCs a room's enter script can place. The simulation that would narrow "can" to "does" is specified but **not built** — see `docs/room-simulation.md`.

### Added
- **`src/script/entities.ts`** — the three NPC-placing opcodes (`0x3c`, `0xba`, `0xa2`) now report what they place: index, state word and raw position. **734 placements across 103 rooms, 707 with a literal position.** `0xa2` computes its position, so it reports that something spawns without claiming where.
- A table under the enter script listing them, labelled **candidates, not contents**.
- `docs/room-simulation.md` — what a real simulation needs and what is still unknown.

### Why this is not the simulation that was asked for
Loot needed no simulation because a pickup writes its reward down as a literal. Room population is genuinely different: rooms are reused across the story and the enter script branches on saved flags, so the answer is *which branch runs*, not what the bytes say. Building that needs two things that do not exist yet — an evaluator for the operand grammar (the current one renders text, it does not compute), and a defensible starting WRAM. "Base boy" is not one state; the same room differs by act. A simulation that silently picks one would be exactly the confident-and-wrong output this decoder is built to avoid.

So the decoder reports the superset and says so.

### Two things deliberately not claimed
- **The NPC index is not a character id.** The jungle spawns index 15 and the enemy there is the Wimpy Flower, character 109. Ruled out: the character table (15 ≠ 109), the map blob's "extras" (those are CHR descriptors), and SoETilesViewer's model (it has no map→NPC relationship). `$2433`, written immediately before each `0x3c` with a different small value per spawn, is the open lead.
- **The coordinate space is not established.** Spawn positions overflow the trigger grid's `(x - offX) * 2` mapping and fit at least two other readings equally well, so they are shown raw and **not drawn on the map**.

### Confirmed along the way
- The character table is at `$8EB678`, stride 74. Record 109 matches the editor exactly: palette `0xb1ab`, HP 18, aggro range 70, `anim_stand` `0x495e`. Porting it is straightforward once the index is understood.
- SoETilesViewer already decodes sprites (`spriteinfo.h`, `spriteblock.h`) and the animation pointers, so drawing an idle flower is a **port**, not new reverse engineering — once the character is identified.

### Notes
- Decoder parity unchanged: 99.992% boundaries, 99.776% summaries, 593/593 sniff flags.

## [0.20.0] — 2026-09-20

Doors are now readable and clickable, and the map no longer yanks the panel around when you click it.

### Added
- **Exit extraction.** `src/script/transition.ts` folds a script's effects into where it sends the player: destination room, landing position, the global scripts it calls on the way out (fades, which edge you leave by), the music it starts and the room state it writes. **605 transitions across the ROM, every destination named.**
- **Destinations are links.** A door trigger's card shows `→ Gothica - Dark Forest`; clicking it opens that room. All 605 land on a room the vanilla catalogue lists, so no link is dead. Navigation goes through the tree's own entry rather than duplicating selection, mode switching and rendering.
- Exits appear on the map too: the trigger's label reads `→ Dark Forest` and its tooltip lists each destination with the preparation that precedes it.
- `changeMap` and `playMusic` effects on decoded instructions.

### Changed
- **Clicking the map no longer jumps to the list entry.** A plain left click selects — highlights the shape and its row. Cmd/ctrl-click selects *and* scrolls the row or script card into view, browser style. Pointing at things on the map used to move the panel under you on every click.

### Notes
- Two exits in one script keep their own preparation; a `CHANGE MAP` closes a transition and the context resets, so a branching trigger does not report one door's fade as the other's.
- Writes to the four pickup bookkeeping addresses are excluded from a transition's "room state", since those belong to the loot system.
- Decoder parity unchanged: 99.992% boundaries, 99.776% summaries, 593/593 sniff flags.

## [0.19.2] — 2026-09-20

### Added
- `docs/ingredient-icons.md` extended with a second trace, one that captures the ring menu *opening*. Settles the menu's setup: background tileset at ROM `$C4:1F74` (`$1000` bytes → VRAM `$2000`), frame tiles at `$C4:2FF4`, palettes at `$C4:1EA4`/`$C4:1EEC`, and the **font at `$C4:0000`, stored 2bpp**, read by the text blitter at `$8CA5AC`. Also records that the sprite tile base is VRAM `$6000` (`OBSEL = $03`) and that nothing uploads there in either trace, so the icon graphics are resident before the menu opens — which is why searching for a ROM→VRAM copy kept coming up empty.
- The note now includes the trace-reading gotcha that cost the most time: Mesen prints `[REG] = $x` as the address's **prior contents**, not the value being written, so DMA parameters have to be reconstructed from the CPU registers and the M/X flag widths.

Still not implemented, and the icon pixel source is still unknown; the note says which breakpoint would settle it.

## [0.19.1] — 2026-09-20

### Added
- `docs/ingredient-icons.md` — research notes from a trace of the Alchemy Formulas screen. Establishes that ingredient icons are **background tiles**, that the menu builds its tilemap in WRAM `$7F:C800` via `$8CAD56` and DMAs it to VRAM `$0800`, and that this screen's palette comes from ROM `$C4:1EA4`. The tileset itself loads before the captured window, so the ROM address is still unknown; the note says exactly what trace would settle it. Not implemented — a research record, not a format.

## [0.19.0] — 2026-09-20

Vanilla rooms now show what a pickup gives, the same way live rooms do.

### Why
The Rooms tab already drew an ingredient icon on a B-trigger — but only for live rooms, where the trigger carries a name from the source (`sniff_wax_2`). Vanilla rooms have no names, so the box stayed empty. Since 0.18.0 the decoder reads the reward straight out of the ROM script, so both paths now know the item and can draw the same icon.

### Added
- **Loot icons on vanilla B-triggers.** `trigIngrName()` resolves a trigger's icon from the source name first, then from the decoded reward, so live and vanilla share one renderer. Strong Heart's Hut now draws Oil, Wax, Wax — matching the live view exactly.
- Trigger labels and tooltips carry the reward: `WAX ×2`, plus the object id, the flag that remembers it was taken, and the bonus to the next pickup.
- The 🌿 toggle appears for vanilla rooms, not just live ones.

### Fixed
- **A string pasted into the webview bundle was treated as a replacement pattern.** `buildMainJs` used `.replace(placeholder, content)`, and `$'` inside `content` expands to "everything after the match" — so one dollar-quote in the webview source silently swallowed the rest of the bundle and left an unterminated string literal. Replacements now go through a function. This had been latent; the first `'flag $'` in the source triggered it.
- **A named ingredient with no asset file rendered as an empty box.** The icon map names 28 ingredients and the assets folder ships 22, so Nectar, Petal, Honey and Mercury drew nothing. The webview now knows which files exist and falls back to the emoji. This affected live rooms too.

### Known limits
- Seven reward kinds are not ingredients (money, charms, equipment) and have no icon; they show as text.

## [0.18.0] — 2026-09-20

Reads what every pickup in the game gives, and writes it back out as Everscript.

### Why no simulator
The plan assumed this needed a WRAM factory and a simulated run. It does not. Pickups never *compute* their reward — they write it down: a sniff spot or chest is a B-trigger that tests an "already taken" flag, writes four literal values, and calls one of two global scripts. **All 922 pickups in the ROM write a literal item; not one computes it.** Reading the bytes tells us everything running the game would.

### Added
- **`src/script/loot.ts`** — folds a decoded script's writes into what it gives: item, amount, bonus for the next pickup, object id, and the flags it tests and sets.
- **`src/script/everscript.ts`** — writes a pickup back as `_loot(0x16, MUSHROOM, 0d01, 0d04);` / `_loot_chest(...)`, matching the encoder's own signature. **921 of 922** render exactly; the one that cannot emits nothing rather than a near-miss that would compile into a different item.
- **`LOOT_REWARD` names** imported from the sibling `everscript` compiler into `names.json` (87 entries) — `WAX`, not `Wax (0x0200)`, because only the former round-trips.
- **`tests/memory/script-loot.test.js`** — regenerates upstream's `sniffflags.inc` from our extraction and requires **593 / 593 lines exactly, in both directions**. That file was itself generated by the reference's own loot extraction, so it is a complete independent record of every sniff spot in the game.
- Pickups shown on each script card in the Rooms tab, with the Everscript form beside them and a tooltip carrying flag, object id, amount and bonus.
- `effects` on every decoded instruction — structured writes, flag tests, calls and branch targets, for callers that read scripts rather than print them.

### Fixed
- **The walk was linear, and scripts are not.** An `END` ends one *path*; code past a conditional is reachable only via the branch. Branch destinations are now recorded and the walk resumes at the next unreached one, as the reference does. Dark Forest's B-trigger read as one sniff spot; it has fifteen.
- **`RCALL` targets are inlined**, again as the reference does — several rooms factor a pickup out into a relative call, so a reader that stopped at the call saw a branch and no reward. Absolute calls are still one row: those are shared subroutines and inlining them would bury the script in boilerplate.
- An undecodable byte no longer ends the listing. It is recorded in `gaps`, shown as a row, and the walk continues at the next branch target.
- `$2461` is read position-sensitively: **amount − 1** before the loot call, **bonus for the next pickup** after it. Upstream's `LootData` reads it position-blind and loses the amount.

### Measured
| | 0.17.0 | 0.18.0 |
|---|---|---|
| Instructions emitted across the ROM | 260,836 | **281,244** |
| On a real instruction boundary | 99.994% | 99.992% |
| Summary text matching the reference | 99.766% | **99.776%** |
| `sniffflags.inc` lines reproduced | — | **593 / 593** both ways |
| Pickups rendered as valid Everscript | — | **921 / 922** |

### Known limits
- **Item icons are not done.** Neither SoEScriptDumper nor SoETilesViewer knows where the ingredient sprites live, so a pickup shows its name, not its picture. That is new reverse-engineering rather than a port — see the release notes.
- Six of Dark Forest's nine B-triggers share one script that picks among fifteen rewards from a room variable at runtime. Those are reported as candidates, with a note, not as fifteen separate pickups.

## [0.17.0] — 2026-09-20

Finishes the script decoder rewrite. The Rooms tab now reads the ported decoder, and the old one is gone.

### Why
0.16.0 got instruction boundaries right but produced no summaries, so the Rooms tab still ran the old decoder — which is what the screenshots showed: a `SET AUDIO volume to 0x82` that was really `0x64` in a 3-byte instruction, then `UNKNOWN OPCODE 0x64` on the next byte, which was not an opcode at all but the tail of the one before. Half the tables ended in a desync dressed up as an unknown instruction.

### Added
- **Instruction summaries**, ported case-for-case from `list-rooms.cpp`'s 207-case switch into `src/script/ops-flow.ts`, `ops-memory.ts`, `ops-entity.ts` and `ops-system.ts`, plus `cursor.ts` for the read head they share.
- **`src/script/names.json`** and `tools/generate-script-names.js`, which imports the name tables out of upstream `data.h` + `sniffflags.inc`: 842 flag names, 235 absolute scripts, 128 NPC scripts, 126 rooms, 33 RAM addresses. Committed, so this repo still does not depend on the SoETilesViewer checkout.
- **`src/script/room-scripts.ts`** — trigger-table discovery (enter / step-on / B-trigger) on top of the new decoder, and `src/rooms/data/room-scripts.js`, the thin shim that finds a ROM on disk.
- **Summary scoring** in `npm run check:script`: the rendered text is compared string for string against the dump, not just the boundaries. A case that reads the right bytes and describes them wrongly is otherwise invisible.
- A final `UNKNOWN INSTR` row when a walk stops, so the table says where knowledge ends instead of just stopping.
- `untraced` on every instruction, and a dimmed row style for it: the reference marks instructions whose length is known but whose meaning is a guess, and that distinction is now carried into the UI instead of being flattened.

### Changed
- The Rooms tab's enter / step-on / B-trigger tables come from `src/script/` (via `src/rooms/data/room-scripts.js`).
- Floors in `script-parity.test.js` raised: boundaries ≥ 99.95%, summaries ≥ 99.5%, clean walks ≥ 63%.

### Removed
- `src/emulator/room-script-model.js` and `opcode-registry.js` (1261 LOC) — replaced.
- Their harness, which only ever compared the old decoder against a snapshot of itself: `tests/debugger/room-script-model.test.js`, `tests/debugger/parser-parity.test.js`, `tests/parity/`, `tests/debugger/parity/` (963 LOC), plus the `test:parity` and `test:parity:strict` scripts. `npm run check:script` measures the same property against real ground truth.
- `src/script/opcodes.ts` — the empirical layout table. The ported cases are the single source of truth for sizes now.

### Measured
| | 0.15.1 | 0.16.0 | 0.17.0 |
|---|---|---|---|
| Instructions on a real boundary | 88.5% | 99.986% | **99.994%** |
| Summary text matching the reference | — | — | **99.766%** (233,943 / 234,492) |
| Entry points walked to a clean END | — | 53.1% | **63.8%** |

### Known limits
- Every case in `list-rooms.cpp` is ported, so an opcode that still stops a walk is one **SoEScriptDumper cannot decode either** — it has no known length. Some scripts will never render in full, whatever we do.
- `SHOW TEXT` reports its pointer but not the string; that needs the text decompressor, so those three opcodes are scored on boundaries only.
- The ~0.23% of summaries that differ are almost all placeholder names for unnamed scripts. Upstream caches the first placeholder it invents for an id across the whole dump, so its wording depends on decode order; these lookups are stateless.

## [0.16.0] — 2026-09-20

Starts the script decoder rewrite. Groundwork only: nothing in the UI changes yet, and the old decoder is still the one the Rooms tab uses.

### Why
The existing decoder (`src/emulator/room-script-model.js`) was an independent re-derivation. Measured against SoEScriptDumper's own dump of the ROM, it put 88.5% of instructions on a real boundary but **lost alignment partway through 2119 of 4000 scripts** — and a decoder that loses alignment does not fail, it keeps emitting plausible nonsense.

The cause was one missing concept, not many small bugs. Script operands are not fixed-width fields; they are little postfix expressions whose length depends on their own contents. Five opcodes (`0x09`, `0x17`, `0x18`, `0x08`, `0x86`) accounted for 2111 of the 2119 derailments, all of them for that reason.

### Added
- **`src/script/`** — a new pure TypeScript domain ported from `list-rooms.cpp`:
  - `expression.ts`, the operand grammar: a stack machine where bit 7 ends an expression, `b & 0x70` in {0x30,0x40,0x60} is an inline constant, and operators pop from a stack that persists across operands (the game's own scripts rely on that).
  - `opcodes.ts`, per-opcode operand layouts. 124 were **measured**: `script_all` prints every instruction's address, so consecutive addresses give true lengths, and only layouts reproducing *every* observed length for an opcode were kept — thousands of instances each for the common ones. A few that end a run or print extra lines were read out of the C++ instead, and the WRITE family plus `0x78/0x79`, `0x6f/0x73/0x9d` are hand-ported because their shape is conditional or interleaved.
  - `decoder.ts`, which **never guesses a length**: an opcode whose layout is not verified stops the walk with a reason and an address, rather than inventing a size.
- **`npm run check:script`** — diffs instruction boundaries against `script_all` across the whole ROM. Skips when the SoETilesViewer checkout or ROM is missing.
- `tests/memory/script-units.test.js` — 16 ROM-free assertions pinning the grammar rules individually.

### Measured
| | before | after |
|---|---|---|
| Instructions on a real boundary | 88.5% | **99.986%** (192,020 / 192,047) |
| Entry points walked to a clean END | — | 53.1% |

The other 47% stop early on purpose. **105 opcodes SoEScriptDumper cannot decode either** — most of `0xC0..0xFF`, which it prints in red as `UNKNOWN INSTR`, its own marker for "length unknown, parsing stops here". Roughly 20 more have layouts not yet pinned down; each is listed in `opcodes.ts` `UNRESOLVED` with how close the best simple layout got, so the next pass knows which C++ cases to read.

### Not done yet
- **Instruction summaries.** The decoder returns structure, not the English rendering. That is the 207-case switch plus `data.h`'s name tables.
- **The old decoder is untouched and still wired in.** Shelving it before the new one can produce summaries would regress the Rooms tab, so that swap and the enter/step-on/B-trigger script view come after.

## [0.15.1] — 2026-09-20

### Fixed
- **Animation erased the overlay markings it ran over.** Animation frames were bare composites, so an animated tile that also carried a contour, an object box, a trigger box or a label had that art wiped the moment a frame landed on it — visible on room 0x25's firepit, where the object box came apart. Frames now re-apply the overlay.

  Freezing the marked pixels would have been the obvious fix and the wrong one: the 20% wall tint alone covers **72%** of the pixels in 0x25, so most of the room would have stopped moving. Instead the overlay is *measured*. Every pass is an alpha blend or an opaque write, so per channel the result is affine in the base colour; probing the pass with a flat black and a flat white image pins both unknowns exactly, and the same mark can then be re-applied to a pixel the pass never saw. Opaque writes fall out as frozen and untouched pixels as passthrough, with no threshold to guess at. Animated pixels now match a real annotated render to within 1 LSB of rounding.

- **Switching an object state left the old animation playing over it.** Which channel drives a cell comes from the tilemap word in it, and an object state rewrites that word: room 0x25's firepit runs on channels **6–9** unlit and **0–3** burning. The animation cache was keyed on the ROM and room alone, so after toggling object 17 to burning the unlit frames kept painting back over the lit tiles — the state change looked like it did nothing. Animation now shares the render's cache key, so it rebuilds whenever the layer, the feature flags or an object state change.

- **Animation ignored the layer selection.** Frames were always full composites, so on an L1-only or L2-only view they blended the other layer back in, and cells animated by the hidden layer animated anyway. Both now follow the selected view.

### Added
- `docs/map-format/map_animated_tiles.md` — the Section 2 format in full: layout, the two corrections to the earlier write-up, a worked example from room 0x71, the ROM-wide validation table, the palette-extension rule that links a tilemap word to a channel, and the three things that bite when playing the animation outside the game (no common period, object states moving a cell between channels, and overlay collision).

## [0.15.0] — 2026-09-20

### Added
- **Animated tiles now animate.** Water, lava, torches, fans and light beams play in the Rooms tab, on the `animate` toggle (on by default). 95 of the 127 vanilla rooms have animation, 1020 channels between them.

### The format
Section 2's channel table *was* documented — `map_tile_graphics_decompression.md` §7 — so the earlier note in the gap analysis that animation was "blocked on upstream research" was wrong. The doc had two errors, both settled by the ROM:

| Claim | Reality | Evidence |
|---|---|---|
| Second descriptor byte is a `timer` | It is the channel's **frame count** | byte span equals `frame_count * 3` in 1020/1020 channels |
| Frame streams are `0xFF`-terminated | The `0xFF` ends the **descriptor table** | first channel's offset lands just past it in 95/95 rooms; last channel ends exactly at `sec2_len` |

A frame stream has no terminator: channel `i` runs to channel `i+1`'s offset. That matters, because a tile id whose low byte is `0xFF` would otherwise cut a stream short — which is what made 686 of 1020 channels look malformed on the first read.

Channel periods have no useful common multiple, so there is no global frame counter and the room cannot be rendered as a handful of whole-room frames. Instead each block of animated cells gets its own small transparent overlay and its own clock, so a torch can flicker at 6Hz while water rolls at 3Hz. Frame 0 of every overlay is pixel-identical to the base render, so the overlay lands seamlessly. Playback is one `requestAnimationFrame` loop for the whole room rather than a timer per block, and it stops when you switch rooms.

Typical cost is 43KB and 28 overlay blocks per room (median); the four heaviest rooms reach ~600KB, and anything beyond 1.5MB is skipped rather than streamed.

### Notes
- **Export is unchanged**: it writes the static base render, which is frame 0 of every channel — the default appearance, as asked.
- The overlays sit on top of the rendered map, so a baked collision marking on an animated tile is hidden while animation is on. Toggle `animate` off to see it.
- Only **1.5 (CGRAM colour cycling)** remains unresearched of the animation items, and nothing so far suggests the map renderer uses it.

## [0.14.0] — 2026-09-20

**The object stamp format is solved**, from the Mesen trace of looting the chest on map 0x71. State previews and room customisation both work as a result.

### The format
`dump_room.py` reads the stamp record as `[tw][th]` plus `tw*th` 16-bit words at `+2`, treating those as metatile IDs. Both halves are wrong. From `$90A4C2..$90A4F2`:

```
[tw][th] then, per tile in row-major order, an inline bit stream:
  a mask byte supplies 8 bits, LSB first
    bit set   -> a 16-bit value follows inline
    bit clear -> this tile is untouched
  a fresh mask byte every 8 tiles
```

And `$90A4E8`, which is the part that mattered:

```
TXA ; EOR [$B0] ; STA [$AD]     new = current XOR value
```

They are **XOR deltas against whatever is already in the grid**, not metatile IDs — `0x5CC8 ^ 0x2470 = 0x78B8` and `0x5CD0 ^ 0x2410 = 0x78C0`, matching the trace's writes exactly. XOR being an involution is how the engine walks a state back down as well as up, and it means a descriptor is the delta *between* two appearances: descriptor `s` turns appearance `s` into `s+1`, so `max_state` descriptors give `max_state + 1` appearances with state 0 needing none.

Validated across all 127 vanilla rooms and pinned by `checkObjectStamps` in the parity suite: record lengths land exactly on the next record's offset **2726/2726**, and cumulative XOR yields a metatile ID that exists in the room's Block 3 table **19797/19797**.

### Added
- **State previews.** Every chip in the object list is a real render of the room with that state applied, cropped to the union of everything that object touches so the states line up for comparison.
- **Room customisation.** Picking a chip re-renders the map with those states stamped in. Collision follows automatically, because it is looked up from the same metatile ID the delta rewrites — an opened chest or an extended bridge changes what you can walk on.
- `reset` puts every object back to its load state; changed objects are marked in the list and outlined on the map.
- PNG export carries the chosen states, and names the file after them.

### Retracted
- v0.13.0 said `docs/map-format/map_objects.md` was wrong about "Total states = max_state + 1". **It was right.** That and its `1 + max_state*5` record size are not in conflict — state 0 needs no descriptor. The test that appeared to disprove it looked for an extra descriptor at state 0's anchor, which presumed descriptors were states; they are transitions, and carry their own anchors.
- Earlier attempts all treated the values as identifiers, so the best fit was `word/8` at 43.4% — close enough to look promising and entirely wrong. The state-0 oracle failed (6 of 8522) for the same reason: descriptor 0 was being compared against the grid it transitions away from. One trace beat all of it.

## [0.13.0] — 2026-09-20

### Correction to 0.12.0
That release said the blue object stamp boxes have "a correct anchor and a guessed extent". **That was wrong.** `target_width`/`target_height` are read at `+0`/`+1` of the stamp record and are correct, upstream and here — the boxes have always been the right size in the right place. Only the record's *contents* were undecoded, and half of that is now solved.

### Added
- **Object stamp header decoded.** The record a state points at is `[tw][th][mask: ceil(tw*th/8) bytes][one 16-bit word per set mask bit]`. Upstream's `dump_room.py` misses the mask and reads `tw*th` words from `+2`, so every word lands early — which is why none of them ever resolved. Verified on room 0x2c, whose 11 contiguous stamp records pin their own lengths: the formula predicts all ten pointer gaps exactly, including a 2×2 footprint with a 3-bit mask. Across all 127 rooms it explains 78.6% of records whose length is pinned. (`src/maps/object-stamps.ts`, with unit tests.)
- **Objects linked to the map, both ways.** The object rectangles are now SVG hit targets sitting exactly over the ones baked into the raster: hover highlights, clicking one selects its row and scrolls it into view, and clicking a row or a state chip highlights the rectangle.
- **Object list rebuilt** as a flat table styled like the trigger tables above it, with a blue section rule: one row per object, anchor, extent, then a chip per state. Chips select; the load state is state 0.
- **`hide boring` filter.** 81.1% of the 1748 objects in the ROM have a single state, and another 0.6% have several states that stamp byte-identical records — so only 18.3% have anything to choose between. The filter hides the rest. (You were right about the sniff spots.)

### Still not delivered: state previews, and painting a state onto the map
The 16-bit words inside the stamp record remain undecoded. They are not absolute metatile IDs, not `baseMetatile`-relative, and index = `word/8` only resolves 43.4% of the time. The obvious oracle fails too: an object's state 0 is its load state and *should* reproduce the decoded grid, but matches 6 of 8522 tiles under the best mapping — almost certainly because the Markov grid is base terrain and the engine stamps initial states over it at load, so the pre-stamp tiles were never in the grid to compare against.

With no oracle, a mapping that merely "looks plausible" cannot be falsified, so there is nothing honest to draw in a thumbnail. Full numbers in `docs/map-port-gap-analysis.md` §1.9. Solving it wants a trace of `$90A5D0` against a known object — sibling-repo tooling.

## [0.12.0] — 2026-09-20

### Fixed
- **The grid was misaligned with the map on 54 of the 127 rooms.** A trigger sitting at the map edge widens the SVG viewBox past the map, and the map image was a CSS-stretched `<img>` filling the canvas — so it was scaled to the widened box while the grid was drawn in true viewBox units. The two drifted apart by 1–3% across the map (3.3% on room 0x10, about 8px). The image is now an SVG `<image>` placed at the map's own extent, in the same coordinate system as the grid, so it cannot drift. Regression-tested against a room with an overhanging trigger.

### Added
- **`export png`** in the ROM view's top bar: saves exactly what is on screen — same layer, same overlay flags — through a save dialog. Distinct from `Everscript: Export Room Maps as PNG`, which asks for scope and layer up front; this one takes its settings from the view so the file matches the picture.
- **Pinch to zoom** on a trackpad, anchored on the cursor so the map does not walk away from whatever you were looking at. Chromium reports a pinch as a `wheel` event with `ctrlKey`; a plain two-finger scroll is left alone so the panel still scrolls over the map. The `+`/`-` buttons now anchor on the viewport centre for the same reason.
- **Object browser** replacing the flat ROM OBJECTS table: one collapsible row per object, its states listed inside with anchor position and stamp pointer, the load state marked `default`, and clicking a state highlights that object's anchor on the map.

### Known limitation: no object state previews, no state switching
Both were asked for and neither is delivered, because the data they need does not decode. A state's `metatile_id` points at a stamp table whose format is unknown: **0 of 2836 object states across all 127 vanilla rooms** yield metatile IDs that exist in their own room's Block 3 table. Four candidate layouts were tested and rejected (see `docs/map-port-gap-analysis.md` §1.9 for the numbers). Upstream's `dump_room.py` reads it the same way, so this is inherited rather than introduced.

Two consequences worth knowing:
- The blue object stamp boxes on the map have a correct **anchor** and a guessed **extent**, since `target_width`/`target_height` come from that same table. The object section says so rather than presenting them as exact.
- `docs/map-format/map_objects.md`'s claim that "Total states = max_state + 1" is also wrong — 0 of 1748 records have a plausible extra descriptor. The record-size formula in the same section (`1 + max_state*5`) is the correct one, and that is what the decoder follows.

Solving this wants a trace of `$90A5D0` against a known object, which is the sibling repo's tooling — upstream research, not a porting task.

## [0.11.0] — 2026-09-20

The ROM map view now shows everything `render_map.py --composition` shows, and the top bar actually controls it.

### Fixed
- **The feature toggles never did anything — "collision is always off".** The webview sent its flags as `msg.overlay`, and the `requestRoomTiles` handler in `src/extension.js` simply did not read the field when calling `buildRoomTileOverlay`. Every render came back bare no matter what the bar said. Forwarded, and the smoke suite now asserts the bar renders one button per flag the host understands.
- **Toggles desynced when you changed rooms.** The buttons were emitted with hardcoded defaults while the flag state lived in module globals that survived the re-render, so after switching rooms the bar disagreed with the image. The bar is built from the live state instead.

### Added
- **The remaining `render_full_composition` passes are ported**, closing gap 1.2:
  - **Index labels** — the 3×5 bitmap font (`src/maps/font.ts`), drawing the object index and the hex script id inside each box, matching what SoEScriptDumper's `script_all` lists. Objects anchor bottom-left and triggers top-left, because the font draws `O` and `0` identically.
  - **Trigger boxes** — yellow B-trigger and magenta step-on, now on by default. The SVG trigger rects drop their paint while these are showing, so triggers are not drawn twice in two colour schemes, but stay live as hover and jump-to-source targets.
  - **The header banner and legend**, as HTML rather than baked pixels — `buildSummary()` and `buildLegend()` return upstream's content as data. Baking them would grow the raster and break its registration with the SVG overlay, and the text would be illegible at fit zoom. Legend entries grey out as their toggle goes off rather than disappearing.
- **One toggle per feature**, all on by default: collision, drift, elevation, pass-thru, gates, grass, rom objects, rom triggers, labels — plus an `all` button. Previously only three of the nine passes were reachable, and two of those forced collision on as a side effect.
- The ROM data table now reports entity gates (grouped by which entities each gate blocks), plane-transparent tiles and elevation changes, and marks which plane is dominant.

### Changed
- **Overlay parity is now exact.** `checkOverlayParity`'s diff budget went from 0.5% to **zero** — the labels were the entire residual. Verified pixel-identical on 0x06 (four planes), 0x1b (shear drift), 0x0b (label-dense: 13 objects, 22 triggers, 15 gates), 0x33, 0x36 and 0x38.
- `src/maps/collision-overlay.ts` split three ways under the 400-line law: `overlay-features.ts` classifies a room (and owns the legend/summary text), `overlay-shapes.ts` holds the raster primitives, and `collision-overlay.ts` keeps only the draw-order orchestration.
- Rooms-tab webview split: `rom-overlay.js` owns the ROM view's top bar and data section; `detail-renderer.js` keeps the request cycle. One owner per global, since the files share a scope.

### Removed
- `src/memory/webview/assets/` — 21 files, a complete stale mirror of the webview tree left behind by the v0.6.0 refactor. Nothing has referenced it since; every file has a live counterpart under `src/docs/`, `src/routes/`, `src/shared/`, `src/rooms/webview/` and `src/scaling/webview/`.

### Unrelated fix
- Two assertions in `tests/debugger/emulator-health.test.js` had been failing on `ENOENT` since v0.6.0, pointing at the pre-refactor `debugger/adapter.js` and root `extension.js`. Both features are present and correct under `src/`; only the test paths were stale.

## [0.10.0] — 2026-09-20

### Fixed
- **Panning snapped the map to the top-left corner.** `setupMouseEvents` receives a hand-built object literal rather than the zoom module itself, and `_getPan` was never forwarded into it — so the accessor added in 0.8.1 was `undefined` there and every drag fell back to an always-zero local copy for its base. Forwarded, with a smoke-test assertion so an un-forwarded helper fails the suite instead of silently breaking the gesture.
- **A pan drag ended by scrolling the panel.** `click` fires after every drag, and `selectAt` calls `scrollIntoView` on the matched row, which yanked the map out of view on release. Drags past a 3px threshold no longer count as clicks.
- Window-level pan handlers were being registered once per room render and never removed. They are now bound once and read whichever gesture is active.

### Changed
- **The collision visualization is now a faithful port of `render_map.py`'s composition pass**, baked into the rendered raster instead of approximated with SVG shapes — verified against upstream with a diff budget of 0.5%, actual residual 0.13–0.25% and entirely the text labels (see below). This replaces the hand-rolled SVG contour/fill overlays, which looked crude next to the Python output because they worked at 16px metatile granularity with uniform strokes.

  What this brings in that was missing entirely:
  - **Entity-gated tiles (collision bit 8) — the dashed white borders.** Gate 3 is solid for everything except the boy and dog, 5 for the dog, 7 for both.
  - **Pixel-accurate per-plane contours** via edge detection on the geometry masks plus 3×3 dilation, so slopes contour along their actual diagonal. Secondary planes are dashed, so a tunnel under a bridge reads as two crossing outlines.
  - **Drift arrows** with real arrowheads and direction, double-headed for the two motion-dependent shear handlers.
  - **Plane-transparent tiles** (bit 6, purple wash), **elevation-change tiles** (amber with step rungs), and **forced-walkable tiles** (bit 13, cyan wash).
  - Cuttable grass as a merged green region with an opaque 2px contour rather than per-tile squares.
- Collision / rom objects / grass toggles now re-render the image host-side (cached per room, layer and flag combination) rather than toggling CSS on an SVG layer.

### Not ported, deliberately
The text labels (script-id digits on triggers and objects) and the legend banner, which need upstream's 3×5 bitmap font. These account for the entire remaining pixel difference. The Rooms tab shows the same information as interactive SVG and table rows instead, which stays readable at any zoom.

## [0.9.0] — 2026-09-20

Works through `docs/map-port-gap-analysis.md`. Eleven of the eighteen gaps closed; the write path and the animation items remain open for the reasons recorded there.

### Fixed
- **Live (author-written) rooms never rendered the ROM map at all.** The overlay resolved its room id by hex-parsing `vanillaId`, which for live rooms is a symbolic MAP enum name (`SOUTH_JUNGLE`), not a hex string — so `parseInt` returned `NaN` and the whole feature silently skipped the workflow it matters most for. The numeric id the host already resolves via `getMapEnum` is now carried through as `romRoomId` for both the Vanilla and Live trees. (gap 2.2, confirmed)
- **Stale map after a rebuild.** The render cache keyed on `roomId:layer` only, so recompiling a ROM left the Rooms tab showing the old map indefinitely. The key now includes a ROM fingerprint, and `everscript.buildAndRun` drops the ROM buffer and render caches explicitly on success. (gap 2.1)
- **Render failures were invisible** outside the devtools console. They now show an in-panel banner reusing the existing error pattern. (gap 2.4)

### Added
- **Loading state** — the map area shows a "decoding ROM map…" badge and dims while the host decodes and renders. (gap 2.3)
- **Contour collision rendering**, matching `render_map.py`'s style: only the edges where a plane's solid region meets open space, so overlapping elevation planes read as crossing outlines instead of stacked translucent blobs. Default; a `solid` button switches back to fills. Also ~7x cheaper in path data (23KB vs 167KB on room 0x38). (gap 1.3)
- **Overlay legend** in the ROM MAP DATA section: a swatch per elevation plane actually present in the room, plus drift, object and grass keys. (gap 2.5)
- **`Everscript: Export Room Maps as PNG`** — one room or all 127, any layer, with progress reporting and cancellation. The in-editor equivalent of `tools/render_map.py --all-rooms`. (gap 1.8)
- **Webview-side overlay cache** keyed by `roomId:layer`, so flipping between layers or returning to a room skips the IPC round trip and its several-hundred-KB payload. (gap 2.8)
- **`tests/memory/map-units.test.js`** — 33 unit assertions covering the modules in isolation: BGR555 expansion, transparent index 0, bitplane weighting, hflip/vflip across the whole grid, CHR mode-1 decompression, collision bitfield semantics (planes, gates, drift, always-walkable, plane-transparent), grass table parsing, Mode 1 compositing priority, and PNG chunk structure. Needs neither a ROM nor the everscript checkout, so it runs anywhere. (gap 1.7)
- **Defensive validation in `decodeRoom`** for room id range, ROM size, pointer targets and the section chain, so a patched or non-Evermore ROM fails with a specific message instead of silently decoding garbage. (gap 1.6, partial — still untested against a real patched ROM)

### Changed
- The ROM MAP DATA header now states its rows are decoded ROM bytes with no source lines, rather than leaving the contrast with the clickable trigger tables unexplained. (gap 2.7)

## [0.8.1] — 2026-09-20

### Fixed
- **Grid no longer misaligns on large maps.** The 8px/16px grids coarsened their spacing to 2 or 4 viewBox units once a room exceeded 64 or 128 units, so on a room like 0x38 the "8px" grid actually drew every 32px and stopped lining up with the rendered map. Both grids now draw at true spacing at any room size, emitted as one `<path>` each instead of several hundred `<line>` elements (3.2KB of path data for the largest room).
- **Panning works.** The pan offset lived in two places — `applyPan` wrote to the zoom module's copy while mousedown read a `state` copy that was only synced once at setup — so every drag after the first started from a stale base and jumped. There is now a single owner with a `_getPan()` accessor. Panning also continues when the pointer leaves the SVG instead of cancelling mid-drag.

### Added
- **Layer selection**: `composite` (SNES Mode 1, default), `L2 terrain` (BG1) and `L1 canopy` (BG2) render the map image from the chosen layer. Each layer is cached per room.
- **New overlay toggles**, all drawn from decoded ROM data: `collision` (real sub-tile geometry, coloured per elevation plane), `rom objects` (Section 3 object stamps with per-state footprints), `drift` (tiles that push an entity, with direction ticks) and `grass` (cuttable-grass metatiles).
- **ROM MAP DATA section** at the bottom of the room panel listing every decoded feature — collision tile count and elevation planes, object and state counts, drift tiles broken down by direction, cuttable grass with table-invariant warnings, tile families, and trigger counts — plus a **ROM OBJECTS** table of each object's states, positions, sizes and metatile IDs.

## [0.8.0] — 2026-09-20

### Added
- **The Rooms tab now shows the actual rendered map**, not a collision approximation. `render_map.py`'s graphics pipeline is ported to TypeScript: SNES palette extraction (`$9CC322`), CHR tile graphics decompression (`$8CC88C`/`$8CC9C0`, both the uncompressed-word and dual-stream nibble-command encodings), 4bpp planar pixel decoding with hardware flips, VRAM tilemap layer rendering, and SNES Mode 1 compositing (main/subscreen selection, per-tile priority, CGADSUB add/half-add/subtract colour math).
  - **Output is pixel-identical to `render_map.py`** — verified across 9 rooms spanning 320×256 to 2048×1120, all 1.9M+ pixels matching on room 0x38. The render comparison is part of `npm run check:maps`, dumping raw RGBA from both sides so neither PNG encoder is in the way.
  - `src/maps/png.ts` encodes PNGs with Node's `zlib`, so the host hands the webview a `data:` URI that slots into the existing room-image layer. A ROM render displays at full brightness, unlike the dimmed static screenshots it replaces.
  - Renders are cached per room (12 most recent): ~146ms cold for the largest room, ~2ms warm.
- **Collision overlay now shows real sub-tile geometry** instead of uniform squares — slopes render as the triangles they actually block, half-blocks as halves — coloured per elevation plane (blue/red/green/purple for planes 0–3, matching `render_map.py`). Drift tiles are detected and marked. Multi-plane rooms like 0x06 now render all four plane colours. Toggled by a `collision` button, off by default so the map is visible.

### Fixed
- Filter buttons never synced their initial state: a button rendered without `.on` would read as off while its content was still shown, because the click handler only toggled. Initial state is now applied on render.
- `tsconfig.json` was missing `types: ["node"]`, so any use of `Buffer`/`zlib` failed `npm run typecheck` despite being valid in a Node extension host.

## [0.7.0] — 2026-09-20

### Added
- **Rooms tab renders real ROM map data**. Selecting a vanilla room now paints its decoded collision grid behind the trigger/entity overlays, so the map area shows the actual room shape instead of an empty grid.
  - `src/rooms/rendering/tile-overlay.js` turns a decoded collision grid into SVG path data, one `<path>` per visual class (solid / partial / drift) with horizontal run-merging — a 128×70 room is 8960 tiles, so per-tile DOM nodes are not viable. Worst-case payload 24KB, average 3.9KB.
  - Decoding is on demand per selected room over a new `requestRoomTiles` / `roomTiles` webview message pair; the rooms tree JSON carries no tile data.
  - New `tiles` filter button toggles the overlay.
- **`src/maps/` is now a TypeScript port of the verified `everscript` room decoder** (`tools/dump_room.py`, `collision.py`, `cuttable_grass.py`): LZSS and 2D Markov decompressors, deterministic blob-layout walking, collision bitfield accessors, cuttable-grass swap table.
  - `npm run check:maps` diffs the port against the Python implementation; it matches on **all 127 rooms**, including `0x38` (which the old decoder failed on) and `0x15` (uncompressed Block 3). `MAP_PARITY_ALL=1` runs the full sweep, and it is wired into `npm test`.
  - `npm run build:maps` compiles via a dedicated `tsconfig.maps.json` (the root config is typecheck-only), emitting to the gitignored `src/maps/dist/`; `src/maps/index.js` is a stable CommonJS facade.
  - Grids are numbers throughout, dropping upstream's parallel hex-string form and the mixing footgun it warns about.
- **Map format documentation imported** from `everscript` into `docs/map-format/`, plus the upstream `rom-map-data` skill.
- `loadRomBuffer()` / `invalidateRomBuffer()` in `src/shared/rom-readers.js` — caches the ~3MB ROM by path+mtime instead of re-reading it per call.

### Fixed
- **`npm test` was red on `develop` since v0.6.0.** That refactor moved `tests/corpus/` and `tests/opcodes/` into `sandbox/` without updating the requires, breaking `parser-parity.test.js` (260 assertions) through a four-deep require chain. All stale paths repointed, including one still aimed at the pre-v0.6.0 `debugger/emulator/` location.
- **`.vscodeignore` excluded `src/**` while `main` is `./src/extension.js`**, so `npm run package` produced a `.vsix` that could not load. Only the TypeScript sources under `src/maps` are excluded now; the compiled output ships. This went unnoticed because the extension was actually being installed by the old `rsync` ritual, not by `npm run deploy`.
- **Deployment cleaned up.** `npm run deploy` is now the verified install path (`rbin.everscript-0.7.0`, 934KB, 240 files). The 19 unregistered full-repo `rsync` copies left in `~/.vscode/extensions/everscript-*` by the old ritual were removed, reclaiming ~9GB. The `.vsix` no longer ships emulator-core C sources, build scripts or submodule git pointers — only the built `snes9x_2005.js`/`.wasm` artifacts.

### Changed
- Shelved the superseded sentinel-scan map decoders (`map-pipeline-model.js`, `map-blob-evidence-model.js`) and their tests into `sandbox/maps/`, out of the extension's runtime path.
- `map-format` skill rewritten around the port: porting with validation is fine, independent re-derivation is what failed twice. `render_map.py` (tile graphics) and `encode_room.py` (write path) remain unported.

## [0.6.0] — 2025-06-30

### Changed
- **Refactored entire codebase into `src/` domain structure**.
  - All production code moved from root-level directories (`code_highlighter/`, `memory_radar/`, `debugger/`) into domain-owned subdirectories under `src/`
  - Domain map: `src/language/` (grammar, theme, hover, completion), `src/memory/` (radar tab), `src/rooms/` (map browser), `src/scaling/` (alchemy/scaling tab), `src/docs/` (docs/RNG tab), `src/routes/` (route planner), `src/maps/` (ROM models), `src/emulator/` (SNES core + panel), `src/debugger/` (DAP adapter), `src/shared/` (cross-domain utils)
  - Emulator git submodules moved from `debugger/core/` to `src/emulator/core/`; legacy path remapping added to `panel.js`
  - Test directories reorganized: `tests/memory/` and `tests/debugger/` replace old `memory_radar/tests/` and `debugger/tests/`; exploration scripts moved to `sandbox/`
  - Added `dependency-cruiser` (`npm run check:deps`) and full validation suite (`npm run typecheck`, `npm run check:circular`, `npm run check:dead`)
  - Zero architecture violations confirmed: dep-cruiser, madge, knip, tsc all clean
  - Added domain `README.md` files for all `src/` subdirectories and `sandbox/`

## [0.5.6] — 2026-06-15

### Changed
- **Standalone script parser experiment and parity baseline refresh**.
  - Add a dedicated `script_parser/` workspace with a minimal ROM script model, script-all truth extraction, generated opcode corpus artifacts, and focused reach-end tests for phase-1 traversal validation
  - Add `.github/agents/script-parser-generator.agent.md` for isolated parser iteration workflow
  - Extend fallback opcode handling in `debugger/emulator/opcode-registry.js` and refresh `tests/parity/snapshots/parser-parity-golden.snapshot.json` after parser behavior updates

## [0.5.5] — 2026-05-30

### Changed
- **Evidence-driven parser iteration (test-first parity loop)**.
  - Adjust opcode `0xA7` sleep summary in `debugger/emulator/room-script-model.js` from raw ticks to dump-aligned tick count (`ticks - 1`)
  - Regenerate parity golden snapshot in `tests/parity/snapshots/parser-parity-golden.snapshot.json` after validated parser behavior change
  - Re-ran mandatory loop commands (`npm test`, `npm run test:parity`, `npm run test:parity:strict`) and recorded deltas from the generated parity report

## [0.5.4] — 2026-05-30

### Changed
- **Corpus-driven parser parity harness expanded** without adding parser logic.
  - Add top-level generated parity modules under `tests/`:
    - `tests/corpus/script-all-corpus.js` for `script_all` ingestion, opcode enumeration, grouped instruction normalization, and ROM byte extraction
    - `tests/opcodes/opcode-report.js` for per-opcode occurrence stats, real decode samples, and variable-length opcode detection
    - `tests/boundaries/boundary-report.js` for instruction boundary validation and script-level parity accounting
    - `tests/parity/report-builder.js` and `tests/parity/failure-types.js` for report orchestration, golden summary snapshots, and expanded failure classes
  - Replace the old single aggregate parity assertion in `debugger/tests/parser-parity.test.js` with generated per-opcode and per-script coverage
  - Add explicit `SIZE_MISMATCH` and `SUBEXPR_DESYNC` defect classes to the parity harness output
  - Emit dedicated reports for aggregate parity, opcode coverage, and unknown-opcode desync investigations to `tmp/`
  - Add `npm run test:parity` and `npm run test:parity:strict` so the suite can run in diagnostic mode by default and red-bar in strict defect mode

## [0.5.3] — 2026-05-29

### Changed
- **Parser correctness validation harness added** (SoEScriptDumper parity focused).
  - Add `debugger/tests/parser-parity.test.js` as CI-ready parity runner integrated into `npm test`
  - Add `debugger/tests/parity/ground-truth-parser.js` to parse SoEScriptDumper `script_all` into script IR blocks
  - Add `debugger/tests/parity/ir-diff.js` and `failure-classifier.js` for structured mismatch reporting:
    - `OPCODE_MISSING`, `OPERAND_MISMATCH`, `PC_DESYNC`, `BRANCH_TARGET_ERROR`, `STATE_DRIFT`, `UNKNOWN_OPCODE`
  - Add `debugger/tests/parity/opcode-interactions.js` for targeted opcode interaction regressions
  - Add `debugger/tests/parity/fuzz-generator.js` for deterministic property/fuzz checks (PC alignment, determinism, unknown-opcode guard)
  - Add golden snapshot baseline at `debugger/tests/parity/snapshots/golden-parity.snapshot.json`
  - Emit structured parity reports to `tmp/parser-parity-report.json` for incremental debugging loops

## [0.5.2] — 2026-05-29

### Changed
- **Room script parser coverage completed against SoEScriptDumper ground truth** — no user-visible UI changes.
  - Add `debugger/emulator/opcode-registry.js` with a unified opcode registry (151 opcodes from SoEScriptDumper `printscript` switch)
  - Add ground-truth fallback decoder for previously unsupported opcodes, including variable-width formats driven by sub-expression parsing
  - Integrate fallback decode path into `debugger/emulator/room-script-model.js` so non-covered opcodes no longer terminate decode as unknown
  - Export `OPCODE_REGISTRY` from `room-script-model.js` for debugger/parser tooling use
  - Extend `debugger/tests/room-script-model.test.js` with:
    - exact registry parity check vs SoEScriptDumper opcode set
    - mixed-script decode test covering previously unsupported instruction classes

## [0.5.1] — 2026-05-29

### Changed
- **Architecture stabilization pass** — no user-visible behavior changes.
  - Split `debugger/emulator/panel.js` (1448 LOC) into lifecycle (`panel.js`, 454 LOC) + webview HTML template (`panel-webview.js`, 1007 LOC)
  - Fix `tsconfig.json` to exclude `memory_radar/webview/assets/**` (browser-concatenated files) — `npm run typecheck` now passes cleanly
  - Delete dead files: `memory_radar/webview/assets/scaling-tab.js` (638 LOC superseded), `memory_radar/room-tree-new.js` (unreferenced shim)
  - Install `madge` + `knip` as dev tools; add `npm run check:circular` and `npm run check:dead` scripts
  - Add `knip.json` with entry points and ignore patterns for webview assets
  - Integrate validation into change ritual: typecheck + circular + dead before every commit
  - Add §§ 12–15 to `copilot-instructions.md`: tab ownership islands, validation tooling, TypeScript migration policy, dead code policy
  - Update `AI_ARCHITECTURE_GUIDE.md`: revised hotspot table, updated ritual with validation gate, new validation tooling section

## [0.5.0] — 2026-06-07

### Changed
- **Major architectural decomposition** — no user-visible behavior changes.
  - Extract `renderRadarHtml` (593 LOC) from `extension.js` into three focused modules:
    - `memory_radar/render-radar.js` — orchestrator (179 LOC)
    - `memory_radar/render-memory-tab.js` — WRAM grid + detail table (300 LOC)
    - `memory_radar/render-docs-tab.js` — docs + RNG tabs (191 LOC)
  - `extension.js` reduced from 1461 → 878 lines
  - Split `code_highlighter/language-providers.js` (559 LOC) into 6 focused modules + 39-line facade:
    - `workspace-index.js`, `hover-provider.js`, `completion-provider.js`, `symbol-provider.js`, `dead-branch.js`, `definition-provider.js`
  - Fix pre-existing `getRadarMap()` ReferenceError in hex literal hover path
  - Fix pre-existing stray HTML string in completion provider
  - Split `memory_radar/webview/assets/scaling-tab.js` (638 LOC) into `assets/scaling/` (8 files):
    - `alchemy-math.js` (88 LOC), `state.js` (37 LOC), `helpers.js` (67 LOC), `events.js` (47 LOC), `damage-math.js` (57 LOC), `chart.js` (73 LOC), `redraw.js` (282 LOC), `tab-init.js` (7 LOC)
  - Alchemy math functions promoted to shared outer scope — accessible from docs tab
  - Updated `AI_ARCHITECTURE_GUIDE.md` and `STATE_FLOW.md` to reflect decompositions

## [0.4.1] — 2026-06-06

### Changed
- **Architectural cognitive stabilization docs added** — no code changes.
  - `AI_ARCHITECTURE_GUIDE.md` — global architectural laws, file size limits, anti-abstraction rules, entropy hotspot table
  - `STATE_FLOW.md` — authoritative state ownership table and full data-flow diagrams for all subsystems
  - `debugger/README.md` — rewritten as ownership contract with dependency rules and invariants
  - `memory_radar/README.md` — rewritten with ownership map, tab ownership table, entropy hotspots
  - `memory_radar/rooms/README.md` — new ownership contract, public API reference, client-side counterpart map
  - `code_highlighter/README.md` — rewritten with allowed deps, state owned, split targets
  - `.global/skills/compress-architecture.md` — reusable ownership decomposition prompt
  - `.global/skills/isolate-subsystem.md` — reusable dependency-direction fix prompt
  - `.global/skills/stabilize-state-flow.md` — reusable one-owner-per-state prompt
  - `.global/skills/split-orchestration.md` — reusable god-file decomposition prompt
  - `.github/agents/everscript-plugin-builder.agent.md` — added cognitive stabilization references
  - `.github/agents/mechanics-modeler.agent.md` — added cognitive stabilization references
  - `.github/copilot-instructions.md` — added §11 Architectural Cognitive Stabilization

## [0.4.0] — 2026-06-05

### Changed
- **Rooms tab decomposed into ownership-local subsystem** (`memory_radar/rooms/`). Every file answers one question only.
  - `rooms/parsing/content-parser.js` — pure .evs map block parser
  - `rooms/parsing/file-scanner.js` — filesystem tree builder with explicit deps injection
  - `rooms/rendering/tree-renderer.js` — server-side tree HTML + JSON
  - `rooms/data/lua-watchers.js` — Lua POI data + script trigger loading
  - `rooms/data/vanilla-data.js` — vanilla room catalogue + ROM-backed content builders
  - `rooms/index.js` — re-export facade + `invalidateRoomDataCaches()`
  - `room-tree.js`, `room-data.js` → thin shims; backward-compatible, no extension.js changes
- **Webview rooms-tab.js split into 8 focused modules** (`memory_radar/webview/assets/rooms/`):
  - `bootstrap.js`, `utils.js`, `svg-builder.js`, `tables-builder.js`, `rom-header.js`, `interactions.js`, `detail-renderer.js`, `tab-init.js`
  - Concatenated in dependency order by `webview/index.js`
- All tests pass (55/55 activation, 16/16 smoke, and all other suites).

## [0.3.6] — 2026-06-02

### Fixed
- Restored 6 functions deleted from [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) during Phase 5 extraction: `radarReadMemoryMap`, `radarFindOpenBrace`, `radarFindCloseBrace`, `radarDetectScope`, `radarAnalyzeScope`, `refreshRadar`. Their absence caused "radarDetectScope is not defined" when opening the Memory Radar panel.
- Added `onCommand:everscript.buildAndRun` to `activationEvents` in `package.json` (was missing; the command was declared but not listed).

### Added
- [memory_radar/tests/activation.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/activation.test.js) now validates the `package.json` manifest: verifies `"main"` points to a real file, `engines.vscode` is present, `activationEvents` is non-empty, and every command in `contributes.commands` has a title, is covered by an activation event, and is actually registered by `activate()`. Any future mismatch between package.json and extension.js is caught before release.

## [0.3.5] — 2026-05-28

### Fixed
- Restored `RadarCodeLensProvider` class that was accidentally deleted from [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) during the Phase 5 language-providers extraction (v0.3.0). Its absence caused a `ReferenceError` in `activate()`, preventing ALL commands from being registered and producing "command not found" errors at runtime.

### Added
- Added [memory_radar/tests/activation.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/activation.test.js): activation smoke test that mocks vscode, calls `activate()`, and asserts every expected command is registered. Also verifies all public exports of `room-data.js`, `room-tree.js`, `rom-readers.js`, and `language-providers.js`. This class of silent activation failure cannot recur without the test catching it.

## [0.3.4] — 2026-05-27

### Changed
- Extracted ROM reader functions into [memory_radar/rom-readers.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/rom-readers.js) (`readRomMapHeader`, `readRomTriggerOffsets`, `readRomCharacters`, `readRomHitLookup`, `detectScaleEnemies`, `readPngDimensions`).
- Extracted room data layer into [memory_radar/room-data.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/room-data.js) (`VANILLA_ROOMS`, `getMapEnum`, `readLuaWatchers`, `readScriptAllTriggers`, `buildVanillaRoomContent`, `buildVanillaRoomDetails`).
- Extracted room tree building and rendering into [memory_radar/room-tree.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/room-tree.js) (`findRoomImage`, `parseRoomContent`, `collectRoomsFromDir`, `buildRoomTree`, `renderVanillaTree`, `renderRoomsTree`, `buildRoomsJson`, `setRoomImageUris`).
- Reduced [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) from 3188 lines (pre-cleanup) to 1280 lines (60% reduction) across this and previous cleanup passes.
- Added `tsconfig.json` with `allowJs: true` scaffold for incremental TypeScript adoption.
- Added `typecheck` script to `package.json`.

## [0.3.3] — 2026-05-27

### Added
- Added a byte-script debugger workflow note in [docs/byte-script-debugging.md](/Users/v/Documents/GitHub/everscript-vscode/docs/byte-script-debugging.md), covering how the emulator, mock `.evs` debugger, and Rooms tab currently attach to one another for both source-level and ROM-byte-script inspection.

### Fixed
- Switched manual emulator-panel breakpoints in [debugger/emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/panel.js) from CPU exec breakpoints to live byte-script `loc` matching, so the addresses shown in the script stack now pause on the intended VM instruction instead of the SNES CPU PC.
- Forwarded active byte-script addresses through [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) into [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js) and [memory_radar/webview/assets/shared.css](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/shared.css), so the current decoded ROM-script row/card can highlight live in the Rooms tab.
- Corrected Rooms map extent sizing in [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js) so the rendered view uses the ROM header's `width * 16` and `height * 16` geometry as the authoritative room size.

### Tests
- Extended [debugger/tests/emulator-health.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-health.test.js) for byte-script breakpoint/focus bridging and [memory_radar/tests/smoke.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/smoke.test.js) for live script-focus highlighting plus ROM-header-driven map extents.

## [0.3.2] — 2026-05-27

### Added
- Added manual exec-breakpoint controls to [debugger/emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/panel.js) so the emulator panel can add and remove address breakpoints directly through the custom core bridge.
- Added ROM-backed practical coverage to [debugger/tests/room-script-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/room-script-model.test.js) using the local Evermore ROM when available, anchored on room `0x33` / Strong Heart's Exterior.

### Fixed
- Restored shell-derived PATH handling in [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) for `everscript.buildAndRun`, so compiler subprocesses can find external tools like `asar` again while still preferring the project venv.
- Corrected room-script decoding in [debugger/emulator/room-script-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/room-script-model.js) for branch sizing and the offset-based `0x08`, `0x09`, `0x0c`, `0x18`, and `0x1b` opcode forms used by real vanilla room scripts.
- Updated the Rooms tab presentation in [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js) and [memory_radar/webview/assets/shared.css](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/shared.css) so decoded script errors are clearer, grid layers are toggleable, map fit/pan is more stable, and selected triggers also highlight their script cards.

## [0.3.1] — 2026-05-27

### Added
- Added [debugger/emulator/snes-rom-header-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/snes-rom-header-model.js) with tested HiROM/LoROM cartridge-header parsing based on the SNES internal ROM header.
- Added [debugger/tests/settings-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/settings-model.test.js) and [debugger/tests/snes-rom-header-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/snes-rom-header-model.test.js) to lock down repo-path autofill behavior and cartridge-header parsing.

### Fixed
- Centralized repo-derived settings resolution in [settings-model.js](/Users/v/Documents/GitHub/everscript-vscode/settings-model.js) and updated [package.json](/Users/v/Documents/GitHub/everscript-vscode/package.json) so `repoPath` now clearly auto-fills compiler, Python, source, patches, and ROM defaults while keeping legacy `patchesPath` compatibility.
- Reworked the Rooms tab in [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js), [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js), and [memory_radar/webview/assets/shared.css](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/shared.css) so vanilla rooms use configured-ROM data, missing-ROM states show explicit errors, the stale placeholder path is gone, and the misleading bottom render block is removed.
- Expanded [debugger/emulator/room-script-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/room-script-model.js) to decode a broader set of fixed-width room-script opcodes including text, audio, call, yield, and UI-related instructions.

### Tests
- Updated [memory_radar/tests/smoke.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/smoke.test.js) and [memory_radar/tests/ui.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/ui.test.js) to assert ROM-backed room details, explicit room errors, and the absence of the removed bottom render block.
- Extended [debugger/tests/room-script-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/room-script-model.test.js) with additional fixed-width opcode coverage.

## [0.3.0] — 2026-05-27

### Added
- Added a ROM-backed room-script parser in [debugger/emulator/room-script-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/room-script-model.js) that resolves the enter script, step-on trigger scripts, and B-trigger scripts directly from the map data pointer, trigger tables, and script pointer tables.
- Added decoded script tables to the Rooms tab in [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js), including opcode, size, raw bytes, script addresses, and termination state in a TilesViewer-style view.

### Fixed
- Moved the debugger feature fully under `debugger/`: the emulator panel now lives in [debugger/emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/panel.js) and both bundled/custom SNES core paths resolve from `debugger/core/...`.
- Replaced the old `script_all` text scrape in [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) with the ROM-backed parser so Rooms-tab trigger data comes from the same authoritative source as the map header and payload readers.
- Updated emulator health coverage for the debugger-rooted layout and warning-path mocking in [debugger/tests/emulator-health.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-health.test.js).

### Tests
- Added [debugger/tests/room-script-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/room-script-model.test.js) with synthetic ROM fixtures that validate trigger-table lengths, script-id lookup, opcode sizing, coordinate ordering, and trailing `0x00` termination.

## [0.2.79] — 2026-05-26

### Fixed
- Merged emulator/debugger core handling into the top-level `core/` folder: the debugger-enabled fork now lives in `core/snes9x2005-wasm` and the vanilla base in `core/snes9x2005-wasm-vanilla`.
- Removed the obsolete `debugger/core/snes9x` submodule and stopped using `emulator/core/` as a special bundled-core path.
- Added legacy-path remapping in [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) so existing `everscript.snesCorePath` values that still point at `debugger/core/...` continue to resolve to the debugger core.
- Reworked screen fitting in [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) to size the canvas with actual fitted width/height values instead of relying on CSS transform scaling.
- Fixed manual ROM reloads to redispatch directly to a ready webview instead of rebuilding the whole panel HTML.

### Restored
- Restored working pause/resume and hook controls with the debugger-enabled core, backed by runtime coverage.
- Restored the script detail panel (`ss-detail`) with current active-slot summary, scheduler-chain view, next-slot column, and `0x0F..0x2E` argument dumps as the next safe v0.2.71 feature slice.

### Tests
- Added top-level core build wrappers via `tools/build_snes_core.sh` and updated `npm test`, `npm run test:emulator-runtime`, and VS Code tasks to build both core variants from the merged layout.
- Extended [debugger/tests/emulator-runtime.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-runtime.test.js) to verify fitted canvas sizing, repeat ROM loads, custom-core debugger controls, and the restored script detail panel.
- Extended [debugger/tests/emulator-health.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-health.test.js) for merged-core paths, legacy-path remapping, and restored detail-panel coverage.

## [0.2.78] — 2026-05-26

### Fixed
- Moved the shell-style build/deploy helpers out of [/.vscode/launch.json](/Users/v/Documents/GitHub/everscript-vscode/.vscode/launch.json) into [/.vscode/tasks.json](/Users/v/Documents/GitHub/everscript-vscode/.vscode/tasks.json), including a dedicated `Test Emulator Runtime` task.
- Restored visible-editor debugger anchoring in [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) as the first safe v0.2.71 feature reintroduction.

### Tests
- Added [debugger/tests/emulator-runtime.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-runtime.test.js): a browser-backed runtime harness that loads the real panel HTML, boots the core, loads the Evermore ROM, exercises core commands, and records the actually exported API surface.
- The runtime harness now covers bundled-core auto-load, bundled-core manual-load, and custom-core auto-load.
- The runtime harness supports both debugger-core directory layouts: `debugger/core/snes9x2005-wasm` and `debugger/core/snes9x`.
- Verified manually with the harness that current `v0.2.76` passes while historical commit `654df3e` fails with `timed out waiting for webviewBoot`.

## [0.2.76] — 2026-05-26

### Fixed
- Reverted the v0.2.71 emulator panel lifecycle-analysis changes from [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) to reduce the boot script back to the pre-0.2.71 shape while diagnosing ROM startup failures. The panel now returns to raw script-slot rendering and raw write-triggered break handling.

### Removed
- Removed the semantic script lifecycle summary panel, 0x20-byte argument dump, scheduler-chain view, and focus-row highlighting that were added in v0.2.71.
- Removed the visible-editor fallback for emulator debugger sync anchoring; sync now again requires the active editor to be an `.evs` file.

### Tests
- Dropped the health-test assertions that required the removed v0.2.71 lifecycle-detail UI and visible-editor debugger anchoring.

## [0.2.75] — 2026-05-26

### Fixed
- Emulator panel timeout: restored `script-src * blob: data:` wildcard CSP (identical to the working v0.2.70/v0.2.71 configuration). The v0.2.73 change to `script-src 'nonce-${nonce}' ${cspSource}` and the v0.2.74 change to `script-src ${cspSource} 'unsafe-inline'` both broke the inline boot script — `cspSource` evaluates to `https://*.vscode-cdn.net` which uses a single-label wildcard that does not match the multi-level `file+.vscode-resource.vscode-cdn.net` subdomain used by VS Code's resource server, and can interact with VS Code's own CSP enforcement to suppress `'unsafe-inline'` for inline scripts.
- Removing unused `cspSource = webview.cspSource` from `_buildHtml` since the wildcard CSP no longer needs it.

### Tests
- Renamed test `panel.js uses unsafe-inline CSP (no nonce on script tag)` to `panel.js uses wildcard script-src with unsafe-inline (no nonce on script tag)`.
- Added assertion that `script-src * blob: data:` wildcard is present (prevents regression to restrictive `${cspSource}` form).
- Added comment explaining that nonce in `script-src` suppresses `'unsafe-inline'` per CSP spec.

## [0.2.74] — 2026-05-25

### Fixed
- Emulator panel timeout: switched webview `script-src` CSP from nonce-based (`'nonce-${nonce}'`) to `'unsafe-inline'`. The nonce-based policy was silently blocking the inline `<script>` tag in VS Code's webview Chromium context, preventing `acquireVsCodeApi()` from ever running and causing the 30-second "Timeout waiting for webview ready message" on every build.
- Removed unused `nonce` attribute from the `<style>` tag (style-src had no matching nonce directive).

### Changed
- Webview boot sequence restructured: `window.onerror`, `unhandledrejection`, and `securitypolicyviolation` handlers are now registered **before** `acquireVsCodeApi()` so any init-time error is captured. Uses `var vscodeApi` (hoisted) so the handlers can safely reference it before assignment.
- `vscodeApi.postMessage` calls in Module callbacks and `loadCoreScript.onerror` are now null-safe (`if (vscodeApi)`) in case API acquisition fails.
- `_resetPanelHtml` logs a 220-char HTML head snippet to the output channel for future CSP/script-load diagnostics.
- Added `console.log('[EVS webview] boot...')` and `console.error` calls visible in the webview developer tools.

### Tests
- `debugger/tests/emulator-health.test.js` section G: ROM load simulation. Adds static checks for unsafe-inline CSP, onerror-before-acquireVsCodeApi ordering, webviewBoot placement, and gameStarted flow. Also adds a mock-based runtime test: `openEmulatorPanel` → `ready` → `loadRom` dispatched → `gameStarted` processed without errors.

## [0.2.73] — 2026-05-25

### Added
- `memory_radar/models/map-pipeline-model.js`: comprehensive evidence-backed map pipeline model covering all confirmed stages: blob header, trigger tables, tile families, sentinel scan, position table, nibble-packed tilemap, delta decode, EE descriptor lookup, and render script 0x93 structure. Includes trusted pass1/pass2 word constants for map 0x33 from Mesen2 memory snapshots (2nd decompressor invocation, source: `tmp/map_research.md`).
- `tools/map-dump.js`: unified map dump script (replaces scattered root-level dump scripts). Prints a structured 13-section dump of any map blob including 6-byte sub-header layout, decompressor trace evidence summary, and provisional tilemap formula caveat.
- `memory_radar/tests/map-pipeline-model.test.js`: 44 tests covering address conversion, delta decode, nibble tilemap parse, sentinel scan, render script 0x93 structure, and ROM-dependent blob parse (map 0x33 all stages).
- `.vscode/launch.json`: F5 launches Extension Host. Added `Build Core (snes9x2005-wasm)` and `Dump Map 0x33` configs.
- `npm run package`: packages VSIX to `out/` via `vsce --out out/` with clear error message on failure.
- `npm run deploy`: packages VSIX and installs with `code --install-extension --force`, then verifies `rbin.everscript` is present in the extension list. Clear error messages when `code` CLI is not in PATH or install fails.
- `docs/map-0x33-analysis.md`: decompressor section expanded with sub-header byte layout, trace PC signatures, two-invocation structure, and exact list of what disassembly is still needed.

### Changed
- `.gitignore`: now ignores `out/` (entire build output folder) instead of `*.vsix`. VSIX files are always built to `out/` and never committed.
- `.vscode/launch.json`: `Deploy Plugin` renamed to `Deploy Plugin (VSIX)` and now uses `npm run deploy` instead of rsync.
- `memory_radar/models/map-pipeline-model.js` header: `compressedSectionSize` comment corrected (was "4-byte sub-header", now "6-byte sub-header + 158-byte bitstream"). `parseTilemap` comment updated: `family = nibble >> 2` is marked as provisional with caveat about the 62.8% out-of-range tile ratio. TRUSTED_MAPS block comment now cites `tmp/map_research.md` and the Mesen2 trigger number.

### Fixed
- Emulator panel webview no longer fails to parse on startup. Root cause: v0.2.71 introduced box-drawing characters (`\u2500`) inside the HTML template literal as JS/CSS comment dividers; these non-ASCII bytes caused the webview browser to throw `Invalid or unexpected token` before `onRuntimeInitialized` ever fired, so the `ready` message was never sent, and ROM loading appeared silently broken.
- All non-ASCII characters removed from `emulator/panel.js` (ASCII-only enforcement).

### Removed
- Root-level `build`, `deploy`, `dump-map-blob.js`, `decode-rom-tilemap.js`, `dump-map-trace-flow.js`, `dump-map-evidence.js` removed from repo. Functionality is now in `tools/map-dump.js` and `.vscode/launch.json`.

## [0.2.72] — 2026-05-22

### Added
- Added `debugger/core/snes9x` as a tracked git submodule pointing to `https://github.com/r-bin/snes9x2005-wasm.git`.
- Added `docs/snes9x_integration.md` with the full integration playbook (subtree/submodule options, tmp migration strategy, hook patterns, and architecture layout).
- Documented debugger core submodule setup/update workflow and branch handoff steps in `debugger/README.md`.

## [0.2.71] — 2026-05-22

### Updated
- Script-stack breaking now happens on semantic slot lifecycle snapshots instead of the first raw `0x28FC`-region byte write. This gives the panel a complete slot image after creation/activation, including the populated `0x0F..0x2E` argument block.
- Script-stack panel now shows a richer debugger summary: executing slots, current active-slot interpretation, scheduler chain via `next_script`, and a focused 0x20-byte arg dump for the latest lifecycle event.
- Emulator debugger sync can now anchor from a visible `.evs` editor even when the emulator webview has focus, fixing the earlier `open an .evs editor first` failure mode.

## [0.2.70] — 2026-05-22

### Added
- Emulator panel button to break on all observed hook writes, not just debugger callback hits. This pauses the core when any watched script-slot byte changes.
- Emulator panel button to connect the existing VS Code `everscript` debugger. Emulator hook breaks now sync into the mock debug adapter through a new `syncFromEmulator` request so VS Code shows a real `stopped` event.

### Updated
- Added regression coverage for the emulator-to-debugger sync path and the new panel controls.

## [0.2.69] — 2026-05-22

### Fixed
- Script-hook watchpoints now follow the custom debugger contract again: `addWriteBreakpoint()` receives WRAM offsets, not `$7E` bus addresses.
- Added explicit hook lifecycle and observed-write logs in the Everscript Build output so hook activity is visible even before a breakpoint pause is confirmed.
- Audio now reads the core's exported `Float32` planar `2048 + 2048` sample buffer directly instead of treating it as interleaved `Int16`, fixing the loud robotic output.

## [0.2.68] — 2026-05-22

### Fixed
- Emulator script-stack hook now arms write breakpoints with full `$7E` bus addresses instead of raw WRAM offsets. This fixes the non-firing hook in custom debugger builds.
- Audio startup is now tied to a real webview user gesture and explicitly resumes the `AudioContext` after ROM load, fixing muted playback caused by autoplay suspension.
- Screen scaling now uses deterministic transform-based resizing and refreshes on visibility, resize, and frame updates so the game canvas fills the available panel area instead of staying near native size.

## [0.2.67] — 2026-05-22

### Changed
- **Removed EmulatorJS entirely.** The emulator panel now loads `snes9x2005-wasm` (lrusso Emscripten build) directly in the VS Code webview — no libretro wrapper, no `.data` bundles.
- Core files moved to `emulator/core/snes9x_2005.{js,wasm}` (bundled with extension). Old `emulator/vendor/emulatorjs/` archived to `tmp/emulatorjs-vendor/`.
- `everscript.snesCorePath` setting now accepts a path to a custom `snes9x2005-wasm` `.js` file (matching `.wasm` must be in the same directory). Previously it accepted a `.data` EmulatorJS bundle.

### Added
- **Audio**: Web Audio via `ScriptProcessorNode` + ring buffer. `_getSoundBuffer()` is fed into a 16-bit stereo → float32 pipeline at 44100 Hz after each frame.
- **Proper screen scaling**: canvas CSS scales to fill the panel while preserving the 512:448 aspect ratio via `ResizeObserver` and aspect-ratio math.
- **Script stack WRAM fallback** updated: reads from `Module._saveState()` + `Module._getStateSaveSize()` instead of EmulatorJS game manager.

### Updated
- `debugger/tests/emulator-health.test.js` rewritten for the new architecture: checks `emulator/core/` files, WASM magic bytes, required Emscripten exports, no EJS_Runtime, and panel.js sanity (17 tests, 0 xfail).

## [0.2.64] — 2026-05-21

## [0.2.66] — 2026-05-21

### Added
- `debugger/tests/emulator-health.test.js` — validates vendor assets and both core bundles (pre-delivered + custom) before launch. Checks: file existence, 7-zip magic bytes, required bundle contents, `EJS_Runtime` definition. Custom core `EJS_Runtime` check is marked `xfail` (known: snes9x2005-wasm is a standalone Emscripten build, not a libretro wrapper).
- `emulator.min.css` added to vendor dir (copy of `emulator.css`) — stops EmulatorJS console warning about missing minified CSS.

## [0.2.65] — 2026-05-21

### Added
- Webview error forwarding: `window.onerror`, `unhandledrejection`, and a `console.warn` intercept now pipe EmulatorJS errors into the Everscript Build output channel (auto-reveals on error). Removes the VS Code modal popup for emulator errors.


### Added
- `tools/pack_snes_core.py` — script to package a custom snes9x2005-wasm build into an EmulatorJS-compatible `.data` bundle (7-zip). Running it against `tmp/docker/snes9x_2005.js` + `.wasm` produces `tmp/custom-snes9x.data`.
- Script stack header now shows a **core info row** below the button bar displaying the active core filename and full bundle path, or "snes9x (bundled)" with the vendored `.data` path when no custom core is configured.

# [0.2.63] — 2026-05-21

### Added
- **EmulatorJS script-stack debugger panel**: the script stack table now reads directly from the running module when a custom debugger-enabled SNES core is loaded, and falls back to save-state parsing otherwise.
  - Visible **custom API proof** in the panel (`api: custom debugger active`) using `getCPUState()` / `readMemoryRange()` when available.
  - **Pause / resume controls** wired to the custom debugger API.
  - **Script stack hook toggle** arms write breakpoints on key script-slot fields so stack writes can pause the emulator and be resumed from the panel.
  - Fixed the previous stack reader bug where the panel injected `Module.EmulatorJSGetState()` but still called a missing `gm.getState()`, leaving the table stuck on `connecting...`.

# [0.2.62] — 2026-05-21

### Changed
- **SNES custom core path now stays inside EmulatorJS**: `everscript.snesCorePath` now overrides EmulatorJS's SNES core bundle path instead of switching to a separate custom canvas runtime.
  - **Empty setting**: uses the bundled EmulatorJS `snes9x` core exactly as before.
  - **Custom setting**: must point to an EmulatorJS-compatible SNES core bundle (`*.data`). The panel overrides both `snes9x-wasm.data` and `snes9x-legacy-wasm.data` through EmulatorJS `filePaths`, so the normal EmulatorJS UI, settings overlay, input handling, audio path, and lifecycle remain intact.
  - **Incompatible raw `.js` / `.wasm` paths** are now rejected with a warning instead of silently switching to a separate runtime.

# [0.2.59] — 2026-05-21

### Added
- **`everscript.snesCore` setting**: Choose the SNES emulator core used in the embedded emulator panel.
  - **Default (empty)**: uses the bundled EmulatorJS snes9x libretro core — same as before.
  - **Custom path**: point to `snes9x_2005.js` from a custom `snes9x2005-wasm` build (the matching `.wasm` must be in the same directory). The panel then uses a canvas renderer that calls directly into the WASM module, bypassing EmulatorJS entirely. Enables debugger breakpoint APIs (`Module._addExecBreakpoint`, etc.) added in the snes9x2005-wasm build.
  - Changing the setting and re-opening the panel (F5 or `Open Emulator`) auto-detects the new core. If the panel is already open and the core changes, it is automatically recreated with the correct `localResourceRoots`.

# [0.2.58] — 2026-05-21

### Fixed
- **Compiled ROM now actually boots in the emulator**: EmulatorJS uses `fetch()` internally to load the game. VS Code webviews silently block `fetch()` on `data:` URLs, causing EJS to open its file browser instead of booting the ROM. The base64 payload is now converted to a `Blob` URL in the webview before being passed to EmulatorJS.

### Added
- **Emulator launch logging**: Build output channel now shows ROM path, size, blob creation confirmation, and game-started event. Errors from the emulator side (blob conversion failure, etc.) surface as an error notification.

# [0.2.57] — 2026-05-21

### Fixed
- **Compiled ROM now boots in the embedded emulator**: Loading a ROM into an already-open emulator panel now rebuilds the webview first, so EmulatorJS starts from a clean bootstrap and consumes the new ROM instead of dropping into its file browser.
- **Settings command contribution now loads cleanly**: Removed a duplicate `everscript.romPath` manifest key that could interfere with VS Code contribution parsing.

# [0.2.56] — 2026-05-28

### Fixed
- **F5 Python interpreter**: `buildAndRun` now detects the project's `.venv/bin/python3` and uses it instead of the system `python3`. System Python lacks the `injector` package, causing `ModuleNotFoundError`. Fallback chain: `.venv/bin/python3` → `.venv/bin/python` → `venv/bin/python3` → `venv/bin/python` → `python3`.
- **Relative paths in compiler invocation**: `--patches` and input file arguments are now passed as relative paths from the project root (e.g. `./patches`, `in/practice`), matching the working manual command.
- **Exact command logged**: Output channel now shows the full command as it would be typed in a terminal.

### Added
- **`everscript.pythonPath` setting**: Optional override for the Python interpreter path. When empty, auto-detected from the project `.venv`.
- **`Everscript: Open Everscript Settings` command**: Opens VS Code Settings UI pre-filtered to all `everscript.*` settings (Cmd+, equivalent).

### Removed
- **Settings tab from Emulator panel**: Settings belong in VS Code's built-in settings UI (Cmd+, → search "everscript"). The emulator panel is now a pure emulator again.

# [0.2.55] — 2026-05-21

### Added
- **Settings tab in Emulator panel**: New "Settings" tab alongside "Emulator". Fields: Everscript repo path, patches/ folder, compiler binary or script, vanilla ROM, SNES core (snes9x). Auto-fill button (and Enter key on the repo field) probes the repo and pre-populates all other fields. Save persists to VS Code global settings.
- **Python compiler support**: `buildAndRun` (F5) now detects `everscript.py` in the repo root and runs `python3 everscript.py --rom <ROM> --patches <patchesDir> <input.evs>` instead of the binary. Falls back to `dist/everscript_mac` / `dist/everscript.exe` if no Python script found.
- **New settings**: `everscript.repoPath`, `everscript.patchesPath`, `everscript.romPath`. Together with the existing `everscript.compilerPath` override, these replace `everscript.projectRoot`.

### Changed
- `everscript.projectRoot` removed; replaced by `everscript.repoPath`.
- Error messages now point to "Emulator panel → Settings tab" instead of raw setting names.
- Emulator overlay changed from `position:fixed` to `position:absolute` inside its tab pane, so it no longer covers the Settings tab.

# [0.2.54] — 2026-05-28

### Added
- **Real compiler wiring (F5)**: `everscript.buildAndRun` now auto-detects the Everscript compiler binary by walking up from the active `.evs` file looking for `dist/everscript_mac` / `dist/everscript`. Runs `everscript_mac --rom <ROM> <input.evs>` with the project root as `cwd`, reads `out/<ROM>`, and loads it into the emulator automatically. No configuration required for the standard project layout.
- **Script Stack panel**: A compact live panel appears below the emulator once the game starts. Polls the WRAM via EmulatorJS save-state API every 500 ms; parses the 20 script slots at `0x28FC` (each `0x4F` bytes); shows slot#, PC, state (exec/wait/dead), entity, and timer1. Color-coded rows: green = executing, yellow = standby, red = dead.
- **WRAM delta messages**: The webview posts `{ command: 'wramDelta', offset, data }` to the host after each poll for future Memory Radar live-mode integration.
- **New settings**: `everscript.compilerPath` (override compiler binary path) and `everscript.projectRoot` (override project root). Replaces `everscript.buildCommand` / `everscript.buildOutput`.

### Changed
- `everscript.buildCommand` and `everscript.buildOutput` removed; replaced by `everscript.compilerPath` and `everscript.projectRoot`.
- Emulator webview layout changed to flex-column so the script-stack panel sits below the emulator canvas without overlapping it.

# [0.2.51] — 2026-05-21

### Fixed
- **Command registration bug**: Fixed duplicate `commands` block in `package.json` that prevented "Everscript: Open Emulator Panel" from appearing in the Command Palette. Both commands now show up after reload.

### Added
- **Emulator Panel (Phase 1 — keyboard POC)**: `Everscript: Open Emulator Panel` command opens a webview with a SNES-style canvas + live key log. Proves VS Code webview keyboard capture works end-to-end. ROM picker sends the path to the panel; WASM emulator slot documented for Phase 2.
  - `emulator/panel.js` — panel registration, ROM picker, extension↔webview message bridge.
  - `emulator/webview/index.html` — canvas, SNES button map, held-key chips, key event log.
- **Call Log module design**: `call-log/design.md` — full architecture for a live function-call logger: detection strategy, WRAM data sources, `call-decoder.js` / `log-channel.js` / `log-webview.js` module split, VS Code settings, Phase 1 (mock) + Phase 2 (live WRAM) plan.
- **Emulator rankings doc**: `docs/web-emulator-plan.md` — ranked analysis of ares, Snes9x, Mesen2, RetroArch by license, WASM availability, accuracy, and debug API. Legal summary table. Phase plan through v1.0.
- **`DebugConfigurationProvider`**: F5 on a `.evs` file with no `launch.json` now auto-fills the debugger config from the active editor, fixing the "wrong file" (kaizo.evs) problem.
- **Debug activation events** (`onDebugResolve:everscript`, `onDebugAdapterProtocol:everscript`): extension activates before a debug session starts so gutter breakpoints are always clickable.

### Updated
- `docs/embedded-emulator-panel-concept.md` — added emulator-selection table, keyboard findings, and current implementation status table.

# [0.2.49] — 2026-05-21

### Added
- **Debugger (Phase 1 — mock)**: source-level step debugger for `.evs` files using the Debug Adapter Protocol.
  - `debugger/adapter.js` — DAP server (stdin/stdout, no npm dependencies).
  - `debugger/mock-runtime.js` — parses `.evs` function blocks, simulates stepping line-by-line, fires `stopOnEntry`/`stopOnStep`/`stopOnBreakpoint` events.
  - Supports: Launch, Breakpoints, Continue, Step Over, Step Into, Step Out, Call Stack panel, Locals variables (mock WRAM refs), `arg[]` scope.
  - `package.json` gains `"breakpoints"` + `"debuggers"` contributions; F5 on any `.evs` file launches the mock session.
  - `debugger/poc-design.md` — architecture doc, compiler changes needed for Phase 2 (live WRAM), and Phase 3 (full DAP).
  - 10 new tests in `debugger/tests/debugger.test.js`.

# [0.2.48] — 2026-05-21

### Fixed
- **Memory Radar activation**: added explicit command activation for `everscript.openMemoryRadar` so the command is registered even before an `.evs` editor activates the extension.

# [0.2.48] — 2026-05-20

### Changed
- **Modular webview**: extracted all 7 inline webview template literals (CSS, scaling, rooms, docs, route, rng, shared JS) from `extension.js` into `src/webview/*.js` modules. `extension.js` reduced from 5280 to 2852 lines.
- **Dead code removed**: `alchemyWebview*` variable definitions and the `alchemy-model` destructure require removed from `extension.js` top level (now live in each webview module).
- **Models directory**: `models/alchemy-model.js`, `models/radar-utils.js`, `models/map-blob-evidence-model.js`, `models/render-script-model.js` are the authoritative copies; root files are thin shims.

# [0.2.47] — 2026-05-20

### Changed
- **Prophet simulation redesign**: replaced outer-reset-counting model with a single-run model that tracks *prompts* (total prophet interactions) and *resets* (player-initiated story resets) per run.
- **Output format**: now shows `prompts: avg X p50 Y p90 Z | resets: avg A p50 B` (success rate shown only when < 100%).
- **Four profiles replacing three strategies**: `mash` (never reset, can tilt), `reset4chaos` (reset at state 4 or any chaos), `reset4` (reset only at state 4, allows chaos recovery), `metaonly` (reset unless in meta arc 6–8, except state 0).
- Histogram now plots prompts distribution (was reset count).

# [0.2.46] — 2026-05-20

### Changed
- **Prophet RNG tab**: replaced basic 3-column codename table with full 5-column state analysis (State, Codename, Reach 8%, Reach 5%, Next states with odds).
- **Prophet simulation**: replaced simple reset counter with strategy-aware `simProphetStrategy(strategy)` implementing correct arc transitions (prophecy/meta/chaos).
- **Reset strategy dropdown**: Aggressive (reset on any chaos or tilt), Moderate (allow 2 chaos rounds), Full EV (reset only on permanent tilt lock). Description updates on change.
- Arc color-coded table rows (blue=prophecy, green=meta, red=tilt, muted=chaos).

# [0.2.45] — 2026-05-20

### Added
- **RNG tab** — new tab in the Memory Radar panel with three simulation sections:
  - **Naris / Super Heal**: 50/50 coin-flip, average ~2 attempts.
  - **Prophet / Bronze Armor**: State-machine simulation over 20 codename states (DOOM→FUSELAGE); includes full codenames reference table; average ~24 area resets.
  - **Egg / Chocobo Egg**: Pot-purchase simulation (5 or 10 pot run); average ~43 purchases.
- Each section has a "Simulate 10,000×" button, avg/p50/p90/p99 output, and a bar histogram.

# [0.2.44] — 2026-05-20

### Changed
- Project cleanup: moved all map-analysis and R&D files to tmp/, removed dead test/model scripts, updated .gitignore to exclude dependencies/.
- No change to extension output or user-facing features.

# Changelog

## [0.2.43] — 2026-05-14

### Added
- **Mechanics model artifact** — added `docs/rooms-payload-boundary.model` as the single evidence-backed boundary model for room payload parsing, with validated map outcomes and explicit `TODO_EVIDENCE_NEEDED` items for unresolved decompressor semantics.

## [0.2.42] — 2026-05-14

### Fixed
- **Map payload boundary false positives** — `decodeMapPayload` now constrains sentinel candidate scanning to the current map blob (nearest higher map pointer end) instead of scanning far into later ROM data.
- **Blob-bounded payload parsing** — position-table and tilemap reads now also enforce map-blob bounds, preventing cross-blob overreads and accidental decode acceptance.

### Added
- **ROM-backed payload regression** in `test/map-payload-compression.test.js`:
  - verifies decode succeeds for maps `0x33`, `0x34`, `0x51`, `0x5c` under bounded scan rules,
  - verifies map `0x38` correctly fails under the current known sentinel model.
- **Feature dossier update** in `docs/map-renderer-status.md` documenting the new bounded-scan evidence and revised parse snapshot.

## [0.2.41] — 2026-05-14

### Added
- **Model test: room compressed-section vs tile codec** — added `test/map-payload-compression.test.js` to run a direct experiment applying tile-compression framing to real room compressed data (map `0x33`) and compare against trace-backed map expectations.
- **Trace comparison assertions** — added explicit checks showing tile codec framing does not reproduce the observed room tilemap structure/diversity, and that room sentinel boundary semantics are distinct from tile framing.

### Changed
- **Test pipeline** — `npm test` now includes `node test/map-payload-compression.test.js` in the default sequence.

## [0.2.40] — 2026-05-14

### Fixed
- **Map payload sentinel detection** — `decodeMapPayload` now accepts additional observed boundary variants:
  - strict7 core: `x 00 00 00 01 00 FF` where lead byte `x` is not restricted to `0x30`/`0xC8`.
  - short6 core: `x 00 00 01 00 FF` for variant payloads not matching strict7.
- **Candidate guardrail** — sentinel candidates now reject implausible position-table counts (`posCount > 64`) to reduce false-positive boundary picks.
- **Offset correctness** — decode now uses matched sentinel length (6 or 7) when computing position-table and tilemap starts.

### Added
- **Smoke tests** covering both new sentinel variants:
  - strict7 wildcard-lead sentinel acceptance.
  - short6 sentinel variant acceptance.
- **Map renderer status update** documenting current variant findings and tile-compression comparison status.

## [0.2.39] — 2026-05-14

### Added
- **Agent workflow requirement** — both custom agents now require a comprehensive feature dossier markdown file that tracks progress, user evidence requests, handled scope, research findings, blockers, and model dependencies.
- **tmp sampledata policy in agents** — both agents now require sampledata-heavy artifacts (raw bytes, dumps, traces) to be stored under `tmp/` and referenced from dossier docs.
- **Map renderer consolidated status** — added `docs/map-renderer-status.md` as the authoritative evidence-first status page for Rooms map rendering.

### Changed
- **Map docs cleanup** — reduced `docs/payload-byte-plots.md` to an archive pointer and moved heavy raw data to `tmp/map-renderer-payload-bytes.md`.
- **Legacy/speculation cleanup** — converted `docs/payload-deep-analysis.md` to a legacy pointer with explicit speculation policy.
- **Navigation update** — `docs/map-loading.md` now points to `docs/map-renderer-status.md` for consolidated current state.

## [0.2.38] — 2026-05-14

### Added
- **Custom agent: Mechanics Modeler** in `.github/agents/mechanics-modeler.agent.md` for evidence-first reverse engineering into a single `.model` artifact with explicit missing-evidence requests, progress tracking, assumption labeling, and test/log validation against real examples.
- **Custom agent: Everscript Plugin Builder** in `.github/agents/everscript-plugin-builder.agent.md` for useful-first extension feature delivery with strict model-backed mechanics policy, vertical-layout UI guidance, cross-feature linking, robust runtime error handling, and visibility-focused test requirements.

## [0.2.37] — 2026-05-14

### Fixed
- **Sentinel scoring** — `decodeMapPayload` now picks the earliest sentinel candidate (smallest compressed-section offset) instead of sorting by `invalidRefs`. Real tilemaps always contain nibble values 0–15 across all 16 VRAM slots; counting nibbles >= tileCount as "bad" produced meaningless scores that could cause wrong-candidate selection.
- **Removed false `invalidRefs` counter** — the per-map `invalidRefs` field is gone. All nibble values 0–15 are syntactically valid 4-bit indices by definition; "unresolved" (no declared family for a slot) is the correct term for nibbles >= tileCount.

### Added
- **docs/map-0x33-analysis.md** — complete byte-level and tilemap analysis of map 0x33 (Strong Heart Exterior): full 20×16 nibble grid, nibble distribution table, sentinel and position-table layout, and comparison of raw payload / trace / decoder output.
- **Test** — `'decodeMapPayload produces zero out-of-range nibble values on synthetic ROM'` — enforces the invariant that all decoded nibble values are in [0, 15].
- **Test** — updated `'decodeMapPayload picks earliest sentinel candidate on synthetic ROM'` — verifies that the earliest sentinel wins regardless of nibble content.

## [0.2.36] — 2026-05-13

### Added
- **Renderer contract tests** in smoke suite to enforce map draw invariants:
  - decoded map canvas size must match ROM header `mapW/mapH`.
  - canvas must be white-prefilled before map draw.
  - rendered map must be fully covered (no white holes) for valid tile fixtures.
  - draw diagnostics must report sufficient tile diversity (`uniqueRefsCount`) for varied fixtures.
  - per-tile pixel correctness checks now assert exact expected RGB output on-map.
  - draw-count parity checks validate `drawnTiles`, `tileRefs`, and `renderCommandsEstimate` consistency.

### Changed
- **Map draw geometry source** — decoded map rendering now always sizes and iterates from ROM header dimensions (not inferred tilemap array shape) to keep renderer behavior aligned with map metadata.
- **Coverage fill behavior** — invalid/missing tile refs are now substituted with fallback family tile 0 during draw, preventing sparse black gaps and ensuring complete map coverage for diagnostics.
- **Draw robustness and telemetry** — draw pass now wraps exceptions, logs explicit failures, and reports `fallbackSubstitutions` and `uniqueRefsCount`.

### Validation
- Full `npm test` passes with expanded map renderer contract coverage.
- Single-tile parity suite remains green, reinforcing that per-tile decode is correct while map-level placement decoding remains the primary open research area.

## [0.2.35] — 2026-05-13

### Added
- **Single-tile decoder parity test suite** (`test/map-tile.test.js`) with multiple 16x16 map-tile scenarios compared against an independent reference decoder ported from SoETilesViewer `tile.h` logic:
  - uncompressed random fixtures,
  - uncompressed overflow/clamp behavior,
  - compressed copy-only streams,
  - compressed command-mode fixtures (`0..8,13,14,15`),
  - strict 16x16 output/range assertions.
- **Rooms render diagnostics** now report unresolved ratio in UI metadata and include explicit draw diagnostics (`invalidRefs`, `tileRefs`) for trace comparison.

### Fixed
- **Broken garbage decoded-map display** — Rooms tab now rejects low-quality decoded payload renders (high unresolved tile-reference ratio) and falls back to header canvas with an explicit reason, instead of showing misleading sparse/black tile mosaics as successful decode output.
- **Decode quality telemetry** — backend logs now flag suspicious payload decode quality (`unresolvedRatio`) so trace review can focus on map-level opcode decode gaps rather than per-tile decode.

### Validation
- Full `npm test` passes with the new map-tile parity suite and updated smoke assertions.
- Result confirms single-tile 16x16 decode path matches SoETilesViewer behavior; remaining map-level mismatch is in payload/tile placement interpretation, not in tile decompression or pixel unpack.

## [0.2.34] — 2026-05-13

### Fixed
- **Rooms payload sentinel mis-pick** — payload decode no longer accepts the first structurally-valid sentinel match. It now scores all candidates in scan range by tile-reference validity (invalid nibble refs, max nibble) and picks the best fit, which prevents false positives that produced sparse/black broken renders.
- **Large-map decode scan window** — increased sentinel search window for long payloads so more maps resolve to decoded render instead of fallback white canvas.

### Added
- **Trace-grade decode logging** (`[RoomsRender]`) now reports:
  - number of sentinel candidates found,
  - selected sentinel type/address,
  - `posCount`, invalid ref count, max nibble,
  - final decoded stats (`compressedSize`, `invalidRefs`).
- **Render draw stats logging** in Rooms tab now reports per-draw counts (`drawnTiles`, `invalidRefs`, `tileRefs`, `families`) for direct comparison with emulator/tilemap traces.
- **Stronger smoke tests for map render quality**:
  - synthetic ROM test validates sentinel candidate selection prefers low-invalid decode path,
  - multi-map decoded fixtures assert render canvas is created and output is not all-white,
  - decoded-render path test still enforces non-empty pixel writes.

## [0.2.33] — 2026-05-13

### Fixed
- **Rooms payload decode address bug** — sentinel scanning in `decodeMapPayload` now uses absolute ROM offsets (`dataRom + payload offset`) instead of scanning from the ROM root, so maps with valid payloads decode correctly and render the decoded room canvas instead of incorrectly dropping to fallback.
- **Post-sentinel parsing alignment** — position-table and tilemap parsing now read from absolute addresses consistently, preventing false decode-null outcomes caused by mixed relative/absolute indexing.

### Added
- **Canvas render assertions in smoke tests**:
  - verify decoded map rooms create a render canvas (`#rr-canvas`) with expected dimensions.
  - verify decoded render path writes non-empty pixel data to the canvas (not an empty image buffer).

## [0.2.32] — 2026-05-13

### Fixed
- **Rooms tab visibility hardening** — room render section now always shows a canvas block in ROM Map Data:
  - If payload render data is available, draw the decoded room canvas as before.
  - If payload render data is unavailable, draw a **header fallback canvas** (white area) sized from ROM header `map_w_tiles` / `map_h_tiles` so the render area is always visibly present.
- **Payload sentinel scan robustness** — payload decode no longer stops at a short sentinel window; scan range was expanded and candidate validation now checks that the resulting position-table + tilemap region fits map geometry.

### Added
- **Render-path logging** — added `[RoomsRender]` logs for room-detail entry, decoded-room draw pass, fallback draw pass, and payload decode success/failure reasons.
- **Tests for render visibility and logs**:
  - smoke tests now assert rooms-tab fallback canvas markup is injected and render logs are emitted.
  - UI tests now assert rooms-tab render block styles exist and fallback render block appears when payload render data is missing.

## [0.2.31] — 2026-05-13

### Added
- **Rooms tab — ROM-decoded room canvas render**: the ROM Map Data section now includes a full-size room canvas (`map_w_tiles * 16` by `map_h_tiles * 16`) rendered from decoded payload tilemap data and map-tile graphics.
- **SoETilesViewer-compatible tile decode path**: map family tiles are decoded using the same tile-table/data model as SoETilesViewer (`0xEE0000` map-tile pointer table, `tileInfo` compressed/uncompressed decode rules, SNES 4bpp planar unpack to 16x16 indices).
- **Palette selector in render panel**: map render supports the SoETilesViewer 16-color map palettes (including `Jungle 1`, `Hut Int. 1`, `Hut Ext. 1`) and allows switching in-place for visual verification.

### Changed
- **Payload display now includes render trace order**: the room panel documents the exact draw order currently implemented (family list -> tile decode -> row-major tilemap blit) and reports unresolved tile references when payload indices exceed known family entries.

## [0.2.30] — 2026-05-13

### Added
- **Rooms tab — Complete map payload decoder** — the ROM Map Data panel now fully decodes and displays the map blob payload for all maps:
  - **Tile families**: 1-byte count + count × uint16 IDs from payload opcode 0 — shared CHR/VRAM art references.
  - **Position table** (optional): count + uint16 byte offsets; 0 entries in sparse maps (e.g., `0x33`), full entries in dense maps (e.g., `0x01` has 12, `0x51` has 25).
  - **Decoded nibble-packed tilemap**: rendered as a grid preview showing the first 10 rows and 20 tiles per row; each tile is a 4-bit index into the tile-family list (0–15).
  - **Compressed section size**: bytes consumed by the opaque bitstream (likely layer / collision / LZ-encoded data; not yet decoded).
  - Complete walkthrough documented in updated `docs/map-loading.md`.

### Fixed
- **Map format confirmed from binary analysis**: verified all three test maps (`0x01`, `0x33`, `0x51`) decode identically:
  - **Tilemap encoding**: nibble-packed (2 tiles per byte, 4-bit indices).
  - **Payload structure**: tile families → compressed section → sentinel → position table → tilemap.
  - **Sentinel variations**: `0x30 00 00 00 01 00 FF` (maps `0x33`, `0x01`) and `0xC8 00 00 00 01 00 FF` (map `0x51`); sentinel location marks end of compressed data.

## [0.2.29] — 2026-05-13

### Added
- **Rooms tab — ROM Map Data panel** — every map room in the Rooms tab now shows a collapsible "ROM Map Data" section populated directly from the ROM binary:
  - **13-byte header table**: offset, hex value, field name, WRAM/IO destination, and description with confidence level for every header byte — including the provisional `room_effect_family` / `room_effect_variant` fields.
  - **Derived geometry**: map size in tiles and pixels, horizontal/vertical scroll capacity.
  - **Render preset badge**: classifies the room by its 5-byte signature (`bytes 4–8`) into the 11 known groups (default outdoor, indoor, cave, parallax, darkness-style, etc.).
  - **Trigger table layout**: decoded `step_len` / `b_len` with entry counts, payload offset in the blob.
  - **Payload tile families**: count + hex IDs from payload opcode 0 (the tile-set load list).
  - Designed as a foundation for a future map editor; toggle collapses/expands the section.

## [0.2.28] — 2026-05-13

### Docs
- **Map payload opcode stream** — documented that the room payload after trigger tables is a command/script stream, not a flat bitmap. Evidence from cross-map comparison of three Prehistoria hut maps (`0x33`, `0x51`, `0x01`):
  - Command 0: count byte + `N × 2-byte` tile family IDs (map `0x01` shows a perfect sequential run `7..13`).
  - High-entropy compressed middle section (likely LZ/RLE tile placement commands), length proportional to map complexity.
  - Shared 6-byte sentinel `00 00 00 01 00 ff` in all three maps, separating the compressed section from a structured position table.
  - Position table: count byte + `N × 2-byte` row offsets with step of 6 tiles (96 px); gaps in map `0x01` match the empty vertical stretches visible in-game.
  - Added provisional opcode model to `docs/map-loading.md`.


### Fixed
- **Projectile alchemy damage model** — replaced the old `effective_mdef`/shared-RNG approximation with the traced projectile formula: cast-side power now uses the ROM spell-level scale table plus its own RNG bonus, and hit damage applies the traced `(0x40 - magic_defense) / 0x40` multiplier.

### Added
- **`hb1` offensive alchemy regressions** — damage coverage now includes Hard Ball level 1 against Purple/Wimpy Flower (`10–20`) and Mosquito-like `m.def 0` (`21–41`), alongside the traced level-0 regressions.

## [0.2.26] — 2026-05-13

### Changed
- **Traced alchemy spell-level scaling** — the shared offensive-alchemy spell-level helper no longer uses the old `+10%` placeholder. Level `0` keeps the existing grounded base-might path, while levels `1..9` now use the ROM-traced high-level scale table `2, 4, 7, 11, 15, 20, 26, 32, 39, 46`, which yields Hard Ball cast-side power `21` at level 1 before the cast RNG bonus.
- **Docs copy now distinguishes traced spell power from open target-side math** — the spell-level slider text in Docs now describes the traced cast-side power step for leveled casts and keeps the remaining target-side resistance/popup conversion explicitly open.

## [0.2.25] — 2026-05-12

### Added
- **Projectile alchemy research note in Docs** — the Docs tab and markdown alchemy note now record the active projectile-slot layout anchor at `7E3564`, including the `POWER` field at `+0x2A/+0x2B`, so spell-damage tracing context is visible in the extension.

### Changed
- **Alchemy docs now distinguish producer vs hit path** — the docs explicitly note that hit-only traces start after projectile power is already prepared, and that full throw+hit traces are the right source for deriving leveled projectile spell power.

## [0.2.24] — 2026-05-12

### Added
- **Docs alchemy spell-level slider** — the Docs tab offensive-alchemy calculator now exposes spell level directly so manual range checks can be explored without leaving the docs surface.

### Changed
- **Docs alchemy copy now labels spell level as projected** — the calculator and docs note now spell out that spell level currently uses the shared `+10% base might per level` preview helper rather than a grounded ROM-traced growth formula.

## [0.2.23] — 2026-05-12

### Added
- **Dual offensive alchemy Scaling graphs** — alchemy mode now shows a top graph for damage vs spell level and a second graph beneath it for damage vs target level, with dedicated sliders for spell level and target level.

### Changed
- **Projected alchemy preview model** — the new graphs use one shared preview path across Scaling and tests: spell level applies a labeled `+10% base might per level` projection, and scalable target level temporarily reuses the target defense-growth slope for `magic_defense` growth until grounded data is traced.

## [0.2.22] — 2026-05-12

### Fixed
- **SoETilesViewer `m.def` check** — verified against the local C++ source that SoETilesViewer reads `magic_defense` directly from `+0x1d` and displays that raw value, so the extension no longer assumes any hidden `0x40 - m.def` conversion in the viewer.
- **Shared offensive alchemy formula** — Scaling, Docs, and automated tests now all use the same `effective_mdef = floor((magic_defense + 20) / 4)` level-0 helper, which keeps Wimpy Flower at `6–10`, Carltron's Robot at `0–1`, and Mosquito in the `12–20` band instead of the old inflated `15–26` output.

### Added
- **Offensive alchemy RNG histogram** — the Docs alchemy calculator now renders the same damage-vs-RNG histogram style used by the physical damage calculator.
- **Broader alchemy coverage in `npm test`** — `test/damage.test.js` is now part of the main test script, and the UI regression fixture now covers Wimpy Flower, Mosquito, and Carltron's Robot.

## [0.2.21] — 2026-05-12

### Fixed
- **Offensive alchemy resistance model** — replaced the overfit inverted `magic_defense` helper with a direct raw-stat reduction model, so high-`m.def` enemies now take less damage and low-`m.def` enemies no longer collapse to `0–1`.
- **Scaling and Docs consistency** — both surfaces now use the same corrected level-0 alchemy math and no longer drift in formula text or rendered examples.

### Added
- **Broader alchemy regressions** — unit coverage now includes Wimpy Flower (`m.def 32` => `6–10`), Carltron-like high resistance (`m.def 60` => `0–1`), and Mosquito-like low resistance (`m.def 0` => `15–26`), alongside the existing Docs and parser checks.

## [0.2.20] — 2026-05-12

### Fixed
- **Purple/Wimpy Flower alchemy range** — the level-0 alchemy preview now matches the checked Hard Ball case against `m.def = 32`, producing `6–10` in both Scaling and Docs instead of the broken `0–1` range.
- **Live target stat parsing** — the live ROM reader again uses the Purple/Wimpy Flower `magic_defense = 32` value from the vanilla stat record, matching the external enemy viewer.

### Added
- **Regression coverage for the real bug** — the unit test, parser test, and Docs/Scaling UI tests now all assert the same grounded case: Hard Ball level 0 vs Purple/Wimpy Flower = `6–10`.

## [0.2.19] — 2026-05-12

### Fixed
- **ROM stat reader used the evade slot as magic defense** — `readRomCharacters()` now parses `evade` from `+0x1d` and `magic_defense` from `+0x1f`, which fixes live Scaling alchemy targets such as Hard Ball L0 vs Purple Flower/Wimpy Flower.

### Added
- **Parser regression coverage** — `test/scaling-rom.test.js` now feeds a synthetic ROM record through the real `readRomCharacters()` path and asserts that the parsed target produces the grounded Hard Ball L0 `6–10` range.

## [0.2.18] — 2026-05-12

### Fixed
- **Scaling alchemy target mdef lookup** — the Scaling tab now accepts both `magic_defense` and `magicDefense` on target records instead of silently falling back to `0`, which was producing bogus alchemy ranges like Hard Ball L0 `0–1` vs Wimpy Flower.

### Added
- **Hard Ball purple-flower regression test** — `test/ui.test.js` now asserts that Scaling alchemy mode shows Hard Ball L0 vs Wimpy Flower as `6–10`, matching the grounded level-0 model.

## [0.2.17] — 2026-05-12

### Fixed
- **Scaling tab damage-type selector restored to the right place** — the Physical / Offensive Alchemy selector now lives in Scaling, not Docs, and the matching field rows have the IDs that the existing mode-switching JS expects.
- **Scaling tab render crash** — switching or initializing Scaling no longer fails because `updateLevelFields()` can now find `sc-src-field`, `sc-charge-field`, `sc-scale-field`, and `sc-atlas-field`.
- **Docs alchemy entry restored** — Docs again exposes Offensive Alchemy as its own subtab instead of hiding it behind a misplaced dropdown.

### Added
- **Scaling-focused UI tests** — `test/ui.test.js` now validates the Scaling selector, physical/alchemy field visibility changes, note text updates, and the restored Docs alchemy entry.

## [0.2.16] — 2026-05-12

### Added
- **`test/ui.test.js`** — 18 new UI tests covering Docs tab structure and JS behaviour: dropdown element exists, physical/alchemy content visibility in HTML, no stray subnav button, dropdown change toggles both sections, both charts populate at init.
- **`test/smoke.test.js`** now included in `npm test`; fake DOM fixed to support `document.createElement` and persistent element identity so webview JS execution tests pass.

### Fixed
- **`bindLinks(null)` crash** — `bindLinks` in the webview JS now guards against a null root argument; this prevented webview JS from executing cleanly in test sandboxes.

## [0.2.15] — 2026-05-12

### Changed
- **Docs > Damage section** — replaced the separate "Offensive Alchemy" subnav button with a **Damage type** dropdown inside the Damage section (Physical / Offensive Alchemy). Physical is the default; selecting Offensive Alchemy switches to the spell-might + magic-defense interactive graph.

## [0.2.14] — 2026-05-12

### Added
- **Map-loading header tables** — expanded the room-loader docs with a byte-by-byte header table, a blob-region table, and a clearer separation between known fields and unknown header bytes.
- **Reverse-engineering next-step guidance** — added a concrete trace checklist for progressing the room-loader work, with emphasis on capturing the first 13 bytes and the first payload writes.

### Changed
- **Trigger-record caveat clarified** — the docs now state that the 6-byte step-on/B-trigger record layout matches the current in-repo model, while also being explicit that the external SoE tiles viewer C++ source was not freshly re-verified in this workspace.
- **Repo cleanup ignores generated artifacts** — `tmp/`, Python bytecode, and `tools/__pycache__/` are now ignored so slice outputs and cache files stop showing up as pending changes.

## [0.2.13] — 2026-05-12

### Added
- **Docs tab map-loading section** — added a grounded map-loading explainer covering the room-blob layout, the `LDA [$8B],Y` stream-read breakpoint, and the truncation evidence for how the payload turns into the final room picture.
- **Map-loading markdown doc** — added a dedicated docs file that records the current room-loader model and the confirmed Strong Heart exterior example.

### Changed
- **Room-data docs clarified** — the room data-block note now explicitly says that the bytes after the trigger tables are still-observed room payload, even though the exact codec is not fully decoded yet.

## [0.2.12] — 2026-05-12

### Added
- **Level-0 offensive alchemy preview** — the Scaling tab can now switch from physical attacks to offensive alchemy, plotting spell might against enemy `magic_defense` with the current `effective_mdef` model.
- **Docs tab alchemy section** — added an offensive alchemy explainer and interactive preview so the spell-might table and `magic_defense` subtraction are visible inside the extension.
- **Alchemy markdown doc** — added a dedicated docs file for the grounded offensive alchemy model, including the spell might table and the current level-0 range assumptions.

### Changed
- **Scaling and Docs wiring fixed** — restored the alchemy docs button to the Docs tab and removed duplicate hidden Scaling controls that were hijacking the chart bindings.
- **Alchemy placeholders narrowed** — route-planner copy now points at the remaining gap more honestly: route-grade spell-level / 8-cast modeling is still missing, but the per-cast level-0 preview exists.

## [0.2.11] — 2026-05-12

### Changed
- **Document alchemy damage inputs** — the scaling docs now describe the confirmed offensive alchemy inputs: enemy `magic_defense`, the `effective_mdef = max(0, 0x40 - magic_defense)` term, and the base-might table at ROM offset `0x45E6B`.
- **List vanilla alchemy might values** — added the per-spell might table to the docs, including the current caveat that exact charge / level scaling is still not fully traced.

## [0.2.3] — 2026-05-09

### Changed
- **Correct temp region boundary** — temp region is now `0x2834–0x28FF` (matching the linker's TEMP RAM definition in `main.evs`). Was incorrectly `0x2800–0x28FF`.
- **Remove static loot-function address extraction** — `_loot_chest`, `_loot`, `loot`, `retained_object` are dynamically allocated from the compiler memory pool; their call-site arguments do not indicate a fixed address. Removed the spurious write annotations.

### Added
- **T-shape layout** — sticky header (title, filters, region bars), left panel (grid, independent scroll), right panel (detail table, independent scroll). Clicking a grid cell scrolls both.
- **Multi-byte cursor selection** — clicking any cell now highlights ALL cells belonging to the same entry (e.g. all 35 bytes of `BOY_NAME`). Previously only the clicked cell got the cursor outline.
- **Word byte extension** — `Word`-typed entries with a single address in the memory map now automatically cover both bytes (`addr` and `addr+1`). Previously the second byte appeared as an undocumented gap.
- **Group color stripes** — cells belonging to the same multi-byte entry share a colored bottom-border stripe (10-color rotating palette), visually connecting bytes of the same entry across grid rows.

## [0.2.2] — 2025-05-09

### Added
- **Radar auto-update** — when you move the cursor to a different scope or switch to another `.evs` file, the open radar re-renders automatically. The `pin` button stops auto-update.
- **Cursor highlight in grid** — last-clicked cell gets a persistent white border (`.cursor`), separate from the hover highlight.
- **Multi-byte hover highlight** — hovering any cell in a multi-byte entry (e.g. `BOY_NAME` ×35, `FRAME_COUNTER_1` word) highlights all bytes in the entry, not just addr+1.
- **Emoji in cells** — `emoji` button overlays the entry’s first emoji (from name/notes) onto each 9×9 cell. Based on the memory-map emoji legend.
- **Emoji in popup/detail** — emoji shown alongside address in popup header and detail table addr column.
- **Boring row filter** — `boring` button hides rows where no cells are used in the current scope.
- **Follow mode** — `follow` button makes the detail table auto-scroll to the entry when a grid cell is selected.
- **Pin button** — `pin` button locks the radar to the current scope, stopping editor-driven auto-updates.
- **Detail table layout** — columns are now Addr / Name / T / Rgn / Notes / Lines. Line references in the last column jump to the editor. Clicking a row selects the grid cell (no jump to table by default; use `follow` mode).
- **Memory-map hover** — hovering a hex literal (e.g. `0x22d8`) in `.evs` code now shows the memory-map name, lifecycle, and an “Open Memory Radar” command link if the address is documented.
- **Lifecycle priority fix** — temp (0x2800–0x28FF) and session (0x2200–0x27FF) address ranges now take priority over the `[SRAM]` tag, so temp RAM documented as SRAM is correctly shown as temp.
- **Memory-map cache** — `memory-map.md` is parsed once and cached; cache is invalidated when the file changes.
- **Reuse panel** — `openMemoryRadar` reuses the existing panel instead of creating a new one each time.

## [0.2.1] — 2025-05-09

### Fixed
- **Lifecycle regions corrected** — `temp` is now `0x2800–0x28FF`, `session` is `0x2200–0x27FF`, `system` covers everything else (was using wrong threshold `addr < 0x2000`).
- **Radar HTML tags in tooltips** — memory-map notes that contain `<br>` or other HTML are now stripped before display.

### Added
- **System filter button** — new fifth filter to hide/show system-region addresses.
- **Click-to-popup detail panel** — click any lit cell to see structured Vanilla notes, Writes (destructive, red), and Reads (non-destructive, blue). Replaces tooltip-on-hover.
- **Read / write cell coloring** — cells used only as write targets render with a red inset shadow; cells used for both reads and writes render amber.
- **Word-byte pair highlighting** — hovering a `word`-type cell highlights the adjacent +1 byte cell.
- **`tools/snes9x_wram.py`** — macOS Mach VM prototype for reading live Snes9x WRAM. Use `--addr`, `--watch`, `--json` flags. See file header for usage and VS Code integration plan.
- **Filter hides empty rows** — `recomputeRows()` hides entire grid rows when all their cells are filtered out.

## [0.2.0] — 2026-05-09

### Added
- **Memory Radar merged in** — the standalone `everscript-memory-radar` extension is
  discontinued; its visualizer now lives in this extension.
- **`Everscript: Open Memory Radar` command** — opens a compact, sidebar-friendly WRAM
  visualizer beside the active `.evs` file. Accessible via right-click context menu or
  the `◉ Memory Radar` CodeLens shown above every `fun`/`map`/`area`/`group` declaration.
- **CodeLens** — `◉ Memory Radar` appears above each scope declaration for one-click access.
- **WRAM heatmap grid** — 9×9 px cells, 16 per row, covering the full documented address
  range. Color indicates lifecycle: blue = temp (`<0x2000`), amber = session, green = sram.
  Bright = used in current scope, dim = documented but unused, near-invisible = rest
  (undocumented). Hover tooltip shows address, name, type, and usage lines.
- **Region usage bars** — temp/session/sram each show `used/total (%)`.
- **Filter buttons** — toggle temp/session/sram/rest visibility independently. Rest is
  off by default (collapses entirely-undocumented rows).
- **Detail table** — lists every known address with addr, name, type, lifecycle chip, and
  clickable line numbers that navigate back to the usage site in the editor.
- **Bidirectional navigation** — click a grid cell to jump to its detail table row; click
  a line number in the table to reveal that line in the source editor.
- Reads `.github/memory-map.md` from the workspace root for ground-truth address data.

### Notes on WRAM addresses
Addresses in `memory(0xADDR)` and `<0xADDR>` are treated as absolute 16-bit WRAM
addresses (bank `$7E` implied). No offset arithmetic is applied by the parser.

### Snes9x live-memory feasibility
Theoretically possible on macOS via `task_for_pid()` + `mach_vm_read()` (Mach kernel
API), the same mechanism Cheat Engine uses. Requires a native Node.js C++ addon and
appropriate process entitlements — not implementable in pure JS from a VS Code extension.
A future milestone could ship a small helper binary for this.

## [0.1.5] — 2026-05-08

### Changed
- **Annotations redesigned to P5 amber bold** — `@install`, `@inject`, `@async` etc.
  are now rendered in bold amber (`#FF9900`) instead of lilac. Rationale: they are
  ROM linker directives that specify the exact byte offset where code is placed;
  semantically equivalent to `<0x1234>` address literals.
- **`<NAME>` entity refs are now all-amber** — the identifier inside `<BOY>` was
  previously teal (P2); now amber (P5) so the whole `<BOY>` construct reads as one
  cohesive hardware-access token.
- **`object[n]` / `arg[n]` brackets now amber** — `[` and `]` get scope
  `punctuation.section.accessor.evs` → amber, completing the accessor construct.
- **P6 is now preprocessor-only** — `#memory`, `#include`, `#patch` remain lilac.
  Annotations are no longer grouped with preprocessor.
- **Theme structural corruption fixed** — a duplicate orphaned `tokenColors` section
  that existed outside the valid JSON root has been removed. Several scopes (labels,
  `variable.language.evs` italic) were previously dead code in that section.

### Added
- **Binary number highlighting** — `0b1010` tokens now get scope
  `constant.numeric.binary.evs` → light green (P8), matching hex and decimal.
- **Annotation argument coloring** — `@install(0x99aac0)` now colors the `(` and `)`
  amber too; address/number/enum arguments inside are tokenised correctly.

## [0.1.4] — 2026-05-08

### Added
- **Number hover** — hovering `0xFF`, `0d99`, or `0b1010` shows the value in hex,
  decimal, and binary plus the byte size inferred from the digit count.
- **Unqualified enum member hover** — hovering a bare `SOUTH`, `ACT4_DOOR_OPENING`,
  etc. now shows the parent enum name, value, and (when unambiguous) the full
  enum listing with the matched member highlighted.
- **Dead branch dimming** — `if(False)`, `if!(True)`, and `if(ENUM.MEMBER)` / 
  `if!(ENUM.MEMBER)` where the member value is 0 or non-zero respectively are
  detected at document open/edit and the unreachable block is rendered at 35% opacity.

### Fixed
- **Declaration name hover conflict** — hovering the name in `enum entrance {` or
  `fun entrance(...)` no longer shows the `entrance()` function tooltip.
- **Accessor hover conflict** — hovering `object` in `object[door_id]` no longer
  shows the `object()` function tooltip; same for `arg`, `script`, and `time`.
- **Unqualified SOUND members** — enum members used without their prefix (e.g.
  `ACT4_DOOR_OPENING`) now show a tooltip via the reverse member lookup.

## [0.1.3] — 2026-05-08

### Added
- **Go-to definition** (`F12` / cmd+click) — jumps to the `fun`, `map`, `area`,
  `group`, `enum`, or `val` declaration for any identifier in the workspace.
  Also resolves `#include("path")` to the included file.
- **Find all references** (`Shift+F12`) — finds every occurrence of a function
  or variable name across all `.evs` files in the workspace.
- **Workspace index** — all `.evs` declarations are indexed on activation and
  kept live via a file watcher (creates/changes/deletes).
- **Function name completions** — typing any identifier now offers all 521 core
  and native functions as completions with full parameter snippets.
  e.g. `transition` expands to `transition(${1:map}, ${2:x}, ${3:y}, ...)`.
  User-defined workspace functions are also included.
- **Enum name completions** — all 111 enum types appear in the completion list.

---

## [0.1.2] — 2026-05-08

### Added
- **Hover documentation** — hover over any function name to see its full signature
  and whether it is a native (compiler built-in) or core library function.
  Hover over an enum name to see all its members with values and comments.
  Hover over `ENUM.MEMBER` to see the specific member value.
  Hover over special identifiers (`BOY`, `LAST_ENTITY`, `NORTH`, `True`, …)
  to see a plain-English description.
- **Enum member completion** — typing `DIRECTION.` or any `ENUM.` triggers a
  completion list of all members with values. Typing `@` suggests annotation names.
- **Document symbols (Outline panel)** — `fun`, `map`, `area`, `group`, `enum`,
  and `val` declarations appear in the Outline panel and breadcrumbs.
- **Snippets** — `fun`, `map`, `area`, `group`, `enum`, `if`, `if!`, `ife`,
  `while`, `while!`, `for`, `val`, `var`, `#memory`, `#include`, `@install`,
  `@inject`, `@async`, `transition`, `sleep`, `conversation`, `add_enemy`.
- **Problem matcher** (`everscript`) — register in a `.vscode/tasks.json` task to
  get compiler errors in the Problems panel with clickable file/line links.
- **Task definition** (`everscript`) — task type for future build task support.
- `code_highlighter/data/index.json` — 521 function signatures and 111 enum definitions extracted
  from the core library (regenerate with `python3 tools/generate_data.py`).
- `tools/generate_data.py` — data extraction script for dev use.

---

## [0.1.1] — 2026-05-08

### Added
- `.github/copilot-instructions.md` — global agent rules for the plugin repo
  (version bump ritual, file map, test format reference, colour theme policy)
- `docs/future-features.md` — full roadmap: hover docs, auto-completion, diagnostics,
  go-to-definition, signature help, LSP server plan, priority stack

---

## [0.1.0] — 2026-05-08

### Added
- Initial release
- TextMate grammar for `.evs` files (`source.evs`)
- Language configuration (bracket matching, comment toggle, word pattern)
- Bundled Everscript Dark colour theme
- Highlights: keywords, declarations, types, booleans, numbers (hex + 0d-decimal),
  memory addresses, memory ranges, enum access, annotations, preprocessor directives,
  built-in functions, core library functions, user function calls, special identifiers,
  label destinations, operators, strings with in-string placeholders
