'use strict';

/**
 * emulator/cdl/host.js
 *
 * Extension-host side of the CDL recorder: owns the per-ROM library, merges
 * the deltas the webview drains from the core, and writes to disk only when
 * something changed: IDLE_FLUSH_MS after the last change, at least every
 * MAX_FLUSH_MS while changes keep coming, and at once on pause / stop / ROM
 * change / panel close. Also runs exports and lookups.
 *
 * Messages (webview -> host): cdlEnable, cdlDelta, cdlPause, cdlDisabled,
 *   cdlRequestSnapshot, cdlExport, cdlLookup
 * Messages (host -> webview): cdlConfig, cdlSeed, cdlSnapshot, cdlStatus, cdlLookupResult
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { CdlLibrary, romHash, stripCopierHeader } = require('./library');
const { createRomMap, hex } = require('./rom-map');
const { buildIndex } = require('./xref-index');
const { exportAsar } = require('./asar-export');
const { exportWram } = require('./wram-export');
const { lookup } = require('./lookup');
const { findTables } = require('./tables');
const { getActiveAddressLookup } = require('../address-lookup');

const IDLE_FLUSH_MS = 60 * 1000;
const MAX_FLUSH_MS = 5 * 60 * 1000;
// lda [$82] / inc $82 / and #$00FF / asl / tax / jsr ($xxxx,x): the script interpreter's opcode fetch
const SCRIPT_FETCH_PATTERN = Buffer.from([0xA7, 0x82, 0xE6, 0x82, 0x29, 0xFF, 0x00, 0x0A, 0xAA, 0xFC]);
const SCRIPT_POINTER_WRAM = 0x82;

const b64ToBytes = s => (s ? new Uint8Array(Buffer.from(s, 'base64')) : null);
const b64ToWords = s => {
    if (!s) return null;
    const buf = Buffer.from(s, 'base64');
    const out = new Uint32Array(buf.length >> 2);
    for (let i = 0; i < out.length; i++) out[i] = buf.readUInt32LE(i * 4);
    return out;
};

/** "0000-01FF" -> [0, 0x1FF] (WRAM offsets; a $7E/$7F bank prefix is accepted). */
function parseRanges(list) {
    const out = [];
    for (const item of list || []) {
        const m = /^\s*\$?([0-9a-f]{1,6})\s*-\s*\$?([0-9a-f]{1,6})\s*$/i.exec(String(item));
        if (!m) continue;
        const lo = parseInt(m[1], 16) & 0x1FFFF, hi = parseInt(m[2], 16) & 0x1FFFF;
        if (lo <= hi) out.push([lo, hi]);
    }
    return out;
}

function findScriptContext(rom) {
    const body = Buffer.from(stripCopierHeader(rom));
    const off = body.indexOf(SCRIPT_FETCH_PATTERN);
    return off >= 0 ? { fetchRomOff: off, ptr: SCRIPT_POINTER_WRAM } : null;
}

class CdlHost {
    /**
     * @param {string} storageDir  extension global storage path
     * @param {(msg: object) => void} post  sends to the webview
     * @param {(line: string, show?: boolean) => void} log
     */
    constructor(storageDir, post, log) {
        this.root = path.join(storageDir, 'cdl-library');
        this.post = post;
        this.log = log;
        this.rom = null;
        this.lib = null;
        this.indexCache = null;
        this.flushTimer = null;
        this.firstUnflushed = 0;
        this.describeScript = null;
    }

    _config() { return vscode.workspace.getConfiguration('everscript'); }

    /** A ROM started in the emulator: save the old library, tell the webview the default. */
    romStarted(rom) {
        this.flushNow();
        this.rom = rom;
        this.lib = null;
        this.indexCache = null;
        this.describeScript = null;
        this.post({ command: 'cdlConfig', autoEnable: !!this._config().get('cdl.enabled', false) });
    }

    _body() { return stripCopierHeader(this.rom); }

