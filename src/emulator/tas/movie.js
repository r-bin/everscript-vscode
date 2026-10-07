'use strict';

/**
 * emulator/tas/movie.js
 *
 * Input movies: one row of four 16-bit pad words per emulated frame, in the
 * core's order [port 1 data1, port 1 data2, port 2 data1, port 2 data2]
 * (setJoypadInputs). Bit 15 = B ... bit 4 = R, bits 3-0 = the pad's extra
 * lines; text form is lsnes' "BYsSudlrAXLR0123", one char per bit from bit 15.
 *
 * Two formats are read:
 *   .lsmv  - lsnes movie (zip: "input" + metadata members); gamepad,
 *            gamepad16 and ygamepad(16) ports. Power-on movies only.
 *   .evsmv - this extension's recordings: "# key: value" header / trailer
 *            lines and one "F|pad1[|pad2|pad3|pad4]" line per frame, appended
 *            while playing so a crash loses at most the last batch.
 *
 * ycable: the movie must be fed with setJoypadInputs for every frame (lsnes
 * Y-cable ports, or a recording that branched off such a replay).
 *
 * Pure: no vscode, no fs (callers pass buffers / text).
 */

const zlib = require('zlib');

const BUTTONS = 'BYsSudlrAXLR0123';
const EVSMV_MAGIC = '# Everscript movie 1';
const PADS = 4;

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

/** One .evsmv frame line; extra pads only when any is non-zero. */
function frameLine(p1, p1b, p2, p2b) {
    return (p1b | p2 | p2b)
        ? 'F|' + padToText(p1) + '|' + padToText(p1b) + '|' + padToText(p2) + '|' + padToText(p2b)
        : 'F|' + padToText(p1);
}

// -- zip (store / deflate) -----------------------------------------------------

function readZip(buf) {
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 0x10000 - 22); i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('not a zip archive');
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    const out = new Map();
    for (let n = 0; n < count; n++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad zip central directory');
        const method = buf.readUInt16LE(p + 10);
        const csize = buf.readUInt32LE(p + 20);
        const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
        const local = buf.readUInt32LE(p + 42);
        const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const raw = buf.subarray(start, start + csize);
        if (method === 0) out.set(name, raw);
        else if (method === 8) out.set(name, zlib.inflateRawSync(raw));
        else throw new Error('zip member ' + name + ' uses unsupported method ' + method);
        p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
}

// -- lsnes ---------------------------------------------------------------------

/** Pad fields each lsnes port type contributes, and which core pads they feed. */
function portSlots(type, port) {
    const base = port === 1 ? 0 : 2;
    switch ((type || 'none').trim()) {
        case 'none': return { fields: 0, slots: [] };
        case 'gamepad': case 'gamepad16': return { fields: 1, slots: [base] };
        case 'ygamepad': case 'ygamepad16': return { fields: 2, slots: [base, base + 1] };
        case 'multitap': case 'multitap16': return { fields: 4, slots: [base, null, null, null], lossy: true };
        case 'mouse': case 'superscope': case 'justifier': return { fields: 1, slots: [null], lossy: true };
        case 'justifiers': return { fields: 2, slots: [null, null], lossy: true };
        default: return { fields: 1, slots: [base], lossy: true };
    }
}

