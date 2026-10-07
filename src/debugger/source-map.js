'use strict';

/**
 * debugger/source-map.js
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
 * Addresses are ROM offsets (SNES address & 0x3FFFFF). Pure: no VS Code API.
 */

const fs   = require('fs');
const path = require('path');

const SOURCE_MAP_NAME = path.join('out', 'source_map.json');

function romOffset(snesAddress) {
    return (snesAddress & 0x3FFFFF) >>> 0;
}

function sameLocation(a, b) {
    return !!a && !!b && a.line === b.line && a.file === b.file && a.function === b.function;
}

/** Index of the last element of `sorted` whose .address is <= address, or -1. */
function lastAtOrBelow(sorted, address) {
    let lo = 0, hi = sorted.length - 1, found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid].address <= address) { found = mid; lo = mid + 1; }
        else hi = mid - 1;
    }
    return found;
}

class SourceMap {
    /**
     * @param {object} json    parsed out/source_map.json
     * @param {string} mapPath where it was read from (for reload checks)
     */
    constructor(json, mapPath) {
        if (!json || json.version !== 1) throw new Error('unsupported source map version');
        this.path = mapPath || '';
        this.files = json.files.map(file => path.normalize(file));
        this.functions = json.functions.slice().sort((a, b) => a.address - b.address);
        this.statements = json.statements.slice().sort((a, b) => a.address - b.address);
        this._chains = this.statements.map(statement => this._chain(statement));
        this._functionOf = this.statements.map(statement => this.functionAt(statement.address));
        this._lines = this._indexLines();
        // Named memory (MEMORY.X, FLAG.X ...): { name, address (WRAM offset), size, flag? }
        this.symbols = new Map((json.symbols || []).map(symbol => [symbol.name, symbol]));
    }

    _chain(statement) {
        const chain = (statement.callers || []).slice().reverse().map(caller => ({
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
        const lines = new Map();
        for (let i = 0; i < this.statements.length; i++) {
            const chain = this._chains[i];
            const fn = this._functionOf[i];
            const prev = i > 0 && this._functionOf[i - 1] === fn ? this._chains[i - 1] : null;
            let continuing = !!prev;
            for (let level = 0; level < chain.length; level++) {
                continuing = continuing && level < prev.length && sameLocation(prev[level], chain[level]);
                if (continuing) continue;
                const { file, line } = chain[level];
                if (!lines.has(file)) lines.set(file, new Map());
                const byLine = lines.get(file);
                if (!byLine.has(line)) byLine.set(line, []);
                byLine.get(line).push({ address: this.statements[i].address, level });
            }
        }
        return lines;
    }

    /** The compiled function containing a ROM offset, or null. */
    functionAt(offset) {
        const i = lastAtOrBelow(this.functions, offset);
        const fn = i >= 0 ? this.functions[i] : null;
        return fn && offset < fn.address + fn.size ? fn : null;
    }

    /** Index of the statement executing at a ROM offset (the last one starting at or before it). */
    statementIndexAt(offset) {
        const fn = this.functionAt(offset);
        if (!fn) return -1;
        const i = lastAtOrBelow(this.statements, offset);
        return i >= 0 && this.statements[i].address >= fn.address ? i : -1;
    }

    /** Locations at a ROM offset, outermost first, or null outside compiled code. */
    chainAt(offset) {
        const i = this.statementIndexAt(offset);
        return i >= 0 ? this._chains[i] : null;
    }

    /**
     * The level a stop at `offset` is shown at: the shallowest location that
     * starts there (an inlined call shows its call site, not the callee's
     * first line).
     */
    entryLevel(offset) {
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
    rangesAt(offset, level) {
        const i = this.statementIndexAt(offset);
        if (i < 0) return [];
        const fn = this._functionOf[i];
        const prefix = this._chains[i].slice(0, level + 1);
        const ranges = [];
        for (let j = 0; j < this.statements.length; j++) {
            if (this._functionOf[j] !== fn) continue;
            const chain = this._chains[j];
            if (chain.length < prefix.length || !prefix.every((loc, k) => sameLocation(loc, chain[k]))) continue;
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

    /** Where execution of file:line starts: [{ address, level }]. */
    locationsAt(file, line) {
        const byLine = this._lines.get(path.normalize(file));
        return (byLine && byLine.get(line)) || [];
    }

    /** Lines of a file that have code, ascending. */
    linesWithCode(file) {
        const byLine = this._lines.get(path.normalize(file));
        return byLine ? [...byLine.keys()].sort((a, b) => a - b) : [];
    }

    /** The compiled or inlined function whose body contains file:line (by fun ... } lines). */
    functionSpan(file, line) {
        const normalized = path.normalize(file);
        let best = null;
        for (const fn of this.functions) {
            if (fn.file === undefined || this.files[fn.file] !== normalized) continue;
            if (line < fn.line || line > (fn.endLine || fn.line)) continue;
            if (!best || fn.line > best.line) best = fn;
        }
        return best ? { start: best.line, end: best.endLine || best.line } : null;
    }
}

/** Parse a source map file. Throws when missing or malformed. */
function loadSourceMap(mapPath) {
    const json = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    const map = new SourceMap(json, mapPath);
    map.mtimeMs = fs.statSync(mapPath).mtimeMs;
    return map;
}

/** True when the file on disk changed since `map` was read. */
function isStale(map) {
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
function findSourceMap({ sourceMap, repoPath, program } = {}) {
    if (sourceMap) return fs.existsSync(sourceMap) ? sourceMap : null;
    const candidates = [];
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

module.exports = { SourceMap, loadSourceMap, isStale, findSourceMap, romOffset, sameLocation };
