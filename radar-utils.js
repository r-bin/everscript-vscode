'use strict';

/**
 * radar-utils.js — pure helper functions for the Memory Radar.
 * No VS Code API dependency; importable from tests.
 *
 * Region definitions (from linker main.evs):
 *   temp    0x2834–0x28FF  compiler TEMP RAM (cleared on room load)
 *   session 0x2200–0x27FF  cross-room persistent SRAM vars
 *   sram    [SRAM]-tagged  battery-backed save (by tag, outside temp/session)
 *   system  everything else
 */

function radarLifecycle(addr, type, notes) {
    if (addr >= 0x2834 && addr <= 0x28FF) return 'temp';
    if (addr >= 0x2200 && addr <= 0x27FF) return 'session';
    const hay = (String(type) + ' ' + String(notes)).toLowerCase();
    if (hay.includes('sram')) return 'sram';
    return 'system';
}

function radarH(n) {
    return '0x' + n.toString(16).toUpperCase().padStart(4, '0');
}

function radarEsc(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function radarExtractEmoji(str) {
    const m = String(str).match(/\p{Extended_Pictographic}/u);
    return m ? m[0] : '';
}

/**
 * Split a memory-map name cell on <br> separators, strip remaining HTML tags.
 * Returns an array of trimmed non-empty strings.
 * E.g. "⚙️ B-trigger (0x01)<br>⚙️ Switch (0x02)" → ["⚙️ B-trigger (0x01)", "⚙️ Switch (0x02)"]
 */
function radarParseName(rawName) {
    return String(rawName)
        .split(/<br\s*\/?>/gi)
        .map(s => s.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean);
}

/**
 * Convert <br> to '\n', strip remaining HTML tags, normalise whitespace.
 */
function radarParseNotes(rawNotes) {
    return String(rawNotes)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

module.exports = {
    radarLifecycle,
    radarH,
    radarEsc,
    radarExtractEmoji,
    radarParseName,
    radarParseNotes,
};
