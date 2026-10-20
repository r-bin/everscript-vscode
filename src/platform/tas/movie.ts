/**
 * emulator/tas/movie.js
 *
 * The extension's own input recordings (.evsmv): "# key: value" header and
 * trailer lines and one "F|<pad>" line per emulated frame, appended while
 * playing so a crash loses at most the last batch. A pad is the core's 16-bit
 * joypad word (bit 15 = B ... bit 4 = R) written one char per bit from bit 15
 * in "BYsSudlrAXLR0123" order ('.' = released).
 *
 * Version 2 adds event lines between the frame lines. An event belongs to the
 * boundary where it appears: the number of F lines above it is the number of
 * frames already emulated, and a replay applies it before the next frame runs.
 *   W|<addr6>|<hex bytes>   memory write through the debugger/UI (cheats, object
 *                           states, menu toggles, injected scripts); only writes
 *                           that changed WRAM are recorded
 *   R|soft                  the console's reset button (RAM and SRAM are kept)
 *   S|<crc8>                CRC-32 of the 128 KB WRAM at this boundary, after the
 *                           events above it; a replay compares and reports the
 *                           first mismatch as a desync
 * A power-cycle is not an event: it starts a new recording.
 *
 * Two header-style lines may be appended to a finished recording (tas/host.ts), and once there
 * they stay: "# desync: <frame> <detail>" (the first replay that lost sync, or a failed replay
 * check while recording) and "# synced: <ISO date>" (a replay to the end matched every checksum).
 * A desync wins: the recording is not trusted again.
 *
 * Version 3 (the one written now) checks more, and more often:
 *   S|<crc8>                every CHECK_EVERY (60) frames instead of every 600
 *   T|vram=<crc8>|cgram=..|oam=..|sram=..|aram=..
 *                           CRC-32 of the other memory spaces every SPACES_EVERY (600) frames
 * and the header names the core build (# core:), which a replay compares: a core that
 * emulates differently cannot replay a movie. Version 1 and 2 movies still load and replay.
 *
 * Pure: no vscode, no fs (callers pass buffers / text).
 */

const BUTTONS = 'BYsSudlrAXLR0123';
const EVSMV_MAGIC = '# Everscript movie 3';
const EVSMV_MAGIC_V2 = '# Everscript movie 2';
const EVSMV_MAGIC_V1 = '# Everscript movie 1';
const CHECK_EVERY = 60;      // frames between S lines (WRAM)
// The sample rate the emulator panel boots the core with (panel-webview.ts AUDIO_FREQ; a test keeps them
// equal). The rate leaks into emulation: the SPC700 sees DSP state that depends on it, so a few ARAM bytes
// differ between rates. A replay must boot with the rate the movie was recorded at.
const AUDIO_RATE = 44100;
const SPACES_EVERY = 600;    // frames between T lines (the other memory spaces)
// The core's readSpace(id) ids (exports.c getSpacePtr) and the names used in T lines.
const SPACES: [string, number][] = [['vram', 0], ['cgram', 1], ['oam', 2], ['sram', 3], ['aram', 4]];

/** One event line of a movie. `frame` is added by parseMovie: the frames emulated before it. */
type MovieEvent =
    | { kind: 'R' }
    | { kind: 'S'; crc: number }
    | { kind: 'T'; crcs: Record<string, number> }
    | { kind: 'W'; addr: number; bytes: number[] };
type PlacedEvent = MovieEvent & { frame: number };
const WRAM_BASE = 0x7E0000;
const WRAM_SIZE = 0x20000;
const READ_CHUNK = 4096;     // the core's readMemoryRange limit

function padToText(word: number): string {
    let s = '';
    for (let i = 0; i < 16; i++) s += (word >> (15 - i)) & 1 ? BUTTONS[i] : '.';
    return s;
}

function textToPad(text: string): number {
    let word = 0;
    for (let i = 0; i < 16 && i < text.length; i++) {
        const c = text[i];
        if (c !== '.' && c !== ' ' && c !== '\r') word |= 1 << (15 - i);
    }
    return word;
}

function frameLine(pad: number): string {
    return 'F|' + padToText(pad);
}

