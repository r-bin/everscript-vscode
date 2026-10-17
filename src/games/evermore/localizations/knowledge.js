'use strict';
// Ownership: the knowledge entries (knowledge/{ram,rom}/<addr>.md, `game-knowledge` skill) as data.
// The one source of what the plugin knows about an address: functions.js and tables.js are views of
// these entries, and the ROM tab, soe://, the asm view and the exports read them through those.

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'knowledge');

/** Flat front matter: `key: value` or `key: [a, b]` (JSON-ish lists). */
function parseFrontMatter(head) {
    const out = {};
    for (const line of head.split('\n')) {
        const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
        if (!m) continue;
        let v = m[2].trim();
        if (v.startsWith('[')) {
            try { v = JSON.parse(v); } catch { v = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean); }
        }
        out[m[1]] = v;
    }
    return out;
}

function parseEntry(file) {
    const text = fs.readFileSync(file, 'utf8');
    const end = text.indexOf('\n---', 3);
    if (!text.startsWith('---') || end < 0) return null;
    const meta = parseFrontMatter(text.slice(3, end));
    const body = text.slice(end + 4).trim();
    const addr = parseInt(meta.addr || path.basename(file, '.md'), 16);
    const size = meta.size ? Number(meta.size) : null;
    const last = meta.end ? parseInt(meta.end, 16) : size ? addr + size - 1 : addr;
    return {
        addr, end: last, size, kind: meta.kind || null, name: meta.name || null, title: meta.title || meta.name || '',
        category: meta.category || null, confidence: meta.confidence || null, tags: meta.tags || [],
        evidence: meta.evidence || [], see: meta.see || [], lifetime: meta.lifetime || null,
        purpose: body.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim(), body,
        file: path.relative(path.join(__dirname, '..', '..', '..', '..'), file),
    };
}

const cache = {};

/** Every entry of one space (`ram` or `rom`), sorted by address. */
function entries(space) {
    if (!cache[space]) {
        const dir = path.join(DIR, space);
        cache[space] = fs.readdirSync(dir).filter(f => f.endsWith('.md'))
            .map(f => parseEntry(path.join(dir, f))).filter(Boolean).sort((a, b) => a.addr - b.addr);
    }
    return cache[space];
}

module.exports = { entries, parseEntry };
