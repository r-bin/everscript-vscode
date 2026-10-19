/**
 * emulator/tas/host.ts
 *
 * Extension-host side of input recording: writes the automatic recording of
 * every emulator session, lists the recordings (pinned first, then newest
 * first) and sends one to the webview for replay.
 *
 * A recording starts when the webview boots a ROM (tasRecStart), is appended
 * in batches (tasRecFrames) and ends on the next boot / panel close
 * (tasRecEnd). A session in which no button was pressed by hand (an idle boot,
 * or a replay watched to its end without taking over) is deleted on close.
 *
 * Messages (webview -> host): tasRecStart, tasRecFrames, tasRecEnd, tasList,
 *   tasLoad, tasPin, tasDelete (confirmed: the pause menu asked already), tasReveal, tasPrefs,
 *   tasDesync / tasReplayed (a replay lost sync / reached the end in sync: written into the
 *   recording when the replay was fair), tasVerify (replay the session so far headless, see verify.ts)
 * Messages (host -> webview): tasConfig, tasListResult, tasMovie, tasStatus
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { parseMovie, evsmvHeader, evsmvTrailer, rleFrames } from '../../../platform/tas/movie';
import { stripCopierHeader } from '../../../platform/cdl/library';
import { verifyMovieSafely } from '../../../platform/tas/verify';

/** A webview message (the fields each command uses). */
interface TasMessage {
    command: string; id?: string; name?: string; source?: string; text?: string; frames?: number; live?: boolean; cheats?: boolean;
    pinned?: boolean; confirmed?: boolean; frame?: number; expected?: string; got?: string; fair?: boolean; overlay?: boolean;
}
/** The recording being written. */
interface Recording { file: string; fd: number | null; frames: number; live: boolean; cheats: boolean; header: string; desync?: boolean }
interface Prefs { overlay?: boolean; pinned?: string[] }

const MOVIE_EXT = /\.evsmv$/i;
const PREFS_FILE = 'tas-prefs.json';

const sha256 = (buf: Uint8Array): string => crypto.createHash('sha256').update(buf).digest('hex');

/** The text of a caught value. */
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function stamp(d: Date): string {
    const p = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function safeName(name: unknown): string {
    return String(name || 'rom').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9 _()[\]!.-]+/g, '_').trim() || 'rom';
}

/** The recordings folder: everscript.tas.recordingsDirectory, else <storage>/tas-recordings. */
function recordingsDir(storageDir: string): string {
    const custom = String(vscode.workspace.getConfiguration('everscript').get('tas.recordingsDirectory', '') || '').trim();
    return custom || path.join(storageDir, 'tas-recordings');
}

class TasHost {
    coreWasmPath: () => string;
    storageDir: string;
    post: (msg: object) => void;
    log: (line: string, show?: boolean) => void;
    romSha = '';
    rom: Uint8Array | null = null;
    rec: Recording | null = null;
    verifying = false;

    /**
     * @param {string} storageDir  extension global storage path
     * @param {(msg: object) => void} post  sends to the webview
     * @param {(line: string, show?: boolean) => void} log
     * @param {() => string} [coreWasmPath]  the emulator core in use (its hash goes into every movie)
     */
    constructor(storageDir: string, post: (msg: object) => void, log: (line: string, show?: boolean) => void, coreWasmPath?: () => string) {
        this.coreWasmPath = coreWasmPath || (() => '');
        this.storageDir = storageDir;
        this.post = post;
        this.log = log;
    }

    _config() { return vscode.workspace.getConfiguration('everscript'); }

    dir() {
        const dir = recordingsDir(this.storageDir);
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }

    _prefs(): Prefs {
        try { return JSON.parse(fs.readFileSync(path.join(this.dir(), PREFS_FILE), 'utf8')); } catch (_) { return {}; }
    }

    _savePrefs(prefs: Prefs): void {
        fs.writeFileSync(path.join(this.dir(), PREFS_FILE), JSON.stringify(prefs, null, 2));
    }

    /** Short hash of the core's wasm: a core that emulates differently cannot replay a movie. */
    coreId() {
        try { return sha256(fs.readFileSync(this.coreWasmPath())).slice(0, 16); } catch (_) { return ''; }
    }

    /** true / false / null (movie or core unknown). */
    _coreMatch(movie: ReturnType<typeof parseMovie>): boolean | null {
        const mine = this.coreId();
        return movie.meta.core && mine ? movie.meta.core === mine : null;
    }

    /** A ROM (re)booted in the webview. */
    romStarted(rom: Uint8Array | null | undefined): void {
        this.romSha = rom ? sha256(stripCopierHeader(rom)) : '';
        this.rom = rom || null;
        this.post({
            command: 'tasConfig',
            autoRecord: !!this._config().get('tas.autoRecord', true),
            overlay: !!this._prefs().overlay,
            verifyEveryMinutes: Number(this._config().get('tas.verifyEveryMinutes', 30)) || 0,
        });
    }

