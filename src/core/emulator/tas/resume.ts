/**
 * emulator/tas/resume.ts
 *
 * "Continue a session": next to a recording `<name>.evsmv` the host keeps the last snapshot the page
 * took while that session was played by hand:
 *   <name>.evsmv.resume.json   { frame, offset, core, rom, romSha256, started, saved, thumb }
 *   <name>.evsmv.state.gz      the core's saveState() buffer at that frame boundary
 * Every snapshot at least STATE_EVERY frames after the previous kept one also goes into the movie itself as a
 * "Z|" line (movie.ts), so an exported recording carries its save states.
 * `offset` is the movie's byte length when the snapshot was taken: everything after it (frames and
 * events recorded after the snapshot, e.g. until the panel closed) is the tail a continue replays
 * on top of the state before the keyboard takes over. The state is a cache: the movie stays the
 * source of truth and still replays from power-on, because a continue appends to the same file.
 *
 * No vscode here (tests load it under node); the folder comes from tas/host.ts recordingsDir().
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { parseMovie, STATE_EVERY } from '../../../platform/tas/movie';

const RESUME_SUFFIX = '.resume.json';
const STATE_SUFFIX = '.state.gz';
/** A state taken while the game still boots does not reproduce the run (tools/cdl/replay-states.js MIN_FRAME). */
const MIN_RESUME_FRAME = 600;

/** What the sidecar JSON holds. */
interface ResumeMeta {
    frame: number; offset: number; core: string; rom: string; romSha256: string; started: string; saved: string; thumb: string;
}
/** A session the ROM picker can offer. */
interface ResumableSession { id: string; rom: string; started: string; saved: string; frame: number; thumb: string }

const resumePath = (movieFile: string): string => movieFile + RESUME_SUFFIX;
const statePath = (movieFile: string): string => movieFile + STATE_SUFFIX;

function writeAtomic(file: string, data: string | Buffer): void {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, file);
}

/** Store a snapshot of the session recorded in movieFile (state: the raw saveState() bytes). */
function writeResume(movieFile: string, meta: ResumeMeta, state: Uint8Array): void {
    writeAtomic(statePath(movieFile), zlib.gzipSync(state, { level: 6 }));
    writeAtomic(resumePath(movieFile), JSON.stringify(meta));
}

/**
 * The page's snapshot (tasSnapshot: frame, base64 state, thumb) of the recording open as fd, which
 * holds `frames` frames. Ignored before MIN_RESUME_FRAME, or when the page's frame is not the file's
 * end (the page flushes every frame before it snapshots: anything else is stale). The state also goes
 * into the movie (Z line) when lastState is STATE_EVERY frames back. Returns the frame of the state in
 * the movie now (frame, or lastState).
 */
function saveSnapshot(movieFile: string, fd: number, frames: number, msg: { frame?: number; state?: string; thumb?: string },
    info: { core: string; rom: string; romSha256: string; started: string }, lastState: number): number {
    const frame = Number(msg.frame);
    if (typeof msg.state !== 'string' || !(frame >= MIN_RESUME_FRAME) || frame !== frames) return lastState;
    const state = Buffer.from(msg.state, 'base64');
    if (frame - lastState >= STATE_EVERY) {
        fs.writeSync(fd, 'Z|' + zlib.gzipSync(state, { level: 6 }).toString('base64') + '\n');
        lastState = frame;
    }
    writeResume(movieFile, Object.assign({ frame, offset: fs.fstatSync(fd).size, saved: new Date().toISOString(),
        thumb: typeof msg.thumb === 'string' ? msg.thumb : '' }, info), state);
    return lastState;
}

function readResume(movieFile: string): ResumeMeta | null {
    try {
        const meta = JSON.parse(fs.readFileSync(resumePath(movieFile), 'utf8'));
        if (typeof meta.frame !== 'number' || typeof meta.offset !== 'number') return null;
        if (!fs.existsSync(statePath(movieFile))) return null;
        return meta;
    } catch (_) {
        return null;
    }
}

function deleteResume(movieFile: string): void {
    for (const f of [resumePath(movieFile), statePath(movieFile)]) {
        try { fs.unlinkSync(f); } catch (_) { /* absent */ }
    }
}

/**
 * Every session in dir that can be continued, by ROM (SHA-256 of the ROM without copier header),
 * newest snapshot first.
 */
function listResumable(dir: string): Map<string, ResumableSession[]> {
    const byRom = new Map<string, ResumableSession[]>();
    let names: string[] = [];
    try { names = fs.readdirSync(dir).filter(n => n.endsWith('.evsmv' + RESUME_SUFFIX)); } catch (_) { return byRom; }
    for (const name of names) {
        const movieName = name.slice(0, -RESUME_SUFFIX.length);
        const movieFile = path.join(dir, movieName);
        if (!fs.existsSync(movieFile)) continue;
        const meta = readResume(movieFile);
        if (!meta || !meta.romSha256) continue;
        const list = byRom.get(meta.romSha256) || [];
        list.push({ id: 'file:' + movieName, rom: meta.rom, started: meta.started, saved: meta.saved, frame: meta.frame, thumb: meta.thumb || '' });
        byRom.set(meta.romSha256, list);
    }
    for (const list of byRom.values()) list.sort((a, b) => String(b.saved).localeCompare(String(a.saved)));
    return byRom;
}

