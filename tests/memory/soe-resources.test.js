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
    FileType: { File: 1, Directory: 2, SymbolicLink: 64 },
    FilePermission: { Readonly: 1 },
    FileChangeType: { Changed: 1 },
} };

const { parseSoeParts, parseAddressName, slugify } = require('../../src/shared/resource-uri');
const { resolveRom, toFileOffset } = require('../../src/resources/rom-files');
const { resolveRam } = require('../../src/resources/ram-files');
const { SoeFileSystem } = require('../../src/resources/fs-provider');
const { busTarget } = require('../../src/resources/bus-files');

const romPath = path.join(__dirname, '..', '..', 'script_parser', 'dependencies', 'Secret of Evermore (U) [!].smc');
const rom = fs.existsSync(romPath) ? new Uint8Array(fs.readFileSync(romPath)) : null;

let passed = 0, failed = 0, skipped = 0;
const tests = [];
const test = (name, fn, needsRom = false) => tests.push({ name, fn, needsRom });
const uri = s => {
    const u = new URL(s);
    const make = (authority, path, query) => ({
        authority, path, query,
        with: c => make(c.authority ?? authority, c.path ?? path, c.query ?? query),
        toString: () => `soe://${authority}${path}${query ? '?' + query : ''}`,
    });
    return make(u.host, decodeURIComponent(u.pathname), u.search.slice(1));
};
const read = async node => Buffer.from(await node.read());

// ── grammar ──────────────────────────────────────────────────────────────────

test('parseSoeParts splits authority, segments and ?rom=', () => {
    const p = parseSoeParts('ROM', '/assets/ingredients/wax/icon.png', 'rom=vanilla');
    assert.deepStrictEqual(p, { authority: 'rom', segments: ['assets', 'ingredients', 'wax', 'icon.png'], rom: 'vanilla', mount: null });
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
    const icons = JSON.parse(await read(resolveRom(['0e8000.json'], rom)));
    assert.strictEqual(icons.name, 'Ring-menu icon table');
    assert.strictEqual(icons.bus, '$ce8000');
    assert.strictEqual((await read(resolveRom(['128000.bin'], rom))).length, 0x100);
    assert.ok((await read(resolveRom(['assets', 'strings', '0540.txt'], rom))).length > 1);
}, true);

