'use strict';
// soe:// resources: the address grammar, the rom/ and ram/ handlers, and the
// FileSystemProvider (against a stubbed vscode). ROM-backed cases use the
// test ROM and are skipped without it. Whether a webview really loads from
// the provider is checked in VS Code by `Everscript: Check soe:// Resources`.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

// ── vscode stub (fs-provider.js only) ────────────────────────────────────────
class FileSystemError extends Error {
    static FileNotFound(m) { return Object.assign(new FileSystemError(String(m)), { code: 'FileNotFound' }); }
    static Unavailable(m) { return Object.assign(new FileSystemError(String(m)), { code: 'Unavailable' }); }
    static NoPermissions(m) { return Object.assign(new FileSystemError(String(m)), { code: 'NoPermissions' }); }
    static FileIsADirectory(m) { return Object.assign(new FileSystemError(String(m)), { code: 'FileIsADirectory' }); }
    static FileNotADirectory(m) { return Object.assign(new FileSystemError(String(m)), { code: 'FileNotADirectory' }); }
}
const _resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { return req === 'vscode' ? req : _resolve.call(this, req, ...rest); };
require.cache.vscode = { id: 'vscode', filename: 'vscode', loaded: true, exports: {
    EventEmitter: class { constructor() { this.event = () => {}; } fire() {} dispose() {} },
    Disposable: class { constructor(f) { this.dispose = f; } },
    FileSystemError,
    FileType: { File: 1, Directory: 2 },
    FilePermission: { Readonly: 1 },
    FileChangeType: { Changed: 1 },
} };

const { parseSoeParts, parseAddressName, slugify } = require('../../src/shared/resource-uri');
const { resolveRom, toFileOffset } = require('../../src/resources/rom-files');
const { resolveRam } = require('../../src/resources/ram-files');
const { SoeFileSystem } = require('../../src/resources/fs-provider');

const romPath = path.join(__dirname, '..', '..', 'script_parser', 'dependencies', 'Secret of Evermore (U) [!].smc');
const rom = fs.existsSync(romPath) ? new Uint8Array(fs.readFileSync(romPath)) : null;

let passed = 0, failed = 0, skipped = 0;
const tests = [];
const test = (name, fn, needsRom = false) => tests.push({ name, fn, needsRom });
const uri = s => {
    const u = new URL(s);
    return { authority: u.host, path: decodeURIComponent(u.pathname), query: u.search.slice(1), toString: () => s };
};
const read = async node => Buffer.from(await node.read());

// ── grammar ──────────────────────────────────────────────────────────────────

test('parseSoeParts splits authority, segments and ?rom=', () => {
    const p = parseSoeParts('ROM', '/assets/ingredients/wax/icon.png', 'rom=vanilla');
    assert.deepStrictEqual(p, { authority: 'rom', segments: ['assets', 'ingredients', 'wax', 'icon.png'], rom: 'vanilla' });
    assert.strictEqual(parseSoeParts('ram', '/', '').rom, null);
});

test('parseAddressName reads slices, words and flag bits in hex', () => {
    assert.deepStrictEqual(parseAddressName('c4601f[20].bin'), { addr: 0xc4601f, len: 0x20, bit: null, ext: 'bin' });
    assert.deepStrictEqual(parseAddressName('2441.json'), { addr: 0x2441, len: null, bit: null, ext: 'json' });
    assert.deepStrictEqual(parseAddressName('2258.0.json'), { addr: 0x2258, len: null, bit: 0, ext: 'json' });
    assert.strictEqual(parseAddressName('2258.8.json'), null, 'bits are 0-7');
    assert.strictEqual(parseAddressName('10[0].bin'), null, 'empty slice');
    assert.strictEqual(parseAddressName('icon.png'), null);
});

test('slugify matches LOOT_REWARD and alchemy names', () => {
    assert.strictEqual(slugify('MUD_PEPPER'), 'mud_pepper');
    assert.strictEqual(slugify('Acid Rain'), 'acid_rain');
});

test('toFileOffset maps HiROM banks and refuses WRAM and low halves', () => {
    assert.strictEqual(toFileOffset(0xc4601f), 0x04601f);
    assert.strictEqual(toFileOffset(0x928000), 0x128000);
    assert.strictEqual(toFileOffset(0x7e2441), null);
    assert.strictEqual(toFileOffset(0x921000), null);
});

// ── ram/ ─────────────────────────────────────────────────────────────────────

const fakeWram = new Uint8Array(0x20000);
fakeWram[0x0adb] = 0x38;
fakeWram[0x2258] = 0b101;
const readMemory = async (bus, len) => fakeWram.slice(bus - 0x7e0000, bus - 0x7e0000 + len);

test('ram/<addr>.json reads byte, word and name', async () => {
    const node = resolveRam(['0adb.json'], readMemory);
    assert.strictEqual(node.live, true);
    const v = JSON.parse(await read(node));
    assert.strictEqual(v.byte, 0x38);
    assert.strictEqual(v.bus, '$7e0adb');
});

test('ram/<addr>.<bit>.json reads one flag with its name', async () => {
    const set = JSON.parse(await read(resolveRam(['2258.0.json'], readMemory)));
    const clear = JSON.parse(await read(resolveRam(['2258.1.json'], readMemory)));
    assert.strictEqual(set.set, true);
    assert.strictEqual(clear.set, false);
    assert.strictEqual(set.name, 'Acid Rain');
});

