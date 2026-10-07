'use strict';

/**
 * emulator/tas/host.js
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
 *   tasLoad, tasPin, tasDelete, tasReveal, tasPrefs
 * Messages (host -> webview): tasConfig, tasListResult, tasMovie, tasStatus
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseMovie, evsmvHeader, evsmvTrailer } = require('./movie');
const { stripCopierHeader } = require('../cdl/library');

const MOVIE_EXT = /\.evsmv$/i;
const PREFS_FILE = 'tas-prefs.json';

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

function stamp(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function safeName(name) {
    return String(name || 'rom').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9 _()[\]!.-]+/g, '_').trim() || 'rom';
}

class TasHost {
    /**
     * @param {string} storageDir  extension global storage path
     * @param {(msg: object) => void} post  sends to the webview
     * @param {(line: string, show?: boolean) => void} log
     */
    constructor(storageDir, post, log) {
        this.defaultDir = path.join(storageDir, 'tas-recordings');
        this.post = post;
        this.log = log;
        this.romSha = '';
        this.rec = null;   // { file, fd, header, frames, live, cheats }
    }

    _config() { return vscode.workspace.getConfiguration('everscript'); }

    dir() {
        const custom = String(this._config().get('tas.recordingsDirectory', '') || '').trim();
        const dir = custom || this.defaultDir;
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }

    _prefs() {
        try { return JSON.parse(fs.readFileSync(path.join(this.dir(), PREFS_FILE), 'utf8')); } catch (_) { return {}; }
    }

    _savePrefs(prefs) {
        fs.writeFileSync(path.join(this.dir(), PREFS_FILE), JSON.stringify(prefs, null, 2));
    }

    /** A ROM (re)booted in the webview. */
    romStarted(rom) {
        this.romSha = rom ? sha256(stripCopierHeader(rom)) : '';
        this.post({
            command: 'tasConfig',
            autoRecord: !!this._config().get('tas.autoRecord', true),
            overlay: !!this._prefs().overlay,
        });
    }

    handle(msg) {
        switch (msg.command) {
            case 'tasRecStart': this._recStart(msg); break;
            case 'tasRecFrames': this._recAppend(msg); break;
            case 'tasRecEnd': this._recEnd(); this._sendList(); break;
            case 'tasList': this._sendList(); break;
            case 'tasLoad': this._load(msg.id); break;
            case 'tasPin': this._pin(msg.id, !!msg.pinned); break;
            case 'tasDelete': this._delete(msg.id); break;
            case 'tasReveal': vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(this.dir())); break;
            case 'tasPrefs': this._savePrefs(Object.assign(this._prefs(), { overlay: !!msg.overlay })); break;
            default: return false;
        }
        return true;
    }

    // -- recording ----------------------------------------------------------------

    _recStart(msg) {
        this._recEnd();
        if (!this._config().get('tas.autoRecord', true)) return;
        const started = new Date();
        const file = path.join(this.dir(), `${safeName(msg.name)}_${stamp(started)}.evsmv`);
        this.rec = {
            file, fd: null, frames: 0, live: false, cheats: false,
            header: evsmvHeader({ rom: msg.name, romSha256: this.romSha, started: started.toISOString(), source: msg.source }),
        };
    }

    _recAppend(msg) {
        const rec = this.rec;
        if (!rec || typeof msg.text !== 'string') return;
        try {
            if (rec.fd === null) {
                rec.fd = fs.openSync(rec.file, 'a');
                fs.writeSync(rec.fd, rec.header);
            }
            fs.writeSync(rec.fd, msg.text);
        } catch (e) {
            this.log('TAS recording write failed: ' + e.message, true);
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
            this.log('TAS recording close failed: ' + e.message, true);
        }
    }

    // -- replay list --------------------------------------------------------------

    /** "file:<name>.evsmv" -> path in the recordings folder (no other paths). */
    _resolve(id) {
        const m = /^file:(.+)$/.exec(String(id || ''));
        if (!m || m[1] !== path.basename(m[1]) || !MOVIE_EXT.test(m[1])) return null;
        return { name: m[1], file: path.join(this.dir(), m[1]) };
    }

    _describe(file, pinned) {
        const name = path.basename(file);
        const recording = !!(this.rec && this.rec.file === file);
        const movie = parseMovie(fs.readFileSync(file, 'utf8'), name);
        return {
            id: 'file:' + name,
            name: movie.title,
            pinned,
            mtime: fs.statSync(file).mtimeMs,
            recording,
            frames: recording ? this.rec.frames : movie.count,
            meta: movie.meta,
            warnings: movie.warnings,
            romMatch: movie.meta.romSha256 && this.romSha ? movie.meta.romSha256 === this.romSha : null,
        };
    }

    list() {
        const pins = new Set(this._prefs().pinned || []);
        const dir = this.dir();
        const items = [];
        for (const name of fs.readdirSync(dir).filter(n => MOVIE_EXT.test(n))) {
            try {
                items.push(this._describe(path.join(dir, name), pins.has(name)));
            } catch (e) {
                this.log(`TAS: cannot read ${name}: ${e.message}`);
            }
        }
        items.sort((a, b) => (b.pinned - a.pinned) || b.mtime - a.mtime);
        return items;
    }

    _sendList() {
        this.post({ command: 'tasListResult', items: this.list(), dir: this.dir(), romSha: this.romSha });
    }

    _load(id) {
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
                romMatch: movie.meta.romSha256 && this.romSha ? movie.meta.romSha256 === this.romSha : null,
                warnings: movie.warnings,
            });
            this.log(`TAS replay: ${ref.file} (${movie.count} frames)`);
        } catch (e) {
            this.post({ command: 'tasStatus', text: 'cannot read recording: ' + e.message });
        }
    }

    _pin(id, pinned) {
        const ref = this._resolve(id);
        if (!ref) return;
        const prefs = this._prefs();
        const pins = new Set(prefs.pinned || []);
        if (pinned) pins.add(ref.name); else pins.delete(ref.name);
        prefs.pinned = [...pins];
        this._savePrefs(prefs);
        this._sendList();
    }

    async _delete(id) {
        const ref = this._resolve(id);
        if (!ref || !fs.existsSync(ref.file)) return;
        if (this.rec && this.rec.file === ref.file) {
            this.post({ command: 'tasStatus', text: 'that is the recording in progress' });
            return;
        }
        const ok = await vscode.window.showWarningMessage(`Delete recording "${ref.name}"?`, { modal: true }, 'Delete');
        if (ok !== 'Delete') return;
        fs.unlinkSync(ref.file);
        this._pin(id, false);
    }

    dispose() { this._recEnd(); }
}

module.exports = { TasHost };
