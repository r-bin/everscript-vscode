/**
 * emulator/cdl/host.ts
 *
 * Extension-host side of the CDL recorder: owns the per-ROM library, merges
 * the deltas the webview drains from the core, and writes to disk only when
 * something changed, at most once every WRITEBACK_MS (pause included), and
 * at once on stop / ROM change / panel close / deactivate. Also runs exports (in the game's worker thread) and lookups when the panel was given
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
import { decodeDelta, type WireDelta } from './wire';
import { applyRescue, markDelivered, type RescueMessage } from './rescue';

type Index = ReturnType<typeof buildIndex>;
type LibraryInfo = { title?: string; mapType?: string; sha256?: string };
/** What the game hands the panel for exports and lookups (src/games/evermore/cdl/tools.ts); absent in the recorder. */
interface CdlTools {
    scriptNamer(rom: Uint8Array): (address: number) => string;
    buildIndex(lib: CdlLibrary, map: RomMap): Index;
    findTables(lib: CdlLibrary, rom: Uint8Array, map: RomMap, index: Index): Table[];
    lookup(lib: CdlLibrary, index: Index, map: RomMap, query: string, opts: { describeScript: (address: number) => string; tables: Table[] }): string[];
    /** The Asar or WRAM export, off the extension host's thread (a big library takes seconds and over 1 GB). */
    exportInBackground(job: { kind: 'asm' | 'wram'; root: string; rom: Uint8Array; info: LibraryInfo; outDir: string }): Promise<{ file: string; text: string }>;
}
interface Wanted { get: () => boolean; set: (on: boolean) => void }
interface CdlMessage extends Partial<RescueMessage> { command: string; delta?: WireDelta; kind?: string; query?: string }

