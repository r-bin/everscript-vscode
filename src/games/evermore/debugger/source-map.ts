/**
 * debugger/source-map.ts
 *
 * Reads the compiler's out/source_map.json (everscript repo,
 * compiler/source_map.py): ROM offset <-> .evs file:line for every compiled
 * script statement.
 *
 * One .evs line compiles to one or more script instructions, and a function
 * without @install is inlined at every call. An address therefore has a chain
 * of locations, outermost first: [the statement of the compiled function, the
 * statement of the inlined callee, ...]. A "level" says how deep into that
 * chain a stop is presented: stepping into an inlined call goes one level
 * deeper without running anything.
 *
 * A block passed to a call (conversation({ ... })) is a lambda: inlined
 * through the callee, so its lines sit one level below the callee's line that
 * runs it (callback();), like any inlined function.
 *
 * Addresses are ROM offsets (SNES address & 0x3FFFFF). Pure: no VS Code API.
 */

import * as fs from 'fs';
import * as path from 'path';

const SOURCE_MAP_NAME = path.join('out', 'source_map.json');

import { hiromFileOffset as romOffset } from '../../../platform';
import type { Constants } from './value-types';

/** A compiled function in out/source_map.json. */
interface MapFunction { address: number; size: number; file?: number; line: number; endLine?: number; name: string }
/** One compiled statement; `callers` are the inlining call sites, innermost first. */
interface MapStatement { address: number; function: string; file: number; line: number; callers?: { function: string; file: number; line: number }[] }
interface MapSymbol { name: string; address: number; size: number; flag?: number }
/** The parsed out/source_map.json. */
interface SourceMapJson { version: number; files: string[]; functions: MapFunction[]; statements: MapStatement[]; symbols?: MapSymbol[]; constants?: Constants }
/** One source location of a chain. */
interface Loc { function: string; file: string; line: number }
interface LineStart { address: number; level: number }

function sameLocation(a: Partial<Loc> | null | undefined, b: Partial<Loc> | null | undefined): boolean {
    return !!a && !!b && a.line === b.line && a.file === b.file && a.function === b.function;
}

/** Index of the last element of `sorted` whose .address is <= address, or -1. */
function lastAtOrBelow(sorted: { address: number }[], address: number): number {
    let lo = 0, hi = sorted.length - 1, found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid].address <= address) { found = mid; lo = mid + 1; }
        else hi = mid - 1;
    }
    return found;
}

class SourceMap {
    path: string;
    files: string[];
    functions: MapFunction[];
    statements: MapStatement[];
    /** Named memory (MEMORY.X, FLAG.X ...): { name, address (WRAM offset), size, flag? }. */
    symbols: Map<string, MapSymbol>;
    /** { ENUM: { MEMBER: value } } */
    constants: Constants;
    /** symbol name -> enum it holds (value-types.ts, filled by the session). */
    types = new Map<string, string>();
    mtimeMs?: number;
    private _chains: Loc[][];
    private _functionOf: (MapFunction | null)[];
    private _lines: Map<string, Map<number, LineStart[]>>;

    /**
     * @param json    parsed out/source_map.json
     * @param mapPath where it was read from (for reload checks)
     */
    constructor(json: SourceMapJson, mapPath: string) {
        if (!json || json.version !== 1) throw new Error('unsupported source map version');
        this.path = mapPath || '';
        this.files = json.files.map((file: string) => path.normalize(file));
        this.functions = json.functions.slice().sort((a, b) => a.address - b.address);
        this.statements = json.statements.slice().sort((a, b) => a.address - b.address);
        this._chains = this.statements.map(statement => this._chain(statement));
        this._functionOf = this.statements.map(statement => this.functionAt(statement.address));
        this._lines = this._indexLines();
        this.symbols = new Map((json.symbols || []).map((symbol): [string, MapSymbol] => [symbol.name, symbol]));
        this.constants = json.constants || {};
    }

    _chain(statement: MapStatement): Loc[] {
        const chain: Loc[] = (statement.callers || []).slice().reverse().map(caller => ({
            function: caller.function, file: this.files[caller.file], line: caller.line,
        }));
        chain.push({ function: statement.function, file: this.files[statement.file], line: statement.line });
        return chain;
    }

    /**
     * file -> line -> [{ address, level }]: where execution of that line starts.
     * A line starts at an address when the statement before it (in the same
     * compiled function) has a different location at that level.
     */
    _indexLines() {
        const lines = new Map<string, Map<number, LineStart[]>>();
        for (let i = 0; i < this.statements.length; i++) {
            const chain = this._chains[i];
            const fn = this._functionOf[i];
            const prev = i > 0 && this._functionOf[i - 1] === fn ? this._chains[i - 1] : null;
            let continuing = !!prev;
            for (let level = 0; level < chain.length; level++) {
                continuing = continuing && !!prev && level < prev.length && sameLocation(prev[level], chain[level]);
                if (continuing) continue;
                const { file, line } = chain[level];
                if (!lines.has(file)) lines.set(file, new Map());
                const byLine = lines.get(file)!;
                if (!byLine.has(line)) byLine.set(line, []);
                byLine.get(line)!.push({ address: this.statements[i].address, level });
            }
        }
        return lines;
    }