function parseLsmv(buf, title) {
    const zip = readZip(buf);
    const text = name => (zip.has(name) ? zip.get(name).toString('utf8').trim() : '');
    if (!zip.has('input')) throw new Error('lsmv has no input member');
    const warnings = [];
    if (zip.has('savestate')) warnings.push('starts from a savestate: played from power-on instead, will not sync');
    const ports = [portSlots(text('port1') || 'gamepad', 1), portSlots(text('port2') || 'none', 2)];
    if (ports.some(p => p.lossy)) warnings.push('port types ' + text('port1') + ' / ' + text('port2') + ' are only partly supported');
    const slots = ports[0].slots.concat(ports[1].slots);

    const lines = zip.get('input').toString('utf8').split('\n');
    const pads = new Uint16Array(lines.length * PADS);
    let count = 0, subframes = 0, resets = 0, ycable = false;
    for (const line of lines) {
        if (!line.trim()) continue;
        const fields = line.split('|');
        if (fields[0][0] !== 'F') { subframes++; continue; }   // extra polls within the frame: core latches once
        if (fields[0][1] === 'R') resets++;
        for (let k = 0; k < slots.length; k++) {
            const slot = slots[k];
            if (slot === null || fields[k + 1] === undefined) continue;
            const word = textToPad(fields[k + 1]);
            pads[count * PADS + slot] = word;
            if (word && (slot & 1)) ycable = true;
        }
        count++;
    }
    if (subframes) warnings.push(subframes + ' subframe input lines ignored');
    if (resets) warnings.push(resets + ' reset frames ignored');
    return {
        title,
        format: 'lsmv',
        pads: pads.subarray(0, count * PADS),
        count,
        ycable: ycable || ports.some(p => p.fields === 2 && !p.lossy),
        meta: {
            game: text('gamename'),
            authors: text('authors'),
            rerecords: text('rerecords'),
            rom: text('rom.hint'),
            romSha256: text('rom.sha256').toLowerCase(),
            core: text('coreversion'),
            emulator: text('systemid'),
        },
        warnings,
    };
}

// -- evsmv ---------------------------------------------------------------------

function parseEvsmvMeta(text) {
    const meta = {};
    for (const line of text.split('\n')) {
        const m = /^# ([a-z0-9.]+): (.*)$/i.exec(line.trim());
        if (m) meta[m[1]] = m[2];
    }
    return meta;
}

function parseEvsmv(text, title) {
    const lines = text.split('\n');
    const pads = new Uint16Array(lines.length * PADS);
    let count = 0, ycable = false;
    for (const line of lines) {
        if (line[0] !== 'F') continue;
        const f = line.split('|');
        for (let k = 0; k < PADS && k + 1 < f.length; k++) {
            const word = textToPad(f[k + 1]);
            pads[count * PADS + k] = word;
            if (word && k) ycable = true;
        }
        count++;
    }
    const m = parseEvsmvMeta(text);
    return {
        title,
        format: 'evsmv',
        pads: pads.subarray(0, count * PADS),
        count,
        ycable: ycable || m.ycable === 'yes',
        meta: { rom: m.rom || '', romSha256: (m['rom.sha256'] || '').toLowerCase(), started: m.started || '', source: m.source || '', cheats: m.cheats || '' },
        warnings: m.cheats === 'yes' ? ['cheats were on while recording: may not sync'] : [],
    };
}

/**
 * ycable: the session fed the core through setJoypadInputs (a 4-pad movie was
 * replayed), which changes what $421C-$421F read; replay must do the same.
 */
function evsmvHeader({ rom, romSha256, started, source, ycable }) {
    const lines = [EVSMV_MAGIC, '# rom: ' + (rom || ''), '# rom.sha256: ' + (romSha256 || ''), '# started: ' + started];
    if (source) lines.push('# source: ' + source);
    if (ycable) lines.push('# ycable: yes');
    return lines.join('\n') + '\n';
}

function evsmvTrailer({ frames, cheats }) {
    return '# frames: ' + frames + '\n# cheats: ' + (cheats ? 'yes' : 'no') + '\n';
}

/** Parse by extension / content. */
function parseMovie(buf, fileName) {
    const title = String(fileName || 'movie').replace(/\.(lsmv|evsmv)$/i, '');
    if (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50) return parseLsmv(buf, title);
    return parseEvsmv(buf.toString('utf8'), title);
}

module.exports = {
    BUTTONS, PADS, EVSMV_MAGIC,
    padToText, textToPad, frameLine,
    readZip, parseLsmv, parseEvsmv, parseEvsmvMeta, evsmvHeader, evsmvTrailer, parseMovie,
};
