'use strict';

/**
 * emulator/tas/host.js
 *
 * Extension-host side of TAS support: writes the automatic input recording of
 * every emulator session, lists replays (bundled pinned movies first, then the
 * user's pinned files, then recordings newest first) and sends a movie to the
 * webview for playback.
 *
 * A recording starts when the webview boots a ROM (tasRecStart), is appended
 * in batches (tasRecFrames) and ends on the next boot / panel close
 * (tasRecEnd). A session in which no button was pressed by hand (an idle boot,
 * or a replay watched to its end without taking over) is deleted on close.
 *
 * Messages (webview -> host): tasRecStart, tasRecFrames, tasRecEnd, tasList,
 *   tasLoad, tasPin, tasDelete, tasReveal, tasImport, tasPrefs
 * Messages (host -> webview): tasConfig, tasListResult, tasMovie, tasStatus
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseMovie, evsmvHeader, evsmvTrailer, EVSMV_MAGIC } = require('./movie');
const { stripCopierHeader } = require('../cdl/library');

const BUNDLED_DIR = path.join(__dirname, 'movies');
const MOVIE_EXT = /\.(lsmv|evsmv)$/i;
const PREFS_FILE = 'tas-prefs.json';

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

function stamp(d) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function safeName(name) {
    return String(name || 'rom').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9 _()[\]!.-]+/g, '_').trim() || 'rom';
}

/** Parse warnings plus a note when the movie was made on another emulator core. */
function movieWarnings(movie) {
    const out = movie.warnings.slice();
    const core = movie.meta.core;
    if (core && !/snes9x/i.test(core)) {
        out.push(`recorded on ${core}: snes9x2005 lags on different frames, so playback desyncs once the movie depends on exact timing`);
    }
    return out;
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
        this.rec = null;   // { file, fd, frames, live, cheats }
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
            case 'tasImport': this._import(); break;
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
            header: evsmvHeader({ rom: msg.name, romSha256: this.romSha, started: started.toISOString(), source: msg.source, ycable: !!msg.ycable }),
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

    _resolve(id) {
        const m = /^(builtin|file):(.+)$/.exec(String(id || ''));
        if (!m || m[2] !== path.basename(m[2]) || !MOVIE_EXT.test(m[2])) return null;
        return { builtin: m[1] === 'builtin', name: m[2], file: path.join(m[1] === 'builtin' ? BUNDLED_DIR : this.dir(), m[2]) };
    }

    _describe(file, builtin, pinned) {
        const name = path.basename(file);
        const st = fs.statSync(file);
        const item = {
            id: (builtin ? 'builtin:' : 'file:') + name,
            name: name.replace(MOVIE_EXT, ''),
            builtin, pinned, size: st.size, mtime: st.mtimeMs,
            recording: !!(this.rec && this.rec.file === file),
        };
        let meta = {}, frames = null, warnings = [];
        if (/\.lsmv$/i.test(name)) {
            const movie = parseMovie(fs.readFileSync(file), name);
            meta = movie.meta;
            frames = movie.count;
            warnings = movieWarnings(movie);
        } else {
            const text = fs.readFileSync(file, 'utf8');
            if (!text.startsWith(EVSMV_MAGIC)) return null;
            const movie = parseMovie(Buffer.from(text), name);
            meta = movie.meta;
            frames = item.recording ? this.rec.frames : movie.count;
            warnings = movie.warnings;
        }
        item.frames = frames;
        item.meta = meta;
        item.warnings = warnings;
        item.romMatch = meta.romSha256 && this.romSha ? meta.romSha256 === this.romSha : null;
        return item;
    }

    list() {
        const prefs = this._prefs();
        const pins = new Set(prefs.pinned || []);
        const items = [];
        const add = (file, builtin, pinned) => {
            try {
                const item = this._describe(file, builtin, pinned);
                if (item) items.push(item);
            } catch (e) {
                this.log(`TAS: cannot read ${file}: ${e.message}`);
            }
        };
        if (fs.existsSync(BUNDLED_DIR)) {
            for (const name of fs.readdirSync(BUNDLED_DIR).filter(n => MOVIE_EXT.test(n)).sort()) add(path.join(BUNDLED_DIR, name), true, true);
        }
        const dir = this.dir();
        for (const name of fs.readdirSync(dir).filter(n => MOVIE_EXT.test(n))) add(path.join(dir, name), false, pins.has(name));
        const rank = it => (it.builtin ? 0 : it.pinned ? 1 : 2);
        items.sort((a, b) => rank(a) - rank(b) || b.mtime - a.mtime);
        return items;
    }

    _sendList() {
        this.post({ command: 'tasListResult', items: this.list(), dir: this.dir(), romSha: this.romSha });
    }

    _load(id) {
        const ref = this._resolve(id);
        if (!ref || !fs.existsSync(ref.file)) {
            this.post({ command: 'tasStatus', text: 'replay not found: ' + id });
            return;
        }
        try {
            const movie = parseMovie(fs.readFileSync(ref.file), ref.name);
            const pads = Buffer.from(movie.pads.buffer, movie.pads.byteOffset, movie.pads.byteLength);
            this.post({
                command: 'tasMovie',
                id,
                title: movie.title,
                count: movie.count,
                ycable: movie.ycable,
                pads: pads.toString('base64'),
                romMatch: movie.meta.romSha256 && this.romSha ? movie.meta.romSha256 === this.romSha : null,
                warnings: movieWarnings(movie),
            });
            this.log(`TAS replay: ${ref.file} (${movie.count} frames${movie.ycable ? ', 4 pads' : ''})`);
        } catch (e) {
            this.post({ command: 'tasStatus', text: 'cannot read replay: ' + e.message });
        }
    }

    _pin(id, pinned) {
        const ref = this._resolve(id);
        if (!ref || ref.builtin) return;
        const prefs = this._prefs();
        const pins = new Set(prefs.pinned || []);
        if (pinned) pins.add(ref.name); else pins.delete(ref.name);
        prefs.pinned = [...pins];
        this._savePrefs(prefs);
        this._sendList();
    }

    async _delete(id) {
        const ref = this._resolve(id);
        if (!ref || ref.builtin || !fs.existsSync(ref.file)) return;
        if (this.rec && this.rec.file === ref.file) {
            this.post({ command: 'tasStatus', text: 'that is the recording in progress' });
            return;
        }
        const ok = await vscode.window.showWarningMessage(`Delete replay "${ref.name}"?`, { modal: true }, 'Delete');
        if (ok !== 'Delete') return;
        fs.unlinkSync(ref.file);
        this._pin(id, false);
    }

    async _import() {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Import replay',
            filters: { 'Input movies': ['lsmv', 'evsmv'] },
        });
        if (!uris || !uris.length) return;
        const prefs = this._prefs();
        const pins = new Set(prefs.pinned || []);
        for (const uri of uris) {
            const name = path.basename(uri.fsPath);
            try {
                parseMovie(fs.readFileSync(uri.fsPath), name);
                fs.copyFileSync(uri.fsPath, path.join(this.dir(), name));
                pins.add(name);
            } catch (e) {
                vscode.window.showErrorMessage(`Cannot import ${name}: ${e.message}`);
            }
        }
        prefs.pinned = [...pins];
        this._savePrefs(prefs);
        this._sendList();
    }

    dispose() { this._recEnd(); }
}

module.exports = { TasHost, stamp, safeName };
