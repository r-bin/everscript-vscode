// Check a Terranigma room picture against the running game (docs/terra/README.md §5).
//   node tools/terra/check-room.mts <room id, hex> [outdir]   (the Terranigma ROM of the ROM library; npm run build:ts first)
// Plays the opening headless on the extension's emulator core (title, new game, the default name, the
// chapter card) up to the first room load, makes the room loader at $86:86ED load the given room instead
// ($047E = room, $0480 = room × 2, as a room change sets them), lets the room come up, then finds the game's
// screen inside src/games/terra/decoder's render of that room and prints how many pixels agree. Sprites,
// BG3 (text), animated tiles and the fade account for the rest. Writes game-<id>.png and render-<id>.png.
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { bootIntoRoom, ROOT } from './boot.mts';

const require = createRequire(import.meta.url);
const terra = require(path.join(ROOT, 'dist/games/terra'));
const { encodePng } = require(path.join(ROOT, 'dist/platform'));

const id = parseInt(process.argv[2] ?? '', 16);
const outDir = process.argv[3] || '.';
if (!Number.isInteger(id)) { console.error('usage: node tools/terra/check-room.mts <room id, hex> [outdir]'); process.exit(2); }

bootIntoRoom(id).then(({ M, heap, rom }) => {
    const sb = M._getScreenBuffer();     // 512x448, the 256x224 picture doubled
    const shot = new Uint8Array(256 * 224 * 4);
    for (let y = 0; y < 224; y++) for (let x = 0; x < 256; x++) {
        for (let k = 0; k < 3; k++) shot[(y * 256 + x) * 4 + k] = heap()[sb + ((y * 2) * 512 + x * 2) * 4 + k];
        shot[(y * 256 + x) * 4 + 3] = 255;
    }
    const room = terra.loadRoom(rom, id);
    if (!room || !room.layers.length) { console.error(`room ${terra.hex3(id)} has no map of its own`); process.exit(1); }
    const img = terra.renderRoom(room);
    const q = (d: Uint8Array, i: number) => (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3);
    let best = [-1, 0, 0];
    for (let oy = 0; oy + 224 <= img.height; oy += 1) for (let ox = 0; ox + 256 <= img.width; ox += 1) {
        let s = 0;
        for (let k = 0; k < 300; k++) {
            const x = (k * 37) % 256, y = (k * 53) % 224;
            if (q(img.rgba, ((oy + y) * img.width + ox + x) * 4) === q(shot, (y * 256 + x) * 4)) s++;
        }
        if (s > best[0]) best = [s, ox, oy];
    }
    const [, ox, oy] = best;
    let same = 0;
    for (let y = 0; y < 224; y++) for (let x = 0; x < 256; x++) {
        if (q(img.rgba, ((oy + y) * img.width + ox + x) * 4) === q(shot, (y * 256 + x) * 4)) same++;
    }
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `game-${terra.hex3(id)}.png`), encodePng(256, 224, shot));
    fs.writeFileSync(path.join(outDir, `render-${terra.hex3(id)}.png`), encodePng(img.width, img.height, img.rgba));
    const ctx = room.context.length ? ` (loaded after ${room.context.map(terra.hex3).join(', ')})` : '';
    console.log(`room ${terra.hex3(id)}${ctx}: screen found at ${ox},${oy} in the ${img.width}×${img.height} render; ${(100 * same / (256 * 224)).toFixed(1)}% of pixels agree`);
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