test('ram/ slices accept WRAM offsets and $7E bus addresses alike', async () => {
    assert.deepStrictEqual([...await read(resolveRam(['2258[2].bin'], readMemory))], [5, 0]);
    assert.deepStrictEqual([...await read(resolveRam(['7e2258[1].bin'], readMemory))], [5]);
    assert.strictEqual(resolveRam(['1ffff[2].bin'], readMemory), null, 'past the end');
    assert.strictEqual((await read(resolveRam(['wram.bin'], readMemory))).length, 0x20000);
});

test('ram/flags.json and symbols.json list the named flags', async () => {
    const flags = JSON.parse(await read(resolveRam(['flags.json'], readMemory)));
    assert.ok(flags.find(f => f.flag === '2258.0' && f.set && f.name === 'Acid Rain'));
    const symbols = JSON.parse(await read(resolveRam(['symbols.json'], () => { throw new Error('no emulator needed'); })));
    assert.ok(symbols.flags.length > 800 && symbols.addresses.length > 10);
});

// ── rom/ ─────────────────────────────────────────────────────────────────────

test('rom/assets/ingredients/wax/icon.png is a 16×16 PNG', async () => {
    const png = await read(resolveRom(['assets', 'ingredients', 'wax', 'icon.png'], rom));
    assert.strictEqual(png.subarray(1, 4).toString(), 'PNG');
    assert.strictEqual(png.readUInt32BE(16), 16);
    assert.strictEqual(png.readUInt32BE(20), 16);
    const byId = await read(resolveRom(['assets', 'ingredients', '0200', 'icon.png'], rom));
    assert.ok(byId.equals(png), 'the hex reward id is an alias of the name');
}, true);

test('rom/ lists ingredients and alchemy by name', () => {
    const ing = resolveRom(['assets', 'ingredients'], rom).entries.map(e => e[0]);
    assert.ok(ing.includes('wax') && ing.includes('mud_pepper'));
    const alc = resolveRom(['assets', 'alchemy'], rom).entries.map(e => e[0]);
    assert.ok(alc.includes('acid_rain'));
}, true);

test('rom/header.json, slices and strings decode', async () => {
    const h = JSON.parse(await read(resolveRom(['header.json'], rom)));
    assert.match(h.title, /SECRET OF EVERMORE/);
    assert.deepStrictEqual([...await read(resolveRom(['bus', 'c4601f[4].bin'], rom))], [...rom.subarray(0x04601f, 0x046023)]);
    assert.strictEqual((await read(resolveRom(['128000.bin'], rom))).length, 0x100);
    assert.ok((await read(resolveRom(['assets', 'strings', '0540.txt'], rom))).length > 1);
}, true);

test('rom/assets/maps/38 has info, header and a render', async () => {
    assert.match(String(await read(resolveRom(['assets', 'maps', '38', 'info.md'], rom))), /^# Room 38/);
    const png = await read(resolveRom(['assets', 'maps', '38', 'render.png'], rom));
    assert.strictEqual(png.subarray(1, 4).toString(), 'PNG');
    assert.strictEqual(resolveRom(['assets', 'maps', '7f'], rom), null);
}, true);

// ── provider ─────────────────────────────────────────────────────────────────

test('provider: ?rom= picks the ROM; default prefers the emulator', async () => {
    const other = new Uint8Array(rom);
    other[0xFFC0] = 0x58;  // 'X'
    let emu = null;
    const fsp = new SoeFileSystem({ vanillaRom: () => rom, emulatorRom: () => emu, readMemory });
    const title = async q => JSON.parse(Buffer.from(await fsp.readFile(uri('soe://rom/header.json' + q)))).title[0];
    assert.strictEqual(await title(''), 'S', 'no emulator: vanilla');
    emu = other;
    assert.strictEqual(await title(''), 'X', 'emulator running: its ROM');
    assert.strictEqual(await title('?rom=vanilla'), 'S');
    await assert.rejects(fsp.readFile(uri('soe://rom/header.json?rom=nope')), e => e.code === 'FileNotFound');
}, true);

test('provider: stat, readDirectory, errors and read-only', async () => {
    const fsp = new SoeFileSystem({ vanillaRom: () => null, emulatorRom: () => null,
        readMemory: () => Promise.reject(new Error('The emulator is not open')) });
    assert.strictEqual((await fsp.stat(uri('soe://ram/'))).type, 2);
    assert.ok(fsp.readDirectory(uri('soe://ram/')).some(([n]) => n === 'wram.bin'));
    await assert.rejects(fsp.readFile(uri('soe://ram/0adb.json')), e => e.code === 'Unavailable' && /not open/.test(e.message));
    await assert.rejects(fsp.readFile(uri('soe://rom/rom.sfc')), e => e.code === 'Unavailable' && /romPath/.test(e.message));
    await assert.rejects(fsp.readFile(uri('soe://vram/vram.bin')), e => e.code === 'FileNotFound');
    assert.throws(() => fsp.writeFile(uri('soe://ram/wram.bin')), e => e.code === 'NoPermissions');
    fsp.dispose();
});

(async () => {
    for (const t of tests) {
        if (t.needsRom && !rom) { console.log('  - ' + t.name + ' (no test ROM)'); skipped++; continue; }
        try { await t.fn(); console.log('  ✓ ' + t.name); passed++; }
        catch (e) { console.error('  ✗ ' + t.name + '\n    ' + e.message); failed++; }
    }
    console.log('\n' + (passed + failed) + ' run: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
    if (failed) process.exit(1);
})();