function parseMeta(text: string): Record<string, string> {
    const meta: Record<string, string> = {};
    for (const line of text.split('\n')) {
        const m = /^# ([a-z0-9.]+): (.*)$/i.exec(line.trim());
        if (m) meta[m[1]] = m[2];
    }
    return meta;
}

// CRC-32 (IEEE), platform/crc32.ts. The webview script carries the same algorithm (tas-view.ts); a test keeps them equal.
import { crc32, crc32Update as crcUpdate, crc32Finish as crcFinish } from '..';
const crcText = (crc: number): string => crc.toString(16).toUpperCase().padStart(8, '0');

/** CRC-32 of WRAM through read(addr, length) -> bytes (the core's side-effect-free readMemoryRange). */
function wramCrc(read: (addr: number, length: number) => Uint8Array): number {
    let crc = 0xFFFFFFFF;
    for (let off = 0; off < WRAM_SIZE; off += READ_CHUNK) crc = crcUpdate(crc, read(WRAM_BASE + off, READ_CHUNK));
    return crcFinish(crc);
}

/** CRCs of VRAM, CGRAM, OAM, SRAM and ARAM through readSpace(id) -> bytes | null: { vram: n, ... }. */
function spaceCrcs(readSpace: (id: number) => Uint8Array | null): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [name, id] of SPACES) {
        const bytes = readSpace(id);
        out[name] = bytes ? crc32(bytes) : 0;
    }
    return out;
}

const hexByte = (n: number): string => (n & 0xFF).toString(16).toUpperCase().padStart(2, '0');
const writeLine = (addr: number, bytes: ArrayLike<number>): string => 'W|' + (addr >>> 0).toString(16).toUpperCase().padStart(6, '0') + '|' + Array.from(bytes, hexByte).join('');
const resetLine = () => 'R|soft';
const checkLine = (crc: number): string => 'S|' + crcText(crc);
const spacesLine = (crcs: Record<string, number>): string => 'T|' + SPACES.map(([name]) => name + '=' + crcText(crcs[name] >>> 0)).join('|');

/** One event line -> { kind, addr, bytes } | { kind: 'R' } | { kind: 'S', crc } | { kind: 'T', crcs } | null. */
function parseEvent(line: string): MovieEvent | null {
    const parts = line.trim().split('|');
    if (parts[0] === 'R') return { kind: 'R' };
    if (parts[0] === 'S' && /^[0-9A-F]{8}$/i.test(parts[1] || '')) return { kind: 'S', crc: parseInt(parts[1], 16) >>> 0 };
    if (parts[0] === 'T') {
        const crcs: Record<string, number> = {};
        for (const part of parts.slice(1)) {
            const m = /^([a-z]+)=([0-9A-F]{8})$/i.exec(part);
            if (m) crcs[m[1]] = parseInt(m[2], 16) >>> 0;
        }
        return Object.keys(crcs).length ? { kind: 'T', crcs } : null;
    }
    if (parts[0] === 'W' && /^[0-9A-F]{6}$/i.test(parts[1] || '') && /^([0-9A-F]{2})+$/i.test(parts[2] || '')) {
        const bytes: number[] = [];
        for (let i = 0; i < parts[2].length; i += 2) bytes.push(parseInt(parts[2].slice(i, i + 2), 16));
        return { kind: 'W', addr: parseInt(parts[1], 16), bytes };
    }
    return null;
}

/** Frame lines may carry a repeat count ("F|....*5" = 5 frames): the frames in these lines. */
function totalFrames(lines: string[]): number {
    let n = 0;
    for (const line of lines) {
        if (line[0] !== 'F') continue;
        const star = line.indexOf('*');
        n += star < 0 ? 1 : Math.max(1, parseInt(line.slice(star + 1), 10) || 1);
    }
    return n;
}

/** Collapse consecutive identical frame lines of a recorded batch into "F|pad*n"; other lines stay. */
function rleFrames(text: string): string {
    const out: string[] = [];
    let run: { line: string; n: number } | null = null;
    const flush = () => { if (run) { out.push(run.n > 1 ? run.line + '*' + run.n : run.line); run = null; } };
    for (const line of text.split('\n')) {
        if (!line) continue;
        if (line[0] === 'F' && line.indexOf('*') < 0) {
            if (run && run.line === line) run.n++;
            else { flush(); run = { line, n: 1 }; }
        } else { flush(); out.push(line); }
    }
    flush();
    return out.length ? out.join('\n') + '\n' : '';
}

