// Which Secret of Mana map a picture shows, and where (docs/mana/verifying.md).
//   EVERSCRIPT_MANA_ROM=<rom> node tools/mana/find-picture.js <picture.png> <cell px> [left] [top]
// <cell px> is how wide one 16x16 map cell is in the picture (122 for a Rooms-tab
// screenshot at ~760%); left/top are where the first cell edge would be (negative when
// the picture starts mid-cell). Compares the middle of every whole cell with every cell
// of every map's render (src/mana) and prints the five best places. Grid lines and
// markers in the picture are mostly skipped by sampling only the middle 40%.
'use strict';
const fs = require('fs'), zlib = require('zlib');
const mana = require('../../src/mana');

const romPath = process.env.EVERSCRIPT_MANA_ROM;
const [file, size, left = '0', top = '0'] = process.argv.slice(2);
if (!romPath || !file || !Number(size)) {
    console.error('usage: EVERSCRIPT_MANA_ROM=<rom> node tools/mana/find-picture.js <picture.png> <cell px> [left] [top]');
    process.exit(2);
}

/** 8-bit RGB/RGBA PNG, not interlaced. */
function readPng(path) {
    const b = fs.readFileSync(path), idat = [];
    let p = 8, w = 0, h = 0, type = 0;
    while (p < b.length) {
        const len = b.readUInt32BE(p), t = b.toString('latin1', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
        if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); type = d[9]; if (d[8] !== 8 || d[12]) throw new Error('8-bit, non-interlaced PNGs only'); }
        if (t === 'IDAT') idat.push(d);
        p += 12 + len;
    }
    const bpp = type === 6 ? 4 : type === 2 ? 3 : 0;
    if (!bpp) throw new Error('RGB or RGBA PNGs only');
    const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = new Uint8Array(w * h * 4);
    let prev = new Uint8Array(stride);
    for (let y = 0; y < h; y++) {
        const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = new Uint8Array(stride);
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? cur[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
            let v = line[i];
            if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
            else if (f === 4) { const q = a + up - c, pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
            cur[i] = v & 255;
        }
        for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) out[(y * w + x) * 4 + k] = cur[x * bpp + k];
        prev = cur;
    }
    return { width: w, height: h, data: out };
}

/** Mean colour of the middle 40% of a square. */
function middle(d, width, x0, y0, s) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = Math.floor(y0 + s * 0.3); y < Math.floor(y0 + s * 0.7); y++) {
        for (let x = Math.floor(x0 + s * 0.3); x < Math.floor(x0 + s * 0.7); x++) {
            const i = (y * width + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
        }
    }
    return [r / n, g / n, b / n];
}

const pic = readPng(file), s = Number(size), ox = Number(left), oy = Number(top);
const cells = [];
for (let cy = 0; oy + (cy + 1) * s <= pic.height; cy++) {
    for (let cx = 0; ox + (cx + 1) * s <= pic.width; cx++) {
        if (ox + cx * s >= 0 && oy + cy * s >= 0) cells.push([cx, cy, middle(pic.data, pic.width, ox + cx * s, oy + cy * s, s)]);
    }
}
const rom = new Uint8Array(fs.readFileSync(romPath));
let best = [];
for (let id = 0; id < mana.MAP_COUNT; id++) {
    const map = mana.loadMap(rom, id);
    if (!map) continue;
    const img = mana.renderMap(map), avg = [];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) avg.push(middle(img.rgba, img.width, x * 16, y * 16, 16));
    for (let py = 0; py < map.h; py++) {
        for (let px = 0; px < map.w; px++) {
            let e = 0;
            for (const [cx, cy, c] of cells) {
                const X = px + cx, Y = py + cy;
                if (X >= map.w || Y >= map.h) { e += 3000; continue; }
                const m = avg[Y * map.w + X];
                e += (m[0] - c[0]) ** 2 + (m[1] - c[1]) ** 2 + (m[2] - c[2]) ** 2;
            }
            best.push({ error: Math.round(e / cells.length), map: id.toString(16), x: px, y: py });
        }
    }
    best.sort((a, b) => a.error - b.error);
    best = best.slice(0, 5);
}
console.log(`${cells.length} cells compared; best places (map, top-left cell):`);
for (const b of best) console.log(`  map ${b.map} at ${b.x},${b.y}  error ${b.error}`);
