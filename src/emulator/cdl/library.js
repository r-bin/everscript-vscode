'use strict';

/**
 * emulator/cdl/library.js
 *
 * Per-ROM CDL library: <root>/<sha1>/ outside the workspace. Every stored
 * field merges with a commutative, associative, idempotent operation (OR,
 * min/max, set union), so sessions, players and re-imports can be merged in
 * any order without double counting (docs/tracing-disassembler-and-asar-generation.md 9.3).
 * Exception: hit counts are summed. The core hands out each count once (drains
 * are deltas), so a library's counts are the total over every recorded session;
 * merging the same library twice would double them.
 *
 *   rom.cdl          1 byte / ROM byte (Mesen-S / BizHawk layout, importable)
 *   rom.ext          1 byte / ROM byte (opcode head, M/X seen, DMA, APU)
 *   wram-values.bin  256-bit values-seen bitmap per WRAM byte
 *   xrefs.bin        [pc, space<<24|addr, flags]           OR
 *   edges.bin        [from, to, kind]                     OR
 *   pcstats.bin      [space<<24|pc, count, lo, hi, flags] max / min / max / OR
 *   wram.flags       1 byte / WRAM byte (R / W / byte / word / exec / script / ptr)  OR
 *   script-xrefs.bin [script instruction, wram addr, flags]                       OR
 *   rom-hits.bin     [rom offset, hits lo, hits hi]  execs at opcode heads, reads at data   SUM
 *   wram-hits.bin    [wram addr, reads lo, reads hi, writes lo, writes hi]                 SUM
 *   rets / regs / bases / wram-code / aram: library-ext.js
 *
 * Newer files are optional: a library written before they existed still loads,
 * keeps all its data, and gains them on the next flush (wram.flags is derived
 * from the WRAM xrefs until a recording supplies the real map).
 *
 * No VS Code dependency: the host passes the root directory.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initExt, mergeExt, loadExt, extWriters, EXT_FILES } = require('./library-ext');

const FORMAT = 1;
const WRAM_SIZE = 0x20000;
const WVAL_BYTES = 32;
const TWO32 = 0x100000000;
const CHUNK = 0x10000;

/** ROM bytes without a 512-byte copier header. */
function stripCopierHeader(rom) {
    return (rom.length % 1024 === 512) ? rom.subarray(512) : rom;
}

function romHash(rom) {
    return crypto.createHash('sha1').update(stripCopierHeader(rom)).digest('hex');
}

const xrefKey  = (pc, spaceAddr) => pc * 0x4000000 + spaceAddr;
const edgeKey  = (from, to) => from * 0x1000000 + to;
const scriptKey = (script, addr) => script * 0x20000 + addr;
const WF = { READ: 1, WRITE: 2, BYTE: 4, WORD: 8, EXEC: 0x10, SCRIPT: 0x20, POINTER: 0x40 };

function readRecords(file, magic, words) {
    if (!fs.existsSync(file)) return null;
    const buf = fs.readFileSync(file);
    if (buf.length < 12 || buf.toString('ascii', 0, 4) !== magic) return null;
    const count = buf.readUInt32LE(8);
    const out = new Uint32Array(count * words);
    for (let i = 0; i < out.length; i++) out[i] = buf.readUInt32LE(12 + i * 4);
    return out;
}

function writeAtomic(file, data) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, file);
}

function packRecords(magic, rows, words) {
    const buf = Buffer.alloc(12 + rows.length * words * 4);
    buf.write(magic, 0, 'ascii');
    buf.writeUInt32LE(FORMAT, 4);
    buf.writeUInt32LE(rows.length, 8);
    let o = 12;
    for (const r of rows) for (let w = 0; w < words; w++) { buf.writeUInt32LE(r[w] >>> 0, o); o += 4; }
    return buf;
}

