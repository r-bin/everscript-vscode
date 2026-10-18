// Ownership: script IDs and ROM addresses to subjective script names (NPC, ABS, Global).
// Sources: names kept from an earlier import and frozen (docs/cleanup.md D4), src/games/evermore/script-model/names.json.

import { resolveLocalizedName } from './strings';
import type { NameOptions } from './strings';
import rawNames from './data/scripts.json';

/** A named script: by id (NPC, global) or bus address (ABS). */
interface ScriptEntry { id?: number; address?: number; hex: string; name: string; stringIndex: number | null }
/** NameOptions, plus the kind a missing NPC script is called (`Short` by default). */
type ScriptNameOptions = NameOptions & { kind?: string };

const NPC_SCRIPTS = new Map<number | string, ScriptEntry>();
const ABS_SCRIPTS = new Map<number | string, ScriptEntry>();
const GLOBAL_SCRIPTS = new Map<number | string, ScriptEntry>();

// Populate NPC scripts
for (const [k, name] of Object.entries(rawNames.npcScripts as Record<string, string>)) {
    const id = Number(k);
    const entry = { id, hex: '0x' + id.toString(16), name, stringIndex: null };
    NPC_SCRIPTS.set(id, entry);
    NPC_SCRIPTS.set(entry.hex.toLowerCase(), entry);
}

// Populate ABS scripts
for (const [k, name] of Object.entries(rawNames.absScripts as Record<string, string>)) {
    const address = Number(k);
    const entry = { address, hex: '0x' + address.toString(16), name, stringIndex: null };
    ABS_SCRIPTS.set(address, entry);
    ABS_SCRIPTS.set(entry.hex.toLowerCase(), entry);
}

// Populate Global scripts
for (const [k, name] of Object.entries(rawNames.globalScripts as Record<string, string>)) {
    const id = Number(k);
    const entry = { id, hex: '0x' + id.toString(16), name, stringIndex: null };
    GLOBAL_SCRIPTS.set(id, entry);
    GLOBAL_SCRIPTS.set(entry.hex.toLowerCase(), entry);
}

/**
 * Look up an NPC/Short script entry by ID (number or hex string).
 */
function getNpcScript(id: number | string): ScriptEntry | null {
    if (typeof id === 'string') {
        const parsed = id.startsWith('0x') || id.startsWith('0X') ? parseInt(id, 16) : parseInt(id, 10);
        return NPC_SCRIPTS.get(id.toLowerCase()) || NPC_SCRIPTS.get(parsed) || null;
    }
    return NPC_SCRIPTS.get(id) || null;
}

/**
 * Get the subjective name of an NPC script, with optional fallback or in-game ROM string.
 */
function getNpcScriptName(id: number | string, options: ScriptNameOptions = {}): string {
    const entry = getNpcScript(id);
    if (!entry) {
        if (options.fallback) return options.fallback;
        const kind = options.kind || 'Short';
        const hexStr = typeof id === 'number' ? '0x' + id.toString(16) : String(id);
        return `Unnamed ${kind} script ${hexStr}`;
    }
    return resolveLocalizedName(entry, options.rom, 'name');
}

/**
 * Look up an ABS script entry by ROM address.
 */
function getAbsScript(address: number | string): ScriptEntry | null {
    if (typeof address === 'string') {
        const parsed = address.startsWith('0x') || address.startsWith('0X') ? parseInt(address, 16) : parseInt(address, 10);
        return ABS_SCRIPTS.get(address.toLowerCase()) || ABS_SCRIPTS.get(parsed) || null;
    }
    return ABS_SCRIPTS.get(address) || null;
}

/**
 * Get the subjective name of an absolute script by address.
 */
function getAbsScriptName(address: number | string, options: ScriptNameOptions = {}): string {
    const entry = getAbsScript(address);
    if (!entry) {
        if (options.fallback) return options.fallback;
        const hexStr = typeof address === 'number' ? '0x' + address.toString(16) : String(address);
        return `Unnamed ABS script ${hexStr}`;
    }
    return resolveLocalizedName(entry, options.rom, 'name');
}

/**
 * Look up a global script entry by ID.
 */
function getGlobalScript(id: number | string): ScriptEntry | null {
    if (typeof id === 'string') {
        const parsed = id.startsWith('0x') || id.startsWith('0X') ? parseInt(id, 16) : parseInt(id, 10);
        return GLOBAL_SCRIPTS.get(id.toLowerCase()) || GLOBAL_SCRIPTS.get(parsed) || null;
    }
    return GLOBAL_SCRIPTS.get(id) || null;
}

/**
 * Get the subjective name of a global script by ID.
 */
function getGlobalScriptName(id: number | string, options: ScriptNameOptions = {}): string {
    const entry = getGlobalScript(id);
    if (!entry) {
        if (options.fallback) return options.fallback;
        const hexStr = typeof id === 'number' ? '0x' + id.toString(16) : String(id);
        return `Unnamed Global script ${hexStr}`;
    }
    return resolveLocalizedName(entry, options.rom, 'name');
}

/** Override or add a subjective script name. */
function setScriptOverride(type: 'npc' | 'abs' | 'global', key: number | string, name: string, stringIndex: number | null = null) {
    const num = typeof key === 'string' ? (key.startsWith('0x') || key.startsWith('0X') ? parseInt(key, 16) : parseInt(key, 10)) : key;
    const hex = '0x' + num.toString(16);
    const entry = { id: num, address: num, hex, name, stringIndex };
    if (type === 'npc') {
        NPC_SCRIPTS.set(num, entry);
        NPC_SCRIPTS.set(hex.toLowerCase(), entry);
    } else if (type === 'abs') {
        ABS_SCRIPTS.set(num, entry);
        ABS_SCRIPTS.set(hex.toLowerCase(), entry);
    } else if (type === 'global') {
        GLOBAL_SCRIPTS.set(num, entry);
        GLOBAL_SCRIPTS.set(hex.toLowerCase(), entry);
    }
}

export type { ScriptEntry };
export { NPC_SCRIPTS, ABS_SCRIPTS, GLOBAL_SCRIPTS, getNpcScript, getNpcScriptName, getAbsScript, getAbsScriptName, getGlobalScript, getGlobalScriptName, setScriptOverride };