    _library() {
        if (this.lib || !this.rom) return this.lib;
        const map = createRomMap(this._body());
        this.lib = new CdlLibrary(this.root, this.rom, { title: map.header ? map.header.title : '', mapType: map.type });
        this.log(`CDL library: ${this.lib.dir}`);
        return this.lib;
    }

    _labels() {
        const map = createRomMap(this._body());
        const labels = [];
        for (let off = 0; off < map.size; off += 0x10000) labels.push(hex(map.canonical(off) >>> 16, 2));
        return labels;
    }

    _scriptNamer() {
        if (this.describeScript) return this.describeScript;
        let starts = [];
        let table = null;
        try {
            table = getActiveAddressLookup(this._body(), null);
            starts = [...table.lookupMap.keys()].sort((a, b) => a - b);
        } catch (_) { /* no names: plain addresses */ }
        this.describeScript = addr => {
            let lo = 0, hi = starts.length - 1, best = -1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (starts[mid] <= addr) { best = starts[mid]; lo = mid + 1; } else hi = mid - 1;
            }
            const plain = '$' + hex(addr, 6);
            if (best < 0 || addr - best > 0x800 || (best >>> 16) !== (addr >>> 16)) return plain;
            const info = table.lookupMap.get(best);
            return plain + ' (' + info.name + (addr !== best ? ' +$' + hex(addr - best, 2) : '') + ')';
        };
        return this.describeScript;
    }

    _status(extra) {
        if (!this.lib) return;
        this.post({ command: 'cdlStatus', summary: this.lib.summary(), dir: this.lib.dir, text: extra || '' });
    }

    _index() {
        if (!this.indexCache) {
            const map = createRomMap(this._body());
            const index = buildIndex(this.lib, map);
            this.indexCache = { map, index, tables: findTables(this.lib, this._body(), map, index) };
        }
        return this.indexCache;
    }

    _scheduleFlush() {
        const now = Date.now();
        if (!this.firstUnflushed) this.firstUnflushed = now;
        if (this.flushTimer) clearTimeout(this.flushTimer);
        const wait = Math.max(0, Math.min(IDLE_FLUSH_MS, this.firstUnflushed + MAX_FLUSH_MS - now));
        this.flushTimer = setTimeout(() => { this.flushTimer = null; this.flushNow(); }, wait);
    }

    flushNow() {
        if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
        this.firstUnflushed = 0;
        if (!this.lib || !this.lib.dirty.size) return;
        try {
            const written = this.lib.flush();
            if (written.length) this.log(`CDL flushed: ${written.join(', ')}`);
        } catch (err) {
            this.log('CDL flush failed: ' + err.message, true);
        }
    }

    _seed() {
        const lib = this._library();
        if (!lib) { this.post({ command: 'cdlStatus', text: 'no ROM loaded' }); return; }
        const ctx = findScriptContext(this.rom);
        const excludes = parseRanges(this._config().get('cdl.scriptExcludes', ['0000-01FF', '2834-2FFF']));
        this.post({
            command: 'cdlSeed',
            labels: this._labels(),
            cdl: Buffer.from(lib.cdl).toString('base64'),
            ext: Buffer.from(lib.ext).toString('base64'),
            wflags: Buffer.from(lib.wflags).toString('base64'),
            scriptContext: ctx ? { fetchRomOff: ctx.fetchRomOff, ptr: ctx.ptr, excludes } : null,
        });
        if (ctx) this.log(`CDL script attribution: interpreter fetch at ROM $${hex(ctx.fetchRomOff, 6)}`);
        this._status('recording');
    }

    /** The last flushed state, for the tab while not recording. Never creates files. */
    _snapshot() {
        if (!this.rom) return;
        const dir = path.join(this.root, romHash(this.rom));
        if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
            this.post({ command: 'cdlSnapshot', empty: true });
            return;
        }
        const lib = this._library();
        this.post({
            command: 'cdlSnapshot',
            labels: this._labels(),
            cdl: Buffer.from(lib.cdl).toString('base64'),
            ext: Buffer.from(lib.ext).toString('base64'),
            wflags: Buffer.from(lib.wflags).toString('base64'),
            summary: lib.summary(),
            updated: lib.manifest ? lib.manifest.updated : '',
        });
    }

    /** @returns {boolean} whether the message was a CDL message */
    handle(msg) {
        switch (msg.command) {
            case 'cdlEnable':
                this._seed();
                return true;
            case 'cdlRequestSnapshot':
                this._snapshot();
                return true;
            case 'cdlDelta': {
                const lib = this._library();
                if (!lib || !msg.delta) return true;
                const d = msg.delta;
                const changed = lib.applyDelta({
                    chunks: (d.chunks || []).map(c => ({ index: c.index, cdl: b64ToBytes(c.cdl), ext: b64ToBytes(c.ext) })),
                    wvals: (d.wvals || []).map(w => ({ index: w.index, data: b64ToBytes(w.data) })),
                    wflags: (d.wflags || []).map(w => ({ index: w.index, data: b64ToBytes(w.data) })),
                    xrefs: b64ToWords(d.xrefs),
                    edges: b64ToWords(d.edges),
                    stats: b64ToWords(d.stats),
                    scriptXrefs: b64ToWords(d.scriptXrefs),
                    romHits: b64ToWords(d.romHits),
                    wramHits: b64ToWords(d.wramHits),
                    rets: b64ToWords(d.rets),
                    regs: b64ToWords(d.regs),
                    bases: b64ToWords(d.bases),
                    wcode: (d.wcode || []).map(c => ({ index: c.index, code: b64ToBytes(c.code), state: b64ToBytes(c.state) })),
                    aram: (d.aram || []).map(a => ({ index: a.index, data: b64ToBytes(a.data) })),
                });
                if (d.dropped && d.dropped !== this.droppedWarned) {
                    this.droppedWarned = d.dropped;
                    this.log(`CDL: ${d.dropped} records dropped this session because a recorder table is full`, true);
                }
                if (changed) {
                    this.indexCache = null;
                    this._scheduleFlush();
                    this._status();
                }
                return true;
            }
            case 'cdlPause':
                this.flushNow();
                return true;
            case 'cdlDisabled':
                this.flushNow();
                this._status('stopped');
                return true;
            case 'cdlExport':
                this._export(msg.kind);
                return true;
            case 'cdlLookup': {
                const lib = this._library();
                if (!lib) return true;
                const { index, map, tables } = this._index();
                this.post({ command: 'cdlLookupResult', lines: lookup(lib, index, map, msg.query, { describeScript: this._scriptNamer(), tables }) });
                return true;
            }
            default:
                return false;
        }
    }

    async _export(kind) {
        const lib = this._library();
        if (!lib) return;
        this.flushNow();
        const outDir = path.join(lib.dir, 'asar');
        try {
            const t0 = Date.now();
            let file, text;
            if (kind === 'wram') {
                const r = exportWram(lib, this.rom, outDir, { describeScript: this._scriptNamer() });
                file = r.file;
                text = `ram.asm: ${r.addresses} WRAM addresses, ${r.enums} enum candidates`;
            } else {
                const r = exportAsar(lib, this.rom, outDir);
                file = r.mainPath;
                text = `Asar export: ${r.banks} banks, ${r.functions} functions, ${r.codeLines} instructions, ${r.tables} lookup tables`;
            }
            text += ` (${Date.now() - t0} ms)`;
            this.log(text + ' -> ' + outDir);
            this._status(text);
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
            await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.One });
            const pick = await vscode.window.showInformationMessage(text, 'Reveal Folder');
            if (pick) vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(file));
        } catch (err) {
            this.log('CDL export failed: ' + (err.stack || err.message), true);
            this.post({ command: 'cdlStatus', text: 'export failed: ' + err.message });
        }
    }

    dispose() { this.flushNow(); }
}

module.exports = { CdlHost, findScriptContext, parseRanges };
