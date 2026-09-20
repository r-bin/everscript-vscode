// Ownership: the script operand grammar — "sub-instructions". Pure.
//
// A faithful port of `buf_parse_sub` in SoEScriptDumper/list-rooms.cpp.
//
// This is the piece the previous decoder did not have, and the reason it
// derailed on 53% of scripts: an operand is not a fixed-width field, it is a
// little postfix expression whose length depends on its own contents. An
// `IF` (0x09) carrying `$22f1 & 0x40` is a different size from one carrying
// `arg3`, so anything assuming a fixed size loses instruction alignment the
// first time a script does arithmetic, and every byte after that is noise.
//
// The encoding, one byte at a time until a byte with bit 7 set ends it:
//
//   - entity tokens (0x50..0x53, 0x2d, 0x2e, with or without bit 7) name an
//     actor: boy, dog, controlled char, ...
//   - `b & 0x70` in {0x30, 0x40, 0x60} is a small inline constant, so the
//     common cases (-16..31) cost a single byte
//   - anything else is an operator from the table below, some of which eat a
//     further one or two bytes
//
// Operators pop from a stack that `0x29` pushes to. The stack is *not* reset
// between operands — upstream notes the game's own scripts rely on leaving
// values on it — so it belongs to the decode run, not to one call.

import { read8, read16, ramAddr, u8, u16 } from './addressing';

/** Result of parsing one operand expression. */
export interface Expression {
    /** Rendered form, matching the dumper's text. */
    text: string;
    /** Bytes consumed. */
    length: number;
    /** False once something unparseable appeared; the caller must stop. */
    ok: boolean;
    /**
     * Rough token count, used only to decide bracketing: >1 means the text is
     * compound and gets wrapped when it becomes an operand of something else.
     */
    weight: number;
}

/**
 * Operand stack shared across one decode run.
 *
 * Upstream keeps this in a function-level static, deliberately: scripts push
 * in one operand and pop in a later one. Clearing it per operand would change
 * how real scripts render, so it is threaded through instead of hidden.
 */
export class OperandStack {
    private items: Array<{ weight: number; text: string }> = [];

    push(weight: number, text: string): void { this.items.push({ weight, text }); }
    pop(): { weight: number; text: string } | undefined { return this.items.pop(); }
    get empty(): boolean { return this.items.length === 0; }
    clear(): void { this.items = []; }
}

/** Entity tokens, by the low 7 bits. */
const ENTITY_NAMES: Record<number, string> = {
    0x50: 'boy',
    0x51: 'dog',
    0x52: 'controlled char',
    0x53: 'non-controlled char',
    0x2d: 'last entity ($0341)',
    0x2e: 'entity attached to script?',
};

/** Only these name an actor; the rest of the 0x2x/0x5x range are operators. */
function isEntity(b: number): boolean {
    switch ((b | 0x80) & 0xff) {
        case 0xd0: case 0xd1: case 0xd2: case 0xd3: case 0xad: case 0xae: return true;
        default: return false;
    }
}

/** Small inline constants: 0x3n is 0..15, 0x4n is -16..-1, 0x6n is 16..31. */
function isInlineValue(b: number): boolean {
    const cmd = b & 0x70;
    return cmd === 0x30 || cmd === 0x40 || cmd === 0x60;
}

function inlineValue(b: number): number {
    const cmd = b & 0x70;
    if (cmd === 0x30) return b & 0x0f;
    if (cmd === 0x40) return (0xfff0 | (b & 0x0f)) & 0xffff;
    return 0x10 + (b & 0x0f);
}

/** Reinterpret as signed 16-bit, which is how the dumper prints constants. */
function signed16(n: number): number {
    return (n & 0x8000) ? n - 0x10000 : n;
}

/** Binary operators, by low 7 bits. Each pops one value off the stack. */
const BINARY_OPS: Record<number, string> = {
    0x17: ' * ', 0x18: ' / ', 0x1a: ' + ', 0x1b: ' - ',
    0x1c: '<<', 0x1d: '>>',
    0x1e: ' < ', 0x1f: ' > ', 0x20: ' <= ', 0x21: ' >= ',
    0x22: ' == ', 0x23: ' != ',
    0x24: ' & ', 0x25: ' | ', 0x26: ' ^ ', 0x27: ' || ', 0x28: ' && ',
};

/** Sub-instructions upstream flags as never legitimately appearing. */
const INVALID = new Set([0x51, 0x19, 0x2f, 0x5d, 0x5e, 0x5f]);

/** Temp variables live at a different base than the main ones. */
const BASE_MAIN = 0x2258;
const BASE_TEMP = 0x2834;

/**
 * Parse one operand expression starting at `addr` (a SNES address).
 *
 * Never throws and never runs away: an unknown byte sets `ok` false and the
 * caller stops decoding that script, exactly as upstream does.
 */
