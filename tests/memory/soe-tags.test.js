'use strict';
// soe://tags/: the tag graph (tag-model.js), the hand-authored tags.json and
// the provider's tags/ authority (against a stubbed vscode). Link checks that
// need ROM routes use the test ROM and are skipped without it.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

// ── vscode stub ──────────────────────────────────────────────────────────────
class FileSystemError extends Error {
    static FileNotFound(m) { return Object.assign(new FileSystemError(String(m)), { code: 'FileNotFound' }); }
    static Unavailable(m) { return Object.assign(new FileSystemError(String(m)), { code: 'Unavailable' }); }
    static NoPermissions(m) { return Object.assign(new FileSystemError(String(m)), { code: 'NoPermissions' }); }
    static FileIsADirectory(m) { return Object.assign(new FileSystemError(String(m)), { code: 'FileIsADirectory' }); }
    static FileNotADirectory(m) { return Object.assign(new FileSystemError(String(m)), { code: 'FileNotADirectory' }); }
}
const uri = s => {
    const u = new URL(s);
    const make = (authority, path, query) => ({
        authority, path, query,
        with: c => make(c.authority ?? authority, c.path ?? path, c.query ?? query),
        toString: () => `soe://${authority}${path}${query ? '?' + query : ''}`,
    });
    return make(u.host, decodeURIComponent(u.pathname), u.search.slice(1));
};
const _resolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { return req === 'vscode' ? req : _resolve.call(this, req, ...rest); };
require.cache.vscode = { id: 'vscode', filename: 'vscode', loaded: true, exports: {
    EventEmitter: class { constructor() { this.event = () => {}; } fire() {} dispose() {} },
    Disposable: class { constructor(f) { this.dispose = f; } },
    FileSystemError,
    FileType: { File: 1, Directory: 2, SymbolicLink: 64 },
    FilePermission: { Readonly: 1 },
    FileChangeType: { Changed: 1 },
    Uri: { parse: uri },
} };

const { buildTagModel, tagModel } = require('../../src/resources/tag-model');
const { SoeFileSystem } = require('../../src/resources/fs-provider');
const AUTHORED = require('../../src/resources/tags/tags.json');

const romPath = path.join(__dirname, '..', '..', 'script_parser', 'dependencies', 'Secret of Evermore (U) [!].smc');
const rom = fs.existsSync(romPath) ? new Uint8Array(fs.readFileSync(romPath)) : null;

let passed = 0, failed = 0, skipped = 0;
const tests = [];
const test = (name, fn, needsRom = false) => tests.push({ name, fn, needsRom });

const fakeWram = new Uint8Array(0x20000);
fakeWram[0x4eb3] = 30;            // boy hp
fakeWram[0x0a35] = 30;            // boy max hp (stats block)
fakeWram[0x0a50] = 1;             // boy level
const readMemory = async (bus, len) => fakeWram.slice(bus - 0x7e0000, bus - 0x7e0000 + len);
const noGame = async () => { throw new Error('Emulator is not open'); };
const provider = (mem = readMemory, r = null) => new SoeFileSystem({
    vanillaRom: () => r, emulatorRom: () => null, romFile: () => null, readMemory: mem,
    emulatorStatus: async () => ({ emulator: 'closed' }),
});
const read = async (fsp, s) => Buffer.from(await fsp.readFile(uri(s))).toString();

// ── tags.json data ──────────────────────────────────────────────────────────

test('the plugin graph loads without errors', () => {
    const m = tagModel();
    assert.deepStrictEqual(m.errors, []);
    for (const r of ['boy', 'dog', 'player', 'character', 'enemy', 'map', 'music', 'flag', 'ram', 'table', 'ingredient']) {
        assert.ok(m.roots().includes(r), r);
    }
});

// The precompiled links are base + offset from the everscript enums
// (ATTRIBUTE for the entity record, ATTRIBUTE_GENERAL for the stats block).
const ENTITY = { hp: 0x2a, x: 0x1a, y: 0x1c, z: 0x1e, z_level: 0x18, velocity: 0x20, face_direction: 0x22, palette: 0x0c,
    stamina: 0x2e, status_1: 0x46, damage_source: 0x36, last_damage: 0x76, xp_required: 0x94,
    boost_attack: 0xa0, boost_defend: 0xa2, boost_evade: 0xa4, boost_hit: 0xa6 };
