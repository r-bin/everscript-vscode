# music/ — Music tab

The radar panel's **Music** tab: one screen (no page scroll) that shows the SNES sound chip.

- **Source:** *Emulator (live)* (default) follows the running game. A track plays it in the tab's
  own sound engine.
- **Voices:** the 8 DSP voices: the sample each plays, pitch in semitones from the sample's own
  rate, envelope (ENVX), and left/right volume.
- **Instruments:** the samples in ARAM: the sample-directory entries (`$1F00`, 4 bytes each)
  written by package 0 (base bank) and by the loaded package. Click one, or a piano key (keys
  A–K), to hear it, decoded from BRR in the page.
- **Sound effects:** the 90 driver effects. The base bank's 62 play in every room; the rest only
  with their package. Click one to trigger it (command `$04`).
- **ARAM:** who owns each of the 64 KB (driver, tables, base samples, song samples, song and
  effect data, echo buffer) and how much is free. A tick marks the sample each voice plays.

Facts: everscript `docs/audio_music_sound_formats.md` (driver protocol, packages, ARAM budget).
Not done yet: the sequence ("script") view, see `docs/music-sequence-todo.md`.

## How it stays in sync

- **Emulator:** the custom core exports `getApuView()` (`core/.../source/exports.c`). This is
  224 bytes: SPC700 registers, the four ports in both directions, timers, the 128 DSP
  registers (ENVX/OUTX filled from the mixer) and the ARAM address. The emulator page posts
  it after every emulated frame while the tab wants it (`emulator/apu-stream-view.js`), with
  the loaded package (WRAM `$7E0E4B`) and each voice's sample start (ARAM at DIR·256 + SRCN·4).
  The tab asks for all 64 KB of ARAM when the package changes.
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
| `webview/music-tab.js` | `_music` state; status and voices |
| `webview/music-lists.js` | Instruments + keys, sound effects, the ARAM map |
| `webview/music-init.js` | Wiring, host messages, the frame loop; loaded last |

## Dependencies

- Uses `../localizations` (track and sound names).
- Must **not** import `../emulator`: `extension.js` injects the emulator's `apuStream`
  (`setOn`, `snapshot`, `isOpen`) and forwards frames as `musicFrame`.

## State owned

- `host.js`: `_cache` (the model and the ROM it came from).
- `webview/music-tab.js`: `_music` (source, last frame, emulator ARAM and its package,
  package bytes, the engine while a track plays, selected instrument).
- `webview/music-audio.js`: `_muAudio` (audio context, output node, the chip being played).

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
