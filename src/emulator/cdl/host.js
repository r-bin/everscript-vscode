'use strict';

/**
 * emulator/cdl/host.js
 *
 * Extension-host side of the CDL recorder: owns the per-ROM library, merges
 * the deltas the webview drains from the core, flushes to disk in batches
 * (never per instruction or per frame), and runs exports / lookups.
 *
 * Messages (webview -> host): cdlEnable, cdlDelta, cdlDisabled, cdlExport, cdlLookup
 * Messages (host -> webview): cdlConfig, cdlSeed, cdlStatus, cdlLookupResult
 */

const vscode = require('vscode');
const path = require('path');
const { CdlLibrary } = require('./library');
const { createRomMap } = require('./rom-map');
const { buildIndex } = require('./xref-index');
const { exportAsar } = require('./asar-export');
const { exportWram } = require('./wram-export');
const { lookup } = require('./lookup');

const FLUSH_DELAY_MS = 2000;

const b64ToBytes = s => (s ? new Uint8Array(Buffer.from(s, 'base64')) : null);
const b64ToWords = s => {
    if (!s) return null;
    const buf = Buffer.from(s, 'base64');
    const out = new Uint32Array(buf.length >> 2);
    for (let i = 0; i < out.length; i++) out[i] = buf.readUInt32LE(i * 4);
    return out;
};

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
    }

    /** A ROM started in the emulator: forget the old library, tell the webview the default. */
    romStarted(rom) {
        this.flushNow();
        this.rom = rom;
        this.lib = null;
        this.indexCache = null;
        const enabled = vscode.workspace.getConfiguration('everscript').get('cdl.enabled', false);
        this.post({ command: 'cdlConfig', autoEnable: !!enabled });
    }

    _library() {
        if (this.lib || !this.rom) return this.lib;
        const body = this.rom.length % 1024 === 512 ? this.rom.subarray(512) : this.rom;
        const map = createRomMap(body);
        this.lib = new CdlLibrary(this.root, this.rom, {
            title: map.header ? map.header.title : '',
            mapType: map.type,
        });
        this.log(`CDL library: ${this.lib.dir}`);
        return this.lib;
    }

    _status(extra) {
        if (!this.lib) return;
        const s = this.lib.summary();
        this.post({ command: 'cdlStatus', summary: s, dir: this.lib.dir, text: extra || '' });
    }

    _index() {
        if (!this.indexCache) {
            const body = this.rom.length % 1024 === 512 ? this.rom.subarray(512) : this.rom;
            const map = createRomMap(body);
            this.indexCache = { map, index: buildIndex(this.lib, map) };
        }
        return this.indexCache;
    }

    scheduleFlush() {
        if (this.flushTimer) return;
        this.flushTimer = setTimeout(() => { this.flushTimer = null; this.flushNow(); }, FLUSH_DELAY_MS);
    }

    flushNow() {
        if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
        if (!this.lib || !this.lib.dirty.size) return;
        try {
            const written = this.lib.flush();
            if (written.length) this.log(`CDL flushed: ${written.join(', ')}`);
        } catch (err) {
            this.log('CDL flush failed: ' + err.message, true);
        }
    }

    /** @returns {boolean} whether the message was a CDL message */
    handle(msg) {
        switch (msg.command) {
            case 'cdlEnable': {
                const lib = this._library();
                if (!lib) { this.post({ command: 'cdlStatus', text: 'no ROM loaded' }); return true; }
                const { map } = this._index();
                const labels = [];
                for (let off = 0; off < lib.romSize; off += 0x10000) labels.push((map.canonical(off) >>> 16).toString(16).toUpperCase());
                this.post({
                    command: 'cdlSeed',
                    labels,
                    cdl: Buffer.from(lib.cdl).toString('base64'),
                    ext: Buffer.from(lib.ext).toString('base64'),
                });
                this._status('recording');
                return true;
            }
            case 'cdlDelta': {
                const lib = this._library();
                if (!lib || !msg.delta) return true;
                const d = msg.delta;
                const changed = lib.applyDelta({
                    chunks: (d.chunks || []).map(c => ({ index: c.index, cdl: b64ToBytes(c.cdl), ext: b64ToBytes(c.ext) })),
                    wvals: (d.wvals || []).map(w => ({ index: w.index, data: b64ToBytes(w.data) })),
                    xrefs: b64ToWords(d.xrefs),
                    edges: b64ToWords(d.edges),
                    stats: b64ToWords(d.stats),
                });
                if (changed) { this.indexCache = null; this.scheduleFlush(); }
                this._status();
                return true;
            }
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
                const { index, map } = this._index();
                this.post({ command: 'cdlLookupResult', lines: lookup(lib, index, map, msg.query) });
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
                const r = exportWram(lib, this.rom, outDir);
                file = r.file;
                text = `ram.asm: ${r.addresses} WRAM addresses, ${r.enums} enum candidates`;
            } else {
                const r = exportAsar(lib, this.rom, outDir);
                file = r.mainPath;
                text = `Asar export: ${r.banks} banks, ${r.functions} functions, ${r.codeLines} instructions`;
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

module.exports = { CdlHost };