const STATS = { name: 0x00, max_hp: 0x0f, attack: 0x19, defense: 0x1b, magic_defense: 0x1d, evade: 0x1f, hit: 0x21,
    level: 0x2a, charge_max: 0x2c, charge_rate: 0x2f };
const BASES = { boy: [0x4e89, 0x0a26], dog: [0x4f37, 0x0a70] };

test('boy and dog links are base + enum offset', () => {
    for (const [who, [entity, stats]] of Object.entries(BASES)) {
        const sub = AUTHORED[who].sub;
        for (const [k, off] of Object.entries(ENTITY)) {
            assert.strictEqual(sub[k].links[0].uri, `soe://ram/${(entity + off).toString(16).padStart(4, '0')}.json`, `${who}.${k}`);
        }
        for (const [k, off] of Object.entries(STATS)) {
            assert.strictEqual(sub[k].links[0].uri, `soe://ram/${(stats + off).toString(16).padStart(4, '0')}.json`, `${who}.${k}`);
        }
        assert.strictEqual(sub.xp.links[0].uri, `soe://ram/${(stats + 0x23).toString(16).padStart(4, '0')}[4].bin`);
    }
});

test('boy and dog map every sub-tag player and character define', () => {
    const m = tagModel();
    for (const who of ['boy', 'dog']) {
        const kids = [...m.children(who).values()];
        assert.ok(kids.length >= 30, `${who}: ${kids.length}`);
        const missing = kids.filter(k => !m.tags.has(k.id)).map(k => k.id);
        assert.deepStrictEqual(missing, [], `${who} unmapped`);
    }
});

test('boy.hp inherits its title from character.hp; enemy.hp is virtual', () => {
    const m = tagModel();
    assert.deepStrictEqual(m.ancestors('boy'), ['player', 'character']);
    assert.deepStrictEqual(m.ancestors('boy.hp'), ['character.hp']);
    assert.strictEqual(m.title('boy.hp'), 'Current HP');
    assert.deepStrictEqual(m.resolve('enemy.hp'), { id: 'enemy.hp', virtual: true });
    assert.strictEqual(m.resolve('enemy.nonsense'), null);
});

test('aliases, search and back-links', () => {
    const m = tagModel();
    assert.deepStrictEqual(m.resolve('map.5c'), { id: 'map.raptors', alias: 'map.5c' });
    assert.ok(m.tags.has('music.raptor_attack'));
    for (const id of ['map.raptors', 'enemy.raptor', 'enemy.raptor_purple', 'music.raptor_attack']) assert.ok(m.search('raptor').includes(id), id);
    assert.ok(m.referencedBy('map.raptors').includes('enemy.raptor'));
    assert.ok(m.tags.get('map.raptors').see.includes('area.prehistoria'), 'generated see survives the authored entry');
});

test('a claim on another tag\'s address is a conflict on both tags', () => {
    const m = tagModel();
    const [c] = m.conflicts('boy.attack');
    assert.strictEqual(c.uri, 'soe://ram/0a3f.json');
    assert.strictEqual(c.claim.id, 'boy.magic_defense');
    assert.strictEqual(c.claim.status, 'unverified');
    assert.strictEqual(m.conflicts('boy.magic_defense').length, 1);
});

// ── the model's rules ────────────────────────────────────────────────────────

test('multiple inheritance merges sub-tags from every parent; the child wins', () => {
    const m = buildTagModel([['t', {
        a: { sub: { x: { title: 'X from a' }, y: { title: 'Y' } } },
        b: { sub: { x: { title: 'X from b' }, z: { title: 'Z' } } },
        c: { parents: ['a', 'b'], sub: { y: { title: 'own Y', links: ['soe://ram/0010.json'] } } },
    }]]);
    assert.deepStrictEqual(m.errors, []);
    const kids = m.children('c');
    assert.deepStrictEqual([...kids.keys()], ['x', 'y', 'z']);
    assert.deepStrictEqual(kids.get('x').from, ['a.x', 'b.x']);
    assert.strictEqual(kids.get('y').own, true);
    assert.strictEqual(m.title('c.y'), 'own Y');
    assert.strictEqual(m.title('c.x'), 'X from a', 'first parent first');
});

