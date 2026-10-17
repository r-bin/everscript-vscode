'use strict';

/**
 * radar-utils.js — pure helper functions for the Memory Radar.
 * No VS Code API dependency; importable from tests.
 *
 * Lifecycles: temp and session come from the compiler-region knowledge entries
 * (knowledge/ram/7e2834.md, 7e2200.md); sram from an [SRAM] tag; system otherwise.
 */

// The compiler's regions are knowledge entries tagged `compiler-region` (localizations/knowledge/ram):
// lifetime `room` = temp, `save` = session. Read once, as 16-bit (bank $7E) ranges.
let _compilerRegions = null;
function compilerRegions() {
    if (!_compilerRegions) {
        const { entries } = require('./localizations/knowledge');
        _compilerRegions = entries('ram').filter(e => e.kind === 'region' && e.tags.includes('compiler-region'))
            .map(e => ({ from: e.addr & 0xFFFF, to: e.end & 0xFFFF, lifecycle: e.lifetime === 'room' ? 'temp' : 'session' }));
    }
    return _compilerRegions;
}

function radarLifecycle(addr, type, notes) {
    for (const r of compilerRegions()) if (addr >= r.from && addr <= r.to) return r.lifecycle;
    const hay = (String(type) + ' ' + String(notes)).toLowerCase();
    if (hay.includes('sram')) return 'sram';
    return 'system';
}

function radarH(n) {
    return '0x' + n.toString(16).toUpperCase().padStart(4, '0');
}

function radarEsc(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function radarExtractEmoji(str) {
    const m = String(str).match(/\p{Extended_Pictographic}/u);
    return m ? m[0] : '';
}

/**
 * Split a memory-map name cell on <br> separators, strip remaining HTML tags.
 * Returns an array of trimmed non-empty strings.
 * E.g. "⚙️ B-trigger (0x01)<br>⚙️ Switch (0x02)" → ["⚙️ B-trigger (0x01)", "⚙️ Switch (0x02)"]
 */
function radarParseName(rawName) {
    return String(rawName)
        .split(/<br\s*\/?>/gi)
        .map(s => s.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean);
}

/**
 * Convert <br> to '\n', strip remaining HTML tags, normalise whitespace.
 */
function radarParseNotes(rawNotes) {
    return String(rawNotes)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

/**
 * Parse all entries from a named enum in evs source text.
 * Returns Map<name, value (number)> for entries of the form:
 *   enum CLASSNAME { NAME = 0xNN, ... }  or  NAME = <0xNN>,
 */
function parseEvsEnumValues(content, enumName) {
    const out = new Map();
    const re = new RegExp('enum\\s+' + enumName + '\\s*\\{([^}]+)\\}');
    const m = re.exec(content);
    if (!m) return out;
    const body = m[1];
    // Match both `NAME = 0xNN` and `NAME = ... <0xNN>`
    for (const ee of body.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:[^,\n<]*<\s*)?(0x[0-9a-fA-F]+)\s*>?,/g)) {
        const val = parseInt(ee[2], 16);
        if (!isNaN(val)) out.set(ee[1], val);
    }
    return out;
}

/**
 * Parse an Everscript numeric literal to a JS number.
 * Supports hex (0xNN / 0XNN), decimal-explicit (0dNN / 0DNN), and plain ints.
 * Returns NaN for null/undefined/empty/unparseable input.
 */
function parseEvsNum(s) {
    if (s == null) return NaN;
    const str = String(s).trim();
    if (!str) return NaN;
    if (/^0[xX]/.test(str)) return parseInt(str, 16);
    if (/^0[dD]/.test(str)) return parseInt(str.slice(2), 10);
    return parseInt(str, 10);
}

/**
 * Parse enum declarations from an evs source string.
 * Looks for:  enum CLASSNAME { NAME = ... <0xNNNN> ..., ... }
 * Returns Map<addr (number), [{cls, name}]>
 */
function parseEnumsFromContent(content) {
    const out = new Map();
    const enumRe = /enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([^}]+)\}/g;
    let em;
    while ((em = enumRe.exec(content)) !== null) {
        const cls = em[1];
        const body = em[2];
        const entryRe = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[^,\n]*<\s*(0x[0-9a-fA-F]+)\s*>/g;
        let ee;
        while ((ee = entryRe.exec(body)) !== null) {
            const addr = parseInt(ee[2], 16);
            if (isNaN(addr)) continue;
            if (!out.has(addr)) out.set(addr, []);
            out.get(addr).push({ cls, name: ee[1] });
        }
    }
    return out;
}

module.exports = {
    radarLifecycle,
    radarH,
    radarEsc,
    radarExtractEmoji,
    radarParseName,
    radarParseNotes,
    parseEvsNum,
    parseEnumsFromContent,
    parseEvsEnumValues,
};
