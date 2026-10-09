'use strict';
// Ownership: `soe://rom/tables/` and `soe://rom/assets/tables/` —
// ROM lookup tables, jump tables, pointer tables, and formula tables. Pure.

const { TABLES } = require('../localizations/tables');
const { hexId, slugify } = require('../shared/resource-uri');
const { snesToRom } = require('../maps');
const { dir, file, json, text } = require('./nodes');

function toFileOffset(bus) {
    const bank = bus >> 16;
    if (bank === 0x7E || bank === 0x7F) return null;
    if ((bank & 0x40) === 0 && (bus & 0xFFFF) < 0x8000) return null;
    return snesToRom(bus);
}

/** Measured or estimated byte lengths for known tables. */
const TABLE_SIZES = {
    0x8088a3: 128,   // Orbit table (y)
    0x808923: 128,   // Orbit table (x)
    0x8c98a1: 16,    // Decompressor jump table
    0x8f0000: 256,   // Hit-chance base
    0x8fbaaf: 32,    // Hit-chance pointers
    0x8faf18: 32,    // Mover direction table
    0x8fb090: 4,     // Step dither
    0x8fca50: 32,    // Velocity share
    0x8fcb18: 32,    // Distance share
    0x908e74: 32,    // Room effect jump table
    0x90815b: 32,    // Facing -> pose table
    0x90d967: 32,    // Projectile movement routines
    0x90dd88: 32,    // Projectile velocity
    0x91ae31: 32,    // Status effect dispatch
    0x90b00b: 32,    // Default Boy palette
    0x045b9c: 9,     // Formula XP per cast
    0x045ba5: 10,    // Level multiplier
    0x045bf5: 70,    // ALCHEMY_TARGET
    0x045c3b: 70,    // ALCHEMY_LEARNED_ADDR
    0x045c81: 35,    // ALCHEMY_LEARNED_MASK
    0x045ddf: 70,    // ALCHEMY_ANIM_MAP
    0x045e6b: 70,    // ALCHEMY_POWER
    0x045f17: 32,    // CALL_BEAD_POWER
    0x04601f: 140,   // ALCHEMY_COST_DATA
    0xc45802: 140,   // Alchemy script pointer table
    0x9ffde7: 512,   // Room pointer table
    0x11d000: 9006,  // String key table
    0x12801b: 640,   // Room enter-script table
    0x0eb678: 10508, // Character table (142 * 74)
    0x043c92: 424,   // Global animation ids
    0x043e3a: 3132,  // Animation records
    0x0438e6: 540,   // Boy weapon table
    0x10d9a6: 504,   // Projectile records
    0x108000: 206,   // Animation VM dispatch
    0x0e8000: 324,   // Ring-menu icon table
    0x0f945f: 12,    // Dog form pointers
    0x019903: 213,   // Song pointer table
    0x0199d8: 70,    // Internal song index sequence
    0x019a1e: 90,    // Song dependency table
    0x0c8362: 224,   // SFX translation table
    0x0c8442: 146,   // Music translation table
    0x2e0000: 20064, // Map graphic pointer table
};

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
            size: TABLE_SIZES[t.address] || 256,
        })));
    }

    const table = parseTable(name);
    if (!table) return null;

    const fileOff = getTableFileOffset(table.address);
    const size = TABLE_SIZES[table.address] || 256;

    if (leaf === undefined) {
        return dir([
            ['info.json', 'file'],
            ['info.md', 'file'],
            ['data.bin', 'file'],
            ['data.json', 'file'],
        ], () => tableMarkdown(table, fileOff, size));
    }

    if (leaf === 'info.json') {
        return json(() => ({
            name: table.name,
            slug: slugify(table.name),
            category: table.category,
            address: table.address,
            addressHex: '$' + hexId(table.address, 6),
            fileOffsetHex: fileOff !== null ? '$' + hexId(fileOff, 6) : null,
            size,
            notes: table.notes,
        }));
    }

    if (leaf === 'info.md') {
        return text(() => tableMarkdown(table, fileOff, size));
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
        return TABLES.find((t) => t.address === addr) || null;
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

function tableMarkdown(table, fileOff, size) {
    return `# ${table.category} ${table.name}

| Property | Value |
|---|---|
| SNES Bus Address | \`$${hexId(table.address, 6)}\` |
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
${TABLES.map((t) => `| ${t.category} | [${t.name}](${slugify(t.name)}/info.md) | \`$${hexId(t.address, 6)}\` | ${TABLE_SIZES[t.address] || 256} B | ${t.notes || ''} |`).join('\n')}
`;
}

module.exports = { resolveTables };