test('authored entries add to generated tags and never replace them', () => {
    const m = buildTagModel([
        ['generated', { map: { sub: { r: { title: 'Room', links: ['soe://rom/a.md'] } } } }],
        ['tags.json', { 'map.r': { title: 'Other', links: ['soe://rom/b.md'], see: ['map'] } }],
    ]);
    const t = m.tags.get('map.r');
    assert.strictEqual(t.title, 'Room');
    assert.deepStrictEqual(t.altTitles, ['Other']);
    assert.deepStrictEqual(t.links.map(l => l.uri), ['soe://rom/a.md', 'soe://rom/b.md']);
});

test('unknown parents, cycles, bad ids and bad links are load errors', () => {
    const m = buildTagModel([['t', {
        a: { parents: ['b'] }, b: { parents: ['a'] },
        c: { parents: ['nope'], see: ['gone'], links: ['http://x'] },
        'Bad Id': {},
    }]]);
    assert.ok(m.errors.some(e => /inheritance cycle/.test(e)), m.errors.join('\n'));
    assert.ok(m.errors.some(e => /unknown parent "nope"/.test(e)));
    assert.ok(m.errors.some(e => /unknown tag "gone"/.test(e)));
    assert.ok(m.errors.some(e => /bad link "http:\/\/x"/.test(e)));
    assert.ok(m.errors.some(e => /bad tag id "Bad Id"/.test(e)));
    assert.deepStrictEqual(m.ancestors('a'), ['b'], 'the edge closing the cycle is dropped');
});

// ── the provider ─────────────────────────────────────────────────────────────

