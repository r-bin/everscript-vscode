// Ownership: names for what scripts touch — memory cells, flags, scripts, rooms, enemies, loot
// rewards. Pure lookups over names.json (kept and frozen, docs/cleanup.md D4) and the
// localizations; a miss is '' or null, never a guess.
//
// `printNames()` gives them to script-vm's printer as identifiers (`CHANGE_DOGGO`, `ACID_RAIN`),
// the form the compiler's notation reads best in. Constants (`music(UNKNOWN_PREHISTORIA_AMBIENT)`,
// `attach_script(1, B, …)`) and unnamed cells (`<0x23bf>` PACIFIED) come from the compiler's own
// enums (language/data/index.json, its data file): the names it compiles. Which operand takes
// which enum is script-vm's (parameters.json, from the handlers): the compiler's signatures can
// order them differently (its `animate(character, mode, id)`; the handler reads entity, id, mode).
// TRIGGER_ID (attach_script's script) is a trigger id, named by ADDRESS_ID from $100 up.

import type { Names } from '../script-vm';
import names from './names.json';
import compiler from '../language/data/index.json';

type Table = Record<string, string>;

const RAM = names.ram as Table;
const RAM_VALUES = names.ramValues as Record<string, Table>;
const FLAGS = names.flags as Table;
const LOOT_REWARDS = names.lootRewards as Table;
const ENEMIES = names.enemies as Record<string, EnemyName>;

/** What an ENEMY value names. */
export interface EnemyName {
    /** The compiler's constant, e.g. `FLOWER_PURPLE`. */
    name: string;
    /** Its record in the character table at $8E:B678, or null. */
    character: number | null;
    /** The game's own name for it, e.g. `Wimpy Flower`. */
    romName: string | null;
}

interface Localizations {
    getAbsScriptName(fileOffset: number, o: { fallback: string }): string;
    getGlobalScriptName(id: number, o: { fallback: string }): string;
    getNpcScriptName(id: number | string, o?: { fallback: string }): string;
    getMapName(id: number, o: { full: boolean; fallback: string }): string;
}

/** The localizations treat an empty fallback as none given and invent a placeholder. */
const NONE = '\u0000';

let localizations: Localizations | null = null;
function loc(): Localizations {
    if (!localizations) {
        // Runs from dist/ (the build); the localizations are JS in src/.
        localizations = require('../localizations') as Localizations;
    }
    return localizations;
}

/** `PRIZE ($2391)` → `PRIZE`; '' when the cell has no name. */
export function memoryName(addr: number): string {
    return (RAM[String(addr)] ?? '').replace(/\s*\(\$[0-9a-f]+\)\s*$/i, '');
}

/** The flag at `addr`, bit `bit`; '' when it has none. */
export function flagName(addr: number, bit: number): string {
    return FLAGS[`${addr}:${bit}`] ?? '';
}

/** The name of a value written to a cell that has named values (`Laser Lance (0x18)` → `Laser Lance`), or null. */
export function valueName(addr: number, value: number): string | null {
    const n = RAM_VALUES[String(addr)]?.[String(value)];
    return n ? n.replace(/\s*\(0x[0-9a-f]+\)\s*$/i, '') : null;
}

/** A script by its file offset; '' when it has none. */
export function scriptName(fileOffset: number): string {
    const n = loc().getAbsScriptName(fileOffset, { fallback: NONE });
    return n === NONE ? '' : n;
}

/** A global script (0xA3 id); '' when it has none. */
export function globalScriptName(id: number): string {
    const n = loc().getGlobalScriptName(id, { fallback: NONE });
    return n === NONE ? '' : n;
}

/** A room's full name; '' when it has none. */
export function mapName(id: number): string {
    const n = loc().getMapName(id, { full: true, fallback: NONE });
    return n === NONE ? '' : n;
}

/** The compiler's LOOT_REWARD name for an item id (`WAX`), or null: only those compile back. */
export function lootRewardName(item: number): string | null {
    return LOOT_REWARDS[String(item)] ?? null;
}

export function enemyName(index: number): EnemyName | null {
    return ENEMIES[String(index)] ?? null;
}

type Constant = { name: string; value: string };
const ENUMS = compiler.enums as unknown as Record<string, Constant[]>;

/** A name that says nothing: `UNKNOWN`, `UNKNOWN_2` (`UNKNOWN_PREHISTORIA_AMBIENT` still says where). */
const NAMELESS = /^UNKNOWN(_\d+)?$/;
/** Enum → value → its first name; nameless ones left out. */
const constants = new Map<string, Map<number, string>>();
/** The constant of compiler enum `type` with this value; '' when it has none. */
export function constantName(type: string, value: number): string {
    let m = constants.get(type);
    if (!m) {
        m = new Map();
        for (const c of ENUMS[type] ?? []) {
            const v = Number(c.value);
            if (Number.isFinite(v) && !NAMELESS.test(c.name) && !m.has(v)) m.set(v, c.name);
        }
        constants.set(type, m);
    }
    return m.get(value) ?? '';
}

/**
 * A field of an entity record by its offset, lower case (`0x1a` → `x`): the compiler's ATTRIBUTE
 * enum, whose offsets knowledge ram/7e4e89 checked; '' past the record or without a name.
 */
