/**
 * emulator/cdl/host.ts
 *
 * Extension-host side of the CDL recorder: owns the per-ROM library, merges
 * the deltas the webview drains from the core, and writes to disk only when
 * something changed: IDLE_FLUSH_MS after the last change, at least every
 * MAX_FLUSH_MS while changes keep coming, and at once on pause / stop / ROM
 * change / panel close. Also runs exports and lookups when the panel was given
 * the tools for them (tools.ts; the SNES CDL Recorder has none).
 *
 * Messages (webview -> host): cdlEnable, cdlDelta, cdlPause, cdlDisabled,
 *   cdlRequestSnapshot, cdlExport, cdlLookup
 * Messages (host -> webview): cdlConfig, cdlSeed, cdlSnapshot, cdlStatus, cdlLookupResult
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CdlLibrary, romHash, stripCopierHeader } from '../../../platform/cdl/library';
import { createRomMap, hex } from '../../../platform/cdl/rom-map';
import type { RomMap } from '../../../platform/cdl/rom-map';
import type { buildIndex } from '../../../platform/cdl/xref-index';
import type { Table } from '../../../platform/cdl/tables';

type Index = ReturnType<typeof buildIndex>;
type B64 = string | null | undefined;
type Chunk = { index: number; data: B64 };
/** What the game hands the panel for exports and lookups (src/games/evermore/cdl/tools.ts); absent in the recorder. */
interface CdlTools {
    scriptNamer(rom: Uint8Array): (address: number) => string;
    buildIndex(lib: CdlLibrary, map: RomMap): Index;
    findTables(lib: CdlLibrary, rom: Uint8Array, map: RomMap, index: Index): Table[];
    lookup(lib: CdlLibrary, index: Index, map: RomMap, query: string, opts: { describeScript: (address: number) => string; tables: Table[] }): string[];
    exportWram(lib: CdlLibrary, rom: Uint8Array, outDir: string, opts: { describeScript: (address: number) => string }): { file: string; addresses: number; enums: number };
    exportAsar(lib: CdlLibrary, rom: Uint8Array, outDir: string): { mainPath: string; banks: number; functions: number; codeLines: number; tables: number };
}
interface Wanted { get: () => boolean; set: (on: boolean) => void }
/** The delta the webview drains from the core; streams are base64 text. */
interface WireDelta {
    chunks?: { index: number; cdl: B64; ext: B64 }[]; wvals?: Chunk[]; wflags?: Chunk[];
    xrefs?: B64; edges?: B64; stats?: B64; scriptXrefs?: B64; romHits?: B64; wramHits?: B64; rets?: B64; regs?: B64; bases?: B64;
    wcode?: { index: number; code: B64; state: B64 }[]; aram?: Chunk[]; bus?: Chunk[]; busSites?: B64; romCycles?: B64;
    ioVals?: Chunk[]; sramFlags?: Chunk[]; wordRanges?: { set: number; index: number; data: B64 }[]; dropped?: number;
}
interface CdlMessage { command: string; delta?: WireDelta; kind?: string; query?: string }

const IDLE_FLUSH_MS = 60 * 1000;
const MAX_FLUSH_MS = 5 * 60 * 1000;
// lda [$82] / inc $82 / and #$00FF / asl / tax / jsr ($xxxx,x): the script interpreter's opcode fetch
const SCRIPT_FETCH_PATTERN = Buffer.from([0xA7, 0x82, 0xE6, 0x82, 0x29, 0xFF, 0x00, 0x0A, 0xAA, 0xFC]);
const SCRIPT_POINTER_WRAM = 0x82;

const b64ToBytes = (s: B64): Uint8Array | undefined => (s ? new Uint8Array(Buffer.from(s, 'base64')) : undefined);
/** Bytes of a stream that must be there (an empty stream when missing). */
const b64Bytes = (s: B64): Uint8Array => new Uint8Array(Buffer.from(s ?? '', 'base64'));
const b64ToWords = (s: B64): Uint32Array | undefined => {
    if (!s) return undefined;
    const buf = Buffer.from(s, 'base64');
    const out = new Uint32Array(buf.length >> 2);
    for (let i = 0; i < out.length; i++) out[i] = buf.readUInt32LE(i * 4);
    return out;
};

