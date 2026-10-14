# music/ — Music tab

The radar panel's **Music** tab: one screen (no page scroll) that shows the SNES sound chip.

- **Source:** *Emulator (live)* (default) follows the running game. A track plays it in the tab's
  own sound engine.
- **Voices:** the 8 DSP voices: the sample each plays, pitch in semitones from the sample's own
  rate, envelope (ENVX), and left/right volume.
- **Instruments:** the samples in ARAM: the sample-directory entries (`$1F00`, 4 bytes each)
  written by package 0 (base bank) and by the loaded package. Click one, or a piano key (keys
  A–K), to hear it, decoded from BRR in the page.
- **Timeline** (default view): the 8 voices over time, the playhead at 75%. Left of it what played;
  right of it the **read-ahead**: what the song will play next (dimmed). A box marks a voice an
  effect holds, labelled with its name and who plays it. The channel column says who owns each
  voice now (`♪ T3` a music track, `⚔ SFX $07` an effect, `—` free), what it plays, its
  envelope, and mute / solo (timeline only). **Hover** a note or a box (paused too): it is
  framed, a tooltip says what it is, how long, when, who sent it and which animations can play
  it; for an effect an entity sent, the emulator rings that entity on its screen. The tooltip can
  be entered (it waits while the pointer moves to it) and floats above the pane. It stays short:
  what, when, from whom; each dotted item opens a card on hover with the details, and each link
  opens the `soe://` page: who (the Boy in the weapon / the Dog in the act whose palette was
  loaded), the animation (GIF and the script lines around the `sound` command), the frame, the
  pitch, the variations, the script excerpt, or the engine code (an asm excerpt around the call,
  `soe://bus/<addr>.asm`). `resources/sound-source.js` builds them (injected).
- **Variations:** an effect can be pitched for one play: driver command `$30` before `$04` sets
  `$0241/2`, which the `$04` handler copies to each voice's pitch offset (`$D9+2v`, added to the
  note at `$0981`), in 1/20 semitone (−256 = −12.8). Animation commands `0x40 n` send a fixed `n`;
  `0x3F` sends −(Boy's stamina `$7E4EB7` / 4), so the Boy's swing drops with his stamina. Boxes show
  `↓0.8` / `↑6.4`; rows mark `~pitch` for effects an animation varies.
- **Who sent a sound** (emulator only, custom core): `emulator/sound-source-view.js` hooks
  `$8C:81FD` while the stream runs or the emulator's SOUNDS chip is on (the chip also switches the
  rings, labelled with the effect's name). The box label says `← Boy (animation)`, `← script $93D386`
  or `← engine code $8F95C1`; the sidebar row says *sent by*; the emulator rings the entity for
  a moment. Effects played from this tab say *clicked in this tab*.
- **Pause:** the emulator's pause button also pauses this tab's player (a track, an effect).
- **Sound effects** (sidebar, both views): the 90 driver effects. The base bank's 62 play in every
  room; the rest only with their package. Click one to trigger it (command `$04`). Each row names
  the animations that play it (⚔ an attack, ✦ another animation, ♦ none) and, live, the voices it
  holds. Filters: All, Recent (what the game sent), Atk, Loaded, Base. Drag its left edge to resize;
  × or the top bar's button hides it. Width and visibility are kept in the webview state.
- **ARAM:** who owns each of the 64 KB (driver, tables, base samples, song samples, song and
  effect data, echo buffer) and how much is free. A tick marks the sample each voice plays.

Facts: everscript `docs/audio_music_sound_formats.md` (driver protocol, packages, ARAM budget).
The sequence ("script") view is the Scripts tab's Music view (`src/scripts-tab/`), fed by
`model/track-timeline.js` (`trackSequence`, `trackTimeline`: the track played silently in the
engine on the host), injected by `extension.js`. Opcodes are still undecoded: `docs/todo/audio-and-music.md`.

## The driver's own bookkeeping (disassembly of the ROM driver, verified in the engine)

The emulator stream sends these ARAM bytes with every frame (`drv`,
`emulator/apu-stream-view.js` `APU_DRIVER_RANGES`); `music-view.js` decodes them:

| ARAM | Meaning |
|---|---|
| `$6C+v` | Owner of voice v: `$80` a sound effect, `$01` a music track, `$00` free |
| `$D1+v` | Music track of voice v (`$80` + track) |
| `$011B+v` | Effect id of voice v, written by the `$04` handler (`$0CC2` → `$0D5C`) |
| `$75+2v` | Countdown of voice v's note; reloaded when a voice is assigned |
| `$EA` | Write index of the 16-entry command queue: cmd `$1043+i`, param `$1053+i` / `$1063+i`. Commands are queued at the port (`$0B7D`) and run through the table at `$1E3D` |

Traps that follow from this: [AGENTS.md](AGENTS.md) § Pitfalls.

## Read-ahead

`music-forecast.js` loads a second engine (its own `createSpcEngine()` instance) with a copy of
the shown chip and runs it ahead of the playhead, one frame (1/60 s) per step. It is reloaded when
it goes stale: for a track, from the tab's engine after any new command; for the emulator, from a
snapshot (all of ARAM, with the frame it was taken after) when the game sent a command, the
package changed, or every 3 s. The copy has no timer phase or DSP envelope state, so its notes can
be a timer tick (~20 ms) off: each note the real chip starts is matched with the copy's nearest
one on that voice and the median difference (`_muFc.shift`) moves the copy onto the timeline. A
reload runs the copy up to the playhead and past it at once (the engine does ~12 frames per ms),
so the read-ahead never blinks empty. What the game will send next it cannot know.

## How it stays in sync

- **Emulator:** the custom core exports `getApuView()` (`core/.../source/exports.c`). This is
  224 bytes: SPC700 registers, the four ports in both directions, timers, the 128 DSP
  registers (ENVX/OUTX filled from the mixer) and the ARAM address. The emulator page posts
  it after every emulated frame while the tab wants it (`emulator/apu-stream-view.js`), with
  the loaded package (WRAM `$7E0E4B`), each voice's sample start (ARAM at DIR·256 + SRCN·4) and
  the driver bytes below. The tab asks for all 64 KB of ARAM when the package changes, and for
  the read-ahead.
- **A track:** `engine/spc-engine.js` is blargg's SPC700 + S-DSP. It's built from the core's
  `apu_blargg.c`, which the core itself does not use. `music-engine.js` speaks the 65816's side
  of the port protocol to it, as bank `$8C` does: boot, package upload through the IPL hand-off,
  `$06 M`. Its view has the same layout as the core's, so one renderer serves both.
- **Sound effects while following the emulator:** the tab copies the emulator's chip (view +
  ARAM) into its engine, sets the music volume to 0 (`$28 0`, ramps over ~1 s) and sends
  `$04 S`. The game is not touched.

