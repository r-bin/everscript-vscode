# Sprites domain (`src/games/evermore/sprites`)

> Ownership: Characters, Enemies, NPCs, Raw ROM Sprites, Animation decoding, Hitboxes, and Game Stats.

## 1. Goal

Characters, sprites and animations from the user's ROM, in one interactive tool:
The radar tab is called **Characters** (it was "Sprites"); inside it, three modes:
- **Characters [Ctrl+1]**: Lists all 142 characters/enemies/NPCs from the ROM table at `$8EB678`, with their stats, engine mechanics explanations, and hitboxes.
- **Sprites [2]**: Lists every sprite the animation scripts name (from `$CA:0003`), with chunk breakdown (`0x0000 @ -12, -31, flags 10`), selectable palettes and backgrounds.
- **Animations**: every one of the 783 animations in the ROM's record table, with its owners and its script.
- **Animation Player**: Plays all animations (both standard 11 character actions and externally triggered scripts from `animate(entity, mode, id)` such as `MAGMAR_ENTER`), with real-time 60Hz SNES tick playback, directional facings, frame scrubber, and body/hurt/strike hitbox overlays.

## 2. File layout

| File | Responsibility | Max LOC |
|---|---|---|
| `character-model.ts` | Reads all 142 characters, stats, and animation catalog from ROM | < 250 |
| `animation-decoder.js` | Runs an animation script (via `maps/animation-vm`), aligns frames, renders PNGs, returns the script listing | < 200 |
| `animation-catalog.ts` | Every animation in the ROM's record table ($C43E3A), who uses it (character fields, weapons, `animate()` ids via $C43C92), and its palette | < 150 |
| `frame-compose.ts` | Composes a run's frames into PNGs aligned on one feet origin | < 80 |
| `projectile-render.ts` | Projectile spawns on the playback timeline, their flight and their own animation | < 100 |
| `target.ts` | The second character on stage: who, where, its standing frame, and which ticks hit it | < 120 |
| `dog-forms.ts` | The Dog's six forms (bank `$CF`), shaped like Boy weapons | < 90 |
| `raw-sprites.ts` | Walks and indexes all raw sprites from `$CA0003`, renders chunk tables | < 150 |
| `sprites-tab.ts` | Server-side tab pane HTML scaffold | < 200 |
| `webview/sprites-view/` | Client-side webview controller, rAF animation loop, canvas drawing: one IIFE kept as parts (`01-state.js` … `05-raw-sprites.js`), wrapped by `memory/webview/index.js` | < 400 each |
| `webview/sprites-script.js` | Script listing panel (current-frame highlight, owners) and the Animations rail list; loaded before `sprites-view/` | < 200 |
| `webview/sprites-motion.js` | Stage geometry: walk path, jump height, projectile flight, and the scene box the canvas must hold | < 160 |
| `webview/sprites-lazy.js` | Resizable splitters and lazy list thumbnails (`window.SpritesThumbs`) | < 120 |
| `thumbnails.ts` | List previews (south/east), sprites in every palette, chunk tiles | < 200 |
| `webview/sprites-layout.css` | Styling adhering to VS Code theme tokens: rail, splitter, main panel, toolbar | < 400 |
| `webview/sprites-stage.css` | Stage canvas, player bar, stat cards, chunk table | < 400 |
| `webview/sprites-views.css` | Raw sprites view, script panel, thumbnails, resizable sidebars | < 400 |
| `index.js` | Public API exports | < 50 |

## Rules for changing this folder

Dependencies, invariants and tests: [AGENTS.md](AGENTS.md).
