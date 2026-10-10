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
  it; for an effect an entity sent, the emulator rings that entity on its screen.
- **Who sent a sound** (emulator only, custom core): `emulator/sound-source-view.js` hooks
  `$8C:81FD` while the stream runs. The box label says `← Boy (animation)`, `← script $93D386`
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
Not done yet: the sequence ("script") view, see `docs/music-sequence-todo.md`.

## The driver's own bookkeeping (disassembly of the ROM driver, verified in the engine)

Who plays on a voice is read from the driver, never inferred from the voice number or the
effect id. The emulator stream sends these ARAM bytes with every frame (`drv`,
`emulator/apu-stream-view.js` `APU_DRIVER_RANGES`); `music-view.js` decodes them:

| ARAM | Meaning |
|---|---|
| `$6C+v` | Owner of voice v: `$80` a sound effect, `$01` a music track, `$00` free |
| `$D1+v` | Music track of voice v (`$80` + track) |
| `$011B+v` | Effect id of voice v, written by the `$04` handler (`$0CC2` → `$0D5C`) |
| `$75+2v` | Countdown of voice v's note; reloaded when a voice is assigned |
| `$EA` | Write index of the 16-entry command queue: cmd `$1043+i`, param `$1053+i` / `$1063+i`. Commands are queued at the port (`$0B7D`) and run through the table at `$1E3D` |

- The `$04` handler picks voices by priority (`$0E37`): Spear Attack (`$07`) lands on V0, V5 or
  V7 depending on the song. A fixed effect → voice table is wrong.
- When an effect's last note runs out, its countdown wraps past 0 but `$6C+v` stays `$80` until a
  music track takes the voice back (Dog Bark, `$10`). Wrapped + silent = ended.
- A voice's directory entry (`$0200+4v`) reads `$0000` for a frame while the driver rewrites it
  around a note (seen on the emulator's chip, not in blargg's). The DSP reads the directory only at
  key-on, so the tab keeps the voice's last sample; drawing `$0000` made one-frame stripes.
- Every command lands in the queue, so effects are seen even when several arrive in one frame.
  Reading ports once per frame missed them, and the Boy's weapon swing never showed.
- The Boy's swing is not a `sound()` call: animation command `0x2E` `sound n` (`$90:8921`) doubles n
  and reads `$8C:8362`, then `$8C:82DC` sends `$04`. Bone Crusher, swords and spears play `$07`
  ("Spear Attack"). `../localizations/data/sound-animations.json` holds every animation → sound.

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

## Dependencies

- Uses `../localizations` (track and sound names).
- Must **not** import `../emulator`: `extension.js` injects the emulator's `apuStream`
  (`setOn`, `snapshot`, `isOpen`) and forwards frames as `musicFrame`.

## State owned

- `host.js`: `_cache` (the model and the ROM it came from).
- `webview/music-tab.js`: `_music` (source, last frame, emulator ARAM and its package,
  package bytes, the engine while a track plays, selected instrument, timeline history,
  the driver queue index, Recent, the sidebar's width and visibility).
- `webview/music-forecast.js`: `_muFc` (the read-ahead engine and its frames).
- `webview/music-audio.js`: `_muAudio` (audio context, output node, the chip being played, its clock).

## Invariants

- Package reads walk bank upper halves only, as `$8C:818D` does.
- Music `M` uses package `M + 1` through `$81:99D8`; sound effects through `$81:9A1E`.
  Script ids (`sound()` parameters) are not driver effect ids: `$8C:8362` maps one to the other.
- A voice's sample is its directory entry (DIR·256 + SRCN·4), not SRCN. The driver uses
  DIR = `$02` and rewrites the entries per note.
- The emulator stream runs only while the Music tab is visible with the Emulator source. It
  stops when the radar panel closes.
- The page is rebuilt when the radar re-renders. The source survives in webview state, but a
  playing track stops.
