// Run a recomp headless input script (docs/recomp/debugging.md §5.1) on the extension's snes9x core, so the
// same inputs can be compared between the recomp and a reference emulator.
//   node tools/recomp/s9x-run.js <rom> <sram file | -> <script> <outdir>
// Commands: wait N, press btn[+btn] [N], poke/pokefor/forcepoke <wram offset> <hex bytes> [N], dump <tag>, quit
// (turbo and loadstate are ignored: start from SRAM and the title menu instead).
// dump writes <tag>.wram.bin, <tag>.vram.bin (same layout as the recomp's dumps) and <tag>.fb.bmp (256x224).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const [rom, srm, scriptFile, outDir] = process.argv.slice(2);
const CORE = path.join(__dirname, '../../src/core/emulator/core/snes9x2005-wasm/snes9x_2005.js');
fs.mkdirSync(outDir, { recursive: true });
const BTN = { b: 0x8000, y: 0x4000, select: 0x2000, start: 0x1000, up: 0x800, down: 0x400, left: 0x200, right: 0x100, a: 0x80, x: 0x40, l: 0x20, r: 0x10 };

global.Module = {
    locateFile: f => path.join(path.dirname(CORE), f),
    onRuntimeInitialized: main,
};
global.require = require; global.__dirname = path.dirname(CORE); global.__filename = CORE;
vm.runInThisContext(fs.readFileSync(CORE, 'utf8'), { filename: CORE });

function main() {
    const M = Module;
    const romBuf = fs.readFileSync(rom);
    const p = M._my_malloc(romBuf.length); HEAPU8.set(romBuf, p);
    M._startWithRom(p, romBuf.length, 32040);
    if (srm && srm !== '-') {
        const s = fs.readFileSync(srm); const q = M._my_malloc(s.length); HEAPU8.set(s, q); M._loadSram(s.length, q);
    }
    let vramOff = -1, wramOff = -1;
    const forced = [];
    let frame = 0;
    const step = pad => {
        for (const f of forced) for (let i = 0; i < f.bytes.length; i++) M.writeMemory(0x7E0000 + f.addr + i, f.bytes[i]);
        M._setJoypadInput(pad); M._mainLoop(); frame++;
    };
    const hex = h => h.match(/../g).map(b => parseInt(b, 16));
    const findOffsets = st => {
        // WRAM: match 64 bytes of live WRAM ($7E2000) inside the state
        const probe = M.readMemoryRange(0x7E2000, 64);
        for (let o = 0; o < st.length - 64; o++) {
            let ok = true; for (let i = 0; i < 64; i++) if (st[o + i] !== probe[i]) { ok = false; break; }
            if (ok) { wramOff = o - 0x2000; vramOff = wramOff - 0x10000; return; }
        }
    };
    const dump = tag => {
        const n = M._getStateSaveSize(); const sp = M._saveState(); const st = new Uint8Array(HEAPU8.buffer, sp, n).slice();
        if (wramOff < 0) findOffsets(st);
        fs.writeFileSync(path.join(outDir, tag + '.wram.bin'), st.subarray(wramOff, wramOff + 0x20000));
        fs.writeFileSync(path.join(outDir, tag + '.vram.bin'), st.subarray(vramOff, vramOff + 0x10000));
        const sb = M._getScreenBuffer(); const W = 256, H = 224, rs = W * 3;
        const bmp = Buffer.alloc(54 + rs * H);
        bmp.write('BM'); bmp.writeUInt32LE(bmp.length, 2); bmp.writeUInt32LE(54, 10); bmp.writeUInt32LE(40, 14);
        bmp.writeInt32LE(W, 18); bmp.writeInt32LE(H, 22); bmp.writeUInt16LE(1, 26); bmp.writeUInt16LE(24, 28);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const s = sb + (y * 512 + x) * 4, d = 54 + (H - 1 - y) * rs + x * 3;
            bmp[d] = HEAPU8[s + 2]; bmp[d + 1] = HEAPU8[s + 1]; bmp[d + 2] = HEAPU8[s];
        }
        fs.writeFileSync(path.join(outDir, tag + '.fb.bmp'), bmp);
        const w = st.subarray(wramOff); const u = a => w[a] | (w[a + 1] << 8);
        console.log(`f=${frame} dump ${tag} map ${w[0xADB].toString(16)} boy ${u(0x4EA3)} ${u(0x4EA5)} hp ${u(0x4EB3)}`);
    };
    for (const raw of fs.readFileSync(scriptFile, 'utf8').split('\n')) {
        const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
        const a = line.split(/\s+/);
        if (a[0] === 'wait') for (let i = 0; i < +a[1]; i++) step(0);
        else if (a[0] === 'press') {
            const pad = a[1].split('+').reduce((m, b) => m | BTN[b], 0);
            for (let i = 0; i < (+a[2] || 1); i++) step(pad);
            step(0);
        } else if (a[0] === 'poke' || a[0] === 'pokefor') {
            const addr = parseInt(a[1], 16), bytes = hex(a[2]);
            for (let i = 0; i < (a[0] === 'pokefor' ? +a[3] : 1); i++) {
                bytes.forEach((b, j) => M.writeMemory(0x7E0000 + addr + j, b)); step(0);
            }
        } else if (a[0] === 'forcepoke') forced.push({ addr: parseInt(a[1], 16), bytes: hex(a[2]) });
        else if (a[0] === 'dump') dump(a[1]);
        else if (a[0] === 'quit') break;
        else if (a[0] !== 'turbo' && a[0] !== 'loadstate') console.error('unknown', line);
    }
    process.exit(0);
}