    handle(msg: TasMessage): boolean {
        switch (msg.command) {
            case 'tasRecStart': this._recStart(msg); break;
            case 'tasRecFrames': this._recAppend(msg); break;
            case 'tasRecEnd': this._recEnd(); this._sendList(); break;
            case 'tasList': this._sendList(); break;
            case 'tasLoad': this._load(msg.id); break;
            case 'tasPin': this._pin(msg.id, !!msg.pinned); break;
            case 'tasDelete': this._delete(msg.id, !!msg.confirmed); break;
            case 'tasReveal': vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(this.dir())); break;
            case 'tasVerify': this._verify(); break;
            case 'tasDesync':
                this.log(`TAS replay desync at frame ${msg.frame}: expected ${msg.expected}, got ${msg.got}`, true);
                if (msg.fair) this._markSync(msg.id, 'desync', `${msg.frame} expected ${msg.expected}, got ${msg.got}`);
                break;
            case 'tasReplayed': this._markSync(msg.id, 'synced', new Date().toISOString()); break;
            case 'tasPrefs': this._savePrefs(Object.assign(this._prefs(), { overlay: !!msg.overlay })); break;
            default: return false;
        }
        return true;
    }

    // -- recording ----------------------------------------------------------------

    _recStart(msg: TasMessage): void {
        this._recEnd();
        if (!this._config().get('tas.autoRecord', true)) return;
        const started = new Date();
        const file = path.join(this.dir(), `${safeName(msg.name)}_${stamp(started)}.evsmv`);
        this.rec = {
            file, fd: null, frames: 0, live: false, cheats: false,
            header: evsmvHeader({ rom: msg.name, romSha256: this.romSha, started: started.toISOString(), source: msg.source, core: this.coreId() }),
        };
    }

    _recAppend(msg: TasMessage): void {
        const rec = this.rec;
        if (!rec || typeof msg.text !== 'string') return;
        try {
            if (rec.fd === null) {
                rec.fd = fs.openSync(rec.file, 'a');
                fs.writeSync(rec.fd, rec.header);
            }
            fs.writeSync(rec.fd, rleFrames(msg.text));
        } catch (e) {
            this.log('TAS recording write failed: ' + errText(e), true);
            this.rec = null;
            return;
        }
        rec.frames += msg.frames || 0;
        rec.live = rec.live || !!msg.live;
        rec.cheats = rec.cheats || !!msg.cheats;
    }

    _recEnd() {
        const rec = this.rec;
        this.rec = null;
        if (!rec || rec.fd === null) return;
        try {
            if (rec.live) fs.writeSync(rec.fd, evsmvTrailer(rec));
            fs.closeSync(rec.fd);
            if (!rec.live) fs.unlinkSync(rec.file);
            else this.log(`TAS recording saved: ${rec.file} (${rec.frames} frames)`);
        } catch (e) {
            this.log('TAS recording close failed: ' + errText(e), true);
        }
    }

    // -- replay check -------------------------------------------------------------

    /** Replay what is recorded so far on a headless core and say whether every checksum matches. */
    async _verify(): Promise<void> {
        const rec = this.rec;
        if (this.verifying || !rec || rec.fd === null || !this.rom) return;
        this.verifying = true;
        const frames = rec.frames;
        try {
            const romFile = path.join(this.dir(), '.verify-rom.smc');
            if (!fs.existsSync(romFile) || fs.statSync(romFile).size !== this.rom.length) fs.writeFileSync(romFile, this.rom);
            this.post({ command: 'tasStatus', text: `checking the recording (${frames} frames) on a headless copy...` });
            const r = await verifyMovieSafely({ node: process.execPath, movie: rec.file, rom: romFile });
            if (r.ok) {
                this.post({ command: 'tasStatus', text: `replay check OK: ${frames} frames reproduce every checksum` });
                this.log(`TAS replay check OK (${frames} frames, ${r.summary}${r.note ? '; ' + r.note : ''})`);
            } else if (r.desync) {
                const text = `REPLAY CHECK FAILED: desync at frame ${r.desync.frame} (${r.desync.detail}). Keep playing is not safe: see ${rec.file}`;
                if (this.rec === rec && rec.fd !== null && !rec.desync) {
                    rec.desync = true;
                    fs.writeSync(rec.fd, `# desync: ${r.desync.frame} replay check: ${r.desync.detail}\n`);
                }
                this.post({ command: 'tasStatus', text });
                this.log(text, true);
                vscode.window.showErrorMessage(text);
            } else {
                this.post({ command: 'tasStatus', text: 'replay check could not run: ' + r.error });
                this.log('TAS replay check could not run: ' + r.error, true);
            }
        } catch (e) {
            this.log('TAS replay check failed: ' + errText(e), true);
        } finally {
            this.verifying = false;
        }
    }

    // -- replay list --------------------------------------------------------------

    /** "file:<name>.evsmv" -> path in the recordings folder (no other paths). */
    _resolve(id: unknown): { name: string; file: string } | null {
        const m = /^file:(.+)$/.exec(String(id || ''));
        if (!m || m[1] !== path.basename(m[1]) || !MOVIE_EXT.test(m[1])) return null;
        return { name: m[1], file: path.join(this.dir(), m[1]) };
    }

    _describe(file: string, pinned: boolean) {
        const name = path.basename(file);
        const recording = !!(this.rec && this.rec.file === file);
        const movie = parseMovie(fs.readFileSync(file, 'utf8'), name);
        return {
            id: 'file:' + name,
            name: movie.title,
            pinned,
            mtime: fs.statSync(file).mtimeMs,
            recording,
            frames: recording ? this.rec!.frames : movie.count,
            meta: movie.meta,
            warnings: movie.warnings,
            romMatch: movie.meta.romSha256 && this.romSha ? movie.meta.romSha256 === this.romSha : null,
            coreMatch: this._coreMatch(movie),
        };
    }

    list() {
        const pins = new Set(this._prefs().pinned || []);
        const dir = this.dir();
        const items: ReturnType<TasHost['_describe']>[] = [];
        for (const name of fs.readdirSync(dir).filter(n => MOVIE_EXT.test(n))) {
            try {
                items.push(this._describe(path.join(dir, name), pins.has(name)));
            } catch (e) {
                this.log(`TAS: cannot read ${name}: ${errText(e)}`);
            }
        }
        items.sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || b.mtime - a.mtime);
        return items;
    }

    _sendList() {
        this.post({ command: 'tasListResult', items: this.list(), dir: this.dir(), romSha: this.romSha });
    }

    _load(id: string | undefined): void {
        const ref = this._resolve(id);
        if (!ref || !fs.existsSync(ref.file)) {
            this.post({ command: 'tasStatus', text: 'recording not found: ' + id });
            return;
        }
        try {
            const movie = parseMovie(fs.readFileSync(ref.file, 'utf8'), ref.name);
            const pads = Buffer.from(movie.pads.buffer, movie.pads.byteOffset, movie.pads.byteLength);
            this.post({
                command: 'tasMovie',
                id,
                title: movie.title,
                count: movie.count,
                pads: pads.toString('base64'),
                events: movie.events,
                romMatch: movie.meta.romSha256 && this.romSha ? movie.meta.romSha256 === this.romSha : null,
                coreMatch: this._coreMatch(movie),
                warnings: movie.warnings,
            });
            this.log(`TAS replay: ${ref.file} (${movie.count} frames)`);
        } catch (e) {
            this.post({ command: 'tasStatus', text: 'cannot read recording: ' + errText(e) });
        }
    }

    /**
     * Write what a replay showed into the recording, once: key 'desync' (frame and detail) or
     * 'synced' (date). A recording that desynced once stays marked; it is never marked synced.
     */
    _markSync(id: string | undefined, key: string, value: string): void {
        const ref = this._resolve(id);
        if (!ref || !fs.existsSync(ref.file) || (this.rec && this.rec.file === ref.file)) return;
        try {
            const text = fs.readFileSync(ref.file, 'utf8');
            const meta = parseMovie(text, ref.name).meta;
            if (meta.desync || (key === 'synced' && meta.synced)) return;
            // The list is sorted by date: keep the file's time.
            const { atime, mtime } = fs.statSync(ref.file);
            fs.appendFileSync(ref.file, `${text.endsWith('\n') ? '' : '\n'}# ${key}: ${String(value).replace(/\s+/g, ' ')}\n`);
            fs.utimesSync(ref.file, atime, mtime);
        } catch (e) {
            this.log(`TAS: cannot mark ${ref.name} as ${key}: ${errText(e)}`);
            return;
        }
        this._sendList();
    }

    _pin(id: string | undefined, pinned: boolean): void {
        const ref = this._resolve(id);
        if (!ref) return;
        const prefs = this._prefs();
        const pins = new Set(prefs.pinned || []);
        if (pinned) pins.add(ref.name); else pins.delete(ref.name);
        prefs.pinned = [...pins];
        this._savePrefs(prefs);
        this._sendList();
    }

    async _delete(id: string | undefined, confirmed: boolean): Promise<void> {
        const ref = this._resolve(id);
        if (!ref || !fs.existsSync(ref.file)) return;
        if (this.rec && this.rec.file === ref.file) {
            this.post({ command: 'tasStatus', text: 'that is the recording in progress' });
            return;
        }
        if (!confirmed) {
            const ok = await vscode.window.showWarningMessage(`Delete recording "${ref.name}"?`, { modal: true }, 'Delete');
            if (ok !== 'Delete') return;
        }
        fs.unlinkSync(ref.file);
        this._pin(id, false);
    }

    dispose() { this._recEnd(); }
}

export { recordingsDir, TasHost };
