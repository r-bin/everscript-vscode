'use strict';
// Ownership: `soe://rom/` — the cartridge as files. Pure apart from the ROM
// buffer it is handed; never reads the emulator.
//
//   soe://rom/index.md            what is here
//   soe://rom/rom.sfc             the whole unheadered ROM
//   soe://rom/header.json         cartridge header at $FFC0
//   soe://rom/<off>[<len>].bin    file-offset slice (unlisted; default 0x100 bytes)
//   soe://rom/<off>.json          byte, word, long and table/function name
//   soe://rom/<off>.asm           65816 listing from there (asm-view.js)
//   soe://rom/assets/...          decoded content, rom-assets.js
// Bus addresses go through soe://bus/ (bus-files.js), which links here.

const { snesToRom } = require('../../../../dist/games/evermore/maps');
const { getTable, getFunction, getAbsScript } = require('../localizations');
const { parseAddressName, hexId } = require('../../../../dist/games/evermore/resources/resource-uri');
const { dir, file, json, text } = require('../../../../dist/games/evermore/resources/nodes');
const { asmListing } = require('./asm-view');
const { cListing } = require('../../../../dist/games/evermore/resources/decomp-view');

/** A file offset as the bus address code runs at: $80-$BF upper halves (fast ROM), else $C0+. */
function fileToBus(off) { return off < 0x400000 && (off & 0xFFFF) >= 0x8000 ? 0x800000 | off : 0xC00000 + off; }
const { resolveAssets } = require('./rom-assets');

const DEFAULT_SLICE = 0x100;
const HEADER = 0xFFC0;

function resolveRom(segments, rom, deps) {
    const [head, ...rest] = segments;
    if (head === undefined) {
        return dir([
            ['index.md', 'file'],
            ['rom.sfc', 'file'],
            ['header.json', 'file'],
            ['assets', 'dir'],
        ]);
    }
    if (head === 'assets') return resolveAssets(rest, rom, deps);
    // Backward-compatibility: route unlisted direct asset categories to resolveAssets
    if (head === 'maps' || head === 'scripts' || head === 'characters' || head === 'audio' || head === 'tables' || head === 'tiles') {
        return resolveAssets(segments, rom, deps);
    }
    if (rest.length === 0) {
        if (head === 'index.md') return text(() => indexMarkdown(rom));
        if (head === 'rom.sfc') return file(() => Buffer.from(rom.buffer, rom.byteOffset, rom.length));
        if (head === 'header.json') return json(() => readHeader(rom));
        return slice(rom, head, deps);
    }
    return null;
}

function slice(rom, name, deps) {
    const a = parseAddressName(name);
    if (!a || a.bit !== null || a.addr >= rom.length) return null;
    const off = a.addr;
    const query = deps && deps.query ? new URLSearchParams(deps.query) : null;
    const wantsC = query ? (query.has('c') || query.has('pseudocode')) : false;
    if (a.ext === 'json') return a.len === null ? json(() => describe(rom, off)) : null;
    if (a.ext === 'asm') return a.len === null ? text(() => asmListing(rom, fileToBus(off), { wantsC })) : null;
    if (a.ext === 'c') return a.len === null ? text(() => cListing(rom, fileToBus(off))) : null;
    const len = a.len ?? DEFAULT_SLICE;
    if (off + len > rom.length) return null;
    return file(() => Buffer.from(rom.subarray(off, off + len)));
}

/** One ROM address: its values, its bus spellings, and any name it has. */
function describe(rom, off) {
    const at = i => (off + i < rom.length ? rom[off + i] : 0);
    const fast = (off & 0xFFFF) >= 0x8000 && off < 0x400000 ? 0x800000 + off : null;
    const busAddr = 0xC00000 + off;
    const script = getAbsScript(busAddr) || (fast !== null && getAbsScript(fast));
    const named = getTable(off)
        || getFunction(busAddr)
        || (fast !== null && getFunction(fast))
        || script;
    return {
        offset: '$' + hexId(off, 6),
        bus: '$' + hexId(busAddr, 6),
        fastBus: fast === null ? null : '$' + hexId(fast, 6),
        byte: at(0),
        word: at(0) | (at(1) << 8),
        long: at(0) | (at(1) << 8) | (at(2) << 16),
        name: named ? named.name : null,
        notes: named && named.notes ? named.notes : null,
        script: script ? { kind: 'abs', name: script.name } : undefined,
        asm: 'soe://rom/' + hexId(off, 6) + '.asm',
        c: 'soe://rom/' + hexId(off, 6) + '.c',
    };
}

/** HiROM: banks $40-$7D and $C0-$FF whole, $00-$3F and $80-$BF upper halves. */
function toFileOffset(bus) {
    const bank = bus >> 16;
    if (bank === 0x7E || bank === 0x7F) return null;
    if ((bank & 0x40) === 0 && (bus & 0xFFFF) < 0x8000) return null;
    return snesToRom(bus);
}

function readHeader(rom) {
    const at = o => rom[HEADER + o];
    const word = o => at(o) | (at(o + 1) << 8);
    const title = Buffer.from(rom.subarray(HEADER, HEADER + 21)).toString('latin1').trimEnd();
    return {
        title,
        mapMode: '$' + at(0x15).toString(16).padStart(2, '0'),
        cartridgeType: '$' + at(0x16).toString(16).padStart(2, '0'),
        romSize: (1 << at(0x17)) * 1024,
        sramSize: at(0x18) ? (1 << at(0x18)) * 1024 : 0,
        region: at(0x19),
        developer: at(0x1A),
        version: at(0x1B),
        checksumComplement: '$' + word(0x1C).toString(16).padStart(4, '0'),
        checksum: '$' + word(0x1E).toString(16).padStart(4, '0'),
        fileSize: rom.length,
    };
}

function indexMarkdown(rom) {
    return `# soe://rom/

The cartridge as files: ${readHeader(rom).title}, ${rom.length} bytes.
Add \`?rom=vanilla\` to any path to read the configured vanilla ROM instead of the one in the emulator.

| Path | Content |
|---|---|
| [rom.sfc](rom.sfc) | the whole unheadered ROM |
| [header.json](header.json) | cartridge header at \`$FFC0\` |
| \`<offset>[<len>].bin\` | slice by file offset, hex, e.g. [128000[40].bin](128000%5B40%5D.bin) |
| \`<offset>.json\` | byte, word, long and name, e.g. [0e8000.json](0e8000.json) (ring-menu icon table) |
| \`soe://bus/<addr>\` | the same by 24-bit bus address; links here or to \`soe://ram/\` |
| [assets/icons/](assets/icons) | ring-menu icons by icon id |
| [assets/ingredients/](assets/ingredients), [armor/](assets/armor), [consumables/](assets/consumables), [alchemy/](assets/alchemy) | icon.png + info.json per item, by name |
| [assets/strings/](assets/strings) | in-game strings by index |
| [assets/maps/](assets/maps) | rooms: info.md, header.json, render.png, tiles |
| [assets/characters/](assets/characters) | all 142 characters: info.json, sprite.png, animations |
| [assets/audio/](assets/audio) | audio subsystem: music with .spc snapshots, sounds |
| [assets/tables/](assets/tables) | engine and lookup tables with data.bin, data.json |
| [assets/tiles/](assets/tiles) | master 16×16 CHR tile graphics table ($EE0000) |

![Wax](assets/ingredients/wax/icon.png)
`;
}

module.exports = { resolveRom, toFileOffset };
