// Ownership: everything that is not control flow, a memory write or an
// entity — text boxes, audio, screen effects, money, shops and the
// single-byte state pokes.
//
// Ported case-for-case from SoEScriptDumper/list-rooms.cpp. Many of these are
// marked "untraced" upstream: the length is known and decoding continues past
// them, but the description is a guess from watching what they do. That
// distinction is carried through rather than flattened, so the UI can say
// which summaries are solid.

import { read16, read24, u8, u16 } from './addressing';
import { Cursor, OpResult, done, target } from './cursor';
import { currencyName } from './names';

function hx(n: number, width: number): string {
    return (n >>> 0).toString(16).padStart(width, '0');
}

/** Where the game's text blobs live. */
const TEXT_BASE = 0x91d000;

/**
 * 0x50 / 0x51 / 0x52 — show a string from the text table.
 *
 * The dumper also prints the decoded string underneath. That needs the text
 * decompressor, which is a separate job; the pointer and whether it is
 * compressed are reported instead of inventing a rendering.
 */
function showText(c: Cursor, instr: number): OpResult {
    const slot = instr === 0x50 ? c.u8() : null;
    const id = c.u16();
    const addr = TEXT_BASE + id;
    const packed = (read24(c.rom, addr) & 0x800000) ? 'compressed' : 'uncompressed';
    const where = instr === 0x50 ? `(UNWINDOWED) IN #${slot}`
        : instr === 0x51 ? 'WINDOWED' : 'UNWINDOWED';
    return done(c, `SHOW TEXT ${hx(id, 4)} FROM ${target(addr)} ${packed} ${where}`);
}

/** Several instructions are just a run of expression arguments. */
function args(c: Cursor, n: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
        out.push(c.expr());
        if (!c.ok) break;
    }
    return out;
}

