// Ownership: ROM in-game string decoding and localized name resolution.
// Pure functions. Decodes strings using the 3002-key table at $C3:D000 ($11D000).

const STRING_KEYS_ADDR = 0x11D000;
const STRING_KEY_COUNT = 3002;

import * as vr from '../variant-resolver';
import { hiromFileOffset } from '../../../platform/snes/hirom';

/** Decode a plain or dictionary-compressed string from the ROM by index; null when there is none. */
function decodeRomString(rom: Uint8Array | Buffer, stringIndex: number): string | null {
    if (!rom || typeof stringIndex !== 'number' || stringIndex < 0) {
        return null;
    }
    const maxCount = vr.getStringKeysCount(rom) || STRING_KEY_COUNT;
    if (stringIndex >= maxCount) return null;

    const baseOffset = vr.getStringKeysOffset(rom) || STRING_KEYS_ADDR;
    const o = baseOffset + stringIndex * 3;
    if (o + 3 > rom.length) return null;

    const v = rom[o] | (rom[o + 1] << 8) | (rom[o + 2] << 16);
    const compressed = !!(v & 0x800000);
    let addr = 0xC00000 + (v & 0x7FFF) + ((v & 0x7F8000) << 1);
    if (addr > 0xCFFFFF) return null;

    const read8 = (a: number): number => hiromFileOffset(a) < rom.length ? rom[hiromFileOffset(a)] : 0;
    const read16 = (a: number): number => read8(a) | (read8(a + 1) << 8);

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
                // An 8-bit shift, as the game's `asl` ($8C:CDC6): bit 7 drops out of the pair index.
                d = (d << 1) & 0xFF;
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
 * The everscript compiler's tokens for a string's control bytes (its text lexer,
 * compiler/ast_everscript.py): `[LF]`, `[PAUSE:3d]`, `[BOY]`, … — the way a script writes the
 * string. A byte it has no token for reads `[0xNN]`.
 */
const TOKENS: Record<number, string> = {
    0x81: '[BOY]', 0x82: '[DOG]', 0x83: '[P3]', 0x84: '[P4]', 0x86: '[B]', 0x87: '[PAGE]', 0x8a: '[CHOICE_RIGHT]', 0x8b: '[CHOICE_INLINE]',
    0x8f: '[NOP]', 0x90: '[BOLD]', 0x91: '[UNBOLD]', 0x92: '[CENTER]', 0x93: '[LEFT]', 0x94: '[RIGHT]', 0x95: '[REPEAT]', 0x96: '[SLOW]',
    0x97: '[UNSLOW]', 0x98: '[INVERTED]', 0xa1: '[MEM1]', 0xa2: '[MEM2]', 0xa3: '[MEM3]', 0x7f: '<-',
    0x5f: '…', 0x7b: '`', 0x7d: '´', 0x7e: '[OK]', 0x5e: '->',
};

function everscriptText(raw: string): string {
    let out = '';
    for (let i = 0; i < raw.length; i++) {
        const c = raw.charCodeAt(i);
        if (c === 0x80 && raw.charCodeAt(i + 2) === 0x80) { out += '[PAUSE:' + raw.charCodeAt(i + 1).toString(16).padStart(2, '0') + ']'; i += 2; continue; }
        if (c === 0x0a) { if (raw.charCodeAt(i + 1) === 0x8b) { out += '[CHOICE]'; i++; } else out += '[LF]'; continue; }
        out += TOKENS[c] ?? (c < 0x20 || c > 0x7e ? '[0x' + c.toString(16).padStart(2, '0') + ']' : raw[i]);
    }
    return out;
}

/** The string a script's text key names ($8C:CCF5 adds the key to the table as a byte offset: 3 bytes a string), in everscript's tokens; null when there is none. */
function dialogueText(rom: Uint8Array | Buffer, key: number): string | null {
    if (key % 3) return null;
    const raw = decodeRomString(rom, key / 3);
    return raw === null ? null : everscriptText(raw);
}

/** Options of the get…Name lookups: the ROM to read in-game strings from, the long name, a name for a miss. */
interface NameOptions { full?: boolean; rom?: Uint8Array | Buffer | null; fallback?: string }

/** A names table entry: our name, and the in-game string that names it when there is one. */
interface NamedEntry { stringIndex?: number | null; name?: string; fullName?: string }

/**
 * Resolve the localized name for an entry. If entry has a stringIndex and rom is provided,
 * tries reading the in-game string from ROM; otherwise falls back to the subjective name.
 */
function resolveLocalizedName(entry: NamedEntry | string | null | undefined, rom?: Uint8Array | Buffer | null, fallbackProp: string = 'name'): string {
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    if (rom && entry.stringIndex !== undefined && entry.stringIndex !== null) {
        const inGame = decodeRomString(rom, entry.stringIndex);
        if (inGame) return inGame;
    }
    const own = (entry as unknown as Record<string, unknown>)[fallbackProp];
    return (typeof own === 'string' && own) || entry.name || entry.fullName || '';
}

export type { NamedEntry, NameOptions };
export { STRING_KEYS_ADDR, STRING_KEY_COUNT, decodeRomString, everscriptText, dialogueText, resolveLocalizedName };

