#!/usr/bin/env node
// Record the vanilla attract loop as a playback: power-on, no input, through the intro and the demo scenes, cut off
// when the intro starts again. The loop is found from the screen: the first frame after the demos whose next
// MATCH frames show exactly the intro's first non-black frames again.
//   node tools/playbacks/record-attract.js --rom <clean rom> [--out file.evsmv] [--max-frames 80000]
// Writes an .evsmv (no input, WRAM checks every 60 frames, other spaces every 600) and prints what the loop covers:
// frames, rooms ($7E0ADB) and which table readers ran (docs/extension-tables.md).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const T = require('../../src/emulator/tas/movie');

const REPO = path.resolve(__dirname, '..', '..');
const CORE = path.join(REPO, 'src/emulator/core/snes9x2005-wasm/snes9x_2005.js');
const DEFAULT_OUT = path.join(REPO, '.agents/skills/sample-playbacks/playbacks/attract-loop.evsmv');
// tas/host.js coreId(): a replay only trusts a movie recorded on the same core build
const coreId = () => crypto.createHash('sha256').update(fs.readFileSync(CORE.replace(/\.js$/, '.wasm'))).digest('hex').slice(0, 16);
const MATCH = 120;                     // frames that must repeat to call it the start of the loop
const CURRENT_MAP_ID = 0x7E0ADB;       // knowledge/ram/7e0adb.md
// First instruction of each table reader the table hack rewrites (tools/table-hack/tables.js), as executed ($8x).
const READERS = {
    map_table: [0x908F68, 0x908F6E],
    room_enter_scripts: [0x8CCECB, 0x8CCED1],
    string_keys: [0x8CCCF7, 0x8CCD35],
    script_pointers: [0x8CCE62, 0x8CD3B4],
    enemy_index: [0x8CDCE1, 0x8CDCF2, 0x8CDCCB, 0x8CDCA0],
    characters: [0x8F8046, 0x8FB15A],          // Boy/Dog template copy, HP at spawn
    map_palettes: [0x90D05C],
    sprite_palettes: [0x90CF3A],
};

const a = process.argv.slice(2), opt = n => { const i = a.indexOf('--' + n); return i < 0 ? null : a[i + 1]; };
const romPath = opt('rom') || process.env.SOE_ROM || process.env.EVERSCRIPT_ROM;
if (!romPath || !fs.existsSync(romPath)) { console.error('usage: record-attract.js --rom <clean rom> [--out file.evsmv]'); process.exit(2); }
const out = opt('out') || DEFAULT_OUT;
const maxFrames = Number(opt('max-frames') || 80000);

global.Module = { locateFile: f => path.join(path.dirname(CORE), f), onRuntimeInitialized: () => main(global.Module) };
global.require = require; global.__dirname = path.dirname(CORE); global.__filename = CORE;
vm.runInThisContext(fs.readFileSync(CORE, 'utf8'), { filename: CORE });

function main(M) {
    const source = fs.readFileSync(romPath);
    const p = M._my_malloc(source.length); HEAPU8.set(source, p);
    M._startWithRom(p, source.length, T.AUDIO_RATE);
    const hits = {};
    const owner = new Map(Object.entries(READERS).flatMap(([name, list]) => list.map(addr => [addr, name])));
    for (const addr of owner.keys()) M.addExecBreakpoint(addr);
    let frame = 0;
    M.onBreakpointHit = ({ address }) => {
        const name = owner.get(address);
        if (name) { hits[name] = hits[name] || { count: 0, first: frame }; hits[name].count++; }
        return false;
    };
    const md5 = b => crypto.createHash('md5').update(b).digest('hex');
    const screens = [], rooms = [], body = [];
    let start = -1, loopAt = -1;
    for (; frame < maxFrames; frame++) {
        M._setJoypadInput(0);
        M._mainLoop();
        body.push(T.frameLine(0));
        const n = frame + 1;
        if (n % T.CHECK_EVERY === 0) body.push(T.checkLine(T.wramCrc((ad, len) => M.readMemoryRange(ad, len))));
        if (n % T.SPACES_EVERY === 0) body.push(T.spacesLine(T.spaceCrcs(id => M.readSpace(id))));
        const sb = new Uint8Array(HEAPU8.buffer, M._getScreenBuffer(), 512 * 448 * 4);
        const h = md5(sb);
        screens.push(h);
        rooms.push(M.readMemory(CURRENT_MAP_ID));
        if (start < 0 && sb.some((v, i) => (i & 3) !== 3 && v)) start = frame;
        // a candidate loop start: the intro's first picture again, at least a minute after it was first shown
        const c = frame - MATCH + 1;
        if (start >= 0 && c > start + 3600 && screens.slice(c, c + MATCH).every((s, i) => s === screens[start + i])) { loopAt = c; break; }
    }
    if (loopAt < 0) { console.error(`no loop back to the intro within ${maxFrames} frames`); process.exit(1); }
    // cut right before the intro's first picture comes back: the playback is one full loop
    const keep = [];
    let frames = 0;
    for (const line of body) {
        if (line[0] === 'F') { if (frames === loopAt) break; frames++; }
        keep.push(line);
    }
    const sha = crypto.createHash('sha256').update(source).digest('hex');
    const text = T.evsmvHeader({ rom: path.basename(romPath), romSha256: sha, started: new Date().toISOString(), source: 'tools/playbacks/record-attract.js: power-on, no input, one attract loop', core: coreId() })
        + T.rleFrames(keep.join('\n') + '\n') + T.evsmvTrailer({ frames, cheats: false });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, text);
    const visited = [...new Set(rooms.slice(0, loopAt))].map(r => r.toString(16).padStart(2, '0'));
    console.log(JSON.stringify({ file: path.relative(REPO, out), frames, introFirstPicture: start, loopAt, rooms: visited, readers: hits }, null, 1));
    process.exit(0);
}