export function parseExpression(
    rom: Uint8Array,
    addr: number,
    stack: OperandStack,
): Expression {
    const start = addr;
    let res = '';
    let weight = 0;
    let ok = true;
    let done = false;
    // A malformed stream could otherwise loop until the ROM ends.
    let guard = 0;

    const join = (s: string): void => { res = res ? res + ' ' + s : s; };
    const wrap = (): string => (weight > 1 ? '(' + res + ')' : res);

    do {
        if (guard++ > 256) { ok = false; break; }
        const raw = read8(rom, addr++);
        done = (raw & 0x80) !== 0;

        if (isEntity(raw)) {
            weight++;
            join(ENTITY_NAMES[raw & 0x7f] || '???');
            continue;
        }
        if (isInlineValue(raw)) {
            weight++;
            join(String(signed16(inlineValue(raw))));
            continue;
        }

        const op = raw & 0x7f;
        if (BINARY_OPS[op] !== undefined) {
            const pulled = stack.pop();
            if (!pulled) { ok = false; break; }
            const a = pulled.weight > 1 ? '(' + pulled.text + ')' : pulled.text;
            res = a + BINARY_OPS[op] + wrap();
            weight = 2;
            continue;
        }

        switch (op) {
            case 0x00: // no-op
                break;

            case 0x01: // signed const byte
            case 0x02: // unsigned const byte
                weight++;
                join(u8(read8(rom, addr++)));
                if (op === 0x01) res += ' signed';
                break;

            case 0x03: // signed const word
            case 0x04: // unsigned const word
                weight++;
                join(u16(read16(rom, addr)));
                addr += 2;
                if (op === 0x03) res += ' signed';
                break;

            case 0x05: // test bit
            case 0x0a: // test temp bit
            {
                const base = op >= 0x0a ? BASE_TEMP : BASE_MAIN;
                const word = read16(rom, addr);
                addr += 2;
                res += ramAddr(base + (word >> 3)) + '&' + u8(1 << (word & 0x07));
                weight = 2;
                break;
            }

            case 0x06: case 0x07: // read byte / word from a variable
            case 0x08: case 0x09:
            case 0x0b: case 0x0c: // ... and the temp bank
            case 0x0d: case 0x0e:
            {
                const isByte = op === 0x06 || op === 0x07 || op === 0x0b || op === 0x0c;
                const base = op >= 0x0a ? BASE_TEMP : BASE_MAIN;
                weight++;
                // Upstream assigns rather than appends here, dropping anything
                // already accumulated. Kept, so the text matches.
                res = ramAddr(base + read16(rom, addr));
                addr += 2;
                if (isByte) { res = '(' + res + ')&0xff'; weight = 2; }
                break;
            }

            case 0x0f: // script argument bit
            {
                const b = read8(rom, addr++);
                join('arg' + (b >> 3) + '&' + u8(1 << (b & 0x07)));
                weight = 2;
                break;
            }

            case 0x10: case 0x11: // script argument, byte
            case 0x12: case 0x13: // script argument, word
            {
                const isByte = op === 0x10 || op === 0x11;
                const isSigned = op === 0x10 || op === 0x12;
                weight++;
                join((isSigned ? 'signed arg' : 'arg') + read8(rom, addr++));
                if (isByte) { res += '&0xff'; weight = 2; }
                break;
            }

            case 0x14: // boolean invert
            case 0x15: // bitwise invert
            case 0x16: // negate
                res = (op === 0x14 ? '!' : op === 0x15 ? '~' : '-') + wrap();
                weight = 2;
                break;

            case 0x29: // push
                stack.push(weight, res);
                res = '';
                weight = 0;
                break;

            case 0x2a: // random word
                weight++;
                join('RAND');
                break;

            case 0x2b: // random in [0, res)
                res = 'RANDRANGE(0,<' + res + ')';
                weight = 1;
                break;

            case 0x2c: // dialog response
                if (!res) { res = 'Dialog response'; weight = 1; }
                else { res = 'Dialog response (preselect ' + res + ')'; weight = 2; }
                break;

            case 0x54: // script data word 9
                weight++;
                join('script[0x9]');
                break;

            case 0x55: // dereference
            case 0x56: // dereference, byte
                res = weight > 1 ? '*(' + res + ')' : '*' + res;
                weight = 1;
                if (op === 0x56) { res = '(' + res + ')&0xff'; weight = 2; }
                break;

            case 0x57:
                weight++;
                join('(player==dog)');
                break;

            case 0x58: // game timer, low half
                weight += 2;
                join('GameTimer&0xffff');
                break;

            case 0x59: // game timer, high half
                weight += 2;
                join('GameTimer>>16');
                break;

            case 0x5a:
                weight++;
                join('Shop buy result');
                break;

            case 0x5b:
                weight++;
                join('Shop sell result');
                break;

            case 0x5c: // next damage is lethal
                res = weight > 1 ? '(' + res + ') will die' : res + ' will die';
                weight = 2;
                break;

            default:
                join(INVALID.has(op) ? '[invalid ' + u8(op) + ']' : '[unknown ' + u8(op) + ']');
                ok = false;
                break;
        }
    } while (ok && !done);

    // Upstream leaves a non-empty stack alone (real scripts rely on it) but
    // throws it away after a parse failure, so a later operand does not pop
    // something that was never meant for it.
    if (!ok) stack.clear();

    return { text: res, length: addr - start, ok, weight };
}
