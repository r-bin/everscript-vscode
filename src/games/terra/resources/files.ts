// Ownership: what each `terra://rom/...` path holds. Pure: ROM bytes in, nodes out (no `vscode`),
// so tests can call it directly.
//
//   index.md, info.json               the ROM: supported or not, room counts, pictures
//   rooms/index.md, rooms/index.json  every used room: id, script, sections, size, context, picture key
//   rooms/<hex>.*                     one room's pictures, sheets and data (room-files.ts)
//   groups/index.json                 the rail: rooms by id range, as pictures (rooms that show the same map)
//   cell-types.json                   what each of the 32 cell types does to a character moving into it
// Ids in paths are three hex digits, lower case.

import * as terra from '../decoder';
import { roomFile, ROOM_FILE_EXTS } from './room-files';
import type { RomNode } from '../../../core/resources/rom-file-system';

const buf = (s: string): Buffer => Buffer.from(s, 'utf8');
const json = (v: unknown): Buffer => buf(JSON.stringify(v, null, 2) + '\n');
const file = (read: () => Buffer): RomNode => ({ kind: 'file', read });

/** The node at `segments` (the path below terra://rom/), or null. */
export function resolveTerra(segments: string[], rom: Uint8Array): RomNode | null {
    const [top, name, ...rest] = segments;
    if (top === undefined) return { kind: 'dir', entries: [['index.md', 'file'], ['info.json', 'file'], ['cell-types.json', 'file'], ['rooms', 'dir'], ['groups', 'dir']] };
    if (rest.length) return null;
    const c = terra.roomCatalog(rom);
    if (top === 'index.md' && name === undefined) return file(() => buf(romIndex(c)));
    if (top === 'info.json' && name === undefined) {
        return file(() => json({ supported: c.supported, rooms: c.used, unused: c.unused, withMap: c.rooms.filter(r => r.w).length, pictures: c.pictures.length }));
    }
    if (top === 'cell-types.json' && name === undefined) {
        return file(() => json(c.supported ? terra.cellTypeRules(rom).map(r => ({ ...r, look: terra.cellClass(r) })) : []));
    }
    if (top === 'groups') {
        if (name === undefined) return { kind: 'dir', entries: [['index.json', 'file']] };
        return name === 'index.json' ? file(() => json(c.groups)) : null;
    }
    if (top === 'rooms') {
        if (name === undefined) return { kind: 'dir', entries: [['index.md', 'file'], ['index.json', 'file'],
            ...c.rooms.filter(r => r.w).flatMap(r => ROOM_FILE_EXTS.map(e => [r.hex + '.' + e, 'file'] as [string, 'file']))] };
        if (name === 'index.json') return file(() => json(c.rooms));
        if (name === 'index.md') return file(() => buf(roomsIndex(c)));
        const hit = /^([0-9a-f]{3})\.(.+)$/.exec(name);
        const r = hit && c.rooms.find(x => x.hex === hit[1]);
        const produce = r && r.w ? roomFile(rom, r.id, hit[2]) : null;
        return produce ? file(produce) : null;
    }
    return null;
}

function romIndex(c: terra.TerraCatalog): string {
    if (!c.supported) return '# Terranigma\n\nThis release is recognised, but only the European ROM (`eu`) is decoded.\n';
    return `# Terranigma\n\n${c.used} rooms in the room table (${c.unused} unused slots); ${c.rooms.filter(r => r.w).length} load a map, `
        + `showing ${c.pictures.length} different pictures.\n\n- [rooms/](rooms/index.md)\n- [groups/index.json](groups/index.json)\n- [cell-types.json](cell-types.json)\n\nFormats: docs/terra/README.md.\n`;
}

function roomsIndex(c: terra.TerraCatalog): string {
    const rows = c.rooms.map(r => `| ${r.w ? `[${r.hex}](${r.hex}.png)` : r.hex} | $${r.script.toString(16).toUpperCase()} | `
        + `${r.w ? r.w + '×' + r.h : 'no map'} | ${r.sections.map(s => '$' + s.toString(16).padStart(2, '0')).join(' ')} | ${r.context.map(terra.hex3).join(' ')} |`);
    return `# Rooms\n\n| room | script | cells | sections | loaded before |\n|---|---|---|---|---|\n${rows.join('\n')}\n`;
}
