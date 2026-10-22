// Ownership: the Data tab's Tables view — ROM tables read from the user's ROM:
// the decoded ones (XP per level, the sine table, the boomerang's orbit) with
// a chart, and the character records' stats. Only tables decoded into
// readable values are listed; the rest stay in soe://rom/tables/. Pure apart
// from the ROM buffer it is handed. Each address here has its knowledge entry
// (localizations/knowledge/rom/), which says how it was found.

import { snesToRom, read16, read24 } from '../../maps';
import { CHARACTER_TABLE, CHARACTER_STRIDE } from '../../maps/character-record';
import { hex } from '../../../../platform';

type Cell = string | number;
interface Series { name: string; points: [number, number][] }
interface Table {
    id: string; group: string; title: string; addr: string; note: string;
    columns: string[]; rows: Cell[][];
    /** Drawn on the right: one y-axis, x = the first column unless `xy` (a path). */
    chart?: { series: Series[]; x: string; y: string; xy?: boolean };
    vfs?: string;
}

/** Boy and dog XP needed for the next level, 3 bytes per level, read by the level at `$0A50` / `$0A9A` (knowledge rom/8c8bd0.md). */
const XP_BOY = 0x8c8bd0;
const XP_DOG = 0x8c8cfc;
const XP_BOY_COUNT = 100;   // ends with $FFFFFF: no level after 99
const XP_DOG_COUNT = 99;    // the next bytes are another table
/** 256 steps per turn, -255..+256; 320 words so cosine (+64 entries, `$808923`) never wraps. */
const SINE = 0x8088a3;
const SINE_WORDS = 320;
const COSINE = 0x808923;
/** The boomerang orbit (`$90DF44`): x = cos · 8, y = sin · 4 in 1/16 px (maps/projectiles.ts). */
const ORBIT_STEPS = 256;
const CHARACTER_COUNT = 142;

const s16 = (v: number): number => (v >= 0x8000 ? v - 0x10000 : v);
const word = (rom: Uint8Array, snes: number): number => s16(read16(rom, snesToRom(snes)));
/** The address in the soe:// file system: `bus/` links to the ROM or WRAM file. */
const vfs = (snes: number): string => 'soe://bus/' + hex(snes, 6).toLowerCase();

function xpTable(rom: Uint8Array): Table {
    const boy: number[] = [], dog: number[] = [];
    for (let i = 0; i < XP_BOY_COUNT; i++) boy.push(read24(rom, snesToRom(XP_BOY) + i * 3));
    for (let i = 0; i < XP_DOG_COUNT; i++) dog.push(read24(rom, snesToRom(XP_DOG) + i * 3));
    const last = (v: number) => v < 0xffffff;
    return {
        id: 'xp', group: 'Progression', title: 'XP per level · Boy and dog', addr: '$8C:8BD0 · $8C:8CFC',
        note: 'Total XP the next level needs, by the level byte ($0A50 Boy, $0A9A dog). The game copies the entry to $4F1D / $4FCB when the level changes. The Boy\'s table ends with $FFFFFF.',
        columns: ['level', 'Boy', 'dog'],
        rows: boy.map((b, i) => [i, last(b) ? b : '$FFFFFF (cap)', i < dog.length ? dog[i] : '—']),
        chart: { x: 'level', y: 'XP', series: [
            { name: 'Boy', points: boy.filter(last).map((v, i): [number, number] => [i, v]) },
            { name: 'dog', points: dog.map((v, i): [number, number] => [i, v]) },
        ] },
        vfs: vfs(XP_BOY),
    };
}

function sineTable(rom: Uint8Array): Table {
    const pts: [number, number][] = [];
    for (let i = 0; i < SINE_WORDS; i++) pts.push([i, word(rom, SINE + i * 2)]);
    return {
        id: 'sine', group: 'Math', title: 'Sine helper', addr: '$80:88A3',
        note: '256 steps per turn, values -255 to +256 (8.8 fixed point). 320 words: cosine reads 64 entries on ($80:8923), so it never wraps. Used by flight ($8E:B33D) and the orbiting projectiles.',
        columns: ['step', 'sine', 'cosine'],
        rows: pts.slice(0, ORBIT_STEPS).map(([i, v]) => [i, v, word(rom, COSINE + i * 2)]),
        chart: { x: 'step', y: 'value', series: [{ name: 'sine', points: pts }] },
        vfs: vfs(SINE),
    };
}

function boomerangTable(rom: Uint8Array): Table {
    const pts: [number, number][] = [];
    for (let a = 0; a < ORBIT_STEPS; a++) pts.push([word(rom, COSINE + a * 2) * 8 / 16, word(rom, SINE + a * 2) * 4 / 16]);
    return {
        id: 'boomerang', group: 'Projectiles', title: 'Boomerang orbit', addr: '$80:8923 · $80:88A3',
        note: 'The ellipse an orbiting projectile flies round its centre ($90:DF44): one step of the angle per tick, a whole turn in 256 ticks. x = cosine × 8, y = sine × 4, in 1/16 px, here in pixels.',
        columns: ['tick', 'x px', 'y px'],
        rows: pts.map(([x, y], i) => [i, x, y]),
        chart: { x: 'x px', y: 'y px', xy: true, series: [{ name: 'orbit', points: pts }] },
        vfs: vfs(SINE),
    };
}

/** Record fields as rom/8eb678.md lists them: [label, offset, bytes]. */
const STAT_FIELDS: [string, number, number][] = [
    ['HP', 0x0f, 2], ['attack', 0x19, 2], ['defence', 0x1b, 2], ['magic def.', 0x1d, 2], ['evade', 0x1f, 2], ['hit rate', 0x21, 2],
    ['XP', 0x23, 4], ['money', 0x27, 2], ['drop chance', 0x29, 1],
];

function statsTable(rom: Uint8Array, names: { id: number; name: string }[]): Table {
    const rows: Cell[][] = [];
    for (let c = 0; c < CHARACTER_COUNT; c++) {
        const at = snesToRom(CHARACTER_TABLE + c * CHARACTER_STRIDE);
        rows.push((['$' + hex(c, 2), names[c]?.name || ''] as Cell[]).concat(STAT_FIELDS.map(([, off, n]) =>
            n === 1 ? rom[at + off] : n === 4 ? read16(rom, at + off) + read16(rom, at + off + 2) * 0x10000 : read16(rom, at + off))));
    }
    return {
        id: 'stats', group: 'Characters', title: 'Character stats', addr: '$8E:B678',
        note: 'The 142 character records, 74 bytes each: the fields rom/8eb678.md names with the routine that reads each. The Boy\'s and Dog\'s rows are templates; their live stats are in WRAM ($0A26, $0A70).',
        columns: ['id', 'name'].concat(STAT_FIELDS.map((f) => f[0] + ' +$' + hex(f[1], 2))), rows, vfs: vfs(CHARACTER_TABLE),
    };
}

/** Every table the view lists: only the ones decoded into readable values. */
function tablesModel(rom: Uint8Array, names: { id: number; name: string }[]): Table[] {
    return [xpTable(rom), statsTable(rom, names), sineTable(rom), boomerangTable(rom)];
}

export { tablesModel };
export type { Table };
