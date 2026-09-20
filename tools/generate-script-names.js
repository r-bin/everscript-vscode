'use strict';
// Generate src/script/names.json from SoEScriptDumper's data.h.
//
// The reference decoder's readability comes almost entirely from these tables:
// without them every instruction reads `WRITE $2443 = 0x02` instead of
// `WRITE CHANGE DOGGO ($2443) = Wolf (0x02)`. They are hand-curated upstream
// over years of tracing, so they are imported rather than reinvented — and
// imported by a script rather than by hand, so re-running this picks up
// whatever upstream has learned since.
//
//   node tools/generate-script-names.js [path/to/data.h]
//
// SoETilesViewer is reference-only and is not a dependency of this repo: the
// generated JSON is committed, and this script only needs to run when the
// upstream tables change.

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || '';
const DEFAULT_DATA_H = path.join(HOME, 'Documents', 'GitHub', 'SoETilesViewer', 'SoEScriptDumper', 'data.h');
const OUT = path.join(__dirname, '..', 'src', 'script', 'names.json');

/**
 * Drop `//` comments, respecting string literals.
 *
 * Upstream comments entries *out* rather than deleting them ("this seems to
 * be a temp for raptors"), so a parser that ignores comments imports names
 * the reference decoder deliberately does not use.
 */
function stripComments(text) {
    return text.split('\n').map((line) => {
        let inStr = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inStr) {
                if (ch === '\\') i += 1;
                else if (ch === '"') inStr = false;
            } else if (ch === '"') inStr = true;
            else if (ch === '/' && line[i + 1] === '/') return line.slice(0, i);
        }
        return line;
    }).join('\n');
}

/** Pull one `name = { ... };` initialiser out of the header. */
function block(text, name) {
    const start = text.indexOf(name + ' = {');
    if (start < 0) throw new Error(`table ${name} not found`);
    let depth = 0;
    for (let i = text.indexOf('{', start); i < text.length; i++) {
        if (text[i] === '{') depth += 1;
        else if (text[i] === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    throw new Error(`table ${name} is not closed`);
}

/** C string literal, tolerating escaped quotes. */
const STR = '"((?:[^"\\\\]|\\\\.)*)"';

function unescapeC(s) {
    return s.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c));
}

/** `{ 0x1234, "text" }` pairs, keyed by the number. */
function numberKeyed(text, name) {
    const out = {};
    const re = new RegExp('\\{\\s*(0x[0-9a-fA-F]+|\\d+)\\s*,\\s*' + STR + '\\s*\\}', 'g');
    let m;
    while ((m = re.exec(block(text, name))) !== null) {
        const key = Number(m[1]);
        // Upstream lists are ordered and looked up first-match-wins.
        if (!(key in out)) out[key] = unescapeC(m[2]);
    }
    return out;
}

/**
 * `{{0x2258, bm2bp(0x01)}, "Acid Rain"}` — address and bit position.
 *
 * data.h `#include`s sniffflags.inc in the middle of this initialiser, so the
 * two are read together; the .inc holds the great majority of the entries.
 */
function flagTable(text, extra) {
    const out = {};
    const re = new RegExp(
        '\\{\\s*\\{\\s*(0x[0-9a-fA-F]+)\\s*,\\s*(?:bm2bp\\(\\s*(0x[0-9a-fA-F]+)\\s*\\)|(\\d+))\\s*\\}\\s*,\\s*' + STR + '\\s*\\}',
        'g',
    );
    let m;
    while ((m = re.exec(block(text, 'flags') + '\n' + extra)) !== null) {
        const addr = Number(m[1]);
        const bit = m[2] !== undefined ? Math.log2(Number(m[2])) : Number(m[3]);
        if (!Number.isInteger(bit) || bit < 0 || bit > 7) throw new Error(`bad bit in ${m[0]}`);
        // std::map's initialiser list keeps the first entry for a key, and
        // sniffflags.inc has repeats. Match that, or the wrong sniff spot
        // gets named.
        const key = `${addr}:${bit}`;
        if (!(key in out)) out[key] = unescapeC(m[4]);
    }
    return out;
}

/**
 * `ramvalues` maps a RAM address to one of the value tables, so a write to
 * $2443 can print "Wolf (0x02)" rather than 0x02. One entry is an inline
 * literal rather than a named table.
 */
function ramValues(text) {
    const named = {
        prizes: numberKeyed(text, 'prizes'),
        weapons: numberKeyed(text, 'weapons'),
        doggos: numberKeyed(text, 'doggos'),
        alchemy_preselections: numberKeyed(text, 'alchemy_preselections'),
        save_spots: numberKeyed(text, 'save_spots'),
    };
    const out = {};
    const body = block(text, 'ramvalues');
    const byName = new RegExp('\\{\\s*(0x[0-9a-fA-F]+)\\s*,\\s*([a-z_]+)\\s*\\}', 'g');
    let m;
    while ((m = byName.exec(body)) !== null) {
        if (!named[m[2]]) throw new Error(`ramvalues references unknown table ${m[2]}`);
        out[Number(m[1])] = named[m[2]];
    }
    const inline = new RegExp('\\{\\s*(0x[0-9a-fA-F]+)\\s*,\\s*\\{\\s*\\{\\s*(0x[0-9a-fA-F]+)\\s*,\\s*' + STR + '\\s*\\}\\s*\\}\\s*\\}', 'g');
    while ((m = inline.exec(body)) !== null) {
        out[Number(m[1])] = { [Number(m[2])]: unescapeC(m[3]) };
    }
    return out;
}

function main() {
    const src = process.argv[2] || DEFAULT_DATA_H;
    if (!fs.existsSync(src)) {
        console.error(`data.h not found at ${src}`);
        console.error('Pass the path explicitly: node tools/generate-script-names.js <path/to/data.h>');
        process.exit(1);
    }
    const text = stripComments(fs.readFileSync(src, 'utf8'));
    const inc = path.join(path.dirname(src), 'sniffflags.inc');
    const sniff = fs.existsSync(inc) ? stripComments(fs.readFileSync(inc, 'utf8')) : '';
    if (!sniff) console.warn('WARN: sniffflags.inc not found next to data.h; flag names will be sparse');

    const names = {
        '//': 'Generated by tools/generate-script-names.js from SoEScriptDumper/data.h. Do not edit by hand.',
        ram: numberKeyed(text, 'ram'),
        ramValues: ramValues(text),
        flags: flagTable(text, sniff),
        absScripts: numberKeyed(text, 'absscripts'),
        npcScripts: numberKeyed(text, 'npcscripts'),
        globalScripts: numberKeyed(text, 'globalscripts'),
        maps: numberKeyed(text, 'maps'),
    };

    fs.writeFileSync(OUT, JSON.stringify(names, null, 1) + '\n');
    const count = (o) => Object.keys(o).length;
    console.log(`wrote ${path.relative(path.join(__dirname, '..'), OUT)}`);
    console.log(`  ram            ${count(names.ram)}`);
    console.log(`  ramValues      ${count(names.ramValues)} addresses`);
    console.log(`  flags          ${count(names.flags)}`);
    console.log(`  absScripts     ${count(names.absScripts)}`);
    console.log(`  npcScripts     ${count(names.npcScripts)}`);
    console.log(`  globalScripts  ${count(names.globalScripts)}`);
    console.log(`  maps           ${count(names.maps)}`);
}

main();