export function fieldName(offset: number): string {
    if (offset >= 0xAE) return '';
    const n = constantName('ATTRIBUTE', offset);
    return n && !n.startsWith('_') ? n.toLowerCase() : '';
}

/**
 * The compiler's MEMORY enum by address: `<0x23bf>` → PACIFIED. Not in the temp area ($2834,
 * 200 bytes): its names there (`ENTITY_4`) are the compiler's own scratch cells, not what the
 * game keeps in them; those cells are sliced (slices.ts) instead.
 */
let memoryEnum: Map<number, string> | null = null;
function compilerMemory(addr: number): string {
    if (!memoryEnum) {
        memoryEnum = new Map();
        for (const c of ENUMS.MEMORY ?? []) {
            const a = /<0x([0-9a-f]+)>/i.exec(c.value);
            const at = a ? parseInt(a[1], 16) : -1;
            if (at >= 0x2834 && at < 0x2834 + 200) continue;
            if (a && !NAMELESS.test(c.name) && !memoryEnum.has(parseInt(a[1], 16))) memoryEnum.set(parseInt(a[1], 16), c.name);
        }
    }
    return memoryEnum.get(addr) ?? '';
}

/** A typed constant: ADDRESS_ID's trigger ids only from $100 up (its smaller values are global ids), or an NPC/Short script name. */
function typedConstant(type: string, value: number): string {
    if (type === 'TRIGGER_ID') {
        if (value >= 0x100) {
            const addr = constantName('ADDRESS_ID', value);
            if (addr) return addr;
            const npc = loc().getNpcScriptName(value, { fallback: NONE });
            if (npc && npc !== NONE) return identifier(npc);
        }
        return '';
    }
    return constantName(type, value);
}

/**
 * What a cell's values are, where the game says so: the loot reward and the three prize items
 * (knowledge ram/7e2391: the default loot script copies a prize into the reward), the dog's form
 * asked for and the one it has (ram/7e2443, ram/7e2363), the equipped weapon's class (ram/7e2360).
 */
const CELL_TYPES: Record<number, string> = { 0x2443: 'DOG', 0x2363: 'DOG', 0x2360: 'WEAPON_TYPE' };
/** Cells holding a weapon index (ram/7e2441 the one a room hands over, ram/7e235f the one equipped): named like the request's values. */
const WEAPON_CELLS = new Set([0x2441, 0x235f]);
const WEAPON_REQUEST = 0x2441;
const LOOT_CELLS = new Set([0x2391, 0x23a1, 0x23a3, 0x23a5]);

/** `Hut/house to enter?` → `HUT_HOUSE_TO_ENTER`. */
export function identifier(name: string): string {
    return name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, '_$1');
}

const bitOf = (mask: number): number => 31 - Math.clz32(mask);

/** What the knowledge entries (soe://localization/knowledge, the `game-knowledge` skill) name, by bus address. */
let knowledgeNames: { ram: Map<number, string>; rom: Map<number, string> } | null = null;
function knowledge(): { ram: Map<number, string>; rom: Map<number, string> } {
    if (!knowledgeNames) {
        const k = require('../localizations/knowledge') as { entries(space: string): Array<{ addr: number; name: string | null; kind: string | null }> };
        // A region (COMPILER_TEMP, the temp area) names a range, not the cell at its start.
        const byAddr = (space: string): Map<number, string> => new Map(k.entries(space).filter((e) => e.name && e.kind !== 'region').map((e) => [e.addr, e.name!] as [number, string]));
        knowledgeNames = { ram: byAddr('ram'), rom: byAddr('rom') };
    }
    return knowledgeNames;
}

/**
 * The names for reading a listing: printNames, and where it has none for a WRAM cell or a script,
 * the knowledge entry's name for exactly that address (`<0x2437>` reads MAP_PALETTE_SET); numbers
 * in decimal where no parameter wants hex (the reader turns them to hex at will). A listing printed
 * with these may not compile: the compiler knows only printNames'.
 */
export function displayNames(file: (bus: number) => number): Names {
    const p = printNames(file);
    return {
        ...p,
        decimal: true,
        memory: (addr) => p.memory!(addr) || identifier(knowledge().ram.get(0x7e0000 | addr) ?? ''),
        script: (bus) => p.script!(bus) || identifier(knowledge().rom.get(bus) ?? ''),
    };
}

/** The names above, for script-vm's printer. `file` maps a bus address to a file offset. */
export function printNames(file: (bus: number) => number): Names {
    return {
        memory: (addr) => identifier(memoryName(addr)) || compilerMemory(addr),
        flag: (addr, mask) => identifier(flagName(addr, bitOf(mask))),
        script: (bus) => identifier(scriptName(file(bus))),
        global: (id) => identifier(globalScriptName(id)) || constantName('ADDRESS_ID', id),
        map: (id) => mapName(id),
        value: (addr, v) => (LOOT_CELLS.has(addr) ? lootRewardName(v) : null) || (CELL_TYPES[addr] ? constantName(CELL_TYPES[addr], v) : '')
            || identifier(valueName(WEAPON_CELLS.has(addr) ? WEAPON_REQUEST : addr, v) ?? ''),
        enemy: (index) => enemyName(index)?.name ?? '',
        constant: typedConstant,
        inEnum: (type, value) => (type === 'TRIGGER_ID' || !ENUMS[type]?.length ? null : ENUMS[type].some((c) => Number(c.value) === value)),
        field: fieldName,
    };
}
