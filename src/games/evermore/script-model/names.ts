// Ownership: names for what scripts touch — memory cells, flags, scripts, rooms, enemies, loot
// rewards. Pure lookups over names.json (kept and frozen, docs/cleanup.md D4) and the
// localizations; a miss is '' or null, never a guess.
//
// `printNames()` gives them to script-vm's printer as identifiers (`CHANGE_DOGGO`, `ACID_RAIN`),
// the form the compiler's notation reads best in.

import type { Names } from '../script-vm';
import names from './names.json';

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
    getMapName(id: number, o: { full: boolean; fallback: string }): string;
}

/** The localizations treat an empty fallback as none given and invent a placeholder. */
const NONE = '\u0000';

let localizations: Localizations | null = null;
function loc(): Localizations {
    if (!localizations) {
        // Runs from dist/ (the build); the localizations are JS in src/.
        localizations = require('../../../../src/games/evermore/localizations') as Localizations;
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

/** `Hut/house to enter?` → `HUT_HOUSE_TO_ENTER`. */
export function identifier(name: string): string {
    return name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, '_$1');
}

const bitOf = (mask: number): number => 31 - Math.clz32(mask);
/** The loot mailbox's reward cell (knowledge ram/7e2391): its values are LOOT_REWARD ids. */
const LOOT_ITEM = 0x2391;

/** The names above, for script-vm's printer. `file` maps a bus address to a file offset. */
export function printNames(file: (bus: number) => number): Names {
    return {
        memory: (addr) => identifier(memoryName(addr)),
        flag: (addr, mask) => identifier(flagName(addr, bitOf(mask))),
        script: (bus) => identifier(scriptName(file(bus))),
        global: (id) => identifier(globalScriptName(id)),
        map: (id) => mapName(id),
        value: (addr, v) => (addr === LOOT_ITEM ? lootRewardName(v) : null) ?? identifier(valueName(addr, v) ?? ''),
        enemy: (index) => enemyName(index)?.name ?? '',
    };
}