/** "0000-01FF" -> [0, 0x1FF] (WRAM offsets; a $7E/$7F bank prefix is accepted). */
function parseRanges(list: unknown): [number, number][] {
    const out: [number, number][] = [];
    for (const item of (list as unknown[] | null | undefined) || []) {
        const m = /^\s*\$?([0-9a-f]{1,6})\s*-\s*\$?([0-9a-f]{1,6})\s*$/i.exec(String(item));
        if (!m) continue;
        const lo = parseInt(m[1], 16) & 0x1FFFF, hi = parseInt(m[2], 16) & 0x1FFFF;
        if (lo <= hi) out.push([lo, hi]);
    }
    return out;
}

function findScriptContext(rom: Uint8Array): { fetchRomOff: number; ptr: number } | null {
    const body = Buffer.from(stripCopierHeader(rom));
    const off = body.indexOf(SCRIPT_FETCH_PATTERN);
    return off >= 0 ? { fetchRomOff: off, ptr: SCRIPT_POINTER_WRAM } : null;
}

class CdlHost {
    root: string;
    post: (msg: object) => void;
    log: (line: string, show?: boolean) => void;
    tools: CdlTools | null;
    wanted: Wanted;
    rom: Uint8Array | null = null;
    lib: CdlLibrary | null = null;
    indexCache: { map: RomMap; index: Index; tables: Table[] } | null = null;
    flushTimer: ReturnType<typeof setTimeout> | null = null;
    firstUnflushed = 0;
    describeScript: ((address: number) => string) | null = null;
    droppedWarned = 0;

    /**
     * @param {string} storageDir  extension global storage path
     * @param {(msg: object) => void} post  sends to the webview
     * @param {(line: string, show?: boolean) => void} log
     * @param {{ tools?: object, wanted?: { get: () => boolean, set: (on: boolean) => void } }} [opts]
     *   tools: exports and lookup (tools.ts), absent in the recorder;
     *   wanted: whether recording was on when the user last switched it (kept across sessions)
     */
    constructor(storageDir: string, post: (msg: object) => void, log: (line: string, show?: boolean) => void, opts?: { tools?: CdlTools | null; wanted?: Wanted }) {
        this.root = path.join(storageDir, 'cdl-library');
        this.post = post;
        this.log = log;
        this.tools = (opts && opts.tools) || null;
        this.wanted = (opts && opts.wanted) || { get: () => false, set: () => {} };
    }

    _config() { return vscode.workspace.getConfiguration('everscript'); }

    /** A ROM started in the emulator: save the old library, tell the webview the default. */
    romStarted(rom: Uint8Array | null): void {
        this.flushNow();
        this.rom = rom;
        this.lib = null;
        this.indexCache = null;
        this.describeScript = null;
        this.post({ command: 'cdlConfig', autoEnable: !!this._config().get('cdl.enabled', false) || this.wanted.get() });
    }

    _body(): Uint8Array { return stripCopierHeader(this.rom!); }

    _library(): CdlLibrary | null {
        if (this.lib || !this.rom) return this.lib;
        const map = createRomMap(this._body());
        const sha256 = crypto.createHash('sha256').update(this._body()).digest('hex');
        this.lib = new CdlLibrary(this.root, Buffer.from(this.rom), { title: map.header ? map.header.title : '', mapType: map.type, sha256 });
        this.log(`CDL library: ${this.lib.dir}`);
        return this.lib;
    }

    _labels() {
        const map = createRomMap(this._body());
        const labels: string[] = [];
        for (let off = 0; off < map.size; off += 0x10000) labels.push(hex(map.canonical(off) >>> 16, 2));
        return labels;
    }

    _scriptNamer() {
        if (!this.describeScript) this.describeScript = this.tools!.scriptNamer(this._body());
        return this.describeScript;
    }

    _status(extra?: string): void {
        if (!this.lib) return;
        this.post({ command: 'cdlStatus', summary: this.lib.summary(), dir: this.lib.dir, text: extra || '' });
    }

