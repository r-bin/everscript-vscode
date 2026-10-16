'use strict';

/**
 * debugger/value-types.js
 *
 * Which enum a memory value holds, so the debugger can show 0x03 as
 * ALCHEMY_INDEX.HARD_BALL. Pure.
 *
 *  - explicit: a "// @type ENUM" comment on the memory's declaration line
 *        SELECTED_ALCHEMY_0 = (Byte) <0x0ADA>, // @type ALCHEMY_INDEX
 *  - inferred: the enum whose constants the sources assign to or compare with
 *    it most often (MEMORY.SELECTED_ALCHEMY_0 = ALCHEMY_INDEX.HARD_BALL).
 *
 * Inputs come from the source map: files, symbols (memory), constants
 * ({ ENUM: { MEMBER: value } }).
 */

const fs = require('fs');

const DECLARATION = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(?:\((?:Byte|Word)\)\s*)?<\s*(0x[0-9a-fA-F]+)[^>]*>[^/]*\/\/.*@type\s+([A-Z][A-Z0-9_]*)/;
const PAIR = /\b([A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*)\s*(?:==|!=|<=|>=|=(?!=)|<|>)\s*([A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*)\b/g;

function isConstant(constants, name) {
    const [enumName, member] = name.split('.');
    return !!(constants[enumName] && Object.prototype.hasOwnProperty.call(constants[enumName], member));
}

/**
 * @param files     .evs paths to scan
 * @param symbols   Map name -> { address, size, flag }
 * @param constants { ENUM: { MEMBER: value } }
 * @param read      (file) -> text (tests); default fs
 * @returns Map symbol name -> enum name
 */
function inferTypes(files, symbols, constants, read) {
    const readFile = read || (file => { try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; } });
    const explicit = new Map();
    const votes = new Map();
    const byMember = new Map();
    for (const [name, symbol] of symbols) {
        const member = name.split('.')[1];
        if (!byMember.has(member)) byMember.set(member, []);
        byMember.get(member).push({ name, symbol });
    }
    const vote = (memory, constant) => {
        if (!symbols.has(memory) || !isConstant(constants, constant)) return;
        const enumName = constant.split('.')[0];
        if (!votes.has(memory)) votes.set(memory, new Map());
        const counts = votes.get(memory);
        counts.set(enumName, (counts.get(enumName) || 0) + 1);
    };
    for (const file of files) {
        for (const line of readFile(file).split('\n')) {
            const declaration = line.match(DECLARATION);
            if (declaration && constants[declaration[3]]) {
                const address = parseInt(declaration[2], 16) & 0xFFFF;
                for (const { name, symbol } of byMember.get(declaration[1]) || []) {
                    if ((symbol.address & 0xFFFF) === address) explicit.set(name, declaration[3]);
                }
            }
            const code = line.replace(/\/\/.*$/, '');
            for (const m of code.matchAll(PAIR)) {
                vote(m[1], m[2]);
                vote(m[2], m[1]);
            }
        }
    }
    const types = new Map(explicit);
    for (const [memory, counts] of votes) {
        if (types.has(memory)) continue;
        const best = [...counts].sort((a, b) => b[1] - a[1])[0];
        if (best) types.set(memory, best[0]);
    }
    return types;
}

/** ENUM.MEMBER names of a value (several members can share one), or []. */
function constantNames(constants, enumName, value) {
    const members = constants[enumName];
    if (!members) return [];
    return Object.keys(members).filter(member => members[member] === value).map(member => enumName + '.' + member);
}

/** The value of an ENUM.MEMBER constant, or undefined. */
function constantValue(constants, name) {
    const [enumName, member] = name.split('.');
    return isConstant(constants, name) ? constants[enumName][member] : undefined;
}

module.exports = { inferTypes, constantNames, constantValue };