/** Throws unless the text is an .evsmv recording. */
function parseMovie(text: string, fileName?: string) {
    const version = text.startsWith(EVSMV_MAGIC) ? 3 : text.startsWith(EVSMV_MAGIC_V2) ? 2 : text.startsWith(EVSMV_MAGIC_V1) ? 1 : 0;
    if (!version) throw new Error('not an Everscript recording');
    const lines = text.split('\n');
    const pads = new Uint16Array(totalFrames(lines));
    const events: PlacedEvent[] = [];   // { frame, kind, ... } in file order; frame = frames emulated before it
    let count = 0;
    for (const line of lines) {
        const c = line[0];
        if (c === 'F') {
            const body = line.slice(line.indexOf('|') + 1);
            const star = body.indexOf('*');
            const pad = textToPad(star < 0 ? body : body.slice(0, star));
            const n = star < 0 ? 1 : Math.max(1, parseInt(body.slice(star + 1), 10) || 1);
            for (let i = 0; i < n; i++) { if (count >= pads.length) break; pads[count++] = pad; }
        }
        else if (c === 'W' || c === 'R' || c === 'S' || c === 'T') {
            const ev = parseEvent(line);
            if (ev) events.push({ frame: count, ...ev });
        }
    }
    const m = parseMeta(text);
    return {
        title: String(fileName || 'movie').replace(/\.evsmv$/i, ''),
        pads: pads.subarray(0, count),
        count,
        version,
        events,
        meta: { rom: m.rom || '', romSha256: (m['rom.sha256'] || '').toLowerCase(), core: m.core || '', audio: parseInt(m.audio, 10) || AUDIO_RATE, started: m.started || '', source: m.source || '', cheats: m.cheats || '',
            desync: m.desync || '', synced: m.synced || '', sram: m.sram || '' },
        warnings: version === 1 && m.cheats === 'yes' ? ['cheats were on while recording: may not sync'] : [],
    };
}

function evsmvHeader({ rom, romSha256, started, source, core, sram }: { rom?: string; romSha256?: string; started: string; source?: string; core?: string; sram?: string }): string {
    const lines = [EVSMV_MAGIC, '# rom: ' + (rom || ''), '# rom.sha256: ' + (romSha256 || ''), '# started: ' + started];
    if (sram) {
        lines.push('# sram: ' + sram);
        lines.push('# start: power-on, initial SRAM');
    } else {
        lines.push('# start: power-on, empty SRAM');
    }
    lines.push('# check: WRAM every ' + CHECK_EVERY + ' frames, other spaces every ' + SPACES_EVERY);
    if (core) lines.push('# core: ' + core);
    lines.push('# audio: ' + AUDIO_RATE);
    if (source) lines.push('# source: ' + source);
    return lines.join('\n') + '\n';
}

function evsmvTrailer({ frames, cheats }: { frames: number; cheats?: boolean }): string {
    return '# frames: ' + frames + '\n# cheats: ' + (cheats ? 'yes' : 'no') + '\n';
}

/** Events grouped by the boundary they belong to: Map(frame -> [event]). */
function groupEvents<E extends { frame: number }>(events: E[]): Map<number, E[]> {
    const by = new Map<number, E[]>();
    for (const ev of events) {
        const list = by.get(ev.frame);
        if (list) list.push(ev); else by.set(ev.frame, [ev]);
    }
    return by;
}

export type { MovieEvent, PlacedEvent };
export { BUTTONS, EVSMV_MAGIC, CHECK_EVERY, SPACES_EVERY, AUDIO_RATE, SPACES, spaceCrcs, spacesLine, WRAM_BASE, WRAM_SIZE, padToText, textToPad, frameLine, parseMovie, evsmvHeader, evsmvTrailer, rleFrames, crc32, crcUpdate, crcFinish, crcText, wramCrc, writeLine, resetLine, checkLine, parseEvent, groupEvents };