test('rom/assets/maps/38 has info, header and a render', async () => {
    assert.match(String(await read(resolveRom(['assets', 'maps', '38', 'info.md'], rom))), /^# Room 38/);
    const png = await read(resolveRom(['assets', 'maps', '38', 'render.png'], rom));
    assert.strictEqual(png.subarray(1, 4).toString(), 'PNG');
    assert.strictEqual(resolveRom(['assets', 'maps', '7f'], rom), null);
}, true);

test('rom/assets/icons lists the icons that draw; item icons are links to them', async () => {
    const listed = resolveRom(['assets', 'icons'], rom).entries;
    assert.strictEqual(listed.length, 162, 'every vanilla icon id has a frame');
    const wax = resolveRom(['assets', 'ingredients', 'wax'], rom).entries;
    assert.deepStrictEqual(wax.map(e => e[1]), ['link', 'file']);
    const icon = resolveRom(['assets', 'ingredients', 'wax', 'icon.png'], rom);
    assert.match(icon.link, /^soe:\/\/rom\/assets\/icons\/[0-9a-f]{4}\.png$/);
    assert.ok(listed.some(([n]) => icon.link.endsWith('/' + n)), 'the link target is listed');
}, true);

test('busTarget maps WRAM, its low mirror and ROM; refuses I/O', () => {
    assert.deepStrictEqual(busTarget('7e0adb'), { authority: 'ram', name: '0adb.json' });
    assert.deepStrictEqual(busTarget('7f0000[10].bin'), { authority: 'ram', name: '10000[10].bin' });
    assert.deepStrictEqual(busTarget('7e2258.0.json'), { authority: 'ram', name: '2258.0.json' });
    assert.deepStrictEqual(busTarget('000f42'), { authority: 'ram', name: '0f42.json' });
    assert.deepStrictEqual(busTarget('c4601f[20].bin'), { authority: 'rom', name: '04601f[20].bin' });
    assert.deepStrictEqual(busTarget('8cd0a6'), { authority: 'rom', name: '0cd0a6.json' });
    assert.strictEqual(busTarget('002100'), null, 'PPU register');
    assert.strictEqual(busTarget('306000'), null, 'SRAM');
    assert.strictEqual(busTarget('80fff0[20].bin'), null, 'crosses into the next bank');
});

// ── provider ─────────────────────────────────────────────────────────────────

test('provider: soe://bus/ serves the target file as a symlink', async () => {
    const fsp = new SoeFileSystem({ vanillaRom: () => rom, emulatorRom: () => null, readMemory, emulatorStatus: async () => ({ emulator: 'closed' }) });
    const st = await fsp.stat(uri('soe://bus/7e0adb'));
    assert.strictEqual(st.type, 1 | 64);
    assert.strictEqual(JSON.parse(Buffer.from(await fsp.readFile(uri('soe://bus/7e0adb')))).byte, 0x38);
    const romBytes = Buffer.from(await fsp.readFile(uri('soe://bus/c4601f[4].bin')));
    assert.deepStrictEqual([...romBytes], [...rom.subarray(0x04601f, 0x046023)]);
    await assert.rejects(fsp.readFile(uri('soe://bus/002100')), e => e.code === 'FileNotFound');
    assert.match(Buffer.from(await fsp.readFile(uri('soe://bus/index.md'))).toString(), /^# soe:\/\/bus\//);
    fsp.dispose();
}, true);

test('provider: every directory has an index.md', async () => {
    const fsp = new SoeFileSystem({ vanillaRom: () => rom, emulatorRom: () => null, readMemory, emulatorStatus: async () => ({ emulator: 'closed' }) });
    const md = async p => Buffer.from(await fsp.readFile(uri(p))).toString();
    assert.ok(fsp.readDirectory(uri('soe://rom/assets/icons/')).some(([n]) => n === 'index.md'));
    assert.match(await md('soe://rom/assets/icons/index.md'), /\[!\[0056\.png\]\(0056\.png\)\]/, 'generic gallery');
    assert.match(await md('soe://rom/assets/ingredients/index.md'), /wax\/icon\.png/, 'item gallery');
    assert.match(await md('soe://rom/assets/ingredients/wax/index.md'), /\[!\[icon\.png\]\(icon\.png\)\]/);
    assert.match(await md('soe://rom/assets/strings/index.md'), /\| \[0540\]\(0540\.txt\) \| Arme Polish\. \|/);
    assert.match(await md('soe://rom/assets/maps/38/index.md'), /^# Room 38/);
    assert.match(await md('soe://ram/index.md'), /^# soe:\/\/ram\//);
    await assert.rejects(fsp.readFile(uri('soe://rom/assets/strings/0540.txt/index.md')), e => e.code === 'FileNotFound');
    fsp.dispose();
}, true);

test('provider: status.json answers without a game', async () => {
    const fsp = new SoeFileSystem({ vanillaRom: () => null, emulatorRom: () => null, readMemory,
        emulatorStatus: async () => ({ emulator: 'closed', rom: null, paused: null }) });
    assert.strictEqual(JSON.parse(Buffer.from(await fsp.readFile(uri('soe://ram/status.json')))).emulator, 'closed');
    fsp.dispose();
});


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

test('provider: ?rom=<absolute path> reads that ROM file (Open ROM as Folder)', async () => {
    const { loadRomFile } = require('../../src/shared/rom-readers');
    const fsp = new SoeFileSystem({ vanillaRom: () => null, emulatorRom: () => null, romFile: loadRomFile, readMemory });
    const q = '?' + new URLSearchParams({ rom: romPath }).toString();
    const title = JSON.parse(Buffer.from(await fsp.readFile(uri('soe://rom/header.json' + q)))).title;
    assert.ok(title.startsWith('SECRET OF EVERMORE'), title);
    assert.ok(fsp.readDirectory(uri('soe://rom/' + q)).some(([n]) => n === 'assets'));
    const missing = '?' + new URLSearchParams({ rom: '/no/such/rom.smc' }).toString();
    await assert.rejects(fsp.readFile(uri('soe://rom/header.json' + missing)), e => e.code === 'Unavailable' && /not readable/.test(e.message));
}, true);

test('mount segment: ~<base64url path> names the ROM file and is stripped from segments', () => {
    const { mountSegment } = require('../../src/shared/resource-uri');
    const m = mountSegment('/x/Secret of Evermore (U) [!].smc');
    assert.ok(/^~[A-Za-z0-9_-]+$/.test(m), m);
    const p = parseSoeParts('rom', `/${m}/assets/icons/0000.png`, '');
    assert.deepStrictEqual(p, { authority: 'rom', segments: ['assets', 'icons', '0000.png'], rom: '/x/Secret of Evermore (U) [!].smc', mount: m });
});

test('provider: a ~mount reads that ROM file; autoindex stays inside the mount', async () => {
    const { loadRomFile } = require('../../src/shared/rom-readers');
    const { mountSegment } = require('../../src/shared/resource-uri');
    const fsp = new SoeFileSystem({ vanillaRom: () => null, emulatorRom: () => null, romFile: loadRomFile, readMemory });
    const base = `soe://rom/${mountSegment(romPath)}/`;
    assert.ok(JSON.parse(Buffer.from(await fsp.readFile(uri(base + 'header.json')))).title.startsWith('SECRET OF EVERMORE'));
    const md = Buffer.from(await fsp.readFile(uri(base + 'assets/icons/index.md'))).toString();
    assert.ok(md.startsWith('# soe://rom/assets/icons/'), md.slice(0, 60));
    assert.ok(md.includes('[![0000.png](0000.png)](0000.png)'));
}, true);

test('provider: rooms list every room; scripts/ does not list itself', async () => {
    const fsp = new SoeFileSystem({ vanillaRom: () => rom, emulatorRom: () => null, readMemory });
    assert.deepStrictEqual(fsp.readDirectory(uri('soe://rom/assets/scripts/')).map(([n]) => n), ['index.md', 'index.json', 'rooms']);
    const md = Buffer.from(await fsp.readFile(uri('soe://rom/assets/scripts/rooms/index.md'))).toString();
    assert.ok(/# Room Scripts \(127\)/.test(md), md.slice(0, 80));
    assert.ok(md.includes('[38/index.md](38/index.md)'));
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

test('provider: soe://localization/ routes and directories', async () => {
    const fsp = new SoeFileSystem({ vanillaRom: () => rom, emulatorRom: () => null, readMemory: () => Promise.resolve(new Uint8Array()) });
    const d = fsp.readDirectory(uri('soe://localization/'));
    const names = d.map(([n]) => n);
    assert.ok(names.includes('scripts'));
    assert.ok(names.includes('maps'));
    assert.ok(names.includes('sounds'));
    assert.ok(names.includes('tables'));
    assert.ok(names.includes('functions'));
    assert.ok(names.includes('strings'));

    const md = Buffer.from(await fsp.readFile(uri('soe://localization/index.md'))).toString('utf8');
    assert.match(md, /^# soe:\/\/localization\//);

    const summary = JSON.parse(Buffer.from(await fsp.readFile(uri('soe://localization/index.json'))).toString('utf8'));
    assert.strictEqual(summary.counts.maps, 127);
    assert.strictEqual(summary.counts.npcScripts, 128);
    fsp.dispose();
});

test('provider: soe://localization/scripts/ resolves known script names as JSON', async () => {
    const fsp = new SoeFileSystem({ vanillaRom: () => rom, emulatorRom: () => null, readMemory: () => Promise.resolve(new Uint8Array()) });
    // NPC script via npc/19b3.json
    const s1 = JSON.parse(Buffer.from(await fsp.readFile(uri('soe://localization/scripts/npc/19b3.json'))).toString('utf8'));
    assert.strictEqual(s1.name, 'Fire Power Dude');
    assert.strictEqual(s1.kind, 'npc');
    assert.strictEqual(s1.id, 6579);

    // NPC script direct via scripts/19b3.json
    const s1Direct = JSON.parse(Buffer.from(await fsp.readFile(uri('soe://localization/scripts/19b3.json'))).toString('utf8'));
    assert.strictEqual(s1Direct.name, 'Fire Power Dude');

    // ABS script via abs/93ca9f.json
    const s2 = JSON.parse(Buffer.from(await fsp.readFile(uri('soe://localization/scripts/abs/93ca9f.json'))).toString('utf8'));
    assert.strictEqual(s2.name, 'Thraxx maggot trigger part');
    assert.strictEqual(s2.kind, 'abs');

    // Global script via global/00.json
    const s3 = JSON.parse(Buffer.from(await fsp.readFile(uri('soe://localization/scripts/global/00.json'))).toString('utf8'));
    assert.strictEqual(s3.name, 'Fade-out / stop music');
    assert.strictEqual(s3.kind, 'global');

    // Maps via maps/38.json
    const m = JSON.parse(Buffer.from(await fsp.readFile(uri('soe://localization/maps/38.json'))).toString('utf8'));
    assert.strictEqual(m.name, 'South jungle / Start');
    assert.strictEqual(m.area, 'Prehistoria');

    fsp.dispose();
});

test('provider: reading script with known name in ROM/bus as JSON adds the name', async () => {
    const fsp = new SoeFileSystem({ vanillaRom: () => rom, emulatorRom: () => null, readMemory: () => Promise.resolve(new Uint8Array()) });
    // Bus address 0x93ca9f -> soe://rom/13ca9f.json
    const res = JSON.parse(Buffer.from(await fsp.readFile(uri('soe://bus/93ca9f'))).toString('utf8'));
    assert.strictEqual(res.name, 'Thraxx maggot trigger part');
    assert.deepStrictEqual(res.script, { kind: 'abs', name: 'Thraxx maggot trigger part' });

    // Also via soe://rom/assets/scripts/19b3.json
    const assetScript = JSON.parse(Buffer.from(await fsp.readFile(uri('soe://rom/assets/scripts/19b3.json'))).toString('utf8'));
    assert.strictEqual(assetScript.name, 'Fire Power Dude');

    fsp.dispose();
}, true);

test('provider: script VFS decodes by address (md, evs, json, with/without everscript)', async () => {
    const fsp = new SoeFileSystem({ vanillaRom: () => rom, emulatorRom: () => null, readMemory: () => Promise.resolve(new Uint8Array()) });

    // With /everscript/ prefix
    const md1 = Buffer.from(await fsp.readFile(uri('soe://rom/assets/scripts/everscript/0x93c8a1.md'))).toString('utf8');
    assert.match(md1, /^# Script \$93C8A1/);
    assert.match(md1, /09 54 29 04 00 01 A4 48 00/);

    // Direct address
    const md2 = Buffer.from(await fsp.readFile(uri('soe://rom/assets/scripts/0x93c8a1.md'))).toString('utf8');
    assert.strictEqual(md1, md2);

    // Via soe://rom/scripts/ alias
    const md3 = Buffer.from(await fsp.readFile(uri('soe://rom/scripts/0x93c8a1.md'))).toString('utf8');
    assert.strictEqual(md1, md3);

    // Plain Everscript (.evs)
    const evs = Buffer.from(await fsp.readFile(uri('soe://rom/assets/scripts/0x93c8a1.evs'))).toString('utf8');
    assert.match(evs, /\$93C8A1:\s+IF \(script\[0x9\] & 0x0100\) == FALSE THEN SKIP 72/);

    // Structured JSON (.json)
    const j = JSON.parse(Buffer.from(await fsp.readFile(uri('soe://rom/assets/scripts/0x93c8a1.json'))).toString('utf8'));
    assert.strictEqual(j.addressSnes, 0x93c8a1);
    assert.strictEqual(j.instructions.length, 16);
    assert.strictEqual(j.terminated, true);

    fsp.dispose();
}, true);

test('provider: script VFS decodes by room (enter, step-on, b-trigger, room index)', async () => {
    const fsp = new SoeFileSystem({ vanillaRom: () => rom, emulatorRom: () => null, readMemory: () => Promise.resolve(new Uint8Array()) });

    // soe://rom/assets/scripts/everscript/rooms/38/enter.md
    const enter1 = Buffer.from(await fsp.readFile(uri('soe://rom/assets/scripts/everscript/rooms/38/enter.md'))).toString('utf8');
    assert.match(enter1, /^# Room 38: Enter Script \(\$9384D9\)/);
    assert.match(enter1, /Prehistoria - South jungle \/ Start/);

    // Without /everscript/ prefix
    const enter2 = Buffer.from(await fsp.readFile(uri('soe://rom/assets/scripts/rooms/38/enter.md'))).toString('utf8');
    assert.strictEqual(enter1, enter2);

    // Under soe://rom/scripts/rooms/38/enter.md
    const enter3 = Buffer.from(await fsp.readFile(uri('soe://rom/scripts/rooms/38/enter.md'))).toString('utf8');
    assert.strictEqual(enter1, enter3);

    // Under map assets: soe://rom/assets/maps/38/scripts/enter.md
    const enter4 = Buffer.from(await fsp.readFile(uri('soe://rom/assets/maps/38/scripts/enter.md'))).toString('utf8');
    assert.strictEqual(enter1, enter4);

    // Step-on trigger
    const step0 = Buffer.from(await fsp.readFile(uri('soe://rom/assets/scripts/rooms/38/step-on/0.md'))).toString('utf8');
    assert.match(step0, /Step-on Trigger #0/);
    assert.match(step0, /\$938000/);

    // B-trigger with loot
    const b0 = Buffer.from(await fsp.readFile(uri('soe://rom/assets/scripts/rooms/38/b-trigger/0.md'))).toString('utf8');
    assert.match(b0, /B-Trigger #0/);
    assert.match(b0, /_loot_chest\(0x05, MONEY, 0d15\);/);

    // Room index
    const roomIdx = Buffer.from(await fsp.readFile(uri('soe://rom/assets/scripts/rooms/38/index.md'))).toString('utf8');
    assert.match(roomIdx, /^# Room 38 Scripts/);
    assert.match(roomIdx, /\[enter\.md\]\(enter\.md\)/);
    assert.match(roomIdx, /step-on\/0\.md/);
    assert.match(roomIdx, /b-trigger\/0\.md/);

    fsp.dispose();
}, true);

(async () => {
    for (const t of tests) {
        if (t.needsRom && !rom) { console.log('  - ' + t.name + ' (no test ROM)'); skipped++; continue; }
        try { await t.fn(); console.log('  ✓ ' + t.name); passed++; }
        catch (e) { console.error('  ✗ ' + t.name + '\n    ' + e.message); failed++; }
    }
    console.log('\n' + (passed + failed) + ' run: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
    if (failed) process.exit(1);
})();
