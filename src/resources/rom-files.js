'use strict';
// Ownership: `soe://rom/` — the cartridge as files. Pure apart from the ROM
// buffer it is handed; never reads the emulator.
//
//   soe://rom/index.md            what is here
//   soe://rom/rom.sfc             the whole unheadered ROM
//   soe://rom/header.json         cartridge header at $FFC0
//   soe://rom/<off>[<len>].bin    file-offset slice (unlisted; default 0x100 bytes)
//   soe://rom/bus/<addr>[<len>].bin  the same, by 24-bit HiROM bus address
//   soe://rom/assets/...          decoded content, rom-assets.js

const { snesToRom } = require('../maps');
const { parseAddressName } = require('../shared/resource-uri');
const { dir, file, json, text } = require('./nodes');
const { resolveAssets } = require('./rom-assets');

const DEFAULT_SLICE = 0x100;
const HEADER = 0xFFC0;

function resolveRom(segments, rom) {
    const [head, ...rest] = segments;
    if (head === undefined) {
        return dir([['index.md', 'file'], ['rom.sfc', 'file'], ['header.json', 'file'], ['assets', 'dir']]);
    }
    if (head === 'assets') return resolveAssets(rest, rom);
    if (rest.length === 0) {
        if (head === 'index.md') return text(() => indexMarkdown(rom));
        if (head === 'rom.sfc') return file(() => Buffer.from(rom.buffer, rom.byteOffset, rom.length));
        if (head === 'header.json') return json(() => readHeader(rom));
        return slice(rom, head, a => a);
    }
    if (head === 'bus' && rest.length === 1) return slice(rom, rest[0], toFileOffset);
    return null;
}

function slice(rom, name, toOffset) {
    const a = parseAddressName(name);
    if (!a || a.ext !== 'bin' || a.bit !== null) return null;
    const off = toOffset(a.addr);
    const len = a.len ?? DEFAULT_SLICE;
    if (off === null || off + len > rom.length) return null;
    return file(() => Buffer.from(rom.subarray(off, off + len)));
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
| \`bus/<addr>[<len>].bin\` | slice by HiROM bus address, e.g. [bus/c4601f[20].bin](bus/c4601f%5B20%5D.bin) |
| [assets/icons/](assets/icons) | ring-menu icons by icon id |
| [assets/ingredients/](assets/ingredients), [armor/](assets/armor), [consumables/](assets/consumables), [alchemy/](assets/alchemy) | icon.png + info.json per item, by name |
| [assets/strings/](assets/strings) | in-game strings by index |
| [assets/maps/](assets/maps) | rooms: info.md, header.json, render.png |

![Wax](assets/ingredients/wax/icon.png)
`;
}

module.exports = { resolveRom, toFileOffset };