| File | Role |
|---|---|
| `index.js` | Public API: `buildMusicModel`, `handlesMusicMessage` / `handleMusicMessage`, `buildMusicTabHtml` |
| `host.js` | The webview's `music*` requests; caches the model per ROM. No `vscode` |
| `model/rom-audio.js` | ROM tables: driver, packages (upper-half reads), music/sfx → package, script id → sfx |
| `model/catalog.js` | The model the page gets: tracks, sound effects, package layouts, driver bytes |
| `model/track-timeline.js` | For the Scripts tab (injected): a track's sequence records, and the track played silently on the host (notes per voice) |
| `render-music-tab.js` | The pane scaffold |
| `engine/spc-engine.c`, `build-engine.sh` | The engine's C side; `build-engine.sh` (`npm run build:music-engine`) writes `spc-engine.js` (wasm embedded, 43 KB) |
| `engine/copyright`, `engine/NOTICE.md` | Licence terms shipped with the engine (blargg's SPC code is LGPL-2.1, inside the snes9x2005 core) |
| `webview/music-view.js` | Pure: the 224-byte view, BRR, instruments, ARAM owners |
| `webview/music-engine.js` | `MusicSpc`: the engine + the port protocol |
| `webview/music-audio.js` | `_muAudio`: WebAudio output (32 kHz) and instrument previews |
| `webview/music-tab.js` | `_music` state; status, voices (inspector), the timeline's channel column |
| `webview/music-timeline.js` | Timeline frames from the driver state, effect runs and who sent them, the canvas |
| `webview/music-hover.js` | Hover: what is under the pointer, its frame, the tooltip, the emulator's mark |
| `webview/music-forecast.js` | `_muFc`: the read-ahead engine |
| `webview/music-lists.js` | Instruments + keys, the sound-effects sidebar, the ARAM map |
| `webview/music-init.js` | Wiring, host messages, the frame loop; loaded last |

## Rules for changing this folder

Dependencies, invariants and tests: [AGENTS.md](AGENTS.md).
