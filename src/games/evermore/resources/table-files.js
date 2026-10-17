'use strict';
// Ownership: `soe://rom/tables/` and `soe://rom/assets/tables/` —
// ROM lookup tables, jump tables, pointer tables, and formula tables. Pure.

const { TABLES, getTable } = require('../localizations/tables');
const { hexId, slugify } = require('./resource-uri');
const { snesToRom } = require('../maps');
const { dir, file, json, text } = require('./nodes');

let vr;
try {
    vr = require('../../../../dist/games/evermore/variant-resolver');
} catch {}

const TABLE_TO_VARIANT_KEY = {
    'Room pointer table': 'map_table',
    'String key table': 'string_keys',
    'Room enter-script table': 'room_enter_scripts',
    'Map graphic pointer table': 'map_tile_graphics',
    'Global animation ids': 'animate_ids',
    'Animation records': 'animation_records',
    'Script opcode handler table': 'script_opcode_table',
    'Character table': 'character_records',
    'Animation VM dispatch': 'animation_vm_dispatch',
    'Song pointer table': 'song_packages',
};

function toFileOffset(bus) {
    const bank = bus >> 16;
    if (bank === 0x7E || bank === 0x7F) return null;
    if ((bank & 0x40) === 0 && (bus & 0xFFFF) < 0x8000) return null;
    return snesToRom(bus);
}

function getTableFileOffset(addr) {
    if (addr < 0x400000) return addr;
    return toFileOffset(addr);
}

function resolveTables(segments, rom) {
    const [name, leaf] = segments;

    if (name === undefined) {
        const entries = [
            ['index.json', 'file'],
            ...TABLES.map((t) => [slugify(t.name), 'dir']),
        ];
        return dir(entries, () => tablesIndexMarkdown());
    }

    if (name === 'index.json') {
        return json(() => TABLES.map((t) => ({
            name: t.name,
            slug: slugify(t.name),
            category: t.category,
            address: t.address,
            addressHex: '$' + hexId(t.address, 6),
            notes: t.notes,
            size: t.size || 256,
        })));
    }

    const table = parseTable(name);
    if (!table) return null;

    let fileOff = getTableFileOffset(table.address);
    let size = table.size || 256;
    let snesAddr = table.address;

    if (vr && rom) {
        const vKey = TABLE_TO_VARIANT_KEY[table.name];
        if (vKey) {
            const info = vr.getTableInfo(vKey, rom);
            if (info) {
                fileOff = parseInt(info.file, 16);
                if (info.snes) {
                    const cleaned = info.snes.replace(/[$:]/g, '');
                    snesAddr = parseInt(cleaned, 16);
                }
                if (info.count) {
                    const entrySizes = {
                        map_table: 4,
                        string_keys: 3,
                        room_enter_scripts: 5,
                        map_tile_graphics: 3,
                        animate_ids: 2,
                        animation_records: 4,
                        script_opcode_table: 2,
                        character_records: 74,
                        animation_vm_dispatch: 2,
                        song_packages: 3,
                    };
                    size = info.count * (entrySizes[vKey] || 1);
                }
            }
        }
    }

    if (leaf === undefined) {
        return dir([
            ['info.json', 'file'],
            ['info.md', 'file'],
            ['data.bin', 'file'],
            ['data.json', 'file'],
        ], () => tableMarkdown(table, fileOff, size, snesAddr));
    }

    if (leaf === 'info.json') {
        return json(() => ({
            name: table.name,
            slug: slugify(table.name),
            category: table.category,
            address: snesAddr,
            addressHex: '$' + hexId(snesAddr, 6),
            fileOffsetHex: fileOff !== null ? '$' + hexId(fileOff, 6) : null,
            size,
            notes: table.notes,
        }));
    }

    if (leaf === 'info.md') {
        return text(() => tableMarkdown(table, fileOff, size, snesAddr));
    }

    if (leaf === 'data.bin') {
        if (fileOff === null || fileOff >= rom.length) return null;
        const len = Math.min(size, rom.length - fileOff);
        return file(() => Buffer.from(rom.subarray(fileOff, fileOff + len)));
    }

    if (leaf === 'data.json') {
        if (fileOff === null || fileOff >= rom.length) return null;
        const len = Math.min(size, rom.length - fileOff);
        return json(() => decodeTableData(rom, fileOff, len));
    }

    return null;
}

function parseTable(ident) {
    if (/^[0-9a-f]{4,6}$/i.test(ident)) {
        const addr = parseInt(ident, 16);
        return getTable(addr);
    }
    const slug = slugify(ident);
    return TABLES.find((t) => slugify(t.name) === slug) || null;
}

function decodeTableData(rom, off, len) {
    const bytes = Array.from(rom.subarray(off, off + len));
    const words = [];
    for (let i = 0; i + 1 < len; i += 2) {
        words.push(bytes[i] | (bytes[i + 1] << 8));
    }
    return {
        byteLength: len,
        bytes,
        words,
    };
}

function tableMarkdown(table, fileOff, size, snesAddr = table.address) {
    return `# ${table.category} ${table.name}

| Property | Value |
|---|---|
| SNES Bus Address | \`$${hexId(snesAddr, 6)}\` |
| ROM File Offset | \`${fileOff !== null ? '$' + hexId(fileOff, 6) : '—'}\` |
| Length | ${size} bytes |
| Notes | ${table.notes || '—'} |

[info.json](info.json) | [data.json](data.json) | [data.bin](data.bin)
`;
}

function tablesIndexMarkdown() {
    return `# soe://rom/tables/

Master engine and lookup tables in Secret of Evermore ROM.

| Category | Table Name | Address | Size | Notes |
|---|---|---|---|---|
${TABLES.map((t) => `| ${t.category} | [${t.name}](${slugify(t.name)}/info.md) | \`$${hexId(t.address, 6)}\` | ${t.size || 256} B | ${t.notes || ''} |`).join('\n')}
`;
}

module.exports = { resolveTables };