// One write a minute at most: a dead extension host loses at most that much play, and the SSD is spared
// (a write of a big library is ~60 MB and ~0.4 s: 2.2 M script xrefs; Windows slower). The page hands its
// data over every 5 s, in memory only.
const WRITEBACK_MS = 60 * 1000;
// lda [$82] / inc $82 / and #$00FF / asl / tax / jsr ($xxxx,x): the script interpreter's opcode fetch
const SCRIPT_FETCH_PATTERN = Buffer.from([0xA7, 0x82, 0xE6, 0x82, 0x29, 0xFF, 0x00, 0x0A, 0xAA, 0xFC]);
const SCRIPT_POINTER_WRAM = 0x82;


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
    libInfo: LibraryInfo | null = null;
    exporting = false;
    indexCache: { map: RomMap; index: Index; tables: Table[] } | null = null;
    flushTimer: ReturnType<typeof setTimeout> | null = null;
    lastWrite = 0;
    /** The page's last delta merged here and not yet acknowledged (cdlSaved once it is on disk). */
    pendingAck: { session: string; seq: number } | null = null;
    describeScript: ((address: number) => string) | null = null;
    droppedWarned = 0;
    /** The last write's error while writes fail (shown over the screen and once as a notification). */
    flushError = '';

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
        this.libInfo = { title: map.header ? map.header.title : '', mapType: map.type, sha256 };
        this.lib = new CdlLibrary(this.root, Buffer.from(this.rom), this.libInfo);
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
        if (this.flushTimer) return;
        if (!this.lastWrite) this.lastWrite = Date.now();   // the first minute counts from the first change
        const wait = Math.max(0, this.lastWrite + WRITEBACK_MS - Date.now());
        this.flushTimer = setTimeout(() => { this.flushTimer = null; this.flushNow(); }, wait);
    }

    flushNow() {
        if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
        if (!this.lib) return;
        if (!this.lib.dirty.size) { this._ack(); return; }
        this.lastWrite = Date.now();
        try {
            const written = this.lib.flush();
            this._ack();
            if (written.length) this.log(`CDL flushed: ${written.join(', ')}`);
            if (this.flushError) {
                this.flushError = '';
                this.post({ command: 'emuAlert', key: 'cdl-save', text: '' });
                this.log('CDL saved again');
            }
            this._status('saved ' + new Date().toLocaleTimeString());
        } catch (err) {
            // The data stays in memory (dirty), so the next write tries again; until one works, say so loudly.
            const why = err instanceof Error ? err.message : String(err);
            this.log('CDL flush failed: ' + why, true);
            this.post({ command: 'emuAlert', key: 'cdl-save', text: `CDL NOT SAVED: ${why}. It stays in memory and the next save tries again; do not close the emulator until this goes away.` });
            if (why !== this.flushError) vscode.window.showErrorMessage(`Everscript: the CDL recording could not be saved: ${why}`);
            this.flushError = why;
            this._scheduleFlush();
        }
    }

    /** A delta from the page is merged: note its number (written with the data, acknowledged after). */
    _received(lib: CdlLibrary, d: WireDelta): void {
        if (typeof d.session !== 'string' || typeof d.seq !== 'number') return;
        markDelivered(lib, d.session, d.seq);
        this.pendingAck = { session: d.session, seq: d.seq };
        // Nothing new in it: what it holds is on disk already.
        if (!lib.dirty.size) this._ack();
    }

    /** Tell the page which of its deltas are on disk: it keeps every later one (page/06-cdl-rescue.js). */
    _ack(): void {
        if (!this.pendingAck) return;
        this.post(Object.assign({ command: 'cdlSaved' }, this.pendingAck));
        this.pendingAck = null;
    }

    /** Deltas a page kept from a session whose host died (rescue.ts); the page forgets them once written. */
    _rescue(msg: RescueMessage): void {
        try {
            const { applied, skipped } = applyRescue(this.root, this.lib, msg);
            this.indexCache = null;
            this._ack();
            this.post({ command: 'cdlRescued', session: msg.session });
            const when = new Date(msg.at).toLocaleString();
            this.log(`CDL rescue: ${applied} deltas from the session cut off at ${when} merged (${skipped} were on disk already)`);
            if (applied) vscode.window.showInformationMessage(`Everscript: recovered the CDL recording the emulator could not save at ${when}.`);
        } catch (err) {
            this.log('CDL rescue failed (the page keeps it and tries again next time): ' + (err instanceof Error ? err.message : err), true);
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
            lib: { hash: lib.hash, romSize: lib.romSize },
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
                const changed = lib.applyDelta(decodeDelta(d));
                this._received(lib, d);
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
            case 'cdlRescue':
                if (msg.session && Array.isArray(msg.entries)) this._rescue(msg as RescueMessage);
                return true;
            case 'cdlPause':
                this._scheduleFlush();
                return true;
            case 'cdlDisabled':
                this.wanted.set(false);
                this.flushNow();
                this._status('stopped');
                return true;
            case 'cdlExport':
                this._export(msg.kind);
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

    /** Every way out answers the page (cdlStatus): its "exporting..." line must never be the last word. */
    async _export(kind: string | undefined): Promise<void> {
        const fail = (why: string) => this.post({ command: 'cdlStatus', text: 'export failed: ' + why });
        if (!this.tools) { fail('exports are part of the full Everscript extension'); return; }
        const lib = this._library();
        if (!lib || !this.libInfo) { fail('no ROM is running'); return; }
        if (this.exporting) { this.post({ command: 'cdlStatus', text: 'an export is still running...' }); return; }
        this.exporting = true;
        try {
            this.flushNow();
            const outDir = path.join(lib.dir, 'asar');
            const { file, text } = await this.tools.exportInBackground({ kind: kind === 'wram' ? 'wram' : 'asm', root: this.root, rom: this.rom!, info: this.libInfo, outDir });
            this.log(text + ' -> ' + outDir);
            this._status(text);
            this.exporting = false;   // done: the notification below waits for the user, not for us
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
            await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.One });
            vscode.window.showInformationMessage(text, 'Reveal Folder').then(pick => {
                if (pick) vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(file));
            });
        } catch (err) {
            const why = err instanceof Error ? err : new Error(String(err));
            this.log('CDL export failed: ' + (why.stack || why.message), true);
            fail(why.message);
        } finally {
            this.exporting = false;
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

export type { CdlTools };
export { CdlHost, findScriptContext, parseRanges };
