/**
 * debugger/value-types.ts
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

import * as fs from 'fs';

/** { ENUM: { MEMBER: value } } from the source map. */
type Constants = Record<string, Record<string, number>>;
/** A memory symbol: where it is, its size, its flag bit if it is one. */
interface MemorySymbol { address: number; size?: number; flag?: number | null }

const DECLARATION = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(?:\((?:Byte|Word)\)\s*)?<\s*(0x[0-9a-fA-F]+)[^>]*>[^/]*\/\/.*@type\s+([A-Z][A-Z0-9_]*)/;
const PAIR = /\b([A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*)\s*(?:==|!=|<=|>=|=(?!=)|<|>)\s*([A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*)\b/g;

function isConstant(constants: Constants, name: string): boolean {
    const [enumName, member] = name.split('.');
    return !!(constants[enumName] && Object.prototype.hasOwnProperty.call(constants[enumName], member));
}

/** Symbol name -> enum name, from the .evs `files` (`read` gives a file's text; tests pass their own). */
function inferTypes(files: string[], symbols: Map<string, MemorySymbol>, constants: Constants, read?: (file: string) => string): Map<string, string> {
    const readFile = read || ((file: string) => { try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; } });
    const explicit = new Map<string, string>();
    const votes = new Map<string, Map<string, number>>();
    const byMember = new Map<string, { name: string; symbol: MemorySymbol }[]>();
    for (const [name, symbol] of symbols) {
        const member = name.split('.')[1];
        const list = byMember.get(member);
        if (list) list.push({ name, symbol }); else byMember.set(member, [{ name, symbol }]);
    }
    const vote = (memory: string, constant: string) => {
        if (!symbols.has(memory) || !isConstant(constants, constant)) return;
        const enumName = constant.split('.')[0];
        const counts = votes.get(memory) ?? new Map<string, number>();
        votes.set(memory, counts);
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
function constantNames(constants: Constants, enumName: string, value: number): string[] {
    const members = constants[enumName];
    if (!members) return [];
    return Object.keys(members).filter(member => members[member] === value).map(member => enumName + '.' + member);
}

/** The value of an ENUM.MEMBER constant, or undefined. */
function constantValue(constants: Constants, name: string): number | undefined {
    const [enumName, member] = name.split('.');
    return isConstant(constants, name) ? constants[enumName][member] : undefined;
}

export type { Constants, MemorySymbol };
export { inferTypes, constantNames, constantValue };