/** What the page needs to continue: the state, and the tail recorded after it (absolute frames). */
interface ResumeData {
    frame: number; count: number; state: Buffer; romSha256: string; core: string;
    pads: Uint16Array; events: ReturnType<typeof parseMovie>['events'];
}

/** Throws with a reason the user can read when the session cannot be continued. */
function loadResume(movieFile: string): ResumeData {
    const meta = readResume(movieFile);
    if (!meta) throw new Error('no snapshot of that session');
    const bytes = fs.readFileSync(movieFile);
    if (bytes.length < meta.offset) throw new Error('the recording is shorter than its snapshot');
    const head = parseMovie(bytes.toString('utf8'), path.basename(movieFile));
    // The tail parses as a movie of its own: frames count from the snapshot's frame.
    const tail = parseMovie(bytes.subarray(0, Math.min(bytes.length, 64)).toString('latin1').split('\n')[0] + '\n'
        + bytes.subarray(meta.offset).toString('utf8'));
    if (meta.frame + tail.count !== head.count) throw new Error(`the snapshot (frame ${meta.frame}) does not fit the recording (${head.count} frames)`);
    return {
        frame: meta.frame,
        count: head.count,
        state: zlib.gunzipSync(fs.readFileSync(statePath(movieFile))),
        romSha256: meta.romSha256,
        core: meta.core,
        pads: tail.pads,
        events: tail.events.map(ev => Object.assign({}, ev, { frame: ev.frame + meta.frame })),
    };
}

/** The host's tasResume message for the ROM and core in use; throws with a reason the user can read. */
function resumeMessage(id: string, movieFile: string, romSha256: string, coreId: string) {
    const r = loadResume(movieFile);
    if (r.romSha256 && romSha256 && r.romSha256 !== romSha256) throw new Error('it was played on another ROM');
    if (r.core && coreId && r.core !== coreId) throw new Error('it was played on another emulator core build');
    const pads = Buffer.from(r.pads.buffer, r.pads.byteOffset, r.pads.byteLength);
    return {
        command: 'tasResume', id, title: path.basename(movieFile).replace(/\.evsmv$/i, ''), frame: r.frame, count: r.count,
        state: r.state.toString('base64'), pads: pads.toString('base64'), events: rawRewinds(r.events),
        nextMarker: nextMarker(parseMovie(fs.readFileSync(movieFile, 'utf8')).events),
    };
}

/** Opens a recording to append a continued session to it, after a "# continued:" line (movie.ts). */
function openToContinue(movieFile: string) {
    const text = fs.readFileSync(movieFile, 'utf8');
    const movie = parseMovie(text, path.basename(movieFile));
    const fd = fs.openSync(movieFile, 'a');
    fs.writeSync(fd, `${text.endsWith('\n') ? '' : '\n'}# continued: ${new Date().toISOString()} at frame ${movie.count}\n`);
    return { fd, frames: movie.count, lastState: movie.count, continued: true, cheats: movie.meta.cheats === 'yes', rom: movie.meta.rom, started: movie.meta.started, desync: !!movie.meta.desync,
        desyncFrame: movie.meta.desync ? parseInt(String(movie.meta.desync), 10) : undefined };
}

// -- rewinds (movie.ts K / L lines) ------------------------------------------------------

/** The page writes a rewind as "L|<n>|raw:<base64 state>": the file keeps it gzipped. */
function packRewinds(text: string): string {
    if (text.indexOf('|raw:') < 0) return text;
    return text.replace(/^L\|(\d+)\|raw:([A-Za-z0-9+/=]*)$/gm, (_, n: string, b64: string) =>
        'L|' + n + '|' + zlib.gzipSync(Buffer.from(b64, 'base64'), { level: 6 }).toString('base64'));
}

type MovieEvents = ReturnType<typeof parseMovie>['events'];

/** Events for the page: L data unzipped (the page loads it between two frames, it cannot wait). */
function rawRewinds(events: MovieEvents): MovieEvents {
    return events.map(ev => ev.kind === 'L' && ev.data
        ? Object.assign({}, ev, { data: zlib.gunzipSync(Buffer.from(ev.data, 'base64')).toString('base64') }) : ev);
}

/** The first rewind marker number a recording has not used yet. */
function nextMarker(events: MovieEvents): number {
    let next = 0;
    for (const ev of events) if (ev.kind === 'K' || ev.kind === 'L') next = Math.max(next, ev.n + 1);
    return next;
}

export type { ResumeMeta, ResumableSession, ResumeData };
export { MIN_RESUME_FRAME, writeResume, saveSnapshot, readResume, deleteResume, listResumable, loadResume, resumeMessage, openToContinue, packRewinds, rawRewinds, nextMarker };