/** Decode one system opcode, or null if this module does not own it. */
export function systemOp(c: Cursor, instr: number): OpResult | null {
    switch (instr) {
        case 0x26:
            return done(c, 'UNTRACED INSTR, writing to VRAM', { untraced: true });
        case 0x27:
            return done(c, 'Fade-out screen (WRITE $0b83=0x8000)');

        case 0x30:
        case 0x31:
        case 0x32:
            return done(c, `PLAY SOUND EFFECT ${u8(c.u8())} ??`);
        case 0x33: {
            const track = c.u8();
            return done(c, `PLAY MUSIC ${u8(track)}`, { effects: [{ kind: 'playMusic', track }] });
        }

        case 0x44: case 0x45: case 0x46: case 0x47: {
            const slot = c.u8();
            const x = c.u8();
            const y = c.u8();
            const w = c.u8();
            const h = c.u8();
            return done(c, `UNTRACED INSTR, Open messagebox? slot=${u8(slot)} x=${u8(x)} y=${u8(y)} w=${u8(w)} h=${u8(h)}`, { untraced: true });
        }
        case 0x48: case 0x49: case 0x4a: case 0x4b:
            return done(c, 'UNTRACED INSTR, Open default messagebox?', { untraced: true });
        case 0x4d:
            return done(c, 'NOP');

        case 0x50:
        case 0x51:
        case 0x52:
            return showText(c, instr);
        case 0x54:
            return done(c, `CLEAR TEXT IN #${c.u8()}`);
        case 0x55:
            return done(c, 'CLEAR TEXT');

        case 0x58:
            return done(c, 'FADE IN VOLUME');
        case 0x59:
            return done(c, 'FADE OUT VOLUME');
        case 0x5a:
        case 0x5b:
            return done(c, 'UNTRACED INSTR, checking message timer', { untraced: true });

        case 0x62: {
            const a = c.peek(0);
            const b = read16(c.rom, c.addr + 1);
            const d = read16(c.rom, c.addr + 3);
            c.addr += 5;
            return done(c, `UNTRACED INSTR vals ${u8(a)} ${u16(b)} ${u16(d)}`, { untraced: true });
        }
        case 0x63:
            return done(c, 'SHOW ALCHEMY SELECTION SCREEN');

        case 0x7c:
        case 0x7d: {
            const op = instr === 0x7c ? 'Give' : 'Take';
            const currency = currencyName(c.expr());
            const amount = c.u24();
            if (!c.ok) return done(c, `${op} unknown ${currency} (moniez)`);
            return done(c, `${op} ${amount} ${currency} (moniez)`);
        }
        case 0x84:
        case 0x85: {
            const op = instr === 0x84 ? 'Give' : 'Take';
            const currency = currencyName(c.expr());
            const amount = c.expr();
            if (!c.ok) return done(c, `${op} unknown ${currency} (moniez)`);
            return done(c, `${op} ${amount} ${currency} (moniez)`);
        }
        case 0x7e: {
            const mul = c.expr();
            const src = currencyName(c.expr());
            const div = c.expr();
            const dst = currencyName(c.expr());
            return done(c, `Exchange ${mul} ${src} to ${div} ${dst} (moniez)`);
        }

        case 0x7f:
            return done(c, `SHOW TEXT/NAME INPUT ${u16(c.u16())}`);
        case 0x80:
            return done(c, 'UNHIDE? UNWINDOWED TEXT');
        case 0x81:
            return done(c, 'HIDE UNWINDOWED TEXT');
        case 0x82:
            return done(c, 'Also change visible layers?', { untraced: true });
        case 0x83:
            return done(c, 'Change visible layers, ... based on $7e0f80..7e0f83');

        case 0x86:
        case 0x87:
            return done(c, `SET AUDIO ${instr === 0x86 ? 'volume' : 'speed'} to ${c.expr()}`);

        case 0x88:
            return done(c, 'Clear shopping ring');
        case 0x89: {
            const item = c.expr();
            const price = c.expr();
            return done(c, `Add item ${item} priced ${price} to shop menu`);
        }
        case 0x8a:
            return done(c, `Move shop menu to ${c.expr()}`);
        case 0x8c:
            return done(c, `Show save menu ${u16(c.u16())}`);
        case 0x8d: {
            const mode = c.u8();
            return done(c, `${hx(mode, 2)} ${mode === 0 ? 'Stop' : 'Start'} screen shaking`);
        }

        case 0x91:
            return done(c, `Sets brightness to ${c.expr()}`);

        case 0x97: {
            const a = args(c, 7);
            const text = `INSTR 0x97, 7 sub-instrs: ${a.join(', ')}`;
            return c.ok ? done(c, `UNTRACED ${text}`, { untraced: true }) : done(c, `UNKNOWN ${text}`);
        }
        case 0x99:
            return done(c, `WINDWALK args ${args(c, 6).join(' ')}`, { untraced: true });
        case 0x9a:
            return done(c, `CHANGE FONT TO ${c.expr()}`, { untraced: true });

        case 0x9f:
            return done(c, 'PREPARE CURRENCY DISPLAY');
        case 0xa0:
            return done(c, 'SHOW CURRENCY AMOUNT');
        case 0xa1:
            return done(c, 'HIDE CURRENCY DISPLAY');
        case 0xaa:
            return done(c, 'Clear boy and dog statuses');

        case 0xae: {
            const v = [c.u8(), c.u8(), c.u8(), c.u8()].map((n) => hx(n, 2)).join(' ');
            return done(c, `UNTRACED INSTR, vals ${v} modifies current script`, { untraced: true });
        }

        case 0xb5:
            return done(c, `REVEAL ENTITY?? args ${args(c, 8).join(' ')}`, { untraced: true });
        case 0xb6:
            return done(c, `START TILE FLASHING ${args(c, 4).join(' ')}`);
        case 0xb7:
            return done(c, `STOP TILE FLASHING ${c.expr()}`);

        case 0xbc:
            return done(c, 'Stop/disable boy (and SELECT button)');
        case 0xbd:
            return done(c, 'BOY = Player controlled');
        case 0xbe:
            return done(c, 'Stop/disable doggo (and SELECT button)');
        case 0xbf:
            return done(c, 'DOG = Player controlled');
        case 0xc0:
            return done(c, 'BOY+DOG = STOPPED');
        case 0xc1:
            return done(c, 'BOY+DOG = Player controlled');

        default:
            return null;
    }
}
