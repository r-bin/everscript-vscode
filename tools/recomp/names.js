'use strict';

// Curated names for the recomp build: functions.js, tables.js, knowledge entries and the WRAM
// symbols, turned into identifiers that are valid in Asar, C (snesrecomp) and Mesen2 labels.

const fs = require('fs');
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

/** Flat front matter of a knowledge entry: { addr, end, size, name, title, confidence, ... } */
function readEntry(file) {
    const text = fs.readFileSync(file, 'utf8');
    const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
    if (!m) return null;
    const meta = {};
    for (const line of m[1].split('\n')) {
        const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
        if (kv) meta[kv[1]] = kv[2].trim();
    }
    meta.body = m[2].trim().split(/\n\s*\n/)[0].replace(/\s+/g, ' ');
    return meta;
}

function readEntries(kind) {
    const dir = path.join(REPO, 'src', 'localizations', 'knowledge', kind);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => readEntry(path.join(dir, f))).filter(e => e && e.addr);
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
        return bus < romLength ? bus : -1;   // tables.js holds a few plain file offsets
    };

    const names = new Map();
    const counts = { functions: 0, tables: 0, romEntries: 0, wram: 0 };
    const addRom = (bus, name, note, key) => {
        const off = toRom(bus);
        if (off < 0 || names.has(off)) return;
        names.set(off, { name: unique(slug(name), bus), note });
        counts[key]++;
    };

    for (const e of readEntries('rom')) {
        addRom(parseInt(e.addr, 16), e.name || e.title, [e.title, e.body].filter(Boolean).join(' - '), 'romEntries');
    }
    const { FUNCTIONS } = require(path.join(REPO, 'src', 'localizations', 'functions.js'));
    for (const f of FUNCTIONS) addRom(f.address, f.name, [f.name, f.notes].filter(Boolean).join(' - '), 'functions');
    const { TABLES } = require(path.join(REPO, 'src', 'localizations', 'tables.js'));
    for (const t of TABLES) addRom(t.address, 'tbl_' + t.name, [t.name, t.notes].filter(Boolean).join(' - '), 'tables');

    const wramNames = new Map();
    const addWram = (addr, name, note, size) => {
        if (addr < 0 || addr >= 0x20000 || wramNames.has(addr) || !name) return;
        wramNames.set(addr, { name: unique(slug(name), 0x7E0000 + addr), note, size: size || 1 });
        counts.wram++;
    };
    for (const e of readEntries('ram')) {
        const addr = parseInt(e.addr, 16) - 0x7E0000;
        const size = e.end ? parseInt(e.end, 16) - parseInt(e.addr, 16) + 1 : parseInt(e.size || '1', 10);
        addWram(addr, e.name, [e.title, e.body].filter(Boolean).join(' - '), size);
    }
    const { ramSymbols, ramBlocks } = require(path.join(REPO, 'src', 'resources', 'ram-symbols.js'));
    for (const b of ramBlocks()) addWram(b.addr, b.tags[0], 'record (' + b.size + ' bytes)', b.size);
    for (const s of ramSymbols()) addWram(s.addr, s.name || s.tags[0], (s.tags || []).join(', '), s.size || 1);

    return { names, wramNames, counts };
}

module.exports = { collectNames, slug, readEntries };