    _index() {
        if (!this.indexCache) {
            const map = createRomMap(this._body());
            const index = this.tools!.buildIndex(this.lib!, map);
            this.indexCache = { map, index, tables: this.tools!.findTables(this.lib!, this._body(), map, index) };
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
            this.log('CDL flush failed: ' + (err instanceof Error ? err.message : err), true);
        }
    }

    _seed() {
        const lib = this._library();
        if (!lib) { this.post({ command: 'cdlStatus', text: 'no ROM loaded' }); return; }
        const ctx = findScriptContext(this.rom!);
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
        const dir = path.join(this.root, romHash(Buffer.from(this.rom)));
        if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
            this.post({ command: 'cdlSnapshot', empty: true });
            return;
        }
        const lib = this._library()!;
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
    handle(msg: CdlMessage): boolean {
        switch (msg.command) {
            case 'cdlEnable':
                this.wanted.set(true);
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
                    wvals: (d.wvals || []).map(w => ({ index: w.index, data: b64Bytes(w.data) })),
                    wflags: (d.wflags || []).map(w => ({ index: w.index, data: b64Bytes(w.data) })),
                    xrefs: b64ToWords(d.xrefs),
                    edges: b64ToWords(d.edges),
                    stats: b64ToWords(d.stats),
                    scriptXrefs: b64ToWords(d.scriptXrefs),
                    romHits: b64ToWords(d.romHits),
                    wramHits: b64ToWords(d.wramHits),
                    rets: b64ToWords(d.rets),
                    regs: b64ToWords(d.regs),
                    bases: b64ToWords(d.bases),
                    wcode: (d.wcode || []).map(c => ({ index: c.index, code: b64Bytes(c.code), state: b64Bytes(c.state) })),
                    aram: (d.aram || []).map(a => ({ index: a.index, data: b64Bytes(a.data) })),
                    bus: (d.bus || []).map(a => ({ index: a.index, data: b64Bytes(a.data) })),
                    busSites: b64ToWords(d.busSites),
                    romCycles: b64ToWords(d.romCycles),
                    ioVals: (d.ioVals || []).map(a => ({ index: a.index, data: b64Bytes(a.data) })),
                    sramFlags: (d.sramFlags || []).map(a => ({ index: a.index, data: b64Bytes(a.data) })),
                    wordRanges: (d.wordRanges || []).map(a => ({ set: a.set, index: a.index, data: b64Bytes(a.data) })),
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
                this.wanted.set(false);
                this.flushNow();
                this._status('stopped');
                return true;
            case 'cdlExport':
                if (this.tools) this._export(msg.kind);
                return true;
            case 'cdlLookup': {
                const lib = this._library();
                if (!lib) return true;
                if (!this.tools) {
                    this.post({ command: 'cdlLookupResult', lines: ['Lookups are part of the full Everscript extension: import this recording there.'] });
                    return true;
                }
                const { index, map, tables } = this._index();
                this.post({ command: 'cdlLookupResult', lines: this.tools.lookup(lib, index, map, msg.query ?? '', { describeScript: this._scriptNamer(), tables }) });
                return true;
            }
            default:
                return false;
        }
    }

    async _export(kind: string | undefined): Promise<void> {
        const lib = this._library();
        if (!lib) return;
        this.flushNow();
        const outDir = path.join(lib.dir, 'asar');
        try {
            const t0 = Date.now();
            let file: string, text: string;
            if (kind === 'wram') {
                const r = this.tools!.exportWram(lib, this.rom!, outDir, { describeScript: this._scriptNamer() });
                file = r.file;
                text = `ram.asm: ${r.addresses} WRAM addresses, ${r.enums} enum candidates`;
            } else {
                const r = this.tools!.exportAsar(lib, this.rom!, outDir);
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
            const why = err instanceof Error ? err : new Error(String(err));
            this.log('CDL export failed: ' + (why.stack || why.message), true);
            this.post({ command: 'cdlStatus', text: 'export failed: ' + why.message });
        }
    }

    /** The library changed on disk (a bundle was imported): save ours, then read it again. */
    reload() {
        this.flushNow();
        this.lib = null;
        this.indexCache = null;
    }

    dispose() { this.flushNow(); }
}

export { CdlHost, findScriptContext, parseRanges };