test('provider: root lists roots, search/ and check.json', async () => {
    const fsp = provider();
    const names = fsp.readDirectory(uri('soe://tags/')).map(([n]) => n);
    for (const n of ['index.md', 'index.json', 'check.json', 'search', 'boy', 'map']) assert.ok(names.includes(n), n);
    assert.match(await read(fsp, 'soe://tags/index.md'), /^# soe:\/\/tags\//);
    assert.ok(JSON.parse(await read(fsp, 'soe://tags/index.json')).tags.some(t => t.id === 'boy.hp'));
    fsp.dispose();
});

test('provider: boy/hp.md shows the live value, links and inheritance', async () => {
    const fsp = provider();
    const md = await read(fsp, 'soe://tags/boy/hp.md');
    assert.match(md, /^# boy\.hp: Current HP/);
    assert.match(md, /\| \[soe:\/\/ram\/4eb3\.json\]\(soe:\/\/ram\/4eb3\.json\) \| entity record \| 30 \(\$001e\)/);
    assert.match(md, /Inherits from: \[character\.hp\]\(soe:\/\/tags\/character\/hp\.md\)/);
    assert.match(md, /## Unverified claims[\s\S]*0a37/);
    const j = JSON.parse(await read(fsp, 'soe://tags/boy/hp.json'));
    assert.strictEqual(j.links[0].value, '30 ($001e)');
    assert.strictEqual((await fsp.stat(uri('soe://tags/boy/hp.md'))).type, 1);
    fsp.dispose();
});

test('provider: boy/index.md tabulates every sub-tag with values', async () => {
    const fsp = provider();
    const md = await read(fsp, 'soe://tags/boy/index.md');
    assert.match(md, /^# boy: The boy/);
    assert.match(md, /\| \[level\]\(soe:\/\/tags\/boy\/level\.md\) \| Level \| 1 \(\$0001\) \| \[player\.level\]/);
    assert.ok(!/not mapped yet/.test(md));
    const names = fsp.readDirectory(uri('soe://tags/boy/')).map(([n]) => n);
    assert.ok(names.includes('hp.md') && names.includes('hp.json') && names.includes('index.json'));
    assert.strictEqual((await fsp.stat(uri('soe://tags/boy.md'))).type, 1 | 64, 'boy.md links to boy/index.md');
    fsp.dispose();
});

test('provider: without a game the page still renders and says why', async () => {
    const fsp = provider(noGame);
    const md = await read(fsp, 'soe://tags/boy/hp.md');
    assert.match(md, /\*\*Live values:\*\* unavailable \(Emulator is not open\)/);
    assert.match(md, /\| entity record \|  \|/);
    fsp.dispose();
});

test('provider: virtual sub-tags, aliases and search', async () => {
    const fsp = provider();
    assert.match(await read(fsp, 'soe://tags/enemy/hp.md'), /\*\*Not mapped yet\.\*\* Inherited from \[character\.hp\]/);
    assert.match(await read(fsp, 'soe://tags/enemy/index.md'), /\| \[hp\]\(soe:\/\/tags\/enemy\/hp\.md\) \| Current HP \| \*not mapped yet\* \|/);
    assert.strictEqual((await fsp.stat(uri('soe://tags/map/5c.md'))).type, 1 | 64);
    assert.match(await read(fsp, 'soe://tags/map/5c.md'), /^# map\.raptors: Prehistoria - Raptors/);
    assert.match(await read(fsp, 'soe://tags/search/raptor.md'), /\[enemy\.raptor\]/);
    await assert.rejects(fsp.readFile(uri('soe://tags/boy/nonsense.md')), e => e.code === 'FileNotFound');
    await assert.rejects(fsp.readFile(uri('soe://tags/nope/index.md')), e => e.code === 'FileNotFound');
    assert.throws(() => fsp.writeFile(uri('soe://tags/boy/hp.md')), e => e.code === 'NoPermissions');
    fsp.dispose();
});

test('provider: check.json — no load errors; RAM links resolve without a ROM', async () => {
    const fsp = provider();
    const c = JSON.parse(await read(fsp, 'soe://tags/check.json'));
    assert.deepStrictEqual(c.errors, []);
    assert.deepStrictEqual(c.links.broken, []);
    assert.ok(c.links.ok > 900, `ram links ok: ${c.links.ok}`);
    assert.ok(c.links.unchecked > 0, 'rom links need a ROM');
    fsp.dispose();
});

test('provider: check.json — every link resolves against the ROM', async () => {
    const fsp = provider(readMemory, rom);
    const c = JSON.parse(await read(fsp, 'soe://tags/check.json'));
    assert.deepStrictEqual(c.links.broken, []);
    assert.strictEqual(c.links.unchecked, 0);
    assert.strictEqual(c.ok, true);
    fsp.dispose();
}, true);

test('provider: a mounted ROM folder shows ram/, tags/ and localization/; tag links stay in the mount', async () => {
    const { mountSegment } = require('../../src/shared/resource-uri');
    const m = mountSegment('/roms/soe.smc');
    const fsp = new SoeFileSystem({ vanillaRom: () => null, emulatorRom: () => null, romFile: p => (p === '/roms/soe.smc' ? rom : null),
        readMemory, emulatorStatus: async () => ({ emulator: 'closed' }) });
    const names = fsp.readDirectory(uri(`soe://rom/${m}/`)).map(([n]) => n);
    for (const n of ['assets', 'rom.sfc', 'ram', 'tags', 'localization']) assert.ok(names.includes(n), n);
    assert.ok(fsp.readDirectory(uri(`soe://rom/${m}/tags/`)).some(([n]) => n === 'boy'));
    const md = await read(fsp, `soe://rom/${m}/tags/boy/hp.md`);
    assert.ok(md.includes(`(soe://rom/${m}/ram/4eb3.json)`), md.slice(0, 600));
    assert.ok(md.includes(`(soe://rom/${m}/tags/character/hp.md)`), md.split("\n").find(l => /Inherits/.test(l)));
    assert.ok(!/\(soe:\/\/(ram|tags)\//.test(md), 'no link leaves the mount');
    const raptors = await read(fsp, `soe://rom/${m}/tags/map/raptors.md`);
    assert.ok(raptors.includes(`![render](soe://rom/${m}/assets/maps/5c/render.png)`));
    assert.strictEqual(JSON.parse(await read(fsp, `soe://rom/${m}/ram/4eb3.json`)).byte, 30);
    assert.match(await read(fsp, `soe://rom/${m}/ram/index.md`), /^# soe:\/\/ram\//);
    assert.match(await read(fsp, `soe://rom/${m}/localization/index.md`), /./);
    assert.strictEqual((await fsp.stat(uri(`soe://rom/${m}/tags/map/5c.md`))).type, 1 | 64);
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
