'use strict';

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
 * Pure: no vscode, no fs (callers pass buffers / text).
 */

const BUTTONS = 'BYsSudlrAXLR0123';
const EVSMV_MAGIC = '# Everscript movie 2';
const EVSMV_MAGIC_V1 = '# Everscript movie 1';
const CHECK_EVERY = 600;     // frames between S lines
const WRAM_BASE = 0x7E0000;
const WRAM_SIZE = 0x20000;
const READ_CHUNK = 4096;     // the core's readMemoryRange limit

function padToText(word) {
    let s = '';
    for (let i = 0; i < 16; i++) s += (word >> (15 - i)) & 1 ? BUTTONS[i] : '.';
    return s;
}

function textToPad(text) {
    let word = 0;
    for (let i = 0; i < 16 && i < text.length; i++) {
        const c = text[i];
        if (c !== '.' && c !== ' ' && c !== '\r') word |= 1 << (15 - i);
    }
    return word;
}

function frameLine(pad) {
    return 'F|' + padToText(pad);
}

function parseMeta(text) {
    const meta = {};
    for (const line of text.split('\n')) {
        const m = /^# ([a-z0-9.]+): (.*)$/i.exec(line.trim());
        if (m) meta[m[1]] = m[2];
    }
    return meta;
}

// CRC-32 (IEEE). The webview script carries the same algorithm (tas-view.js); a test keeps them equal.
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crcUpdate(crc, bytes) {
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return crc >>> 0;
}

const crcFinish = crc => ((crc ^ 0xFFFFFFFF) >>> 0);
const crc32 = bytes => crcFinish(crcUpdate(0xFFFFFFFF, bytes));
const crcText = crc => crc.toString(16).toUpperCase().padStart(8, '0');

/** CRC-32 of WRAM through read(addr, length) -> bytes (the core's side-effect-free readMemoryRange). */
function wramCrc(read) {
    let crc = 0xFFFFFFFF;
    for (let off = 0; off < WRAM_SIZE; off += READ_CHUNK) crc = crcUpdate(crc, read(WRAM_BASE + off, READ_CHUNK));
    return crcFinish(crc);
}

const hexByte = n => (n & 0xFF).toString(16).toUpperCase().padStart(2, '0');
const writeLine = (addr, bytes) => 'W|' + (addr >>> 0).toString(16).toUpperCase().padStart(6, '0') + '|' + Array.from(bytes, hexByte).join('');
const resetLine = () => 'R|soft';
const checkLine = crc => 'S|' + crcText(crc);

/** One event line -> { kind, addr, bytes } | { kind: 'R' } | { kind: 'S', crc } | null. */
function parseEvent(line) {
    const parts = line.trim().split('|');
    if (parts[0] === 'R') return { kind: 'R' };
    if (parts[0] === 'S' && /^[0-9A-F]{8}$/i.test(parts[1] || '')) return { kind: 'S', crc: parseInt(parts[1], 16) >>> 0 };
    if (parts[0] === 'W' && /^[0-9A-F]{6}$/i.test(parts[1] || '') && /^([0-9A-F]{2})+$/i.test(parts[2] || '')) {
        const bytes = [];
        for (let i = 0; i < parts[2].length; i += 2) bytes.push(parseInt(parts[2].slice(i, i + 2), 16));
        return { kind: 'W', addr: parseInt(parts[1], 16), bytes };
    }
    return null;
}

/** Throws unless the text is an .evsmv recording. */
function parseMovie(text, fileName) {
    if (!text.startsWith(EVSMV_MAGIC) && !text.startsWith(EVSMV_MAGIC_V1)) throw new Error('not an Everscript recording');
    const version = text.startsWith(EVSMV_MAGIC) ? 2 : 1;
    const lines = text.split('\n');
    const pads = new Uint16Array(lines.length);
    const events = [];   // { frame, kind, ... } in file order; frame = frames emulated before it
    let count = 0;
    for (const line of lines) {
        const c = line[0];
        if (c === 'F') pads[count++] = textToPad(line.slice(line.indexOf('|') + 1));
        else if (c === 'W' || c === 'R' || c === 'S') {
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
        meta: { rom: m.rom || '', romSha256: (m['rom.sha256'] || '').toLowerCase(), started: m.started || '', source: m.source || '', cheats: m.cheats || '' },
        warnings: version === 1 && m.cheats === 'yes' ? ['cheats were on while recording: may not sync'] : [],
    };
}

function evsmvHeader({ rom, romSha256, started, source }) {
    const lines = [EVSMV_MAGIC, '# rom: ' + (rom || ''), '# rom.sha256: ' + (romSha256 || ''), '# started: ' + started,
        '# start: power-on, empty SRAM', '# check: every ' + CHECK_EVERY + ' frames'];
    if (source) lines.push('# source: ' + source);
    return lines.join('\n') + '\n';
}

function evsmvTrailer({ frames, cheats }) {
    return '# frames: ' + frames + '\n# cheats: ' + (cheats ? 'yes' : 'no') + '\n';
}

/** Events grouped by the boundary they belong to: Map(frame -> [event]). */
function groupEvents(events) {
    const by = new Map();
    for (const ev of events) {
        const list = by.get(ev.frame);
        if (list) list.push(ev); else by.set(ev.frame, [ev]);
    }
    return by;
}

module.exports = {
    BUTTONS, EVSMV_MAGIC, CHECK_EVERY, WRAM_BASE, WRAM_SIZE, padToText, textToPad, frameLine, parseMovie, evsmvHeader, evsmvTrailer,
    crc32, crcUpdate, crcFinish, crcText, wramCrc, writeLine, resetLine, checkLine, parseEvent, groupEvents,
};
