// Ownership: the human-readable names behind script operands. Pure lookups.
//
// Data comes from SoEScriptDumper/data.h via tools/generate-script-names.js
// and is committed as names.json, so this repo does not depend on the
// SoETilesViewer checkout being present.
//
// These tables are the whole difference between `WRITE $2443 = 0x02` and
// `WRITE CHANGE DOGGO ($2443) = Wolf (0x02)`. They are curated upstream from
// tracing, not derived from the ROM, so there is nothing to verify here — a
// missing name simply falls back to the raw number.

import names from './names.json';
import { ramAddr, u8, u16, u24 } from './addressing';

type Table = Record<string, string>;

const RAM = names.ram as Table;
const RAM_VALUES = names.ramValues as Record<string, Table>;
const FLAGS = names.flags as Table;
const LOOT_REWARDS = names.lootRewards as Table;
const ENEMIES = names.enemies as Record<string, EnemyName>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localizationsModule: any = null;
function getLocalizations() {
    if (!localizationsModule) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            localizationsModule = require('../localizations');
        } catch (_) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            localizationsModule = require('../../localizations');
        }
    }
    return localizationsModule;
}

/** What an ENEMY enum value names, from the encoder's own enum. */
export interface EnemyName {
    /** The Everscript constant, e.g. `FLOWER_PURPLE`. */
    name: string;
    /** Its record in the character table at $8EB678, or null. */
    character: number | null;
    /** The game's own name for it, e.g. `Wimpy Flower`. */
    romName: string | null;
}

/** `PRIZE    ($2391)` if the address is known, else `$2391`. */
export function ramAddrToStr(addr: number): string {
    return RAM[String(addr)] ?? ramAddr(addr);
}

/**
 * `(Acid Rain) ` for a known flag bit, else empty.
 *
 * The trailing space and brackets are upstream's, kept so summaries
 * concatenate the same way.
 */
export function ramBitToStr(addr: number, bit: number): string {
    const name = FLAGS[`${addr}:${bit}`];
    return name ? `(${name}) ` : '';
}

/** The name of a value written to a well-known address, if there is one. */
export function ramValueToStr(addr: number, value: number): string | null {
    const table = RAM_VALUES[String(addr)];
    if (!table) return null;
    return table[String(value)] ?? null;
}

// Scripts with no curated name get a placeholder built from their address,
// the way upstream's auto-discovery does. Upstream *caches* the first
// placeholder it invents for an id, so when two call sites reach the same
// unnamed script it keeps whichever kind it saw first; these lookups are
// stateless and always describe the call site in hand. The difference only
// ever shows up in the placeholder's wording.

/**
 * `fallback` is what to print when the address has no curated name. RCALL
 * targets pass "Unknown": upstream's auto-discovery is compiled out for them,
 * because it inlines the called script instead.
 */
export function absScriptName(romAddr: number, fallback?: string): string {
    return getLocalizations().getAbsScriptName(romAddr, { fallback: fallback ?? `Unnamed ABS script ${u24(romAddr)}` });
}

/** `kind` names the call site: `Short`, `NPC Talk`, `NPC Kill`, ... */
export function npcScriptName(id: number, kind = 'Short'): string {
    return getLocalizations().getNpcScriptName(id, { kind, fallback: `Unnamed ${kind} script ${u16(id)}` });
}

export function globalScriptName(id: number): string {
    return getLocalizations().getGlobalScriptName(id, { fallback: `Unnamed Global script ${u8(id)}` });
}

/**
 * The Everscript `LOOT_REWARD` name for an item id, or null.
 *
 * This is the encoder's vocabulary, not the dumper's: `WAX`, not
 * `Wax (0x0200)`. Only a name from here round-trips back through the
 * compiler, so a miss must stay a miss rather than fall back to a number.
 */
export function lootRewardName(item: number): string | null {
    return LOOT_REWARDS[String(item)] ?? null;
}

/**
 * The enemy an NPC-placing opcode refers to.
 *
 * The index is an `ENEMY` enum value, not a character-table index: the
 * encoder emits `enemy * 2` for the opcodes that store an address and the
 * bare value for the others, so unshifting gets back to the enum. The enum's
 * own comments carry the character record and the in-ROM name.
 */
export function enemyName(index: number): EnemyName | null {
    return ENEMIES[String(index)] ?? null;
}

/** Room name for a CHANGE MAP target, or empty. */
export function mapName(id: number): string {
    return getLocalizations().getMapName(id, { full: true, fallback: '' });
}

/**
 * Money instructions take a currency selector as their first operand.
 * Only the four literal selectors are named; anything computed stays raw.
 */
export function currencyName(expr: string): string {
    switch (expr) {
        case '0': return 'Talons';
        case '3': return 'Jewels';
        case '6': return 'Gold Coins';
        case '9': return 'Credits';
        default: return 'Currency ' + expr;
    }
}
