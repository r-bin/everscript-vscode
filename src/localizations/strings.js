'use strict';
// Ownership: ROM in-game string decoding and localized name resolution.
// Pure functions. Decodes strings using the 3002-key table at $C3:D000 ($11D000).

const STRING_KEYS_ADDR = 0x11D000;
const STRING_KEY_COUNT = 3002;

/**
 * Decode a plain or dictionary-compressed string from the ROM by index (0..3001).
 *
 * @param {Uint8Array|Buffer} rom
 * @param {number} stringIndex
 * @returns {string|null}
 */
function decodeRomString(rom, stringIndex) {
    if (!rom || typeof stringIndex !== 'number' || stringIndex < 0 || stringIndex >= STRING_KEY_COUNT) {
        return null;
    }
    const o = STRING_KEYS_ADDR + stringIndex * 3;
    if (o + 3 > rom.length) return null;

    const v = rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16);
    const compressed = !!(v & 0x800000);
    let addr = 0xC00000 + (v & 0x7FFF) + ((v & 0x7F8000) << 1);
    if (addr > 0xCFFFFF) return null;

    const read8 = a => (a & 0x3FFFFF) < rom.length ? rom[a & 0x3FFFFF] : 0;
    const read16 = a => read8(a) | (read8(a + 1) << 8);

    let result = '';
    if (compressed) {
        let nextPlain = 0;
        while (true) {
            let d = read8(addr);
            if (nextPlain) {
                nextPlain--;
                if (!d && !nextPlain) break;
                result += String.fromCharCode(d);
            } else if (d === 0xC0) {
                addr++;
                const wordpp = 0x91F46C + (read8(addr) << 1);
                let wordp = 0x91F7D5 + read16(wordpp);
                for (let c; (c = read8(wordp)); wordp++) result += String.fromCharCode(c);
            } else if ((d & 0xC0) === 0xC0) {
                d = (d << 1) & 0x7E;
                const wordpp = 0x91F3EC + d;
                let wordp = 0x91F66C + read16(wordpp);
                for (let c; (c = read8(wordp)); wordp++) result += String.fromCharCode(c);
            } else if ((d & 0xC0) === 0x40) {
                nextPlain = d & 0x3F;
            } else if ((d & 0xC0) === 0x80) {
                d <<= 1;
                const c1 = read8(0x91F32E + d);
                result += String.fromCharCode(c1);
                const c2 = read8(0x91F32F + d);
                if (!c2) break;
                result += String.fromCharCode(c2);
            } else if ((d & 0xC0) === 0x00) {
                const c = read8(0x91F3AE + d);
                if (!c) break;
                result += String.fromCharCode(c);
            }
            addr++;
        }
    } else {
        for (let c; (c = read8(addr)); addr++) {
            result += String.fromCharCode(c);
        }
    }
    return result;
}

/**
 * Resolve the localized name for an entry. If entry has a stringIndex and rom is provided,
 * tries reading the in-game string from ROM; otherwise falls back to the subjective name.
 *
 * @param {object|string} entry
 * @param {Uint8Array|Buffer|null} [rom]
 * @param {string} [fallbackProp='name']
 * @returns {string}
 */
function resolveLocalizedName(entry, rom, fallbackProp = 'name') {
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    if (rom && entry.stringIndex !== undefined && entry.stringIndex !== null) {
        const inGame = decodeRomString(rom, entry.stringIndex);
        if (inGame) return inGame;
    }
    return entry[fallbackProp] || entry.name || entry.fullName || '';
}

module.exports = {
    STRING_KEYS_ADDR,
    STRING_KEY_COUNT,
    decodeRomString,
    resolveLocalizedName,
};

