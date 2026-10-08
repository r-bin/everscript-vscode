'use strict';
// Ownership: script IDs and ROM addresses to subjective script names (NPC, ABS, Global).
// Sources: SoEScriptDumper/data.h, src/script/names.json.

const { resolveLocalizedName } = require('./strings');

let rawNames = null;
try {
    rawNames = require('./data/scripts.json');
} catch (_) {
    rawNames = { npcScripts: {}, absScripts: {}, globalScripts: {} };
}

const NPC_SCRIPTS = new Map();
const ABS_SCRIPTS = new Map();
const GLOBAL_SCRIPTS = new Map();

// Populate NPC scripts
for (const [k, name] of Object.entries(rawNames.npcScripts || {})) {
    const id = Number(k);
    const entry = { id, hex: '0x' + id.toString(16), name, stringIndex: null };
    NPC_SCRIPTS.set(id, entry);
    NPC_SCRIPTS.set(entry.hex.toLowerCase(), entry);
}

// Populate ABS scripts
for (const [k, name] of Object.entries(rawNames.absScripts || {})) {
    const address = Number(k);
    const entry = { address, hex: '0x' + address.toString(16), name, stringIndex: null };
    ABS_SCRIPTS.set(address, entry);
    ABS_SCRIPTS.set(entry.hex.toLowerCase(), entry);
}

// Populate Global scripts
for (const [k, name] of Object.entries(rawNames.globalScripts || {})) {
    const id = Number(k);
    const entry = { id, hex: '0x' + id.toString(16), name, stringIndex: null };
    GLOBAL_SCRIPTS.set(id, entry);
    GLOBAL_SCRIPTS.set(entry.hex.toLowerCase(), entry);
}

/**
 * Look up an NPC/Short script entry by ID (number or hex string).
 */
function getNpcScript(id) {
    if (typeof id === 'string') {
        const parsed = id.startsWith('0x') || id.startsWith('0X') ? parseInt(id, 16) : parseInt(id, 10);
        return NPC_SCRIPTS.get(id.toLowerCase()) || NPC_SCRIPTS.get(parsed) || null;
    }
    return NPC_SCRIPTS.get(id) || null;
}

/**
 * Get the subjective name of an NPC script, with optional fallback or in-game ROM string.
 */
function getNpcScriptName(id, options = {}) {
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
function getAbsScript(address) {
    if (typeof address === 'string') {
        const parsed = address.startsWith('0x') || address.startsWith('0X') ? parseInt(address, 16) : parseInt(address, 10);
        return ABS_SCRIPTS.get(address.toLowerCase()) || ABS_SCRIPTS.get(parsed) || null;
    }
    return ABS_SCRIPTS.get(address) || null;
}

/**
 * Get the subjective name of an absolute script by address.
 */
function getAbsScriptName(address, options = {}) {
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
function getGlobalScript(id) {
    if (typeof id === 'string') {
        const parsed = id.startsWith('0x') || id.startsWith('0X') ? parseInt(id, 16) : parseInt(id, 10);
        return GLOBAL_SCRIPTS.get(id.toLowerCase()) || GLOBAL_SCRIPTS.get(parsed) || null;
    }
    return GLOBAL_SCRIPTS.get(id) || null;
}

/**
 * Get the subjective name of a global script by ID.
 */
function getGlobalScriptName(id, options = {}) {
    const entry = getGlobalScript(id);
    if (!entry) {
        if (options.fallback) return options.fallback;
        const hexStr = typeof id === 'number' ? '0x' + id.toString(16) : String(id);
        return `Unnamed Global script ${hexStr}`;
    }
    return resolveLocalizedName(entry, options.rom, 'name');
}

/**
 * Override or add a subjective script name.
 * @param {'npc'|'abs'|'global'} type
 * @param {number|string} key
 * @param {string} name
 * @param {number|null} [stringIndex=null]
 */
function setScriptOverride(type, key, name, stringIndex = null) {
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

module.exports = {
    NPC_SCRIPTS,
    ABS_SCRIPTS,
    GLOBAL_SCRIPTS,
    getNpcScript,
    getNpcScriptName,
    getAbsScript,
    getAbsScriptName,
    getGlobalScript,
    getGlobalScriptName,
    setScriptOverride,
};