class CdlLibrary {
    /**
     * @param {string} root   library root (e.g. <globalStorage>/cdl-library)
     * @param {Uint8Array} rom ROM bytes (copier header allowed)
     * @param {object} [info]  { title, mapType } for the manifest
     */
    constructor(root, rom, info) {
        const body = stripCopierHeader(rom);
        this.hash = romHash(rom);
        this.dir = path.join(root, this.hash);
        this.romSize = body.length;
        this.info = info || {};
        this.cdl = new Uint8Array(this.romSize);
        this.ext = new Uint8Array(this.romSize);
        this.wvals = null;
        this.xrefs = new Map();
        this.edges = new Map();
        this.stats = new Map();
        this.wflags = new Uint8Array(WRAM_SIZE);
        this.scriptXrefs = new Map();
        this.romHits = new Float64Array(this.romSize);
        this.wramReads = new Float64Array(WRAM_SIZE);
        this.wramWrites = new Float64Array(WRAM_SIZE);
        this.hasHits = false;
        initExt(this);
        this.manifest = null;
        this.dirty = new Set();
        this.changes = 0;
        this._load();
    }

    _file(name) { return path.join(this.dir, name); }

    _touch(name) { this.dirty.add(name); this.changes++; }

    _load() {
        const manifestFile = this._file('manifest.json');
        if (fs.existsSync(manifestFile)) {
            try { this.manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch (_) { this.manifest = null; }
        }
        if (this.manifest && this.manifest.sha1 && this.manifest.sha1 !== this.hash) {
            throw new Error(`CDL library ${this.dir} belongs to ROM ${this.manifest.sha1}`);
        }
        for (const [name, arr] of [['rom.cdl', this.cdl], ['rom.ext', this.ext]]) {
            if (fs.existsSync(this._file(name))) arr.set(fs.readFileSync(this._file(name)).subarray(0, this.romSize));
        }
        if (fs.existsSync(this._file('wram-values.bin'))) {
            this.wvals = new Uint8Array(WRAM_SIZE * WVAL_BYTES);
            this.wvals.set(fs.readFileSync(this._file('wram-values.bin')).subarray(0, this.wvals.length));
        }
        this.mergeLists(
            readRecords(this._file('xrefs.bin'), 'EVXR', 3),
            readRecords(this._file('edges.bin'), 'EVED', 3),
            readRecords(this._file('pcstats.bin'), 'EVPS', 5),
        );
        this.mergeScriptXrefs(readRecords(this._file('script-xrefs.bin'), 'EVSX', 3));
        const rh = readRecords(this._file('rom-hits.bin'), 'EVRH', 3);
        if (rh) for (let i = 0; i + 2 < rh.length; i += 3) if (rh[i] < this.romSize) this.romHits[rh[i]] = rh[i + 1] + rh[i + 2] * TWO32;
        const wh = readRecords(this._file('wram-hits.bin'), 'EVWH', 5);
        if (wh) for (let i = 0; i + 4 < wh.length; i += 5) {
            if (wh[i] >= WRAM_SIZE) continue;
            this.wramReads[wh[i]] = wh[i + 1] + wh[i + 2] * TWO32;
            this.wramWrites[wh[i]] = wh[i + 3] + wh[i + 4] * TWO32;
        }
        this.hasHits = !!(rh || wh);
        loadExt(this, (name, magic, words) => readRecords(this._file(name), magic, words),
            name => (fs.existsSync(this._file(name)) ? new Uint8Array(fs.readFileSync(this._file(name))) : null));
        if (fs.existsSync(this._file('wram.flags'))) {
            this.wflags.set(fs.readFileSync(this._file('wram.flags')).subarray(0, WRAM_SIZE));
        } else {
            this._deriveWflags();
        }
        this.dirty.clear();
    }

    /** WRAM access map from the xrefs, for libraries recorded before wram.flags existed. */
    _deriveWflags() {
        for (const [key, flags] of this.xrefs) {
            const spaceAddr = key % 0x4000000;
            if ((spaceAddr >>> 24) !== 0) continue;
            const addr = spaceAddr & 0xFFFFFF;
            const f = (flags & 1 ? WF.READ : 0) | (flags & 2 ? WF.WRITE : 0) | (flags & 8 ? WF.WORD : WF.BYTE);
            this.wflags[addr] |= f;
            if ((flags & 8) && addr + 1 < WRAM_SIZE) this.wflags[addr + 1] |= f;
        }
        for (const [key] of this.scriptXrefs) this.wflags[key % 0x20000] |= WF.SCRIPT;
    }

    mergeWflags(index, data) {
        const base = index * data.length;
        for (let i = 0; i < data.length && base + i < WRAM_SIZE; i++) {
            const v = this.wflags[base + i] | data[i];
            if (v !== this.wflags[base + i]) { this.wflags[base + i] = v; this._touch('wram.flags'); }
        }
    }

    mergeScriptXrefs(list) {
        if (!list) return;
        for (let i = 0; i + 2 < list.length; i += 3) {
            const k = scriptKey(list[i], list[i + 1]);
            const old = this.scriptXrefs.get(k) || 0;
            if ((old | list[i + 2]) !== old) { this.scriptXrefs.set(k, old | list[i + 2]); this._touch('script-xrefs.bin'); }
        }
    }

    /** OR-merge a whole CDL/EXT image (e.g. an imported BizHawk / Mesen .cdl). */
    mergeImage(cdl, ext, offset) {
        const base = offset || 0;
        let changed = false;
        for (const [src, dst, name] of [[cdl, this.cdl, 'rom.cdl'], [ext, this.ext, 'rom.ext']]) {
            if (!src) continue;
            const n = Math.min(src.length, dst.length - base);
            for (let i = 0; i < n; i++) {
                const v = dst[base + i] | src[i];
                if (v !== dst[base + i]) { dst[base + i] = v; changed = true; this._touch(name); }
            }
        }
        return changed;
    }

    mergeWvals(index, data) {
        if (!this.wvals) this.wvals = new Uint8Array(WRAM_SIZE * WVAL_BYTES);
        const base = index * data.length;
        for (let i = 0; i < data.length && base + i < this.wvals.length; i++) {
            const v = this.wvals[base + i] | data[i];
            if (v !== this.wvals[base + i]) { this.wvals[base + i] = v; this._touch('wram-values.bin'); }
        }
    }

    mergeLists(xrefs, edges, stats) {
        if (xrefs) for (let i = 0; i + 2 < xrefs.length; i += 3) {
            const k = xrefKey(xrefs[i], xrefs[i + 1]);
            const old = this.xrefs.get(k) || 0;
            if ((old | xrefs[i + 2]) !== old) { this.xrefs.set(k, old | xrefs[i + 2]); this._touch('xrefs.bin'); }
        }
        if (edges) for (let i = 0; i + 2 < edges.length; i += 3) {
            const k = edgeKey(edges[i], edges[i + 1]);
            const old = this.edges.get(k) || 0;
            if ((old | edges[i + 2]) !== old) { this.edges.set(k, old | edges[i + 2]); this._touch('edges.bin'); }
        }
        if (stats) for (let i = 0; i + 4 < stats.length; i += 5) {
            const k = stats[i];
            const old = this.stats.get(k);
            const next = old
                ? { count: Math.max(old.count, stats[i + 1]), lo: Math.min(old.lo, stats[i + 2]), hi: Math.max(old.hi, stats[i + 3]), flags: old.flags | stats[i + 4] }
                : { count: stats[i + 1], lo: stats[i + 2], hi: stats[i + 3], flags: stats[i + 4] };
            if (!old || old.count !== next.count || old.lo !== next.lo || old.hi !== next.hi || old.flags !== next.flags) {
                this.stats.set(k, next);
                this._touch('pcstats.bin');
            }
        }
    }

    /** Add drained hit deltas: romHits [off, n], wramHits [addr, reads, writes]. */
    addHits(romHits, wramHits) {
        if (romHits && romHits.length) {
            for (let i = 0; i + 1 < romHits.length; i += 2) if (romHits[i] < this.romSize) this.romHits[romHits[i]] += romHits[i + 1];
            this._touch('rom-hits.bin');
            this.hasHits = true;
        }
        if (wramHits && wramHits.length) {
            for (let i = 0; i + 2 < wramHits.length; i += 3) {
                if (wramHits[i] >= WRAM_SIZE) continue;
                this.wramReads[wramHits[i]] += wramHits[i + 1];
                this.wramWrites[wramHits[i]] += wramHits[i + 2];
            }
            this._touch('wram-hits.bin');
            this.hasHits = true;
        }
    }

    /** Merge one drained delta from the webview recorder (see debugger-post.js cdlDrain). */
    applyDelta(delta) {
        const before = this.changes;
        for (const c of delta.chunks || []) this.mergeImage(c.cdl, c.ext, c.index * CHUNK);
        for (const w of delta.wvals || []) this.mergeWvals(w.index, w.data);
        for (const w of delta.wflags || []) this.mergeWflags(w.index, w.data);
        this.mergeLists(delta.xrefs, delta.edges, delta.stats);
        this.mergeScriptXrefs(delta.scriptXrefs);
        this.addHits(delta.romHits, delta.wramHits);
        mergeExt(this, delta, name => this._touch(name));
        return this.changes !== before;
    }

    /** Write changed files (atomic rename). Returns the names written. */
    flush() {
        const written = [];
        if (!this.dirty.size && this.manifest) return written;
        fs.mkdirSync(this.dir, { recursive: true });
        const xr = () => [...this.xrefs].map(([k, f]) => [Math.floor(k / 0x4000000), k % 0x4000000, f]);
        const ed = () => [...this.edges].map(([k, f]) => [Math.floor(k / 0x1000000), k % 0x1000000, f]);
        const st = () => [...this.stats].map(([k, s]) => [k, s.count, s.lo, s.hi, s.flags]);
        const writers = {
            'rom.cdl': () => this.cdl,
            'rom.ext': () => this.ext,
            'wram-values.bin': () => this.wvals,
            'xrefs.bin': () => packRecords('EVXR', xr(), 3),
            'edges.bin': () => packRecords('EVED', ed(), 3),
            'pcstats.bin': () => packRecords('EVPS', st(), 5),
            'wram.flags': () => this.wflags,
            'script-xrefs.bin': () => packRecords('EVSX',
                [...this.scriptXrefs].map(([k, f]) => [Math.floor(k / 0x20000), k % 0x20000, f]), 3),
            'rom-hits.bin': () => {
                const rows = [];
                for (let i = 0; i < this.romSize; i++) { const n = this.romHits[i]; if (n) rows.push([i, n % TWO32, Math.floor(n / TWO32)]); }
                return packRecords('EVRH', rows, 3);
            },
            'wram-hits.bin': () => {
                const rows = [];
                for (let i = 0; i < WRAM_SIZE; i++) {
                    const r = this.wramReads[i], w = this.wramWrites[i];
                    if (r || w) rows.push([i, r % TWO32, Math.floor(r / TWO32), w % TWO32, Math.floor(w / TWO32)]);
                }
                return packRecords('EVWH', rows, 5);
            },
            ...extWriters(this, packRecords),
        };
        for (const name of this.dirty) {
            const data = writers[name] && writers[name]();
            if (!data) continue;
            writeAtomic(this._file(name), data);
            written.push(name);
        }
        this.dirty.clear();
        const now = new Date().toISOString();
        this.manifest = Object.assign({ format: FORMAT, sha1: this.hash, created: now }, this.manifest || {}, {
            title: this.info.title || (this.manifest && this.manifest.title) || '',
            mapType: this.info.mapType || (this.manifest && this.manifest.mapType) || '',
            romSize: this.romSize,
            files: ['rom.cdl', 'rom.ext', 'wram-values.bin', 'xrefs.bin', 'edges.bin', 'pcstats.bin', 'wram.flags', 'script-xrefs.bin', 'rom-hits.bin', 'wram-hits.bin', ...EXT_FILES],
            updated: now,
        });
        writeAtomic(this._file('manifest.json'), JSON.stringify(this.manifest, null, 2));
        return written;
    }

    /** Coverage summary for the status line. */
    summary() {
        let code = 0, data = 0;
        for (let i = 0; i < this.romSize; i++) {
            if (this.cdl[i] & 1) code++;
            else if (this.cdl[i] & 2) data++;
        }
        let wram = 0;
        for (let i = 0; i < WRAM_SIZE; i++) if (this.wflags[i] & (WF.READ | WF.WRITE | WF.EXEC)) wram++;
        return { code, data, romSize: this.romSize, xrefs: this.xrefs.size, edges: this.edges.size, wram, scriptXrefs: this.scriptXrefs.size };
    }
}

module.exports = { CdlLibrary, romHash, stripCopierHeader, xrefKey, edgeKey, scriptKey, WF, WRAM_SIZE, WVAL_BYTES };