    /** Merged [start, end) ranges of the statements of i's function that pass `keep`. */
    _ranges(i: number, keep: (j: number) => boolean): [number, number][] {
        const fn = this._functionOf[i]!;
        const ranges: [number, number][] = [];
        for (let j = 0; j < this.statements.length; j++) {
            if (this._functionOf[j] !== fn || !keep(j)) continue;
            const start = this.statements[j].address;
            const next = j + 1 < this.statements.length && this._functionOf[j + 1] === fn
                ? this.statements[j + 1].address
                : fn.address + fn.size;
            const last = ranges[ranges.length - 1];
            if (last && last[1] === start) last[1] = next;
            else ranges.push([start, next]);
        }
        return ranges;
    }

    /** The compiled function containing a ROM offset, or null. */
    functionAt(offset: number): MapFunction | null {
        const i = lastAtOrBelow(this.functions, offset);
        const fn = i >= 0 ? this.functions[i] : null;
        return fn && offset < fn.address + fn.size ? fn : null;
    }

    /** Index of the statement executing at a ROM offset (the last one starting at or before it). */
    statementIndexAt(offset: number): number {
        const fn = this.functionAt(offset);
        if (!fn) return -1;
        const i = lastAtOrBelow(this.statements, offset);
        return i >= 0 && this.statements[i].address >= fn.address ? i : -1;
    }

    /** Locations at a ROM offset, outermost first, or null outside compiled code. */
    chainAt(offset: number): Loc[] | null {
        const i = this.statementIndexAt(offset);
        return i >= 0 ? this._chains[i] : null;
    }

    /**
     * The level a stop at `offset` is shown at: the shallowest location that
     * starts there (an inlined call shows its call site, not the callee's
     * first line).
     */
    entryLevel(offset: number): number {
        const i = this.statementIndexAt(offset);
        if (i < 0) return 0;
        const chain = this._chains[i];
        if (this.statements[i].address !== offset) return 0;
        const prev = i > 0 && this._functionOf[i - 1] === this._functionOf[i] ? this._chains[i - 1] : null;
        if (!prev) return 0;
        for (let level = 0; level < chain.length; level++) {
            if (level >= prev.length || !sameLocation(prev[level], chain[level])) return level;
        }
        return chain.length - 1;
    }

    /**
     * Address ranges [start, end) still "on" the location at `level` of the
     * statement at `offset`: stepping over it runs until execution leaves them.
     */
    rangesAt(offset: number, level: number): [number, number][] {
        const i = this.statementIndexAt(offset);
        if (i < 0) return [];
        const prefix = this._chains[i].slice(0, level + 1);
        return this._ranges(i, j => {
            const chain = this._chains[j];
            return chain.length >= prefix.length && prefix.every((loc, k) => sameLocation(loc, chain[k]));
        });
    }

    /** Where execution of file:line starts: [{ address, level }]. */
    locationsAt(file: string, line: number): LineStart[] {
        const byLine = this._lines.get(path.normalize(file));
        return (byLine && byLine.get(line)) || [];
    }

    /** Lines of a file that have code, ascending. */
    linesWithCode(file: string): number[] {
        const byLine = this._lines.get(path.normalize(file));
        return byLine ? [...byLine.keys()].sort((a, b) => a - b) : [];
    }

    /** The compiled or inlined function whose body contains file:line (by fun ... } lines). */
    functionSpan(file: string, line: number) {
        const normalized = path.normalize(file);
        let best: MapFunction | null = null;
        for (const fn of this.functions) {
            if (fn.file === undefined || this.files[fn.file] !== normalized) continue;
            if (line < fn.line || line > (fn.endLine || fn.line)) continue;
            if (!best || fn.line > best.line) best = fn;
        }
        return best ? { start: best.line, end: best.endLine || best.line } : null;
    }
}

/** Parse a source map file. Throws when missing or malformed. */
function loadSourceMap(mapPath: string): SourceMap {
    const json = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    const map = new SourceMap(json, mapPath);
    map.mtimeMs = fs.statSync(mapPath).mtimeMs;
    return map;
}

/** True when the file on disk changed since `map` was read. */
function isStale(map: SourceMap): boolean {
    try {
        return fs.statSync(map.path).mtimeMs !== map.mtimeMs;
    } catch (_) {
        return false;
    }
}

/**
 * Locate out/source_map.json: an explicit path, the compiler repo, or the
 * first `out/` found walking up from the debugged .evs file.
 */
function findSourceMap({ sourceMap, repoPath, program }: { sourceMap?: string; repoPath?: string; program?: string } = {}): string | null {
    if (sourceMap) return fs.existsSync(sourceMap) ? sourceMap : null;
    const candidates: string[] = [];
    if (repoPath) candidates.push(path.join(repoPath, SOURCE_MAP_NAME));
    if (program) {
        let dir = path.dirname(program);
        for (let depth = 0; depth < 8; depth++) {
            candidates.push(path.join(dir, SOURCE_MAP_NAME));
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }
    }
    return candidates.find(candidate => fs.existsSync(candidate)) || null;
}

export type { MapFunction, MapStatement, MapSymbol, SourceMapJson, Loc };
export { SourceMap, loadSourceMap, isStale, findSourceMap, romOffset, sameLocation };
