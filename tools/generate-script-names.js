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
//   node tools/generate-script-names.js [path/to/data.h] [path/to/everscript]
//
// One more table comes from the sibling `everscript` compiler repo: the
// LOOT_REWARD enum, which is the vocabulary a decompiled pickup has to be
// written back in. `WAX` there and `Wax (0x0200)` in data.h are the same
// item; only the former round-trips through the encoder.
//
// Neither source is a dependency of this repo: the generated JSON is
// committed, and this script only needs re-running when they change.

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || '';
const DEFAULT_DATA_H = path.join(HOME, 'Documents', 'GitHub', 'SoETilesViewer', 'SoEScriptDumper', 'data.h');
const DEFAULT_EVERSCRIPT = path.join(HOME, 'Documents', 'GitHub', 'everscript');
const ITEMS_EVS = path.join('in', 'core', '[group] 00_general_enums', '[group] 05_everscript', '04_items.evs');
const SPRITES_EVS = path.join('in', 'core', '[group] 00_general_enums', '[group] 05_everscript', '03_sprites.evs');
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

/**
 * `NAME = 0x1234,` entries from one Everscript enum.
 *
 * The encoder resolves a pickup's reward against LOOT_REWARD specifically —
 * not the ITEM enum, which uses different numbers for the same things.
 */
function evsEnum(text, name) {
    const body = new RegExp('enum ' + name + '\\s*\\{([\\s\\S]*?)\\n\\s*\\}').exec(text);
    if (!body) throw new Error(`enum ${name} not found`);
    const out = {};
    const re = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*0x([0-9a-fA-F]+)\s*,?/gm;
    let m;
    while ((m = re.exec(body[1])) !== null) {
        const key = Number('0x' + m[2]);
        // First name wins, as the compiler's own lookup does: several ids
        // carry an alias underneath the canonical name.
        if (!(key in out)) out[key] = m[1];
    }
    return out;
}

/**
 * The ENEMY enum, which is what a spawn opcode's index actually means.
 *
 * Each entry carries more than a name: the comment gives the character
 * record it maps to and that record's in-ROM name, e.g.
 *
 *   FLOWER_PURPLE = 0x0b, // #109, "Wimpy Flower", palette(...)
 *
 * so one parse yields the enum name, the character id and the game's own
 * name for it.
 */
function enemyEnum(text) {
    const body = /enum ENEMY\s*\{([\s\S]*?)\n\s*\}/.exec(text);
    if (!body) throw new Error('enum ENEMY not found');
    const out = {};
    // The comment is parsed off the raw line, so stripComments must not have
    // run on this text.
    const re = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*0x([0-9a-fA-F]+)\s*,?\s*(?:\/\/\s*(.*))?$/gm;
    let m;
    while ((m = re.exec(body[1])) !== null) {
        const key = Number('0x' + m[2]);
        if (key in out) continue;                       // first name wins
        const note = m[3] || '';
        const charId = /#(\d+)/.exec(note);
        const romName = /"([^"]*)"/.exec(note);
        out[key] = {
            name: m[1],
            character: charId ? Number(charId[1]) : null,
            romName: romName ? romName[1] : null,
        };
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

    const evsRoot = process.argv[3] || DEFAULT_EVERSCRIPT;
    const spritesPath = path.join(evsRoot, SPRITES_EVS);
    let enemies = {};
    if (fs.existsSync(spritesPath)) {
        enemies = enemyEnum(fs.readFileSync(spritesPath, 'utf8'));
    } else {
        console.warn(`WARN: ${spritesPath} not found; keeping the committed ENEMY names`);
        try { enemies = require(OUT).enemies || {}; } catch { /* first run */ }
    }
    const itemsPath = path.join(evsRoot, ITEMS_EVS);
    let lootRewards = {};
    if (fs.existsSync(itemsPath)) {
        lootRewards = evsEnum(fs.readFileSync(itemsPath, 'utf8'), 'LOOT_REWARD');
    } else {
        console.warn(`WARN: ${itemsPath} not found; keeping the committed LOOT_REWARD names`);
        try { lootRewards = require(OUT).lootRewards || {}; } catch { /* first run */ }
    }

    const names = {
        '//': 'Generated by tools/generate-script-names.js from SoEScriptDumper/data.h. Do not edit by hand.',
        ram: numberKeyed(text, 'ram'),
        ramValues: ramValues(text),
        flags: flagTable(text, sniff),
        absScripts: numberKeyed(text, 'absscripts'),
        npcScripts: numberKeyed(text, 'npcscripts'),
        globalScripts: numberKeyed(text, 'globalscripts'),
        maps: numberKeyed(text, 'maps'),
        lootRewards,
        enemies,
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
    console.log(`  lootRewards    ${count(names.lootRewards)}`);
    console.log(`  enemies        ${count(names.enemies)}`);
}

main();
