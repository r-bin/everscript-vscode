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
 * Pure: no vscode, no fs (callers pass buffers / text).
 */

const BUTTONS = 'BYsSudlrAXLR0123';
const EVSMV_MAGIC = '# Everscript movie 1';

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

/** Throws unless the text is an .evsmv recording. */
function parseMovie(text, fileName) {
    if (!text.startsWith(EVSMV_MAGIC)) throw new Error('not an Everscript recording');
    const lines = text.split('\n');
    const pads = new Uint16Array(lines.length);
    let count = 0;
    for (const line of lines) {
        if (line[0] === 'F') pads[count++] = textToPad(line.slice(line.indexOf('|') + 1));
    }
    const m = parseMeta(text);
    return {
        title: String(fileName || 'movie').replace(/\.evsmv$/i, ''),
        pads: pads.subarray(0, count),
        count,
        meta: { rom: m.rom || '', romSha256: (m['rom.sha256'] || '').toLowerCase(), started: m.started || '', source: m.source || '', cheats: m.cheats || '' },
        warnings: m.cheats === 'yes' ? ['cheats were on while recording: may not sync'] : [],
    };
}

function evsmvHeader({ rom, romSha256, started, source }) {
    const lines = [EVSMV_MAGIC, '# rom: ' + (rom || ''), '# rom.sha256: ' + (romSha256 || ''), '# started: ' + started];
    if (source) lines.push('# source: ' + source);
    return lines.join('\n') + '\n';
}

function evsmvTrailer({ frames, cheats }) {
    return '# frames: ' + frames + '\n# cheats: ' + (cheats ? 'yes' : 'no') + '\n';
}

module.exports = { BUTTONS, EVSMV_MAGIC, padToText, textToPad, frameLine, parseMovie, evsmvHeader, evsmvTrailer };
