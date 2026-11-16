// Ownership: `soe://rom/tables/` and `soe://rom/assets/tables/` —
// ROM lookup tables, jump tables, pointer tables, and formula tables. Pure.

import { TABLES, getTable } from '../localizations/tables';
import { hexId, slugify } from './resource-uri';
import { snesToRom } from '../maps';
import { dir, file, json, text } from './nodes';
import type { Entry, VfsNode } from './nodes';
import * as vr from '../variant-resolver';

type Table = (typeof TABLES)[number];

const TABLE_TO_VARIANT_KEY: Record<string, string> = {
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

const TABLE_ASSET_LINKS: Record<string, { uri: string; label: string }> = {
    'Character table': { uri: '../characters/index.md', label: 'soe://rom/assets/characters/' },
    'Ring-menu icon table': { uri: '../icons/index.md', label: 'soe://rom/assets/icons/' },
    'String key table': { uri: '../strings/index.md', label: 'soe://rom/assets/strings/' },
    'Song pointer table': { uri: '../audio/music/index.md', label: 'soe://rom/assets/audio/music/' },
    'Master music soundtrack & sound package pointer table': { uri: '../audio/music/index.md', label: 'soe://rom/assets/audio/music/' },
    'Script opcode handler table': { uri: '../scripts/opcodes/index.md', label: 'soe://rom/assets/scripts/opcodes/' },
    'Room enter-script table': { uri: '../scripts/rooms/index.md', label: 'soe://rom/assets/scripts/rooms/' },
    'ALCHEMY_BLOCK_TABLE': { uri: '../alchemy/index.md', label: 'soe://rom/assets/alchemy/' },
    'Master map 16x16 graphics tile pointer directory': { uri: '../tiles/index.md', label: 'soe://rom/assets/tiles/' },
    'Room pointer table': { uri: '../maps/index.md', label: 'soe://rom/assets/maps/' },
    'Companion dog breed form attribute pointer table ($CF:945F)': { uri: '../characters/01/info.md', label: 'soe://rom/assets/characters/01/' },
    'Dog form pointers': { uri: '../characters/01/info.md', label: 'soe://rom/assets/characters/01/' },
};

function toFileOffset(bus: number): number | null {
    const bank = bus >> 16;
    if (bank === 0x7E || bank === 0x7F) return null;
    if ((bank & 0x40) === 0 && (bus & 0xFFFF) < 0x8000) return null;
    return snesToRom(bus);
}

function getTableFileOffset(addr: number): number | null {
    if (addr < 0x400000) return addr;
    return toFileOffset(addr);
}

function resolveTables(segments: string[], rom: Uint8Array | null): VfsNode | null {
    const [name, leaf] = segments;

    if (name === undefined) {
        const entries: Entry[] = [
            ['index.json', 'file'],
            ...TABLES.map((t): Entry => [slugify(t.name), 'dir']),
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

    if (rom) {
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
                    const entrySizes: Record<string, number> = {
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
        const link = TABLE_ASSET_LINKS[table.name];
        return json(() => ({
            name: table.name,
            slug: slugify(table.name),
            category: table.category,
            address: snesAddr,
            addressHex: '$' + hexId(snesAddr, 6),
            fileOffsetHex: fileOff !== null ? '$' + hexId(fileOff, 6) : null,
            size,
            notes: table.notes,
            assetLink: link ? link.label : null,
            assetUri: link ? link.uri : null,
        }));
    }

    if (leaf === 'info.md') {
        return text(() => tableMarkdown(table, fileOff, size, snesAddr));
    }

    if (leaf === 'data.bin') {
        if (!rom || fileOff === null || fileOff >= rom.length) return null;
        const at = fileOff, len = Math.min(size, rom.length - at);
        return file(() => Buffer.from(rom.subarray(at, at + len)));
    }

    if (leaf === 'data.json') {
        if (!rom || fileOff === null || fileOff >= rom.length) return null;
        const at = fileOff, len = Math.min(size, rom.length - at);
        return json(() => decodeTableData(rom, at, len));
    }

    return null;
}

function parseTable(ident: string): Table | null {
    if (/^[0-9a-f]{4,6}$/i.test(ident)) {
        const addr = parseInt(ident, 16);
        return getTable(addr);
    }
    const slug = slugify(ident);
    return TABLES.find((t) => slugify(t.name) === slug || (t.id && slugify(t.id) === slug)) || null;
}

function decodeTableData(rom: Uint8Array, off: number, len: number) {
    const bytes = Array.from(rom.subarray(off, off + len));
    const words: number[] = [];
    for (let i = 0; i + 1 < len; i += 2) {
        words.push(bytes[i] | (bytes[i + 1] << 8));
    }
    return {
        byteLength: len,
        bytes,
        words,
    };
}

function tableMarkdown(table: Table, fileOff: number | null, size: number, snesAddr = table.address): string {
    const link = TABLE_ASSET_LINKS[table.name];
    const lines = [
        `# ${table.category} ${table.name}`,
        '',
        '| Property | Value |',
        '|---|---|',
        `| SNES Bus Address | \`$${hexId(snesAddr, 6)}\` |`,
        `| ROM File Offset | \`${fileOff !== null ? '$' + hexId(fileOff, 6) : '—'}\` |`,
        `| Length | ${size} bytes |`,
        `| Notes | ${table.notes || '—'} |`,
    ];
    if (link) {
        lines.push(
            '',
            '## Decoded Domain Asset',
            '',
            `See [${link.label}](${link.uri}) for decoded and structured views of this data.`,
        );
    }
    lines.push(
        '',
        '[info.json](info.json) | [data.json](data.json) | [data.bin](data.bin)',
        '',
    );
    return lines.join('\n');
}

function tablesIndexMarkdown() {
    return `# soe://rom/tables/

Master engine and lookup tables in Secret of Evermore ROM.

| Category | Table Name | Address | Size | Asset | Notes |
|---|---|---|---|---|---|
${TABLES.map((t) => {
    const link = TABLE_ASSET_LINKS[t.name];
    const assetCol = link ? `[Asset](${slugify(t.name)}/${link.uri})` : '—';
    return `| ${t.category} | [${t.name}](${slugify(t.name)}/info.md) | \`$${hexId(t.address, 6)}\` | ${t.size || 256} B | ${assetCol} | ${t.notes || ''} |`;
}).join('\n')}
`;
}

export { resolveTables };
