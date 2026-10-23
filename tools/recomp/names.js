// TODO port to TS (docs/todo/port-to-ts.md)
'use strict';

// Curated names for the recomp build: the knowledge entries and the WRAM symbols, turned into identifiers that are valid in Asar, C (snesrecomp) and Mesen2 labels.

const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const C_KEYWORDS = new Set(('auto break case char const continue default do double else enum extern float for goto if '
    + 'inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void '
    + 'volatile while bool true false main').split(' '));
const NAME_MAX = 40;

/** "Method `0x03`: LZSS (window `$7F:A000`)" -> "method_0x03_lzss_window_7f_a000" (cut at a word). */
function slug(text) {
    let s = String(text).toLowerCase().replace(/[`'"]/g, '').replace(/\$/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (s.length > NAME_MAX) {
        const cut = s.lastIndexOf('_', NAME_MAX);
        s = s.slice(0, cut > 12 ? cut : NAME_MAX);
    }
    if (!s || /^[0-9]/.test(s)) s = 'n_' + s;
    if (C_KEYWORDS.has(s) || /^[a-z]{3}$/.test(s)) s += '_';   // keywords, and 3-letter words that could be mnemonics
    return s;
}

/** The knowledge entries of one space, through the one loader (src/games/evermore/localizations/knowledge.ts). */
function readEntries(kind) {
    return require(path.join(REPO, 'dist', 'games', 'evermore', 'localizations', 'knowledge.js')).entries(kind);
}

/**
 * @param map createRomMap() result (busToRom, canonical)
 * @returns { names: Map<rom offset, {name, note}>, wramNames: Map<wram offset, {name, note, size}>, counts }
 */
function collectNames(map, romLength) {
    const used = new Set();
    const unique = (base, addr) => {
        let n = base;
        if (used.has(n)) n = base + '_' + addr.toString(16).toUpperCase();
        used.add(n);
        return n;
    };
    const toRom = bus => {
        const off = map.busToRom(bus);
        if (off >= 0) return off;
        return bus < romLength ? bus : -1;
    };

    const names = new Map();
    const counts = { functions: 0, tables: 0, romEntries: 0, wram: 0 };
    const addRom = (bus, name, note, key) => {
        const off = toRom(bus);
        if (off < 0 || names.has(off)) return;
        names.set(off, { name: unique(slug(name), bus), note });
        counts[key]++;
    };

    // Every routine and table name is a knowledge entry (functions.ts / tables.js are views of them).
    for (const e of readEntries('rom')) {
        const key = e.kind === 'table' || e.kind === 'data' ? 'tables' : e.kind === 'code' || e.kind === 'script' ? 'functions' : 'romEntries';
        addRom(e.addr, (key === 'tables' ? 'tbl_' : '') + (e.name || e.title), [e.title, e.purpose].filter(Boolean).join(' - '), key);
    }

    // Centralized ASM comments and labels
    const commentsPath = path.join(REPO, 'src', 'games', 'evermore', 'localizations', 'data', 'asm-comments.json');
    if (require('fs').existsSync(commentsPath)) {
        try {
            const raw = JSON.parse(require('fs').readFileSync(commentsPath, 'utf8'));
            for (const [k, v] of Object.entries(raw.rom || {})) {
                const off = parseInt(k, 16);
                if (!isNaN(off) && v.label) {
                    addRom(off, v.label, v.comment, 'functions');
                }
            }
        } catch {}
    }

    const wramNames = new Map();
    const addWram = (addr, name, note, size) => {
        if (addr < 0 || addr >= 0x20000 || wramNames.has(addr) || !name) return;
        wramNames.set(addr, { name: unique(slug(name), 0x7E0000 + addr), note, size: size || 1 });
        counts.wram++;
    };
    for (const e of readEntries('ram')) {
        addWram(e.addr - 0x7E0000, e.name, [e.title, e.purpose].filter(Boolean).join(' - '), e.end - e.addr + 1);
    }
    const { ramSymbols, ramBlocks } = require(path.join(REPO, 'dist', 'games', 'evermore', 'resources', 'ram-symbols.js'));
    for (const b of ramBlocks()) addWram(b.addr, b.tags[0], 'record (' + b.size + ' bytes)', b.size);
    for (const s of ramSymbols()) addWram(s.addr, s.name || s.tags[0], (s.tags || []).join(', '), s.size || 1);

    return { names, wramNames, counts };
}

module.exports = { collectNames, slug, readEntries };
