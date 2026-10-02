# Sprites domain (`src/sprites`)

> Ownership: Characters, Enemies, NPCs, Raw ROM Sprites, Animation decoding, Hitboxes, and Game Stats.

## 1. Goal

Unify and modernize the first two tabs of SoETilesViewer into an interactive, readable tool within the VS Code Extension:
- **Characters [Ctrl+1]**: Lists all 142 characters/enemies/NPCs from the ROM table at `$8EB678`, with their stats, engine mechanics explanations, and hitboxes.
- **Sprites [2]**: Lists all 5,128 raw sprites walked from `$CA0003`, with chunk breakdown (`0x0000 @ -12, -31, flags 10`), selectable palettes and backgrounds.
- **Animations**: every one of the 783 animations in the ROM's record table, with its owners and its script.
- **Animation Player**: Plays all animations (both standard 11 character actions and externally triggered scripts from `animate(entity, mode, id)` such as `MAGMAR_ENTER`), with real-time 60Hz SNES tick playback, directional facings, frame scrubber, and body/hurt/strike hitbox overlays.

## 2. File layout

| File | Responsibility | Max LOC |
|---|---|---|
| `character-model.js` | Reads all 142 characters, stats, and animation catalog from ROM | < 250 |
| `animation-decoder.js` | Runs an animation script (via `maps/animation-vm`), aligns frames, renders PNGs, returns the script listing | < 200 |
| `animation-catalog.js` | Every animation in the ROM's record table ($C43E3A), who uses it (character fields, weapons, `animate()` ids via $C43C92), and its palette | < 150 |
| `raw-sprites.js` | Walks and indexes all raw sprites from `$CA0003`, renders chunk tables | < 150 |
| `sprites-tab.js` | Server-side tab pane HTML scaffold | < 200 |
| `webview/sprites-view.js` | Client-side webview controller, rAF animation loop, canvas drawing | < 350 |
| `webview/sprites-script.js` | Script listing panel (current-frame highlight, owners) and the Animations rail list; loaded before `sprites-view.js` | < 200 |
| `webview/sprites-layout.css` | Styling adhering to VS Code theme tokens | < 300 |
| `index.js` | Public API exports | < 50 |

## 3. Allowed dependencies

- `src/maps/` (pure ROM functions: `rom.ts`, `sprites.ts`, `character-record.ts`, `character-animation.ts`, `png.ts`)
- `src/shared/` (`rom-readers.js`)
- `src/language/data/index.json` (enum definitions for external animations)
- No dependency on `src/rooms/`, `src/debugger/`, `src/scaling/`, or `vscode`.
